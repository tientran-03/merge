export const ROLE_ADMIN = 'ROLE_ADMIN';
export const ROLE_STAFF = 'ROLE_STAFF';
export const ROLE_LAB_TECHNICIAN = 'ROLE_LAB_TECHNICIAN';
export const ROLE_SAMPLE_COLLECTOR = 'ROLE_SAMPLE_COLLECTOR';
export const ROLE_DOCTOR = 'ROLE_DOCTOR';
export const ROLE_CUSTOMER = 'ROLE_CUSTOMER';

export const ALL_ROLES = [
  ROLE_ADMIN,
  ROLE_STAFF,
  ROLE_LAB_TECHNICIAN,
  ROLE_SAMPLE_COLLECTOR,
  ROLE_DOCTOR,
  ROLE_CUSTOMER,
] as const;

export type RoleType = (typeof ALL_ROLES)[number];

export const STAFF_SIDE_ROLES: readonly string[] = [
  ROLE_ADMIN,
  ROLE_STAFF,
  ROLE_LAB_TECHNICIAN,
  ROLE_SAMPLE_COLLECTOR,
  ROLE_DOCTOR,
];

export const isStaffSideRole = (role?: string | null): boolean => {
  if (!role) return false;
  return STAFF_SIDE_ROLES.includes(role.toUpperCase());
};
