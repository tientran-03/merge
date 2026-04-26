/**
 * Nhãn mã bệnh nhân hiển thị: ưu tiên mã dạng PAT- (trùng chuẩn hệ thống / PK),
 * tránh trường hợp patientCode cũ lệch định dạng vẫn được ưu tiên trước patientId.
 */
export function getPatientMbnDisplay(p: {
  patientId?: string | null;
  patientCode?: string | null;
}): string {
  const id = String(p.patientId ?? "").trim();
  const code = String(p.patientCode ?? "").trim();
  if (/^PAT-/i.test(id)) return id;
  if (/^PAT-/i.test(code)) return code;
  return code || id;
}
