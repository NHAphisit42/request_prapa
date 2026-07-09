import raw from "./thai-address-data.json";

// Full dataset: 77 provinces / ~930 districts / ~7,450 subdistricts (ตำบล/แขวง)
// Source: kongvut/thai-province-data (MIT) — trimmed to {name, zipcode} fields only
// to keep the bundle small. Re-run the same transform if you need to refresh it later:
// https://github.com/kongvut/thai-province-data -> api/latest/province_with_district_and_sub_district.json

export type Subdistrict = { name: string; zipcode: string };
export type District = { name: string; subdistricts: Subdistrict[] };
export type Province = { name: string; districts: District[] };

export const THAI_ADDRESS: Province[] = raw as Province[];

// กปภ.สาขา — Provincial Waterworks Authority branch offices.
// This is NOT part of the province/district dataset above (PWA branch coverage areas
// don't map 1:1 to provinces). Replace with your organization's real branch list —
// ideally keyed by province/district so the dropdown can filter automatically.
export const PWA_BRANCHES = [
  "กปภ.สาขาสมุทรปราการ",
  "กปภ.สาขาปากน้ำ",
  "กปภ.สาขานนทบุรี",
  "กปภ.สาขาบางบัวทอง",
  "กปภ.สาขาปทุมธานี",
];
