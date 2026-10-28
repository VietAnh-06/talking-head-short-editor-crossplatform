# Style preset và cách tránh các video giống nhau

Style nằm ở `src/talking/style.tsx` của project. Một style đổi đồng thời: bảng màu, font (đều có subset tiếng Việt), kiểu phụ đề, bố cục B-roll, chuyển cảnh, kiểu tiêu đề, tông màu (tint/vignette/grain), nhạc nền và bộ SFX chuyển cảnh/pop.

## Style có sẵn (thư viện để tái kết hợp, không phải danh sách để xoay vòng)

| id | Cảm giác | Font | Phụ đề | B-roll | Chuyển cảnh | Tiêu đề | Nhạc |
|---|---|---|---|---|---|---|---|
| `clean-explainer` | Explainer sạch, tin cậy | Be Vietnam Pro | `pill`: khối từ khóa nền màu | `card`: thẻ 960×800 giữa khung trên nền mờ | `zoomwhip`: zoom-blur + whip-pan | `kicker`: nhãn nhỏ + câu lớn | uplift 96 BPM |
| `bold-news` | Bản tin, khẩn, mạnh | Oswald + Montserrat | `box`: dải hộp đen, từ khóa nền đỏ | `fullbleed`: tràn khung + dải nhãn dưới | `flash`: chớp trắng | `boxed`: thanh đỏ + hộp đen | news 112 BPM giọng thứ |
| `warm-vlog` | Gần gũi, kể chuyện | Baloo 2 | `bounce`: chữ viền dày nảy lên | `polaroid`: ảnh nghiêng dán băng keo | `slide`: trượt đẩy | `tape`: sticker dán băng keo | lo-fi 78 BPM swing |
| `editorial` | Tạp chí, chín chắn | Playfair Display + Lexend | `underline`: tối giản, gạch chân từ đang đọc | `split`: B-roll trên, người nói dưới | `soft`: mờ chéo | `serif`: nhãn nghiêng + đường kẻ | piano 68 BPM |
| `tech-neon` | Công nghệ, trẻ | Bricolage Grotesque + Lexend | `glow`: chữ phát sáng | `card` viền neon | `glitch`: rung + sọc màu | `kicker` neon | synth 120 BPM |
| `seoul-pass` | Tuyển sinh/du học Hàn, hành trình | Big Shoulders + Archivo | `pill` đỏ-xanh Thái Cực | `ticket`: boarding pass có cuống vé, mã vạch, logo thương hiệu | `stripe`: vạch chéo đỏ-xanh quét ngang | `board`: bảng giờ bay, từng chữ lật | kpop 104 BPM I–V–vi–IV |
| `receipt-ledger` | Chi phí, tiền bạc, cảnh báo nợ (clip-13) | Anton + Barlow | `box` | `receipt`: tờ hóa đơn in nhiệt nhả ra từ khe máy in, nhãn là dòng mục hàng có chấm dẫn | `tear`: mép giấy xé răng cưa quét dọc | `ledger`: mẩu biên lai số mục đỏ | ledger 92 BPM giọng thứ, piano rải |
| `answer-sheet` | Thi cử, TOPIK, hạn đăng ký (topik-003) | Saira Condensed + IBM Plex Sans | `pill` | `omr`: phiếu trả lời trắc nghiệm, vạch định vị lề trái, khung kẻ hồng, hàng 5 ô A–E có một ô được tô | `bubble`: cảnh mới lộ qua lưới chấm tròn lớn dần (tô ô trắc nghiệm) | `exam`: dải giấy thi lề đỏ đôi, nhãn câu hỏi, vệt dạ quang quét dưới câu | exam 86 BPM vi–IV–I–V, hats 16 như kim giây |
| `airmail` | Hồ sơ, giấy tờ, visa, gửi bản gốc (truong-018) | Alfa Slab One (`displayEm` 0,7) + Bitter | `underline` | `envelope`: phong bì thư máy bay viền sọc đỏ–xanh, dòng "Từ:" tên kênh, tem răng cưa có dấu bưu điện đóng đè, nhãn ở dòng "Gửi" | `postmark`: dải giấy có vạch dấu hủy tem lượn sóng và vòng dấu đỏ quét ngang | `stamp`: dấu cao su đỏ viền đôi đập xuống làm nhãn, câu chính mực xanh trên giấy kraft có viền sọc | airmail 98 BPM I–vi–IV–V, piano rải, clap thưa |
| `passbook` | Tiền gửi, số dư, mốc thời gian tài chính (truong-018-kyhe) | Roboto Slab + Mulish, số JetBrains Mono | `ink`: mực tối trên giấy, từ đang đọc nền vàng dạ quang | `passbook` **toàn trang**: trang sổ giấy kem kẻ dòng, đầu trang dải xanh ngân hàng, B-roll là dải ngang tràn bề rộng y 210–810, dòng "GD 00n" gõ nhãn | `print`: dòng mới in từ trên xuống | `entry`: dòng giao dịch (cột loại giao dịch + vạch chấm, câu chính mực xanh, kẻ dưới) ở y 1120 | passbook 84 BPM I–iii–vi–IV, piano rải |
| `phone` | Thu chi, làm thêm, tính tiền, app (tien-019) | Manrope + Nunito | `chat`: bong bóng chat trắng, từ đang đọc xanh | `phone` **toàn trang**: giao diện app (đầu xanh, thanh tab dưới), B-roll là bài đăng bo tròn y 350–990 | `swipe`: vuốt story từ phải | `notify`: thông báo đẩy trượt xuống từ trên | app 108 BPM IV–I–V–vi |
| `film` | Cảnh giác, điều tra, chuyện có thật (canh-009) | Oswald + Inter | `block`: chữ hẹp khổng lồ, từ đang đọc khối vàng | `film` **toàn trang**: nền đen hạt phim, dải phim 35 mm có lỗ răng cưa chạy ngang y 700–1260, nhãn khung "01A ▸" | `advance`: khung phim kéo từ phải, nhòe ngang | `kinetic`: chữ khổng lồ trên dải phim, nhãn đỏ cắt chéo | noir 90 BPM i–VII–VI–V, rè phim |
| `ho-so` | Hồ sơ, giấy tờ, nơi nộp, thủ tục visa (visa-017) | Merriweather + Work Sans, mã JetBrains Mono | `typed`: chữ đánh máy mực xanh, từ đang đọc gạch chân đỏ, từ khóa tô dạ quang | `dossier` **toàn trang**: bìa giấy kraft có tab "HỒ SƠ VISA · D-4", tờ hồ sơ kem; B-roll là ảnh kẹp ghim y 910–1510, hơi nghiêng, nhãn "Mục 0n" đóng dấu đỏ | `slide`: ảnh trượt vào, nghiêng nhẹ | `seal`: dấu cao su đỏ viền đôi đập xuống, câu chính serif mực xanh ở y 230–676 | piano |
| `alba-night` | Làm thêm, việc làm, ca tối, cửa hàng (truong-007) | Bungee (`displayEm` 0,62) + Kanit | `glow` | `storefront` **toàn trang**: mặt tiền cửa hàng đêm, mái hiên sọc bạc hà–kem có diềm lượn, B-roll là ô kính 1020×1000 tràn bề ngang y 310–1310 (49 %), nhãn là tờ "TUYỂN" có tua xé dán góc dưới trái kính, phản quang chéo trên kính | `shutter`: cửa cuốn kéo lên từ đáy ô kính, cảnh mới lộ dưới thanh thép | `timecard`: thẻ chấm công trượt xuống mép trên ô kính, dải đầu thẻ màu nhấn đóng "cạch", cột ô giờ bên phải | nightshift 100 BPM city pop IV–iii–vi–ii |
| `sikpan` | Ăn uống, giá món, tiền ăn, đi chợ (tien-013) | Paytone One (`displayEm` 0,56) + Quicksand | `bounce` | `tray` **toàn trang sáng**: khay cơm inox xước trên bàn gỗ, B-roll trong ngăn lớn bo góc 980×980 y 90–1070 (46 %), nhãn là phiếu ăn 식권 mép răng cưa trượt vào góc dưới trái, hai bát tròn + đũa ở chân khay (vùng nút TikTok) | `checker` | `menuboard`: bảng menu gỗ trong ngăn dưới y 1122, dòng kicker có chấm dẫn tới ô ₩ đỏ, câu chính chữ kem | sikdang 94 BPM I–IV–ii–V, swing, piano rải |
| `myeongse` | Lương, làm thêm, quyền người lao động, bị trả thiếu (tien-016) | Chakra Petch (`displayEm` 0,58) + Signika | `ink` | `payslip` **toàn trang sáng**: phiếu lương 급여명세서 trên bàn xám lục, dải đầu xanh lục, B-roll trong ô "chi tiết" 960×980 y 130–1110 (45 %), nhãn là dòng mục "0n │ …" số mục đỏ, chân trang "Ký nhận" + vòng dấu mờ | `clockwipe` | `redpen`: thẻ giấy ở vùng dưới y 1140, kicker cột chấm dẫn, từ `hi` gạch chân/khoanh bút đỏ vẽ tay | myeongse 88 BPM Am–F–C–G, piano rải, hats thưa |
| `suseup` | Thử việc, điều kiện luật, đủ/thiếu điều kiện (tien-015) | Exo 2 (`displayEm` 0,52) + Sarabun, số LCD Roboto Mono | `box` | `console` **toàn trang tối**: tủ điện thép xước có ốc vít, dải công tắc nhôm ở trên y 96–408, B-roll là màn hình giám sát bezel đen 960×980 y 432–1412 (45 %), nhãn Dymo vàng dập nổi ở góc trên trái màn hình; `PAGE.endTop` đưa màn kết vào trong kính | `crt`: màn hình tắt kiểu CRT ép thành vạch rồi chấm, bung ra cảnh mới (12 khung, chỉ trong ô) | `dymo`: kicker băng Dymo, từ `hi` dập trên băng vàng, trong dải công tắc | suseup 100 BPM Dm–Bb–F–C, pluck tắt tiếng |
| `simsa` | Thẩm định hồ sơ, số liệu bị soi, tỷ lệ bất hợp pháp (tinhan-001) | Unbounded 700 + Space Grotesk, số JetBrains Mono | `underline` | `lightbox`: thảm cắt xanh tối, B-roll trong hộp đèn soi giữa trang (45,5 %), tờ bằng chứng đặt lên đèn kèm kính lúp và dải dạ quang | `backlight`: đèn hộp tắt rồi bật sáng cảnh mới | `foldertab`: tai bìa hồ sơ, dải dạ quang quét dưới chữ | simsa 92 BPM Em–C–G–D, piano staccato |
| `danso` | Bị bắt, xử phạt, vi phạm (tinhan-002) | Roboto Condensed 800 + Public Sans, biểu mẫu IBM Plex Mono | `typed` | `citation` nền SÁNG: ảnh hiện trường/ảnh báo tràn mép trên 47 %, mép xé răng cưa, tờ biên bản giấy than vàng ở dưới | `policeline`: băng cảnh sát vàng quét chéo | `formfield`: ô điền biểu mẫu 860×300 | danso 112 BPM Gm–Eb–Bb–F, bass xung, còi hai tông rất nhỏ |
| `hwanseung` | Lộ trình chính sách có mốc năm, kế hoạch dự kiến (tinhan-003) | Fira Sans Condensed + Overpass, số Overpass Mono | `bar` xanh tuyến 2 | `platform`: tường gạch men sân ga, B-roll sau cửa kính chắn tàu (45,4 %), bảng giờ tàu lật chữ ở dưới | `screendoor`: hai cánh cửa kính khép rồi mở | `splitflap`: ô lật theo TỪ (không theo ký tự), một tiếng | hwanseung 96 BPM Fmaj7–Am7–Dm7–Bbmaj7, `peak` 0,93 |
| `yeokjeon` | Vượt lên, xếp hạng, tăng trưởng (tinhan-004) | Anybody 800 + Epilogue | `pill` | `track`: mặt đường chạy tartan đỏ cam có vạch làn, dải ảnh tràn ngang giữa trang 49 % với vạch đích ca-rô | `photofinish`: quét ảnh đích kiểu chụp vạch đích | `bib`: số áo thi đấu ghim bốn góc | yeokjeon 112 BPM E–B–C#m–A, stomp-clap, brass ngắn |

