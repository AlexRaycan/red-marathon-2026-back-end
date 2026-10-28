/**
 * Для сравнения названий и жанров: без регистра, диакритики и знаков
 * препинания, чтобы «Amélie» совпало с «Amelie», а «Sci-Fi» — с «Sci Fi»
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
