import vnProvincesIndex from "@/lib/data/vn-provinces-index.json";

type ProvinceIndexEntry = { code: string; file_path: string };
type ProvinceIndex = Record<string, ProvinceIndexEntry>;

type WardJson = { name: string; pre: string };
type DistrictJson = { name: string; pre: string; ward: WardJson[] };

type ProvinceFileJson = {
  code: string;
  name: string;
  district: DistrictJson[];
};

const index = vnProvincesIndex as ProvinceIndex;

const WARD_DATA_BASE =
  "https://cdn.jsdelivr.net/gh/thien0291/vietnam_dataset@master/data";

export type AddressSelectOption = { value: string; label: string; uniqueKey: string };

const wardOptionsByCode = new Map<string, AddressSelectOption[]>();

function provinceLabelsLooselyEqual(a: string, b: string): boolean {
  const x = a.trim().replace(/\s+/g, " ").normalize("NFC");
  const y = b.trim().replace(/\s+/g, " ").normalize("NFC");
  if (x === y) return true;
  try {
    return x.localeCompare(y, "vi", { sensitivity: "base" }) === 0;
  } catch {
    return x.toLowerCase() === y.toLowerCase();
  }
}

/** Public province name (trimmed) → code in dataset */
export function resolveProvinceCode(provinceName: string): string | undefined {
  const hit = resolveProvinceIndexKey(provinceName);
  if (!hit) return undefined;
  const entry = (index as ProvinceIndex)[hit];
  return entry?.code;
}

/** Index key for a province label (chuẩn hoá Unicode / tiền tố Thành phố|Tỉnh / so sánh loose). */
export function resolveProvinceIndexKey(provinceName: string): string | null {
  const want = provinceName.trim().replace(/\s+/g, " ");
  if (!want) return null;
  for (const rawKey of Object.keys(index)) {
    const keyNorm = rawKey.trim().replace(/\s+/g, " ");
    if (keyNorm === want) return rawKey;
  }
  const wantVariants = [
    want,
    want.replace(/^thành phố\s+/i, "").trim(),
    want.replace(/^tỉnh\s+/i, "").trim(),
  ].filter(Boolean);
  for (const v of wantVariants) {
    for (const rawKey of Object.keys(index)) {
      const keyNorm = rawKey.trim().replace(/\s+/g, " ");
      if (provinceLabelsLooselyEqual(keyNorm, v)) return rawKey;
      const keyStripped = keyNorm
        .replace(/^thành phố\s+/i, "")
        .replace(/^tỉnh\s+/i, "")
        .trim();
      if (keyStripped && provinceLabelsLooselyEqual(keyStripped, v)) return rawKey;
    }
  }
  return null;
}

export function getProvinceSelectOptions(): AddressSelectOption[] {
  return Object.entries(index)
    .map(([rawKey, entry]) => {
      const label = rawKey.trim().replace(/\s+/g, " ");
      return {
        value: label,
        label,
        uniqueKey: `vn-province-${entry.code}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

function buildWardLabel(district: DistrictJson, ward: WardJson): string {
  const d = `${district.pre} ${district.name}`.trim();
  const w = `${ward.pre} ${ward.name}`.trim();
  return `${w} — ${d}`;
}

/**
 * value = stable id for form; label = human-readable line in address string.
 */
export async function loadWardSelectOptions(provinceName: string): Promise<AddressSelectOption[]> {
  const code = resolveProvinceCode(provinceName);
  if (!code) return [];

  const cached = wardOptionsByCode.get(code);
  if (cached) return cached;

  const url = `${WARD_DATA_BASE}/${code}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Không tải được danh sách phường/xã (${res.status})`);
  }
  const data = (await res.json()) as ProvinceFileJson;
  const options: AddressSelectOption[] = [];
  let i = 0;
  for (const district of data.district || []) {
    for (const ward of district.ward || []) {
      const label = buildWardLabel(district, ward);
      const value = `${code}|${district.name}|${ward.pre}|${ward.name}`;
      options.push({
        value,
        label,
        uniqueKey: `vn-ward-${code}-${i++}`,
      });
    }
  }
  wardOptionsByCode.set(code, options);
  return options;
}

export function wardLabelFromValue(
  wardValue: string,
  options: AddressSelectOption[]
): string {
  const v = String(wardValue || "").trim();
  if (!v) return "";
  const hit = options.find((o) => o.value === v);
  return hit?.label || v;
}

/** Ensures the current form value appears in the list (legacy / parse fallback). */
export function mergeWardSelectOptions(
  base: AddressSelectOption[],
  currentValue: string
): AddressSelectOption[] {
  const v = String(currentValue || "").trim();
  if (!v) return base;
  if (base.some((o) => o.value === v)) return base;
  const label = v.includes("|") ? v.split("|").filter(Boolean).join(" · ") : v;
  return [...base, { value: v, label, uniqueKey: `ward-extra-${v.length}` }];
}

export function formatPatientAddressLine(detail: string, wardLabel: string, province: string): string {
  const d = detail.trim();
  const w = wardLabel.trim();
  const p = province.trim();
  return [d, w, p].filter(Boolean).join(", ");
}

export type ParsedPatientAddress = {
  detail: string;
  wardLabel: string;
  province: string;
};

/**
 * Last segment = province, second-to-last = ward (new format),
 * everything before = street/detail. If only 2 segments, legacy: detail + province.
 */
export function parseStoredPatientAddress(raw: string): ParsedPatientAddress {
  const full = String(raw || "").trim();
  if (!full) return { detail: "", wardLabel: "", province: "" };

  const parts = full
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    const province = parts[parts.length - 1] ?? "";
    const wardLabel = parts[parts.length - 2] ?? "";
    const detail = parts.slice(0, -2).join(", ");
    return { detail, wardLabel, province };
  }

  if (parts.length === 2) {
    return { detail: parts[0] ?? "", wardLabel: "", province: parts[1] ?? "" };
  }

  return { detail: full, wardLabel: "", province: "" };
}

/** If value matches our encoded ward id, return label from options; else treat stored middle segment as label. */
export function resolveWardValueFromParsed(
  wardSegment: string,
  options: AddressSelectOption[]
): string {
  const seg = String(wardSegment || "").trim();
  if (!seg) return "";
  const byValue = options.find((o) => o.value === seg);
  if (byValue) return byValue.value;
  const byLabel = options.find((o) => o.label === seg);
  if (byLabel) return byLabel.value;
  return seg;
}