### Kiểu chuyển cảnh chưa style nào dùng

Viết sẵn trong `broll.tsx`, gán vào `transition` của style mới. `check-style-novelty.py` tính chúng là kiểu mới cho tới khi một style dùng. Ý tưởng chuyển từ `lib/transitions` của [claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) (MIT), viết lại cho mô hình một lớp CSS của template.

| id | Hình | Hợp với |
|---|---|---|
| `clockwipe` (myeongse đã dùng) | kim màu nhấn quét một vòng từ 12 giờ quanh tâm khung, cảnh mới lộ sau kim; về người nói thì kim quét tiếp | hạn chót, đếm ngược, lịch thi, "còn bao lâu" |
| `checker` (sikpan đã dùng) | ô vuông 135 px mở lan chéo từ góc trên trái, về người nói thì thu lại ngược thứ tự | lựa chọn, so sánh, checklist, bảng điểm |
| `lightleak` | vệt sáng ấm (accent2 → trắng kem → accent) quét chéo, cảnh mới phơi sáng quá rồi về đúng | kỷ niệm, hành trình, chuyện cảm xúc, vlog |

Không chuyển `rgbSplit` (phải vẽ cảnh 3 lần, 3 `OffthreadVideo`), `pixelate` (CSS không làm sạch được) và `zoomBlur` (trùng `zoomwhip`).

