// Vietnam's 34 provincial-level units since 1 July 2025 (Resolution 202/2025/QH15): 6 centrally
// run cities + 28 provinces; districts no longer exist. `formerly` lists the merged pre-2025
// provinces so customers who type an old name ("Bình Dương") still find the right one. `spx` is
// SPX's name for it (spx_locations.province), checked by tests/provinces.test.ts.
export const PROVINCES: { name: string; spx: string; formerly?: string[]; aliases?: string[] }[] = [
  { name: "An Giang", spx: "Tỉnh An Giang", formerly: ["Kiên Giang"] },
  { name: "Bắc Ninh", spx: "Tỉnh Bắc Ninh", formerly: ["Bắc Giang"] },
  { name: "Cà Mau", spx: "Tỉnh Cà Mau", formerly: ["Bạc Liêu"] },
  { name: "Cao Bằng", spx: "Tỉnh Cao Bằng" },
  { name: "Cần Thơ", spx: "Thành phố Cần Thơ", formerly: ["Sóc Trăng", "Hậu Giang"] },
  { name: "Đà Nẵng", spx: "Thành phố Đà Nẵng", formerly: ["Quảng Nam"] },
  { name: "Đắk Lắk", spx: "Tỉnh Đắk Lắk", formerly: ["Phú Yên"] },
  { name: "Điện Biên", spx: "Tỉnh Điện Biên" },
  { name: "Đồng Nai", spx: "Tỉnh Đồng Nai", formerly: ["Bình Phước"] },
  { name: "Đồng Tháp", spx: "Tỉnh Đồng Tháp", formerly: ["Tiền Giang"] },
  { name: "Gia Lai", spx: "Tỉnh Gia Lai", formerly: ["Bình Định"] },
  { name: "Hà Nội", spx: "Thành phố Hà Nội", aliases: ["HN"] },
  { name: "Hà Tĩnh", spx: "Tỉnh Hà Tĩnh" },
  { name: "Hải Phòng", spx: "Thành phố Hải Phòng", formerly: ["Hải Dương"] },
  { name: "Huế", spx: "Thành phố Huế", aliases: ["Thừa Thiên Huế"] },
  { name: "Hưng Yên", spx: "Tỉnh Hưng Yên", formerly: ["Thái Bình"] },
  { name: "Khánh Hòa", spx: "Tỉnh Khánh Hòa", formerly: ["Ninh Thuận"] },
  { name: "Lai Châu", spx: "Tỉnh Lai Châu" },
  { name: "Lâm Đồng", spx: "Tỉnh Lâm Đồng", formerly: ["Đắk Nông", "Bình Thuận"] },
  { name: "Lạng Sơn", spx: "Tỉnh Lạng Sơn" },
  { name: "Lào Cai", spx: "Tỉnh Lào Cai", formerly: ["Yên Bái"] },
  { name: "Nghệ An", spx: "Tỉnh Nghệ An" },
  { name: "Ninh Bình", spx: "Tỉnh Ninh Bình", formerly: ["Hà Nam", "Nam Định"] },
  { name: "Phú Thọ", spx: "Tỉnh Phú Thọ", formerly: ["Vĩnh Phúc", "Hòa Bình"] },
  { name: "Quảng Ngãi", spx: "Tỉnh Quảng Ngãi", formerly: ["Kon Tum"] },
  { name: "Quảng Ninh", spx: "Tỉnh Quảng Ninh" },
  { name: "Quảng Trị", spx: "Tỉnh Quảng Trị", formerly: ["Quảng Bình"] },
  { name: "Sơn La", spx: "Tỉnh Sơn La" },
  { name: "Tây Ninh", spx: "Tỉnh Tây Ninh", formerly: ["Long An"] },
  { name: "Thái Nguyên", spx: "Tỉnh Thái Nguyên", formerly: ["Bắc Kạn"] },
  { name: "Thanh Hóa", spx: "Tỉnh Thanh Hóa" },
  { name: "TP. Hồ Chí Minh", spx: "Thành phố Hồ Chí Minh", formerly: ["Bình Dương", "Bà Rịa - Vũng Tàu"], aliases: ["HCM", "Sài Gòn", "Saigon"] },
  { name: "Tuyên Quang", spx: "Tỉnh Tuyên Quang", formerly: ["Hà Giang"] },
  { name: "Vĩnh Long", spx: "Tỉnh Vĩnh Long", formerly: ["Bến Tre", "Trà Vinh"] },
];

export const PROVINCE_NAMES = new Set(PROVINCES.map((p) => p.name));

/** Accent- and case-insensitive key: "Hồ Chí Minh" → "ho chi minh", "Đà Nẵng" → "da nang". */
export function searchKey(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
