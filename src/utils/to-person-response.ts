/** Фото есть не у всех — наружу отдаём null, а не отсутствующее поле */
export function toPersonResponse<T extends { photoUrl?: string }>(
  person: T
): Omit<T, 'photoUrl'> & { photoUrl: string | null } {
  return { ...person, photoUrl: person.photoUrl ?? null }
}
