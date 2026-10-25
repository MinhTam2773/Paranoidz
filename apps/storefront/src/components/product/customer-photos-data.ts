// Customer reviews supplied by the shop, kept in code as static data plus
// photos under public/customer-reviews/. The section shows each review's
// own stars, author, date and words — no aggregate rating, no
// marketplace attribution of any kind. Photo-to-review pairing for 7654
// was drawn at random (2026-10-25) because the supplied photos arrived
// without review details.
export type CustomerReview = {
  author: string;
  rating: number;
  date: string; // dd/mm/yyyy
  content: string;
  photos: string[];
};

export const CUSTOMER_REVIEWS_DATA: Record<string, CustomerReview[]> = {
  "7654": [
    {
      author: "x*****i",
      rating: 5,
      date: "10/07/2026",
      content:
        "Vải dày dặn chắc chắn, khoang chứa rộng đựng được rất nhiều đồ, độ hoàn thiện của đường chỉ tương đối tốt, phù hợp mẹ bỉm sữa mang con đi ra ngoài và đi du lịch",
      photos: ["/customer-reviews/7654/balo-bim-sua-7654-danh-gia-04.jpg"],
    },
    {
      author: "utdung969",
      rating: 5,
      date: "11/11/2025",
      content:
        "200k được balo như này quá ưng, lâu rồi mới mua được balo ưng như vậy, balo to, rộng, đựng đồ thoải mái, thiết kế trẻ trung, phần vân xám với nâu. Ck góp ý nâu, có dịp sẽ mua luôn màu trắng xám kia",
      photos: ["/customer-reviews/7654/balo-bim-sua-7654-danh-gia-02.jpg"],
    },
    {
      author: "m****2",
      rating: 5,
      date: "05/10/2025",
      content:
        "Nhận hàng mà bất ngờ, balo cực xịn xò nha, vải dày dặn, đường may kĩ, dây kéo mượt, giá cũng ko quá rẻ nhưng xứng đáng",
      photos: ["/customer-reviews/7654/balo-bim-sua-7654-danh-gia-05.jpg"],
    },
    {
      author: "samsam3134_",
      rating: 5,
      date: "20/09/2025",
      content:
        "Balo nhận về tay giống hình mô tả của shop, chất và form dày dặn, để được nhiều đồ, balo đeo lưng nên bồng bé vẫn rất tiện hơn túi xách nhiều",
      photos: ["/customer-reviews/7654/balo-bim-sua-7654-danh-gia-03.jpg"],
    },
    {
      author: "winter2607",
      rating: 5,
      date: "25/09/2026",
      content:
        "Chất liệu: cứng cáp\nKích thước: rộng\nThiết kế: xinh xắn\nBalo đẹp y như hình, cứng cáp có form, đựng được laptop, nhiều ngăn để nhiều đồ, giao siêu nhanh",
      photos: ["/customer-reviews/7654/balo-bim-sua-7654-danh-gia-01.jpg"],
    },
  ],
};
