export function isHasMorePagination(
  totalCount: number,
  skip?: number,
  take?: number
): boolean {
  return (skip || 0) + (take || 0) < totalCount
}