Đổi style khi render mà không sửa code: `--props='{"style":"warm-vlog"}'`. Mặc định của từng video ghi trong `src/videos/registry.tsx`.

## Bộ khung, không chỉ lớp trang trí

Người dùng xem video 2 (airmail) cạnh video 1 (answer-sheet) và hỏi "sao thấy styled giống video trước nhỉ?" (20/10/2026). Hai style khác 7/7 tên trục nhưng cùng một bộ khung: nền B-roll mờ tối + thẻ giấy ở giữa + mẩu giấy tiêu đề trên + phụ đề y 1418 + bìa giấy sáng. Người xem nhận ra bộ khung trước, màu và họa tiết sau.

- Mọi bố cục cũ trừ `fullbleed` và `split` là cùng một khung ("nền B-roll mờ tối / thẻ giữa / phụ đề dưới").
- Bố cục toàn trang (`passbook`, `phone`, `film`, `dossier`) khai báo trong `PAGE` của `style.tsx` (vị trí phụ đề, tiêu đề, nền sáng hay tối). Nền trang vẽ một lần bằng `PageBackdrop` dưới lớp B-roll, cảnh chỉ vẽ phần ảnh, nên chuyển cảnh không kéo theo khung trang. Màn kết và bìa có biến thể riêng cho từng bố cục toàn trang.
- `check-style-novelty.py` có bảng `SKELETON` (nền, chỗ đặt hình, vùng phụ đề) theo bố cục B-roll: FAIL khi nền + chỗ đặt hình trùng video liền trước, và khi dùng lại clip B-roll của video liền trước. Thêm bố cục mới thì thêm dòng vào `SKELETON`.
- **Khung B-roll lớn.** Ô hiện clip phải chiếm ít nhất 45 % khung 1080×1920 (ví dụ 1080×860 trở lên). Clip Mixkit gần hết là 16:9 (kho 22/10/2026: 356 clip ngang, 12 clip dọc), nên khung nhỏ làm hình minh họa bé tí. Các bố cục `film`, `phone`, `dossier` (video 3–5) chỉ khoảng 21 % và bị người dùng chê "nội dung minh họa khá nhỏ" (22/10/2026). Muốn khung lớn thì để clip tràn bề ngang và cao khoảng nửa khung. Cắt clip 16:9 sát chủ thể bằng `focusX` của beat. Tiêu đề, phụ đề và đồ họa đặt đè lên ảnh, có lớp nền mờ hoặc thẻ đặc dưới chữ. `check-style-novelty.py` có bảng `BROLL_AREA` và FAIL khi bố cục dưới `MIN_BROLL_AREA`; thêm bố cục mới thì đo rộng × cao ô clip rồi thêm dòng vào bảng.
- Video liên tiếp nên đổi cả độ sáng nền (sáng ↔ tối) và chỗ đặt hình (dải trên, bài đăng, dải giữa, thẻ giữa, tràn khung).

