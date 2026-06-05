'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DATE_FNS_LOCALES, formatDate, formatDateTime } from '@/lib/utils';

export function useDateFormatter() {
  const locale = useLocale();
  const t = useTranslations('common');
  const dfLocale = DATE_FNS_LOCALES[locale] ?? DATE_FNS_LOCALES['pt-BR'];

  return {
    formatDate: (date: string | Date | null | undefined, fmt?: string) =>
      formatDate(date, fmt, dfLocale),
    formatDateTime: (date: string | Date | null | undefined) =>
      formatDateTime(date, t('at'), dfLocale),
  };
}
