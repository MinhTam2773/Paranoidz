// Curated Shopee reviews, kept in code like the gacha art in public/gacha/.
// These are real customer reviews from the shop's Shopee page (collected 2026-10-20). The photos
// live in public/shopee-reviews/ so the section needs no database row or bucket upload; adding
// another product means adding one entry here plus its photos. The section must keep its "from
// Shopee" label so Shopee reviews are never passed off as web reviews.
export type ShopeeReview = {
  author: string;
  rating: number;
  date: string; // dd/mm/yyyy, as shown on Shopee
  variant: string;
  content: string;
  photos: string[];
};

export type ShopeeReviewData = {
  totalRatings: number;
  featured: ShopeeReview[];
};

export const SHOPEE_REVIEWS_DATA: Record<string, ShopeeReviewData> = {
  pdz01: {
    totalRatings: 35,
    featured: [
      {
        author: "camsuong2211",
        rating: 5,
        date: "26/06/2026",
        variant: "Mint Blue, size M",
        content:
          "Màu sắc: Đúng như ảnh shop đăng.\nChất liệu: Vải thun sờ mịn tay, mát và dày dặn.\nĐã mua ở brand này vài lần và chưa bao giờ làm mình thất vọng. Cách đóng gói hộp chỉn chu. Vải áo đẹp, form chuẩn dã man. M58 - 45kg mặc size M lên đúng gu luôn. Brand làm việc rất chuyên nghiệp, từ khâu chuẩn bị hàng đến chăm sóc khách hàng đều 10 điểm.",
        photos: ["/shopee-reviews/pdz01/review-01-1.jpg"],
      },
      {
        author: "liengngocdiep",
        rating: 5,
        date: "25/06/2026",
        variant: "Basic Gray, size L",
        content: "Màu sắc: đúng\nĐúng với mô tả: đúng\nChất liệu: nhung\nForm đẹp, chất vải nhung mặc lên khá thích",
        photos: ["/shopee-reviews/pdz01/review-02-1.jpg", "/shopee-reviews/pdz01/review-02-2.jpg"],
      },
      {
        author: "suphng522",
        rating: 5,
        date: "28/06/2026",
        variant: "Basic Gray, size M",
        content: "Đúng với mô tả: đúng mô tả\n10 điểm không có nhưng nha đẹp suất sắc mê lắm luôn ý vải mịn mặc mát",
        photos: [
          "/shopee-reviews/pdz01/review-04-1.jpg",
          "/shopee-reviews/pdz01/review-04-2.jpg",
          "/shopee-reviews/pdz01/review-04-3.jpg",
        ],
      },
      {
        author: "t*****1",
        rating: 5,
        date: "11/10/2026",
        variant: "Mint Blue, size M",
        content: "Áo quá xinh có tặng vớ nữa, dòng chữ là may, ko có chỉ thừa, mở ra là phải khen 5 sao r",
        photos: ["/shopee-reviews/pdz01/review-06-1.jpg"],
      },
      {
        author: "q*****4",
        rating: 5,
        date: "08/10/2026",
        variant: "Mint Blue, size L",
        content: "Giặt 3-4 lần chưa thấy cổ áo có dấu hiệu bị nhão. Chất vải nhìn tưởng nóng nhưng mặc không thấy bí",
        photos: ["/shopee-reviews/pdz01/review-09-1.jpg"],
      },
    ],
  },
};
