import { formatPhone } from '@/lib/utils';

function WhatsappIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.115-2.908-6.993-1.879-1.878-4.36-2.908-6.999-2.91-5.45 0-9.88 4.421-9.884 9.867-.001 1.73.457 3.419 1.32 4.933l-.994 3.634 3.782-.992zm10.963-7.534c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.669.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.15-.174.2-.298.3-.496.1-.198.05-.371-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.568-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    </svg>
  );
}

interface ContactCellProps {
  whatsapp?: string | null;
  email?: string | null;
}

/**
 * Celula de contato padronizada das tabelas de membros (gerenciamento e visualizacao):
 * icone do WhatsApp + telefone formatado e, abaixo, o email.
 */
export function ContactCell({ whatsapp, email }: ContactCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {whatsapp ? (
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <WhatsappIcon />
          {formatPhone(whatsapp)}
        </span>
      ) : (
        <span className="text-sm text-gray-300">—</span>
      )}
      {email && <span className="text-xs text-gray-400">{email}</span>}
    </div>
  );
}
