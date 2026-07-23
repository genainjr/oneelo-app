'use client';

import { SearchCombobox } from './search-combobox';

export interface MembroOption {
  id: string;
  nome: string;
  nomeExibicao?: string | null;
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

export function getMembroPrintName(membro: Pick<MembroOption, 'nome' | 'nomeExibicao'>) {
  const nomeExibicao = membro.nomeExibicao?.trim();
  if (nomeExibicao) return nomeExibicao;
  return membro.nome.trim().split(/\s+/)[0] || membro.nome;
}

export function MembroSearchCombobox(props: MembroSearchComboboxProps) {
  return (
    <SearchCombobox
      {...props}
      loadingPlaceholder="Carregando membros..."
      getDisplayText={getMembroPrintName}
      getSecondaryText={(membro) => membro.email}
    />
  );
}
