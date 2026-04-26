export function isExplicitNoFastqParam(hasFastq: string | string[] | undefined): boolean {
  const v = Array.isArray(hasFastq) ? hasFastq[0] : hasFastq;
  return String(v ?? '') === 'false';
}
