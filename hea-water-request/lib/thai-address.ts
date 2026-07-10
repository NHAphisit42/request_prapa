import raw from "./thai-address-data.json";

// Full dataset: 77 provinces / ~930 districts / ~7,450 subdistricts (ตำบล/แขวง)
// Source: kongvut/thai-province-data (MIT) — trimmed to {name, zipcode} fields only
// to keep the bundle small. Re-run the same transform if you need to refresh it later:
// https://github.com/kongvut/thai-province-data -> api/latest/province_with_district_and_sub_district.json

export type Subdistrict = { name: string; zipcode: string };
export type District = { name: string; subdistricts: Subdistrict[] };
export type Province = { name: string; districts: District[] };

export const THAI_ADDRESS: Province[] = raw as Province[];

// This deployment only serves Phuket — the form locks the province field to this value.
export const PHUKET_PROVINCE_NAME = "ภูเก็ต";

// กปภ.สาขา — Provincial Waterworks Authority branch office(s) covering Phuket province.
// PWA operates a single branch for the whole province (source: pwa.co.th/province/pid/83).
export const PWA_BRANCHES = ["กปภ.สาขาภูเก็ต"];
