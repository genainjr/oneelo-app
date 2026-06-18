/**
 * Avatar circular com as iniciais do nome, usado na coluna "Nome" das
 * tabelas de membros (gerenciamento e visualizacao).
 */
export function InitialsAvatar({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs uppercase shrink-0">
      {name.substring(0, 2)}
    </div>
  );
}
