export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function includesNormalizedText(
  value: string | null | undefined,
  search: string | null | undefined,
): boolean {
  const normalizedSearch = normalizeSearchText(search);
  return (
    !normalizedSearch || normalizeSearchText(value).includes(normalizedSearch)
  );
}
