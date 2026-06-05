'use client';

import { useTranslations } from 'next-intl';

interface ComingSoonFeature {
  label: string;
  description: string;
}

interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features?: ComingSoonFeature[];
  phase?: string;
}

export function ComingSoon({ title, description, icon, features, phase }: ComingSoonProps) {
  const t = useTranslations('comingSoon');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
        {t('badge')}{phase ? ` · ${phase}` : ''}
      </span>

      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mb-6 shadow-lg text-white">
        {icon}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 max-w-md mb-8 text-sm leading-relaxed">{description}</p>

      {features && features.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full mb-8">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl text-left shadow-xs"
            >
              <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  className="w-3.5 h-3.5 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">{t('defaultDescription')}</p>
    </div>
  );
}
