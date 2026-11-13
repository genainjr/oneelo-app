export function isSafePublicHttpUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildSafeGoogleMapsLink(params: {
  googleMapsUrl?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  churchName?: string | null;
}): string | null {
  if (isSafePublicHttpUrl(params.googleMapsUrl)) {
    return params.googleMapsUrl;
  }

  const addressParts = [
    params.endereco,
    params.numero,
    params.bairro,
    params.cidade,
    params.estado,
    params.cep,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  if (addressParts.length === 0) {
    return null;
  }

  const query = [params.churchName?.trim(), ...addressParts]
    .filter(Boolean)
    .join(', ');

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildWhatsappLink(phone?: string | null, churchName?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const text = churchName
    ? `Olá! Gostaria de falar com a equipe de ${churchName}.`
    : 'Olá! Gostaria de mais informações.';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function formatWeekdayLabel(day: number): string {
  const labels: Record<number, string> = {
    0: 'Domingo',
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
  };
  return labels[day] ?? 'Culto';
}

export function formatShortWeekdayLabel(day: number): string {
  const labels: Record<number, string> = {
    0: 'Dom',
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb',
  };
  return labels[day] ?? 'Culto';
}

export function splitSafeParagraphs(text?: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