## Mỗi video một style mới

Người dùng đã chốt (10/2026): **mỗi video tạo một style mới hợp nội dung của chính nó**, không chỉ chọn lại một style có sẵn theo `.style-ledger`. `new-video.py` vẫn ghi một style tạm để project chạy được; thay nó sau khi đọc bản chép lời.

1. Rút "giọng" của nội dung: chủ đề (tuyển sinh, cảnh báo, chia sẻ), đối tượng, quốc gia/thương hiệu, cảm xúc. Ví dụ: tuyển sinh du học Hàn có lộ trình, nên chọn ẩn dụ "chuyến bay": boarding pass, bảng giờ bay, màu cờ Hàn.
2. Chọn ẩn dụ hình ảnh và viết **ít nhất 1–3 kiểu mới** (B-roll layout, chuyển cảnh hoặc tiêu đề) trong `broll.tsx`, kết hợp với kiểu có sẵn cho phần còn lại. Chỉ đổi bảng màu thì người xem vẫn thấy "cùng một khuôn".
3. Bảng màu lấy từ chủ đề/thương hiệu, khác hẳn style của video trước trên kênh. Font mới chưa dùng trên kênh, có subset `vietnamese`.
4. Nhạc: thêm preset vào `generate-music-beds.py` (bpm, hợp âm, trống, arp; `length` nếu video dài hơn 60 s) rồi chạy `uv run --with numpy --with scipy python ./scripts/generate-music-beds.py <tên>`.
5. Đăng ký `style` cho video trong `src/videos/registry.tsx`, sửa dòng của video trong `.style-ledger`, chạy `uv run --with numpy python ./scripts/check-style-novelty.py <slug>` cho tới khi `ĐẠT`, rồi duyệt still ở 3 khung (người nói, B-roll, tiêu đề) và một khung **đang chuyển cảnh**.
6. Kiểu mới viết chung (đọc màu/font từ `useStyle()`), không nhúng chữ riêng của một video, để video sau tái kết hợp được.

