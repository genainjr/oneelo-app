export const locales = ['pt-BR', 'pt-PT', 'en-US'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'pt-BR';

export const localeLabels: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'en-US': 'English (US)',
};

export const localeFlags: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'pt-PT': '🇵🇹',
  'en-US': '🇺🇸',
};
