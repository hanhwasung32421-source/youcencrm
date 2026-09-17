// ilike 패턴에서 %, _ 가 와일드카드로 해석되지 않도록 이스케이프합니다.
export function escapeLikePattern(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
