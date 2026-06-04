import { ComingSoon } from '@/components/app/coming-soon';

export default function MidiaPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ComingSoon
        title="Módulo de Mídia"
        description="Gere imagens para posts, banners e avisos da igreja com inteligência artificial, diretamente do portal."
        phase="Fase 3"
        icon={
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        features={[
          {
            label: 'Geração de imagens com IA',
            description: 'Descreva o que precisa — a IA gera o prompt ideal e cria a imagem.',
          },
          {
            label: 'Templates para posts',
            description: 'Banners para cultos, eventos, avisos e redes sociais da igreja.',
          },
          {
            label: 'Biblioteca de imagens',
            description: 'Histórico de todas as imagens geradas para reutilização.',
          },
          {
            label: 'Integração com Canva',
            description: 'Exporte o prompt gerado diretamente para o Canva IA ou Midjourney.',
          },
        ]}
      />
    </div>
  );
}
