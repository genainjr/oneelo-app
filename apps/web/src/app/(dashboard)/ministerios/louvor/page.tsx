import { ComingSoon } from '@/components/app/coming-soon';

export default function LouvorPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ComingSoon
        title="Módulo de Louvor"
        description="Gerencie o repertório do ministério, monte set lists para cada culto e controle o tom de cada música por vocalista."
        phase="Fase 3"
        icon={
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        }
        features={[
          {
            label: 'Biblioteca de músicas',
            description: 'Cadastre músicas com tom, letra cifrada e links do YouTube ou Spotify.',
          },
          {
            label: 'Set list por culto',
            description: 'Monte e ordene o set list de cada evento com arrastar e soltar.',
          },
          {
            label: 'Controle de tom',
            description: 'Registre o tom preferido de cada vocalista e veja a transposição automaticamente.',
          },
          {
            label: 'Histórico de set lists',
            description: 'Consulte set lists anteriores e exporte em PDF para o ensaio.',
          },
        ]}
      />
    </div>
  );
}
