'use client';

import { SearchCombobox } from './search-combobox';

export interface MembroOption {
  id: string;
  nome: string;
  email?: string | null;
  whatsapp?: string | null;
}

interface MembroSearchComboboxProps {
  label: string;
  optionalLabel?: string;
  placeholder: string;
  loading?: boolean;
  options: MembroOption[];
  selected: MembroOption | null;
  search: string;
  emptyMessage: string;
  selectedPrefix?: string;
  onSearchChange: (value: string) => void;
  onSelect: (membro: MembroOption) => void;
  onClear: () => void;
}

export function MembroSearchCombobox(props: MembroSearchComboboxProps) {
  return (
    <SearchCombobox
      {...props}
      loadingPlaceholder="Carregando membros..."
      getSecondaryText={(membro) => membro.email}
    />
  );
}
