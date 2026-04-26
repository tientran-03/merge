/** Chuẩn hoá staffPosition từ API (không phân biệt hoa thường) */
export const normalizeStaffPosition = (value?: string): string =>
  String(value || "")
    .trim()
    .toLowerCase();

/** Nhân viên phụ trách / phân tích: vị trí bác sĩ (giống web admin order-new) */
export const isDoctorPosition = (value?: string): boolean => {
  const p = normalizeStaffPosition(value);
  return p === "doctor" || p === "role_doctor";
};

/** Nhân viên thu mẫu: kỹ thuật viên lab */
export const isLabPosition = (value?: string): boolean => {
  const p = normalizeStaffPosition(value);
  return (
    p === "lab_technician" ||
    p === "lab-technician" ||
    p === "lab technician" ||
    p === "sample_collector" ||
    p === "sample collector" ||
    p === "collector" ||
    p === "lab" ||
    p === "role_lab_technician"
  );
};

/** Người thu tiền (màn tạo đơn): STAFF */
export const isStaffPosition = (value?: string): boolean => {
  const p = normalizeStaffPosition(value);
  return p === "staff" || p === "role_staff";
};

/**
 * Admin web `order-new`: nhân viên phụ trách = hospital staff DOCTOR gắn hospitalId cố định này
 * (lookup `staffAnalystId` trong hospitalStaff, không dùng doctorId bảng bác sĩ).
 */
export const STAFF_ANALYST_HOSPITAL_ID = "1";

export function isStaffAnalystWebRule(staff: {
  staffPosition?: string;
  hospitalId?: string;
}): boolean {
  return (
    isDoctorPosition(staff.staffPosition) &&
    String(staff.hospitalId ?? "").trim() === STAFF_ANALYST_HOSPITAL_ID
  );
}
