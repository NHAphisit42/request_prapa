// NOTE: This is a small sample so the cascading dropdowns work out of the box.
// For production, replace with the full 77-province dataset (e.g. thailand-province-district-subdistrict-zipcode
// on npm) or query it live from PWA's own reference API if one exists internally.

export type Subdistrict = { name: string; zipcode: string };
export type District = { name: string; subdistricts: Subdistrict[] };
export type Province = { name: string; districts: District[] };

export const THAI_ADDRESS: Province[] = [
  {
    name: "กรุงเทพมหานคร",
    districts: [
      {
        name: "เขตพระโขนง",
        subdistricts: [
          { name: "พระโขนงเหนือ", zipcode: "10110" },
          { name: "คลองตันเหนือ", zipcode: "10110" },
          { name: "บางจาก", zipcode: "10260" },
        ],
      },
      {
        name: "เขตคลองเตย",
        subdistricts: [
          { name: "คลองเตย", zipcode: "10110" },
          { name: "คลองตัน", zipcode: "10110" },
          { name: "พระโขนง", zipcode: "10110" },
        ],
      },
      {
        name: "เขตวัฒนา",
        subdistricts: [
          { name: "คลองเตยเหนือ", zipcode: "10110" },
          { name: "คลองตันเหนือ", zipcode: "10110" },
          { name: "พระโขนงเหนือ", zipcode: "10110" },
        ],
      },
    ],
  },
  {
    name: "สมุทรปราการ",
    districts: [
      {
        name: "เมืองสมุทรปราการ",
        subdistricts: [
          { name: "ปากน้ำ", zipcode: "10270" },
          { name: "สำโรงเหนือ", zipcode: "10270" },
          { name: "บางเมือง", zipcode: "10270" },
        ],
      },
      {
        name: "บางพลี",
        subdistricts: [
          { name: "บางพลีใหญ่", zipcode: "10540" },
          { name: "บางแก้ว", zipcode: "10540" },
          { name: "ราชาเทวะ", zipcode: "10540" },
        ],
      },
    ],
  },
  {
    name: "นนทบุรี",
    districts: [
      {
        name: "เมืองนนทบุรี",
        subdistricts: [
          { name: "สวนใหญ่", zipcode: "11000" },
          { name: "ตลาดขวัญ", zipcode: "11000" },
          { name: "บางกระสอ", zipcode: "11000" },
        ],
      },
    ],
  },
];

// กปภ.สาขา — Provincial Waterworks Authority branch offices (sample)
export const PWA_BRANCHES = [
  "กปภ.สาขาสมุทรปราการ",
  "กปภ.สาขาปากน้ำ",
  "กปภ.สาขานนทบุรี",
  "กปภ.สาขาบางบัวทอง",
  "กปภ.สาขาปทุมธานี",
];
