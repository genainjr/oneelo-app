import { ComingSoon } from '@/components/app/coming-soon';

export default function GruposPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ComingSoon
        title="Grupo de Crescimento"
        description="Gerencie células e grupos pequenos, acompanhe frequência, crescimento e multiplicação dos grupos da sua igreja."
        phase="Fase 4"
        icon={
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        }
        features={[
          {
            label: 'Cadastro de grupos',
            description: 'Registre líderes, membros e endereço de cada grupo com todos os dados de contato.',
          },
          {
            label: 'Controle de frequência',
            description: 'Lance presença por encontro e visualize o histórico de participação de cada membro.',
          },
          {
            label: 'Relatório de crescimento',
            description: 'Acompanhe a evolução do número de membros por grupo ao longo do tempo.',
          },
          {
            label: 'Multiplicação de grupos',
            description: 'Registre divisões de grupos e visualize a árvore de multiplicação da célula.',
          },
          {
            label: 'Agenda de encontros',
            description: 'Sincronize os encontros dos grupos com a agenda geral da igreja.',
          },
          {
            label: 'Integração com Membros',
            description: 'Vincule cada participante do grupo ao seu cadastro pastoral existente.',
          },
        ]}
      />
    </div>
  );
}
