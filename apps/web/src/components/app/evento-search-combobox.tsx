'use client';

import type { StatusEvento } from '@/types';
import { SearchCombobox } from './search-combobox';

export type EventoOption = {
  id: string;
  titulo: string;
  dataInicio: string;
  dataFim?: string | null;
  local?: string | null;
  status: StatusEvento;
};

const eventDateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

interface EventoSearchComboboxProps {
  label: string;
  optionalLabel?: string;
  placeholder: string;
  loading?: boolean;
  options: EventoOption[];
  selected: EventoOption | null;
  search: string;
  emptyMessage: string;
  selectedPrefix?: string;
  onSearchChange: (value: string) => void;
  onSelect: (evento: EventoOption) => void;
  onClear: () => void;
}

export function getEventoDisplayName(evento: EventoOption) {
  return `${evento.titulo} - ${eventDateFormatter.format(new Date(evento.dataInicio))}`;
}

export function EventoSearchCombobox(props: EventoSearchComboboxProps) {
  return (
    <SearchCombobox
      {...props}
      loadingPlaceholder="Carregando eventos..."
      getDisplayText={getEventoDisplayName}
      getSecondaryText={(evento) => evento.local}
    />
  );
}
