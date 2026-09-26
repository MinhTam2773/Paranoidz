// Vietnam's 34 provincial-level units since 1 July 2025 (Resolution 202/2025/QH15): 6 centrally
// run cities + 28 provinces; districts no longer exist. `formerly` lists the merged pre-2025
// provinces so customers who type an old name ("Bình Dương") still find the right one.
export const PROVINCES: { name: string; formerly?: string[]; aliases?: string[] }[] = [
  { name: "An Giang", formerly: ["Kiên Giang"] },
  { name: "Bắc Ninh", formerly: ["Bắc Giang"] },
  { name: "Cà Mau", formerly: ["Bạc Liêu"] },
  { name: "Cao Bằng" },
  { name: "Cần Thơ", formerly: ["Sóc Trăng", "Hậu Giang"] },
  { name: "Đà Nẵng", formerly: ["Quảng Nam"] },
  { name: "Đắk Lắk", formerly: ["Phú Yên"] },
  { name: "Điện Biên" },
  { name: "Đồng Nai", formerly: ["Bình Phước"] },
  { name: "Đồng Tháp", formerly: ["Tiền Giang"] },
  { name: "Gia Lai", formerly: ["Bình Định"] },
  { name: "Hà Nội", aliases: ["HN"] },
  { name: "Hà Tĩnh" },
  { name: "Hải Phòng", formerly: ["Hải Dương"] },
  { name: "Huế", aliases: ["Thừa Thiên Huế"] },
  { name: "Hưng Yên", formerly: ["Thái Bình"] },
  { name: "Khánh Hòa", formerly: ["Ninh Thuận"] },
  { name: "Lai Châu" },
  { name: "Lâm Đồng", formerly: ["Đắk Nông", "Bình Thuận"] },
  { name: "Lạng Sơn" },
  { name: "Lào Cai", formerly: ["Yên Bái"] },
  { name: "Nghệ An" },
  { name: "Ninh Bình", formerly: ["Hà Nam", "Nam Định"] },
  { name: "Phú Thọ", formerly: ["Vĩnh Phúc", "Hòa Bình"] },
  { name: "Quảng Ngãi", formerly: ["Kon Tum"] },
  { name: "Quảng Ninh" },
  { name: "Quảng Trị", formerly: ["Quảng Bình"] },
  { name: "Sơn La" },
  { name: "Tây Ninh", formerly: ["Long An"] },
  { name: "Thái Nguyên", formerly: ["Bắc Kạn"] },
  { name: "Thanh Hóa" },
  { name: "TP. Hồ Chí Minh", formerly: ["Bình Dương", "Bà Rịa - Vũng Tàu"], aliases: ["HCM", "Sài Gòn", "Saigon"] },
  { name: "Tuyên Quang", formerly: ["Hà Giang"] },
  { name: "Vĩnh Long", formerly: ["Bến Tre", "Trà Vinh"] },
];

export const PROVINCE_NAMES = new Set(PROVINCES.map((p) => p.name));

/** Accent- and case-insensitive key: "Hồ Chí Minh" → "ho chi minh", "Đà Nẵng" → "da nang". */
export function searchKey(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
