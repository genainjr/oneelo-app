import { formatPhone } from '@/lib/utils';

interface ContactCellProps {
  whatsapp?: string | null;
  email?: string | null;
}

/**
 * Celula de contato padronizada das tabelas de membros (gerenciamento e visualizacao).
 * Mostra telefone formatado e, abaixo, o email quando existir.
 */
export function ContactCell({ whatsapp, email }: ContactCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {whatsapp ? (
        <span className="text-sm font-medium text-gray-700">
          {formatPhone(whatsapp)}
        </span>
      ) : (
        <span className="text-sm text-gray-300">-</span>
      )}
      {email && <span className="text-xs text-gray-400">{email}</span>}
    </div>
  );
}
