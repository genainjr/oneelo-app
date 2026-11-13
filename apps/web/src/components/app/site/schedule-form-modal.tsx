'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import type { ModalidadeCulto, PublicChurchSchedule } from '@/lib/api-website';
import { ModalError, ModalFooter, ModalShell } from '@/components/app/modal-shell';
import {
  CheckboxField,
  InputField,
  SelectField,
  TextareaField,
} from '@/components/app/form-field';

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
] as const;

export const MODALIDADE_OPTIONS: Array<{ value: ModalidadeCulto; label: string }> = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'HIBRIDO', label: 'Híbrido (Presencial e Online)' },
];

interface ScheduleFormModalProps {
  isOpen: boolean;
  schedule: PublicChurchSchedule | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function ScheduleFormModal({
  isOpen,
  schedule,
  onClose,
  onSaved,
}: ScheduleFormModalProps) {
  if (!isOpen) return null;

  return (
    <ScheduleFormModalContent
      key={schedule?.id ?? 'new'}
      isOpen={isOpen}
      schedule={schedule}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ScheduleFormModalContent({
  isOpen,
  schedule,
  onClose,
  onSaved,
}: ScheduleFormModalProps) {
  const [diaSemana, setDiaSemana] = useState<number>(schedule?.diaSemana ?? 0);
  const [horario, setHorario] = useState(schedule?.horario ?? '');
  const [titulo, setTitulo] = useState(schedule?.titulo ?? '');
  const [modalidade, setModalidade] = useState<ModalidadeCulto>(
    schedule?.modalidade ?? 'PRESENCIAL',
  );
  const [descricao, setDescricao] = useState(schedule?.descricao ?? '');
  const [ativo, setAtivo] = useState(schedule?.ativo ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!horario.trim()) {
      setError('Informe o horário do culto ou reunião.');
      return;
    }

    if (!titulo.trim()) {
      setError('Informe o título do culto ou reunião.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        diaSemana,
        horario: horario.trim(),
        titulo: titulo.trim(),
        modalidade,
        descricao: descricao.trim() || null,
        ativo,
      };

      if (schedule) {
        await api.put(`/api/site/cultos/${schedule.id}`, payload);
      } else {
        await api.post('/api/site/cultos', payload);
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'Não foi possível salvar o horário de culto.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title={schedule ? 'Editar Horário de Culto' : 'Novo Horário de Culto'}
      description="Defina o dia, horário e modalidade exibidos na programação pública."
      icon={<CalendarClock className="h-5 w-5" />}
      onClose={onClose}
      size="md"
      footer={
        <ModalFooter
          form="church-schedule-form"
          primaryLabel={schedule ? 'Salvar Alterações' : 'Cadastrar Horário'}
          onCancel={onClose}
          loading={loading}
        />
      }
    >
      <form id="church-schedule-form" onSubmit={handleSubmit}>
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="schedule-weekday"
              label="Dia da Semana"
              required
              value={String(diaSemana)}
              onChange={(e) => setDiaSemana(Number(e.target.value))}
            >
              {WEEKDAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <InputField
              id="schedule-time"
              label="Horário"
              required
              placeholder="Ex: 19:00 ou 09h30"
              maxLength={40}
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
            />
          </div>

          <InputField
            id="schedule-title"
            label="Nome do Culto / Reunião"
            required
            placeholder="Ex: Culto da Família"
            maxLength={120}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />

          <SelectField
            id="schedule-mode"
            label="Modalidade"
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value as ModalidadeCulto)}
          >
            {MODALIDADE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <TextareaField
            id="schedule-description"
            label="Descrição"
            optionalLabel="(opcional)"
            placeholder="Detalhes para visitantes, como ministério infantil disponível ou transmissão ao vivo."
            maxLength={400}
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />

          <CheckboxField
            id="schedule-active"
            label="Exibir no site público"
            helperText="Desmarque para ocultar temporariamente sem excluir o registro."
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        </div>
      </form>
    </ModalShell>
  );
}
