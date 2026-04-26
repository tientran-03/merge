const API_BASE = "https://provinces.open-api.vn/api/v1";

export interface VNProvinceAPI {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code: number;
}

export interface VNDistrictAPI {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  province_code: number;
}

export interface VNWardAPI {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  district_code: number;
}

let provincesCache: VNProvinceAPI[] | null = null;
const districtsCache: Record<number, VNDistrictAPI[]> = {};
const wardsCache: Record<number, VNWardAPI[]> = {};

export async function fetchProvinces(): Promise<VNProvinceAPI[]> {
  if (provincesCache) return provincesCache;
  try {
    const res = await fetch(`${API_BASE}/p/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: VNProvinceAPI[] = await res.json();
    provincesCache = data;
    return data;
  } catch (e) {
    console.warn("[addressService] fetchProvinces error:", e);
    return [];
  }
}

export async function fetchDistricts(provinceCode: number): Promise<VNDistrictAPI[]> {
  if (districtsCache[provinceCode]) return districtsCache[provinceCode];
  try {
    const res = await fetch(`${API_BASE}/p/${provinceCode}?depth=2`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const districts: VNDistrictAPI[] = data.districts || [];
    districtsCache[provinceCode] = districts;
    return districts;
  } catch (e) {
    console.warn("[addressService] fetchDistricts error:", e);
    return [];
  }
}

export async function fetchWards(districtCode: number): Promise<VNWardAPI[]> {
  if (wardsCache[districtCode]) return wardsCache[districtCode];
  try {
    const res = await fetch(`${API_BASE}/d/${districtCode}?depth=2`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const wards: VNWardAPI[] = data.wards || [];
    wardsCache[districtCode] = wards;
    return wards;
  } catch (e) {
    console.warn("[addressService] fetchWards error:", e);
    return [];
  }
}

export function buildAddress(
  detail: string,
  wardName: string,
  districtName: string,
  provinceName: string
): string {
  return [detail, wardName, districtName, provinceName].filter(Boolean).join(", ");
}

export function splitAddressDetailAndAdmin(full: string): {
  detail: string;
  adminTail: [string, string, string] | null;
} {
  const raw = (full || "").trim();
  if (!raw) return { detail: "", adminTail: null };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) {
    return { detail: raw, adminTail: null };
  }
  const province = parts[parts.length - 1]!;
  const district = parts[parts.length - 2]!;
  const ward = parts[parts.length - 3]!;
  const detail = parts.slice(0, -3).join(", ");
  return { detail, adminTail: [ward, district, province] };
}

export function mergeAddressDetailWithAdmin(
  detail: string,
  adminTail: [string, string, string] | null
): string {
  const d = detail.trim();
  if (!adminTail) {
    return d;
  }
  const [ward, district, province] = adminTail;
  return buildAddress(d, ward || "", district || "", province || "");
}
