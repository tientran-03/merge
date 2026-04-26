/**
 * Vai trò backend (Spring) — cùng tập ROLE_* như admin web / import Excel user.
 * Dùng chung cho Auth, admin-home, màn phân quyền.
 */

export const ROLE_ADMIN = "ROLE_ADMIN";
export const ROLE_STAFF = "ROLE_STAFF";
export const ROLE_DOCTOR = "ROLE_DOCTOR";
export const ROLE_CUSTOMER = "ROLE_CUSTOMER";
export const ROLE_LAB_TECHNICIAN = "ROLE_LAB_TECHNICIAN";
export const ROLE_SAMPLE_COLLECTOR = "ROLE_SAMPLE_COLLECTOR";

/** Role được phép dùng app vận hành mobile (web quản lý user có đủ các vai trò này). */
export const MOBILE_APP_ALLOWED_ROLES: readonly string[] = [
  ROLE_ADMIN,
  ROLE_STAFF,
  ROLE_DOCTOR,
  ROLE_LAB_TECHNICIAN,
  ROLE_SAMPLE_COLLECTOR,
];

/** Vai trò dùng chung luồng vận hành → `/home` (không vào admin-home). */
export const STAFF_LIKE_HOME_ROLES: readonly string[] = [
  ROLE_STAFF,
  ROLE_DOCTOR,
  ROLE_LAB_TECHNICIAN,
  ROLE_SAMPLE_COLLECTOR,
];

export function canAccessMobileApp(role?: string | null): boolean {
  if (!role) return false;
  return MOBILE_APP_ALLOWED_ROLES.includes(role);
}

export function isStaffLikeOperationalRole(role?: string | null): boolean {
  if (!role) return false;
  return STAFF_LIKE_HOME_ROLES.includes(role);
}

/** Nhãn hiển thị — khớp admin web (users / import Excel). */
export function getRoleLabelVi(roleName?: string | null): string {
  const roleMap: Record<string, string> = {
    [ROLE_ADMIN]: "Quản trị viên",
    [ROLE_STAFF]: "Nhân viên",
    [ROLE_DOCTOR]: "Bác sĩ",
    [ROLE_CUSTOMER]: "Khách hàng",
    [ROLE_LAB_TECHNICIAN]: "Kỹ thuật viên lab",
    [ROLE_SAMPLE_COLLECTOR]: "Người thu mẫu",
  };
  return roleMap[roleName || ""] || roleName || "";
}

export type HomeRoute = "/admin-home" | "/home" | "/";

export function getDefaultHomeRoute(role?: string | null): HomeRoute {
  if (role === ROLE_ADMIN) return "/admin-home";
  if (isStaffLikeOperationalRole(role)) return "/home";
  return "/";
}
