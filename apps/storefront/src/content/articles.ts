// Long-form copy from the SEO kit (2026-11-17, content/pillars/*.md), edited only to drop
// notes meant for the developer and a hotline number the owner has not confirmed. Rendered by
// components/content/Prose.tsx (a small markdown subset). Stored as TS, not .md files: the
// storefront runs on Cloudflare Workers and must not read the filesystem.

export type Article = { h1: string; title: string; description: string; body: string };

export const ARTICLES = {
  "ao-thun-boxy-va-oversize-khac-nhau": {
    h1: "Áo thun boxy và oversize khác nhau thế nào?",
    title: "Áo thun boxy và oversize khác nhau thế nào? | Paranoidz",
    description:
      "Boxy và oversize đều là áo form rộng nhưng dáng khác nhau. Bài này giải thích ngắn, cách chọn size, và chỉ ra mẫu Paranoidz nào đang ghi form boxy hay oversize trên site.",
    body: `Paranoidz là local brand streetwear Việt Nam, bán áo thun và polo trên [paranoidz.vn](/). Trên các trang sản phẩm của shop, áo được mô tả là form boxy, form rộng, oversize, hoặc đôi khi ghi cả “oversize / boxy fit” trên cùng một mẫu. Bài này giải thích hai form này khác nhau ở đâu, rồi chỉ cách đọc đúng chữ trên từng áo Paranoidz — không gộp hết thành một kiểu.

## Trả lời ngắn

Áo thun **boxy** có dáng gần hình hộp: thân rộng, đường sườn tương đối thẳng, thường không dài thượt. Áo **oversize** cũng rộng nhưng thường rộng và dài hơn áo mặc vừa, vai có thể rơi, mặc trông thoáng và phủ người hơn.

Cả hai đều “form rộng”, nhưng boxy nghiêng về dáng vuông, gọn theo chiều dài; oversize nghiêng về mặc rộng, thoáng, đôi khi phủ mông. Cách chọn đúng là xem form được ghi trên trang sản phẩm, rồi đối chiếu bảng size của đúng mẫu đó — vì Paranoidz không dùng một bảng size chung cho cả shop.

## Boxy là gì?

Form boxy (boxy fit) là cách cắt áo cho thân rộng, ít ôm eo, tạo cảm giác vuông. Nhiều người chọn boxy vì mặc thoải mái nhưng không muốn áo dài quá gối hay quá đầu gối. Trên trang [áo thun minimalism pdz01](/products/ao-thun-localbrand-unisex-form-boxy-slim-fit-theu-minimalism-vai-nhung-pre-pdz01), Paranoidz mô tả là “boxy fit, form rộng” và nhắc: nếu thích mặc rộng hơn thì chọn size lớn hơn.

Cùng hướng boxy trên site còn có [pdz02 (thêu vịt vàng)](/products/ao-thun-local-brand-unisex-form-boxy-slim-fit-theu-vit-vang-vai-nhung-prem-pdz02) và [pdz08 (thêu logo tròn pdz+)](/products/ao-thun-localbrand-unisex-form-boxy-slim-fit-theu-minimalism-vai-nhung-pre-pdz08): cả hai được viết là áo thun form boxy rộng, vải nhung, unisex.

## Oversize là gì?

Áo oversize được cắt rộng hơn form mặc sát người, thường rộng vai và dài thân hơn áo regular. Người mặc có thể thấy vai rơi, áo phủ hông hoặc mông, đứng nhìn thoáng hơn. Trên trang [polo pdz05](/products/ao-polo-oversize-unisex-localbrand-paranoidz-theu-chu-nhat-vai-cotton-sign-pdz05), Paranoidz ghi rõ form oversize, “rộng phủ mông”, và nói khách không cần tăng size trừ khi muốn rộng hẳn.

Áo thun [pdz07](/products/ao-thun-nam-oversize-localbrand-vai-cotton-hinh-theu-lon-form-rong-the-tha-pdz07) cũng được mô tả là form rộng oversize. Riêng [pdz03](/products/ao-thun-localbrand-dap-noi-3d-paranoidz-form-rong-unisex-nam-nu-vai-cotton-pdz03) và [pdz04](/products/ao-thun-localbrand-dap-noi-3d-made-in-pain-form-rong-unisex-nam-nu-vai-cot-pdz04) (dập nổi cotton 250gsm): shop ghi đồng thời “form rộng”, “oversize / boxy fit”. Khi gặp trường hợp này, đừng tự suy ra một form duy nhất — hãy xem ảnh, bảng size của đúng mẫu, và hỏi shop nếu muốn mặc vừa hoặc rộng hơn.

## Khác nhau ở điểm nào?

| Tiêu chí | Form boxy (cách hiểu thông thường) | Form oversize (cách hiểu thông thường) | Cách Paranoidz đang ghi trên site |
| --- | --- | --- | --- |
| Dáng | Rộng, gần hình hộp, chiều dài thường vừa phải | Rộng, thường dài và thoáng hơn | Tùy mẫu; đọc đúng chữ trên PDP |
| Cảm giác mặc | Thoải mái, gọn hơn oversize dài | Rộng, dễ phủ người | pdz01 khuyên tăng size nếu muốn rộng hơn form boxy sẵn có; pdz05 nói form oversize đã rộng, không cần tăng size trừ khi muốn rộng hơn nữa |
| Mẫu PDZ đang gắn chữ này | pdz01, pdz02, pdz08 (vải nhung, thêu) | pdz05 (polo), pdz07 (áo thun thêu) | pdz03, pdz04 ghi cả oversize và boxy fit |

Bảng trên không phải số đo chuẩn ngành, cũng không thay cho bảng size trên từng sản phẩm.

## Nên chọn form nào?

- Muốn áo rộng nhưng không quá dài: bắt đầu với các mẫu Paranoidz đang gọi là form boxy (pdz01, pdz02, pdz08).  
- Muốn áo thoáng, phủ người hơn — ví dụ polo rộng phủ mông: xem pdz05 và các mẫu đang ghi oversize.  
- Muốn áo ôm hơn: trên site đang có [polo vải gân pdz06](/products/ao-polo-nam-vai-thun-gan-form-slimfit-om-sat-thoi-trang-thanh-lich-phong-d-pdz06), shop mô tả form ôm, và lưu ý nếu thích thoải mái thì cân nhắc tăng một size. Đây không phải áo boxy hay oversize.

Vẫn xem bảng size của đúng mẫu. Các áo boxy vải nhung không dùng chung mốc cân nặng với nhau: pdz01 ghi L 55–65 kg, XL 65–80 kg; pdz02 và pdz08 ghi L 55–70 kg, XL 70–85 kg. Chi tiết gom trong [bài hướng dẫn chọn size](/huong-dan-chon-size).

## Paranoidz là ai, mua ở đâu?

Paranoidz (PDZ) là local brand streetwear trên [paranoidz.vn](/), do Hộ kinh doanh COOLSHIRTZ vận hành. Shop ghi sản phẩm may tại Việt Nam. Đặt hàng trên website, thanh toán COD hoặc VietQR, giao SPX Express. Đổi trả 7 ngày theo [chính sách](/policy). Xem toàn bộ áo trong [bộ sưu tập áo thun](/collections/t-shirtz).

## FAQ

**Boxy và oversize có phải cùng một form không?**  
Không. Cả hai đều rộng hơn áo ôm, nhưng boxy thường vuông và gọn theo chiều dài hơn; oversize thường rộng và thoáng hơn. Trên một số trang Paranoidz, shop ghi cả hai cụm — khi đó phải xem đúng mẫu, không suy ra từ tên gọi chung.

**Áo thun Paranoidz mặc unisex được không?**  
Nhiều mẫu áo thun và polo oversize trên site được ghi là unisex. Polo vải gân pdz06 được viết hướng đến nam, form ôm.

**Tôi nên tăng size nếu muốn mặc rộng?**  
Tùy mẫu. pdz01 (boxy) khuyên tăng size nếu muốn rộng hơn. pdz05 (polo oversize) khuyên không cần tăng size trừ khi muốn rộng hẳn. Luôn đọc dòng lưu ý trên đúng trang sản phẩm.

**Có bài hướng dẫn size không?**  
Có. Xem [hướng dẫn chọn size áo Paranoidz](/huong-dan-chon-size), hoặc gọi 0345 267 709 / nhắn Zalo để shop tư vấn.`,
  },
  "cach-phoi-ao-thun-local-brand": {
    h1: "Cách phối áo thun local brand: form rộng, boxy và polo",
    title: "Cách phối áo thun local brand form rộng | Paranoidz",
    description:
      "Gợi ý phối áo thun và polo Paranoidz với jean, short, jogger, cargo, kaki — lấy từ mô tả sản phẩm và lookbook trên paranoidz.vn. Local brand streetwear Việt Nam.",
    body: `Paranoidz là local brand streetwear Việt Nam. Trên [paranoidz.vn](/), các trang áo thun và polo đã ghi sẵn gợi ý phối: jean, short, jogger, cargo, kaki, sneaker. Trang chủ còn mục “Phối cùng PDZ”: 8 mẫu áo, mỗi mẫu một bộ phối với balo và túi đang bán. Bài này gom các gợi ý đó lại cho dễ đọc — không phải bảng xếp hạng, cũng không phải công thức mặc đẹp duy nhất.

## Trả lời ngắn

Áo thun local brand form rộng hoặc boxy của Paranoidz dễ bắt đầu với quần jean, quần short hoặc jogger — đúng như mô tả trên các trang áo vải nhung (pdz01, pdz02, pdz08). Áo dập nổi cotton (pdz03, pdz04) được shop gợi ý thêm cargo hoặc khoác jacket. Polo oversize pdz05 hợp cargo, jean ống rộng, kaki, short và sneaker trắng. Polo vải gân form ôm pdz06 nghiêng về quần tây, kaki hoặc âu, theo hướng thanh lịch hơn.

Muốn xem bộ có sẵn: mở lookbook trên trang chủ. Look 01 đang gọi là “Đôi minimalism: Cream và Basic Gray”, gồm áo thun minimalism pdz01 (màu Cream và Basic Gray), túi đeo chéo form ngang (màu Kaki) và túi tote hình thú (màu Be).

## 1. Áo thun boxy, nền trơn, thêu nhỏ (pdz01, pdz02, pdz08)

Ba mẫu này trên site đều là áo thun unisex, form boxy rộng, vải nhung, nền trơn, điểm nhấn là thêu nổi (minimalism, vịt vàng, hoặc logo tròn pdz+).

Gợi ý đang có trên trang sản phẩm: phối quần jean, quần short, jogger; mặc đi học, đi chơi, đi cafe; nền trơn nên mua mặc cặp hoặc mặc nhóm cũng được.

Cách dùng thực tế từ chữ trên site: chọn một màu áo (pdz01 đang có Basic Gray, Cream, Mint Blue), giữ quần và giày đơn giản. Nếu muốn mặc thành bộ như lookbook, xem look 01 trên trang chủ — shop đang ghép pdz01 với túi đeo chéo và túi tote, không bắt buộc phải mua đủ bộ.

## 2. Áo thun form rộng, dập nổi chữ (pdz03, pdz04)

[pdz03](/products/ao-thun-localbrand-dap-noi-3d-paranoidz-form-rong-unisex-nam-nu-vai-cotton-pdz03) có logo “paranoidz” dập nổi cùng màu áo; [pdz04](/products/ao-thun-localbrand-dap-noi-3d-made-in-pain-form-rong-unisex-nam-nu-vai-cot-pdz04) là chữ “made in pain”, cùng chất cotton jersey 250gsm. Màu đang bán khác nhau (pdz03: Black, Green Beige, White; pdz04: Đen, Trắng, Xanh Be).

Gợi ý trên trang: phối jeans, short, cargo, hoặc layer với jacket. Vì họa tiết ở ngực đã là điểm nhấn, shop đang mô tả tổng thể tối giản — không cần thêm nhiều lớp graphic khác nếu muốn giữ đúng tinh thần đó.

## 3. Polo oversize và polo form ôm

[Polo pdz05](/products/ao-polo-oversize-unisex-localbrand-paranoidz-theu-chu-nhat-vai-cotton-sign-pdz05): form oversize, cổ bẻ, patch chữ Nhật trước ngực, màu đen hoặc trắng. Shop gợi ý mặc đi học, đi chơi, dạo phố, cafe, du lịch, đi làm casual; phối cargo, jean ống rộng, kaki, short, sneaker trắng.

[Polo vải gân pdz06](/products/ao-polo-nam-vai-thun-gan-form-slimfit-om-sat-thoi-trang-thanh-lich-phong-d-pdz06): form ôm, hướng thanh lịch hơn. Gợi ý trên trang: polo trắng với quần tây đen; polo nâu với kaki hoặc quần âu tối màu. Shop cũng nêu mặc đi làm, đi học, đi chơi, hẹn hò, smart casual.

Hai mẫu polo không mặc cùng một cảm giác: một chiếc rộng phủ mông, một chiếc ôm. Chọn form trước, rồi mới nghĩ tới quần.

## 4. Áo thun thêu form oversize (pdz07)

[pdz07](/products/ao-thun-nam-oversize-localbrand-vai-cotton-hinh-theu-lon-form-rong-the-tha-pdz07) được mô tả là áo thun form rộng oversize, họa tiết thêu trước ngực, màu đen và trắng. Trang này không liệt kê sẵn loại quần như các mẫu kia. Nếu muốn gợi ý cụ thể, hỏi shop hoặc xem lookbook trên trang chủ.

## 5. Lookbook trên trang chủ

Mục “Phối cùng PDZ” nói rõ: 8 mẫu áo PDZ, mỗi mẫu một bộ phối cùng balo và túi đang bán. Look 01 (đang hiện trên trang chủ lúc soạn bài) gồm:

- Áo thun minimalism pdz01, màu Cream và Basic Gray
- Túi đeo chéo nam form ngang, màu Kaki
- Túi tote hình thú kèm móc khoá, màu Be

Shop đang để tuỳ chọn xem cả bộ. Các look 02–08 nằm trong cùng slider trên trang chủ.

## Mua và đổi size

Xem áo trong [collection áo thun](/collections/t-shirtz). Chọn size theo bảng trên đúng sản phẩm, hoặc đọc [bài hướng dẫn chọn size](/huong-dan-chon-size). Đặt trên paranoidz.vn, COD hoặc VietQR, giao SPX. Đổi trả 7 ngày theo [chính sách](/policy).

## FAQ

**Áo thun Paranoidz phối với quần gì?**  
Các trang áo boxy vải nhung gợi ý jean, short, jogger. Áo dập nổi cotton gợi ý jeans, short, cargo hoặc jacket. Polo oversize gợi ý cargo, jean ống rộng, kaki, short, sneaker trắng. Polo form ôm gợi ý tây, kaki, âu.

**Có cần mua đủ balo túi như lookbook không?**  
Không. Lookbook là gợi ý phối với hàng đang bán. Có thể chỉ lấy áo.

**Mặc đi làm được không?**  
Polo pdz06 được shop mô tả cho đi làm và smart casual. Polo oversize pdz05 được nêu là đi làm casual. Áo thun graphic hay dập nổi: trang sản phẩm nghiêng về đi học, đi chơi, cafe, streetwear — không ghi là áo công sở.

**Paranoidz là brand nào?**  
Local brand streetwear Việt Nam, website chính [paranoidz.vn](/). Áo thun và polo là dòng PDZ; balo và túi là các dòng đang bán thêm trên cùng site.`,
  },
  "huong-dan-chon-size": {
    h1: "Cách chọn size áo thun và polo Paranoidz",
    title: "Cách chọn size áo thun, polo Paranoidz | Bảng size",
    description:
      "Hướng dẫn chọn size áo Paranoidz theo đúng bảng trên từng mẫu: boxy vải nhung, áo dập nổi cotton, polo oversize và polo form ôm. Không dùng một bảng cho cả shop.",
    body: `Paranoidz là local brand streetwear Việt Nam. Trên [paranoidz.vn](/), mỗi áo PDZ có bảng size riêng — có mẫu chỉ ghi theo cân nặng, có mẫu ghi thêm số cm và chiều cao. **Không dùng một bảng size chung cho cả shop.**

## Trả lời ngắn

1. Mở đúng trang sản phẩm, xem form (boxy, oversize, hay ôm) và bảng size của mẫu đó.  
2. Nếu chỉ có mốc kg: chọn size trùng cân nặng của bạn. Muốn rộng hơn form sẵn có, đọc dòng lưu ý trên trang (một số mẫu khuyên tăng size, một số mẫu nói không cần).  
3. Nếu có số rộng áo / dài áo: so với áo đang mặc (đo khi áo trải phẳng) sẽ chính xác hơn là chỉ nhìn kg.  
4. Phân vân: gọi hoặc nhắn Zalo 0345 267 709, hoặc email support@paranoidz.vn.  
5. Không vừa: đổi size trong 7 ngày theo [chính sách](/policy) — đổi size thì khách chịu phí vận chuyển phát sinh.

## Vì sao không có một bảng cho tất cả?

Tại thời điểm 17/11/2026, các dòng áo PDZ đang dùng mốc khác nhau. Ví dụ cùng chữ “size L”, áo thun boxy pdz01 ghi 55–65 kg, trong khi pdz02, pdz03, pdz04, pdz08 ghi 55–70 kg. Polo oversize pdz05 và polo ôm pdz06 lại đo bằng cm, kèm chiều cao và cân nặng, và hai bảng cm đó không giống nhau.

Nếu gom thành một bảng “chuẩn Paranoidz”, khách dễ chọn nhầm. Bài này tách từng nhóm đúng như trên site.

## Nhóm 1 — Áo thun boxy vải nhung (pdz01, pdz02, pdz08)

Form trên trang: boxy, form rộng, unisex. Các trang này **không đăng số rộng áo / dài áo**, chỉ gợi ý theo kg. Shop ghi nếu thích mặc rộng hơn form boxy sẵn có thì tăng một size (câu này có trên pdz01, pdz02, pdz08).

**pdz01** (thêu minimalism):

| Size | Gợi ý cân nặng |
| --- | --- |
| M | 40–55 kg |
| L | 55–65 kg |
| XL | 65–80 kg |

**pdz02** (thêu vịt vàng) và **pdz08** (thêu logo tròn pdz+):

| Size | Gợi ý cân nặng |
| --- | --- |
| M | 40–55 kg |
| L | 55–70 kg |
| XL | 70–85 kg |

Lưu ý: L và XL của pdz01 hẹp hơn hai mẫu kia. Đừng lấy bảng pdz02/pdz08 để chọn pdz01.

## Nhóm 2 — Áo thun dập nổi cotton 250gsm (pdz03, pdz04)

Form trên trang: form rộng, oversize / boxy fit, unisex. Tab bảng size gợi ý theo kg. Shop ghi số đo thực tế có thể lệch 1–2 cm. **Không có số rộng áo / dài áo** tại thời điểm soạn.

| Size | Gợi ý cân nặng trên pdz03 và pdz04 |
| --- | --- |
| M | 40–55 kg |
| L | 55–70 kg |
| XL | 70–85 kg |

## Nhóm 3 — Polo oversize pdz05 (có số cm)

Form trên trang: oversize, rộng phủ mông, unisex. Shop nói không cần tăng size trừ khi thích mặc rộng hẳn. Người mẫu trên trang: cao 1m80, nặng 65 kg, mặc XL. Sai số 1–2 cm.

| Size | Rộng áo | Dài áo | Dài tay | Gợi ý chiều cao / cân nặng |
| --- | --- | --- | --- | --- |
| M | 54 cm | 64 cm | 22 cm | Dưới 1m70, dưới 60 kg |
| L | 56 cm | 68 cm | 23 cm | Dưới 1m75, dưới 73 kg |
| XL | 58 cm | 72 cm | 24 cm | Dưới 1m85, dưới 95 kg |

## Nhóm 4 — Polo vải gân form ôm pdz06 (có số cm)

Form trên trang: ôm sát, hướng nam, thanh lịch. Shop lưu ý: áo form ôm, nếu thích mặc thoải mái thì cân nhắc tăng một size. Sai số 1–2 cm.

| Size | Dài áo | Ngực | Gợi ý chiều cao / cân nặng |
| --- | --- | --- | --- |
| M | 67 cm | 48 cm | Dưới 1m70, dưới 60 kg |
| L | 69 cm | 50 cm | Dưới 1m75, dưới 73 kg |
| XL | 71 cm | 52 cm | Dưới 1m85, dưới 95 kg |

Cách đo ngực ở đây là số trên trang sản phẩm; trang không mô tả chi tiết cách đặt thước. Nếu cần, hỏi shop.

## Mẫu chưa dùng được trong bài này

Trên trang [pdz07](/products/ao-thun-nam-oversize-localbrand-vai-cotton-hinh-theu-lon-form-rong-the-tha-pdz07) (áo thun thêu, form oversize), khối size trong mã nguồn đang bị vỡ, không đọc thành bảng rõ ràng. Bài này **không chép lại số từ khối đó**. Cần tư vấn size pdz07, hỏi shop qua hotline hoặc Zalo 0345 267 709.

## Một vài tín hiệu từ đánh giá trên site (không phải bảng size)

Trên trang chủ, Paranoidz đăng đánh giá khách (ghi là lấy từ Shopee paranoidz.studio). Có nhận xét: người 70 kg mặc áo thun minimalism, size L vừa, nhưng đặt XL để rộng hơn; và một nhận xét polo vải gân: cao 1m75, nặng 74 kg, size L vừa. Đây là trải nghiệm từng người, không thay bảng chính thức, cũng không áp cho mọi mẫu.

## Đổi size khi không vừa

Theo [chính sách](/policy): đổi trả trong 7 ngày kể từ khi nhận hàng; hàng chưa giặt, chưa dùng, còn nguyên tem mác. **Đổi size hoặc đổi mẫu:** liên hệ 0345 267 709 hoặc support@paranoidz.vn, khách chịu phí vận chuyển phát sinh. **Trả hàng:** cửa hàng gửi SPX lấy tại địa chỉ giao và chịu phí vận chuyển trả hàng; tiền hoàn không gồm phí ship lúc gửi đi.

## FAQ

**Tôi 65 kg nên mặc size nào?**  
Không có câu trả lời chung. Với pdz01, 65 kg đang nằm ở mốc cuối size L / đầu XL. Với pdz02/pdz03/pdz08, 65 kg nằm trong L (55–70 kg). Với polo, phải xem thêm chiều cao và số cm. An toàn nhất: mở đúng PDP hoặc hỏi shop.

**Form boxy đã rộng, tôi còn tăng size nữa không?**  
Các trang boxy vải nhung khuyên: form đã rộng; tăng size khi muốn rộng hơn nữa.

**Polo oversize thì sao?**  
pdz05: shop nói không cần tăng size trừ khi muốn rộng hẳn. Người mẫu 1m80, 65 kg mặc XL.


Xem toàn bộ áo: [collection áo thun](/collections/t-shirtz).`,
  },
} satisfies Record<string, Article>;