Gợi ý theo nội dung khi cần điểm xuất phát: số liệu/khẩn cấp → nền từ `bold-news`; đời sống → `warm-vlog`; lời khuyên sâu → `editorial`; công nghệ → `tech-neon`; giải thích chung → `clean-explainer`; tuyển sinh/hành trình → `seoul-pass`; chi phí/tiền → `receipt-ledger`; thi cử/hạn chót → `answer-sheet`; hồ sơ/giấy tờ/visa → `airmail`. Chuyển động của mọi kiểu mới theo `motion-design.md`.

## Đa dạng ngoài style

Đổi style mà giữ nguyên mọi thứ khác vẫn lộ "cùng một khuôn". Mỗi video mới đổi thêm ít nhất 3 trục:

| Trục | Lựa chọn |
|---|---|
| Hook | câu đắt nhất làm cold open · câu hỏi gây tò mò · con số/kết luận · "sai lầm thường gặp" |
| Tiêu đề hook | chữ lớn 2 tầng · chữ nước ngoài/biểu tượng (빨리빨리) · câu hỏi · con số |
| Đồ họa đặc trưng | thẻ cấp độ/level · checklist · đồng hồ/thước đo · so sánh hai cột · dòng thời gian · bản đồ |
| Nhịp B-roll | dày (mỗi 1,5–2 s) · vừa (3–4 s) · ít cảnh dài cho chuyện cảm xúc |
| Câu kéo bình luận | chấm điểm 1–10 · chọn A/B · "bạn ở level mấy" · kể trải nghiệm |
| SFX đặc trưng | game (level-up, coin) · điện ảnh (impact, riser) · đời thường (bát đĩa, bút) |

## Thêm style mới

Trong `STYLES` của `style.tsx`, thêm một khóa với đủ trường của `StyleSpec` (`label`, `fonts`, `palette`, `caption`, `broll`, `transition`, `headline`, `grade`, `music`, `sfx`) và một hàm trong `FONT_LOADERS`:

```ts
'my-style': () => ({
  display: loadX('normal', {weights: ['700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  body: loadY('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
}),
```

- Font phải có subset `vietnamese` (kiểm tra trong `node_modules/@remotion/google-fonts/dist/cjs/<Font>.js`). Font không có subset này làm vỡ dấu.
- Font phải có cả bản ESM: `ls node_modules/@remotion/google-fonts/dist/esm/<Font>.mjs`. `tsc` vẫn qua nhưng Remotion bundle báo "Package path ./<Font> is exported … but no valid target file" (ví dụ `BigShouldersDisplay` chỉ có cjs, dùng `BigShoulders`).
- Kiểu chuyển cảnh mới vẽ lớp phủ (vạch, flash) ngoài phần nội dung bị cắt clipPath, và chỉ vẽ trong lúc chuyển: dùng `undefined` khi xong, không dùng giá trị cờ như `-1` vì lọt điều kiện vẽ và làm lớp phủ đứng yên che nhãn suốt cảnh.
- Kết hợp lại các kiểu `caption`/`broll`/`transition`/`headline` đã có trước khi viết kiểu mới; kiểu mới thêm vào `viral-captions.tsx` hoặc `broll.tsx`.
- Nhạc: thêm preset vào `<project>/scripts/generate-music-beds.py` (bpm, vòng hợp âm, trống, arp) rồi chạy lại.
- Duyệt bằng still ở 3 khung (người nói, B-roll, tiêu đề) trước khi dùng.
