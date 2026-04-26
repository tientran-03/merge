export type OrderStatus =
  | "initiation"
  | "forward_analysis"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "sample_error"
  | "rerun_testing"
  | "completed"
  | "sample_addition";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "UNPAID";

export type PaymentType = "CASH" | "ONLINE_PAYMENT";

export type ServiceType = "embryo" | "disease" | "reproduction";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface Order {
  id: string;
  code: string;
  name: string;
  patientName: string;
  testName: string;
  status: OrderStatus;
  date: string;
  createdAt: Date;
  amount?: number;
  customer?: string;
  clinic?: string;
  hasDownload?: boolean;
}

export interface PrescriptionSlip {
  id: string;
  code: string;
  testName: string;
  patientName?: string;
  status: OrderStatus;
  date: string;
  createdAt: Date;
  hasDownload?: boolean;
}

export interface Patient {
  id: string;
  code: string;
  name: string;
  gender: string;
  phone: string;
  address: string;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
}

export interface User {
  id: string;
  accountCode: string;
  email: string;
  name: string;
  phone: string;
  gender: string;
  department: string;
  hospitalName: string;
  dateOfBirth: string;
  hospitalId: string;
  avatarUrl?: string;
  role?: string; // ROLE_ADMIN, ROLE_STAFF, ...
}

export interface AdditionalSample {
  id: string;
  code: string;
  orderCode: string;
  patientName: string;
  requestDate: string;
  status: "pending" | "completed";
}
