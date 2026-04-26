export function sanitizePatientNameInput(s: string): string {
  let t = s.replace(/\d/g, '');
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/\.{2,}/g, '.');
  return t;
}

export function stripDiacriticsForEmail(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}
