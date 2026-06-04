import { ComingSoon } from '@/components/app/coming-soon';

export default function IntegracoesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ComingSoon
        title="Integrações"
        description="Conecte o portal com as ferramentas que sua equipe já usa — WhatsApp, Google Agenda e muito mais."
        phase="Fase 1"
        icon={
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        }
        features={[
          {
            label: 'WhatsApp',
            description: 'Envie confirmações de escala, lembretes de eventos e avisos diretamente pelo WhatsApp.',
          },
          {
            label: 'Google Agenda',
            description: 'Ao ser escalado, o evento aparece automaticamente no Google Agenda do membro.',
          },
          {
            label: 'Notificações automáticas',
            description: 'Configure lembretes de 24h antes de cada evento para toda a equipe escalada.',
          },
          {
            label: 'Avisos por ministério',
            description: 'Envie mensagens segmentadas para os membros de um ministério específico.',
          },
        ]}
      />
    </div>
  );
}
