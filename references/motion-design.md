# Chuyển động, khung bìa và nét vẽ tay

Đồ họa AI tự viết thường lộ ra mấy dấu hiệu "video AI": mọi thứ bật vào cùng một kiểu lò xo, hiện xong thì đứng im tuyệt đối, biến mất đột ngột, chuyển động tuyến tính, nét dạ quang là một hình chữ nhật CSS phẳng, và icon là emoji. Tài liệu này là luật chung cho mọi overlay, tiêu đề và đồ họa riêng. Helper nằm ở `src/talking/motion.tsx`, khung bìa ở `src/talking/cover.tsx`.

Rút từ [haidrrrry/claude-remotion-skill](https://github.com/haidrrrry/claude-remotion-skill) (MIT), bộ quy tắc chính thức [remotion-dev/skills](https://github.com/remotion-dev/skills) (`remotion-markup`: timing, text-highlights, lottie, motion-blur) và `article-highlights` của [Liamrjohnston/remotion-motion-graphics-skill](https://github.com/Liamrjohnston/remotion-motion-graphics-skill) (MIT). Đã chỉnh cho video giọng đọc dọc 9:16 có phụ đề, áp lần đầu ở topik-003 (10/2026).

## 1. Luật chuyển động

| Luật | Cách làm trong project | Vì sao |
|---|---|---|
| Không tuyến tính | Vào bằng `useEnter`/`spring` (`SPRING.snappy`, `smooth`, `pop`); trượt có kiểm soát dùng `EASE.out/in/inOut`. Mọi `interpolate` có `extrapolateLeft/Right: 'clamp'` | Tuyến tính trông như máy, và giá trị trôi ra ngoài khoảng khi thiếu clamp |
| Vào bằng 2–3 thuộc tính | `enterStyle(p, rise, scaleFrom)`: mờ→rõ + trồi/rơi + phóng nhẹ. Không dùng mỗi một cái fade | Một thuộc tính trông rẻ |
| Lệch nhịp | Phần tử trong một nhóm vào cách nhau `STAGGER.word` 3, `row` 4, `chip` 3, `block` 6 khung (`stagger(at, i)`). Khi mỗi dòng neo theo chữ được đọc thì lời đã tự lệch nhịp, không cộng thêm | Vào đồng loạt là dấu hiệu AI rõ nhất |
| Ra nhanh hơn vào | `exitStyle(frame, to)`: 8 khung (`EXIT_FRAMES`), mờ + trượt lên, so với 15–20 khung lúc vào | Cảnh sau cần chỗ; ra chậm làm nhịp lê thê |
| Thở khi chờ | Đồ họa đứng > 2 s (tờ giấy, thẻ) dùng `breathe(frame, seed, 0.6)` sau khi vào xong: nổi 3 px, phóng 1,2 %, mỗi phần tử một `seed` | Đứng im tuyệt đối trông như ảnh dán |
| Có lúc đứng yên | Nhịp "bật → giữ 15–20 khung → dựng tiếp". Không cho mọi thứ chuyển động liên tục; `breathe` đủ nhỏ để vẫn đọc như đứng yên | Tương phản động–tĩnh mới thấy đắt |
| Số đếm bằng lò xo | `useCounter(at, from, to)` + `fontVariantNumeric: 'tabular-nums'`. Chỉ đếm khi con số đích là số được nói; không đếm về 0 để minh họa "hết chỗ" (người xem đọc thành "0 chỗ"), dùng con dấu thay | Đếm tuyến tính trông giả, chữ số nhảy bề ngang |
| Phóng to/nhỏ cảm nhận đều | `interpolate(..., {output: 'perceptual-scale'})` khi animate `scale` lớn (bìa thu về, con dấu đập xuống) | Scale tuyến tính trông nhanh dần ở cuối |
| Một màu nhấn mỗi khung (lớp đồ họa) | Trong lớp đồ họa (tiêu đề, tờ giấy, thẻ), màu nhấn (`emphBg`) chỉ ở một chỗ đang được nói; phần còn lại mực/giấy. Phụ đề là lớp riêng, có màu từ-đang-đọc của style, không tính vào luật này | Nhiều điểm nhấn cùng lúc thì mắt không biết nhìn đâu |
| Không emoji làm icon | Vẽ ký hiệu bằng SVG/ký tự trong font style (✓ ✗ •), hoặc Lottie (§4) | Emoji ra màu hệ điều hành, phá bảng màu, khác nhau giữa máy |
| Giữ chữ đọc được | Chữ trong tờ giấy ≥ 32 px ở 1080 rộng (nhãn tiêu đề tờ ≥ 30 px), nhãn chính ≥ 40 px; không làm mờ dòng mà lời đang nói tới; chữ hoa có dấu cần `lineHeight` ≥ 1,25 và không đặt `overflow: hidden` lên khối chữ một dòng; danh sách dài thì chỉ giữ 3–4 dòng mới nhất, không giữ chỗ cho dòng chưa hiện | topik-003: dòng chưa hiện vẫn giữ 64 px nên tờ giấy dài xuống đè thẻ B-roll |

Mốc thời gian: neo theo cụm từ (`f('cụm')`) hoặc tính từ fps; không ghi số khung "ma thuật" trừ độ lệch nhỏ trong cùng một đồ họa (+6, +8).

## 2. Khung bìa (bắt buộc cho mọi video)

Khung 0 là ảnh đại diện trên lưới hồ sơ, là khung người xem thấy khi video đang tải, và là ảnh xem trước khi chia sẻ. Bản giọng máy mở bằng B-roll trên nền tối nên khung 0 trông "đen đầu" (người dùng nhận xét, topik-003 v1).

- Khai báo `cover={{kicker, title, hi, sub}}` trong `<TalkingShort>`. `CoverCard` hiện đủ ở khung 0, giữ `COVER_HOLD` 10 khung rồi thu về đúng vùng tiêu đề hook trong `COVER_EXIT` 8 khung. Giọng vẫn chạy từ khung 0, nên không mất nhịp hook.
- `title` nói đúng câu hook (không hứa khác lời), 2–3 dòng, ngắt dòng bằng `\n`. `hi` là từ khóa, được tô màu nhấn và có nét dạ quang vẽ tay. `sub` là một câu tóm lời hứa của video, có thể nói thêm thông tin mà thân bài sẽ nói.
- Nền là giấy sáng của style (`palette.surface`). Chữ nằm trong vùng an toàn: từ 420 px trở xuống, tên kênh ở trên 1450 px (giao diện TikTok che đáy và phải).
- Ảnh đại diện tải lên là poster riêng (mục dưới), không dùng khung này.
- Kiểm: still khung 0 (bìa đủ, không chữ mồ côi), khung 14 (bìa đang thu, không lộ khung đen), khung 20 (hook đã về chỗ).

### Poster bìa (ảnh đại diện tải lên, thiết kế riêng)

Ảnh bìa tải lên TikTok là một poster làm riêng, không cắt từ khung video (người dùng chốt 20/10/2026). Khung bìa trong video (trên) chỉ để video không mở bằng màn tối.

- Component `CoverPoster` (`src/talking/poster.tsx`), theo màu/font của style video: nhãn + số chuỗi ở trên, ảnh lớn nghiêng (khung đẹp nhất của B-roll chủ đạo, tách bằng `ffmpeg -ss <giây> -i public/broll/<clip>.mp4 -frames:v 1 public/img/<slug>-poster.jpg`, chọn khung nét, đọc được ngay chủ đề), con dấu mốc chính trên ảnh, tiêu đề cỡ lớn có nét dạ quang ở từ khóa, một câu phụ, tên kênh đầy đủ.
- Khai báo `export const <Comp>Poster` trong file video và `poster: <Comp>Poster` trong `registry.tsx`; `root.tsx` tự đăng ký Still `<Id>Poster`. Xuất: `npx remotion still src/index.ts <Id>Poster out/final/<slug>-cover.jpg`.
- Vùng an toàn: lưới hồ sơ TikTok cắt về 3:4 giữa khung (y ≈ 240–1680); kiểm bằng `magick <cover> -gravity center -crop 1080x1440+0+0 +repage` và đọc ảnh cắt. Mọi chữ, con dấu, tên kênh phải còn nguyên.
- Tiêu đề poster nói cùng lời hứa với hook (có thể khác chữ với bìa trong video); con dấu chỉ ghi số liệu đã có trong lời.

## 3. Nét vẽ tay (`@remotion/rough-notation`)

Dùng `MarkerHighlight` (dạ quang dưới chữ) và `MarkerCircle` (khoanh tròn) trong `motion.tsx`, không tự vẽ hình chữ nhật CSS. `progress` chạy theo khung (12–14 khung), nét có độ run tay, nằm dưới chữ.

- Chỉ tô cụm có ý nghĩa đã được nói hoặc đã kiểm chứng (con số, hạn, điều kiện), không tô cả đoạn. Một đồ họa tối đa 2 nét.
- Màu dạ quang: `palette.accent` với alpha `cc`, không phát sáng, không bóng màu.
- Nét bắt đầu 6–8 khung sau khi chữ hiện, để mắt đọc chữ trước rồi mới thấy nét.
- `seed` khác nhau giữa các nét trong cùng khung để không giống hệt nhau.

## 4. Lottie cho icon động

Icon động do designer làm sẵn (tick, lịch lật, ổ khóa đóng, đồng hồ cát, máy bay) mượt hơn hẳn icon AI tự vẽ. Dùng `@remotion/lottie` (cài cùng phiên bản `remotion` của project).

- Tải file JSON về `public/lottie/`, không fetch URL ngoài lúc render. Nạp bằng `delayRender()`/`continueRender()`, lỗi thì `cancelRender`.
- Giấy phép: kiểm giấy phép từng file trước khi dùng cho video thương mại (trang tải của file đó), ghi nguồn và giấy phép vào báo cáo. Không rõ giấy phép thì không dùng.
- Chỉnh màu Lottie theo bảng màu style (lớp màu trong JSON) hoặc chọn file có màu trung tính; Lottie lệch màu phá luật một màu nhấn.
- Điều khiển khung của Lottie theo `useCurrentFrame()` (`playbackRate`, `Sequence`), không để tự chạy vòng lặp lệch lời.

## 5. Thẻ bài báo cho video tin tức (trụ tin, chính sách)

Khi video dựa trên một thông cáo/bài báo Hàn (Bộ Tư pháp, NIIED, báo lớn), dựng thẻ bài báo thay cho câu tiêu đề lặp lời:

- Nguồn thật: tên cơ quan/báo, ngày, tiêu đề đúng như bản gốc (có thể kèm dịch). Không bịa trích dẫn, ngày, số liệu. Ảnh chụp màn hình bài gốc là bằng chứng tốt nhất; làm mờ phần không liên quan.
- Lớp: nền cảnh → tờ giấy (trắng ngà, viền trung tính, bóng trung tính) → nét dạ quang → chữ. Nét luôn dưới chữ.
- Chuyển động: mờ→rõ ngắn (lấy nét quang học, không phát sáng), đẩy máy chậm + xoay phối cảnh nhẹ; nét tô lần lượt từ trái sang phải sau khi lấy nét xong; kết thúc bằng một nhịp giữ khi mọi cụm đã tô.
- Cấm: neon, glow, bóng màu, gradient tím–xanh, kính mờ. Chữ trên thẻ phải đọc được ở kích thước thật trên điện thoại.

## 6. Kiểm tra

- Still ở 4 thời điểm cho mỗi đồ họa: trước khi vào, đang vào (giữa nhịp lệch), giữ, đang ra. Thấy phần tử hiện trước mốc vào hoặc còn sau mốc ra là thiếu clamp.
- Xem chuyển động nghi vấn ở tốc độ 0,25× trong Remotion Studio: lỗi easing không thấy ở 1× rất rõ ở 0,25×.
- Critic (`critic-review.md`) chấm thêm: có chỗ nào vào đồng loạt, đứng im tuyệt đối > 2 s, ra chậm hơn vào, nhiều hơn một điểm nhấn trong khung, emoji làm icon.
