export const FINANCIAL_BATCH_MAX_OCCURRENCES = 120;

export type FinancialRecurrenceFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUAL';
export type FinancialAmountDistributionMode = 'REPEAT' | 'SPLIT';
export type FinancialBatchEndCondition = 'COUNT' | 'UNTIL_DATE';

export const RECURRENCE_FREQUENCY_LABELS: Record<FinancialRecurrenceFrequency, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  ANNUAL: 'Anual',
};

export const AMOUNT_DISTRIBUTION_LABELS: Record<FinancialAmountDistributionMode, string> = {
  REPEAT: 'Repetir valor por parcela',
  SPLIT: 'Dividir valor total entre parcelas',
};

export type GeneratedFinancialOccurrence = {
  dateKey: string;
  dateIso: string;
  amount: number;
  status: 'PENDING' | 'DRAFT' | 'CONFIRMED';
  installmentNumber: number;
  totalInstallments: number;
};

export type GenerateFinancialBatchInput = {
  startDate: string;
  frequency: FinancialRecurrenceFrequency;
  endCondition: FinancialBatchEndCondition;
  count: number;
  untilDate?: string;
  amountMode: FinancialAmountDistributionMode;
  amount: number;
  excludedDateKeys?: Set<string>;
  baseStatus: 'PENDING' | 'DRAFT';
  confirmFirst?: boolean;
};

export type GenerateFinancialBatchResult = {
  occurrences: GeneratedFinancialOccurrence[];
  rawCount: number;
  totalAmount: number;
  error: string | null;
};

export function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatUtcDateKey(year: number, monthOneBased: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(monthOneBased).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addFrequencyStep(
  startDateKey: string,
  frequency: FinancialRecurrenceFrequency,
  step: number,
): string {
  const parsed = parseDateKey(startDateKey);
  if (!parsed) throw new Error('Data inicial inválida.');

  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    const intervalDays = frequency === 'WEEKLY' ? 7 : 14;
    const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + step * intervalDays));
    return next.toISOString().slice(0, 10);
  }

  if (frequency === 'MONTHLY') {
    const zeroBasedMonth = parsed.month - 1 + step;
    const targetYear = parsed.year + Math.floor(zeroBasedMonth / 12);
    const targetMonthZero = ((zeroBasedMonth % 12) + 12) % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthZero + 1, 0)).getUTCDate();
    const clampedDay = Math.min(parsed.day, daysInTargetMonth);
    return formatUtcDateKey(targetYear, targetMonthZero + 1, clampedDay);
  }

  const targetYear = parsed.year + step;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, parsed.month, 0)).getUTCDate();
  const clampedDay = Math.min(parsed.day, daysInTargetMonth);
  return formatUtcDateKey(targetYear, parsed.month, clampedDay);
}

export function toMiddayIso(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toISOString();
}

export function generateFinancialBatchOccurrences(
  input: GenerateFinancialBatchInput,
): GenerateFinancialBatchResult {
  const start = parseDateKey(input.startDate);
  if (!start) {
    return {
      occurrences: [],
      rawCount: 0,
      totalAmount: 0,
      error: input.startDate ? 'Data inicial inválida.' : null,
    };
  }

  const generatedDates: string[] = [];

  if (input.endCondition === 'COUNT') {
    if (!Number.isInteger(input.count) || input.count < 1) {
      return {
        occurrences: [],
        rawCount: 0,
        totalAmount: 0,
        error: 'Informe pelo menos 1 ocorrência.',
      };
    }
    if (input.count > FINANCIAL_BATCH_MAX_OCCURRENCES) {
      return {
        occurrences: [],
        rawCount: 0,
        totalAmount: 0,
        error: `O lote pode conter no máximo ${FINANCIAL_BATCH_MAX_OCCURRENCES} ocorrências.`,
      };
    }
    for (let step = 0; step < input.count; step += 1) {
      generatedDates.push(addFrequencyStep(input.startDate, input.frequency, step));
    }
  } else {
    if (!input.untilDate) {
      return { occurrences: [], rawCount: 0, totalAmount: 0, error: null };
    }
    const until = parseDateKey(input.untilDate);
    if (!until) {
      return {
        occurrences: [],
        rawCount: 0,
        totalAmount: 0,
        error: 'Data limite inválida.',
      };
    }
    if (input.untilDate < input.startDate) {
      return {
        occurrences: [],
        rawCount: 0,
        totalAmount: 0,
        error: 'A data limite deve ser igual ou posterior à data inicial.',
      };
    }

    for (let step = 0; ; step += 1) {
      const nextDateKey = addFrequencyStep(input.startDate, input.frequency, step);
      if (nextDateKey > input.untilDate) break;
      generatedDates.push(nextDateKey);
      if (generatedDates.length > FINANCIAL_BATCH_MAX_OCCURRENCES) {
        return {
          occurrences: [],
          rawCount: generatedDates.length,
          totalAmount: 0,
          error: `O período gera mais de ${FINANCIAL_BATCH_MAX_OCCURRENCES} ocorrências. Reduza a data limite.`,
        };
      }
    }
  }

  const excluded = input.excludedDateKeys ?? new Set<string>();
  const activeDates = generatedDates.filter((dateKey) => !excluded.has(dateKey));
  const totalCents = Number.isFinite(input.amount) ? Math.round(input.amount * 100) : 0;

  if (totalCents <= 0) {
    return {
      occurrences: [],
      rawCount: generatedDates.length,
      totalAmount: 0,
      error: null,
    };
  }

  if (activeDates.length === 0) {
    return {
      occurrences: [],
      rawCount: generatedDates.length,
      totalAmount: 0,
      error: null,
    };
  }

  if (input.amountMode === 'SPLIT' && totalCents < activeDates.length) {
    return {
      occurrences: [],
      rawCount: generatedDates.length,
      totalAmount: 0,
      error: 'O valor total deve ser suficiente para gerar parcelas de pelo menos R$ 0,01.',
    };
  }

  const totalInstallments = activeDates.length;
  const baseSplitCents = input.amountMode === 'SPLIT' ? Math.floor(totalCents / totalInstallments) : totalCents;
  const remainderCents =
    input.amountMode === 'SPLIT' ? totalCents - baseSplitCents * totalInstallments : 0;

  let sumCents = 0;
  const occurrences: GeneratedFinancialOccurrence[] = activeDates.map((dateKey, index) => {
    const isLast = index === totalInstallments - 1;
    const itemCents =
      input.amountMode === 'SPLIT' && isLast ? baseSplitCents + remainderCents : baseSplitCents;
    sumCents += itemCents;

    return {
      dateKey,
      dateIso: toMiddayIso(dateKey),
      amount: itemCents / 100,
      status: index === 0 && input.confirmFirst ? 'CONFIRMED' : input.baseStatus,
      installmentNumber: index + 1,
      totalInstallments,
    };
  });

  return {
    occurrences,
    rawCount: generatedDates.length,
    totalAmount: sumCents / 100,
    error: null,
  };
}
