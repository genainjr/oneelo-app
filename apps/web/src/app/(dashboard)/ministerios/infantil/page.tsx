import { ComingSoon } from '@/components/app/coming-soon';

export default function InfantilPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ComingSoon
        title="Módulo Infantil"
        description="Crie histórias bíblicas adaptadas por faixa etária com ajuda de inteligência artificial e compartilhe com toda a equipe."
        phase="Fase 3"
        icon={
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
        features={[
          {
            label: 'Geração de histórias com IA',
            description: 'Informe o texto bíblico e a faixa etária — a IA cria a história adaptada.',
          },
          {
            label: 'Formatos variados',
            description: 'Escolha entre narrativa, peça curta ou atividade interativa para a aula.',
          },
          {
            label: 'Biblioteca compartilhada',
            description: 'Salve e reutilize histórias criadas por outros professores do ministério.',
          },
          {
            label: 'Exportação para impressão',
            description: 'Gere o material pronto para imprimir e distribuir na aula.',
          },
        ]}
      />
    </div>
  );
}
