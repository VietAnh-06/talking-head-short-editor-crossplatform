---
name: talking-head-short-editor
description: "Edit real talking-head footage (one person speaking to camera, e.g. expert Q&A; multi-clip videos are concatenated) into a viral vertical short with Remotion: whisper-based cuts, cold open, comment-reply card, literal B-roll per spoken noun, transitions, word-highlight captions, Mixkit SFX with voice ducking, wind/rustle denoise, -14 LUFS master, and a new content-fitted style per video so videos do not look alike. Also builds faceless voice-over shorts from an approved script read by VieNeu-TTS (one take per line, extra takes only for lines whisper or the pitch check flags; the user listens before visuals are built) with full-frame B-roll, a bright cover at frame 0 and motion rules (staggered entrances, fast exits, idle breathing, rough-notation highlights). Use when the user gives a recorded clip or an approved voice-over script and asks to edit/build it professionally or make it viral (dựng/edit video quay, video talking head, video giọng đọc AI, short viral, Reels/TikTok). Not for pure motion-graphics videos without voice or footage (use remotion or hyperframes skills) or simple trims."
---

# Talking Head Short Editor

Dựng clip người nói quay thật (dọc, một bối cảnh cố định) thành short 60–90 giây xem được không cần tiếng, đúng chuẩn kênh giáo dục viral, cho người làm nội dung/thương hiệu tiếng Việt. Chuẩn chất lượng: không có đoạn nào chỉ là cái đầu người nói, hình minh họa đúng từng câu, chữ rõ, SFX đa dạng không che giọng, và mỗi video mang một style khác video trước.

## Khi dùng

- Người dùng đưa file quay (một người nói, phỏng vấn, hỏi–đáp, chia sẻ) và muốn dựng chuyên nghiệp/viral, thêm minh họa, phụ đề, hiệu ứng.
- Người dùng muốn dựng tiếp một loạt video cùng kênh nhưng không trùng màu sắc.
- Một video quay thành nhiều file (nhiều cảnh, nhiều lần bấm máy): ghép thành một nguồn rồi dựng như một clip.
- Thêm một phiên bản đọc bằng giọng máy (VieNeu-TTS, giọng Bắc/Nam/Trung dựng sẵn) của video đã dựng, hoặc dựng thẳng video giọng đọc từ một kịch bản đã duyệt (không có người nói, B-roll phủ kín): theo `references/tts-voice-version.md`.
- Không dùng cho: video thuần đồ họa/hoạt hình không có giọng đọc hay footage (skill remotion/hyperframes), cắt ghép đơn giản, vlog nhiều cảnh quay (cần dựng theo cảnh, không theo lời).

## Cách làm

Thứ tự dưới đây là bắt buộc vì bước sau dùng kết quả bước trước. Chi tiết lệnh và cấu hình: `references/edit-workflow.md`.

Đọc mục **Checklist yêu cầu video** bên dưới trước khi bắt đầu (ô đầu tiên: phong cách mới), đối chiếu từng ô trước khi báo xong.

Lệnh `./scripts/…` chạy trong thư mục project; `new-project.py`, `new-video.py`, `concat-footage.py` và `sync-template.py` nằm trong `scripts/` của skill. Skill chạy được trên Windows, macOS và Linux: script Python chạy qua `uv run scripts/<tên>.py` (không gọi `./scripts/x.py` trực tiếp, Windows không đọc shebang), Python trong venv gọi bằng `uv run -p .venv-align python …` (uv tự tìm `Scripts\python.exe` trên Windows). Trên Windows, Claude Code chạy lệnh qua Git Bash, nên các lệnh dưới đây giữ nguyên cú pháp; đường dẫn Windows viết dạng `C:/Users/...`. Project dựng thường không phải repo git (footage hàng GB) nên không tạo được worktree: làm thẳng trong project và chép lưu file `src/talking/` trước khi sửa code dùng chung.

1. **Project.** Chưa có thì `uv run scripts/new-project.py <thư-mục>` (cần node, ffmpeg, uv, ImageMagick, mạng; lần đầu tải model whisper large-v3). Có rồi thì dùng lại.
2. **Khởi tạo video.** Nhiều file quay của một video thì ghép trước: `uv run scripts/concat-footage.py <nguồn.mov> <file1> <file2>...` (theo thứ tự cảnh, tự xoay theo cờ rotation, in ranh giới cảnh). Rồi `uv run scripts/new-video.py <project> <file-quay> <slug> [style]`. Style truyền vào chỉ là chỗ tạm: bước 7 tạo style mới cho video.
3. **Âm thanh giọng.** `measure-voice-noise.py <slug>`; nền thấp hơn giọng < 10 dB (quay ngoài trời, gió, lá) thì `denoise-voice.py <slug> <nguồn>` và gửi người dùng file A/B 6 s nghe trước. Làm trước EDL vì đổi track giọng làm đổi toàn bộ điểm cắt (`references/voice-audio.md`).
4. **Phân tích.** Xem khung trích của **từng cảnh** (máy quay chĩa nhầm chỗ, chỉ có tiếng: đoạn đó phải phủ kín B-roll/đồ họa) và bản chép lời (bỏ tiếng đếm "1, 2, 3, máy chạy" giữa cảnh); xác định thể loại, câu đắt nhất cho cold open, đoạn câu hỏi, các ý, chỗ vấp/lặp (`references/viral-editing-playbook.md`). Trình bày ngắn phân tích này cho người dùng. Mọi ảnh ghép để xem (khung trích, thumbnail, still) thu về khoảng 400 KB trước khi đọc (`magick … -resize 1100x -quality 55`), vì ảnh lớn hơn bị chặn đọc và phải làm lại.
5. **EDL.** Sửa `./scripts/edits/<slug>.json`, dựng lại, nghe bản ghép bằng `verify-edit-voice.py` cho đến khi sạch chữ thừa/thiếu, rồi chạy `find-voice-leaks.py --write` để bỏ tiếng đệm/chữ lặp ("ừm", "em, em") mà whisper chép thường bỏ qua, và `check-cut-edges.py` để chắc không mép nào cắt giữa âm tiết hay phát lại một khúc.
6. **Phụ đề.** `caption-talking-edit.py`; sửa chính tả, cụm từ khóa trong cấu hình. Video giọng máy: đặt `captions.script` để chữ lấy từ kịch bản (`show`), whisper chỉ cho mốc.
7. **Style + B-roll + âm thanh.** Code style mới và đồ họa đặc trưng giao cho sub-agent `sonnet` chạy song song (người dùng chốt 22/10/2026, `references/graphics-delegate.md`): model chính chốt hợp đồng thiết kế `out/qa/<slug>-design.md` (ẩn dụ, bảng màu, font, hằng số bố cục, nội dung từng đồ họa), export hằng số bố cục và tên kiểu trước, rồi gọi cùng lúc agent A (style) và agent B (`overlays.tsx`) cùng với lúc đọc giọng và agent dò B-roll; model chính ráp và duyệt. Tạo style mới hợp nội dung (bảng màu, font có subset tiếng Việt, kiểu B-roll/chuyển cảnh/tiêu đề, nhạc) theo `references/style-presets.md`, đăng ký trong registry và `.style-ledger`, rồi chạy `uv run --with numpy python ./scripts/check-style-novelty.py <slug>` cho tới khi `ĐẠT` (cổng: style chưa video nào dùng, khác video trước ≥ 4 trục, có ít nhất một kiểu hình mới). Dò/xem/tải cảnh Mixkit theo từng danh từ; khai báo `BEATS` với nhãn, `hit`, `amb` (`references/broll-and-sound.md`).
8. **Bìa + đồ họa + tiêu đề + logo.** (Code bìa của bố cục mới do agent A viết, code đồ họa đặc trưng do agent B viết; model chính nối `Headline`/đồ họa vào file video và duyệt still.) Khung bìa ở khung 0 (`cover` của `TalkingShort`: giấy sáng, tiêu đề hook cỡ lớn) để video không "đen đầu", cộng poster ảnh đại diện thiết kế riêng (`CoverPoster`, không cắt từ video); tiêu đề hai tầng mỗi ý; một đồ họa đặc trưng hợp nội dung (level, checklist, thước đo, dòng thời gian...); thẻ bình luận và màn kết kéo bình luận. Mọi chuyển động theo `references/motion-design.md` (helper `src/talking/motion.tsx`: vào 2–3 thuộc tính, lệch nhịp, ra nhanh hơn vào, thở khi chờ, số đếm lò xo, nét dạ quang/khoanh vẽ tay bằng rough-notation, không emoji làm icon). Logo thương hiệu/đối tác (người dùng cung cấp hoặc SVG chính thức từ website của họ) đặt trên nền sáng, không che mặt.
9. **Duyệt ảnh** 8–12 khung (gồm một khung đang chuyển cảnh); `node ./scripts/qa-frames.mjs` render hàng loạt still nhanh bằng `remotion still`, sửa bố cục, rồi mới render.
9a. **Video giọng máy: người dùng nghe giọng trước khi dựng hình.** `uv run ./scripts/tts-build.py` xong thì gửi file `du-lieu/video-xuat/nghe-thu-giong/<slug>-giong.mp3` kèm bảng mốc câu và chờ trả lời trước khi chép lời/dựng timeline (người dùng 22/10/2026: whisper chỉ bắt lơ lớ khi nó làm lệch chữ; lỗi giọng lộ ra sau render là nguyên nhân chính của nhiều vòng sửa). Trong lúc chờ chỉ làm việc không phụ thuộc thời gian giọng.
9b. **Kiểm âm trước khi render hình** (người dùng 22/10/2026: tránh sửa đi sửa lại): `uv run ./scripts/preflight-audio.py <Id> <slug>` render bản trộn và stem SFX chỉ âm thanh (song song, không vẽ khung; đừng chạy lúc máy đang render video khác, vì hai lệnh render cùng lúc từng treo hàng giờ) rồi `audio-layers.py` in từng chữ whisper nghe sai kèm lớp gây ra (GIỌNG / SFX / NHẠC) và các SFX dài hơn 1,5 s. Chỉ sửa lỗi lớp SFX; lớp GIỌNG thì nghe lại câu (chọn lần đọc khác), lớp NHẠC/GIỌNG mà giọng riêng nghe đúng thì ghi giây cho người dùng nghe, không render lại vì nó. Gộp mọi lỗi critic/still/âm thành **một** lượt sửa rồi mới render.
10. **Render → master → kiểm tra → giao** (chỉ khi `check-style-novelty.py` đã `ĐẠT`; `master-loudness.py`, `verify-final.py` gồm độ to từng đoạn; âm thanh giống bản trộn `out/qa/<slug>-mix.wav` của bước 9b (`audio-same.py`, lệch ≤ 2 dB) thì không chạy whisper lại, `--full` để ép, rồi `uv run scripts/deliver.py <slug> [video-NNN-<slug>]`). Trước khi giao, xuất bìa `npx remotion still src/index.ts <Id>Poster out/final/<slug>-cover.jpg` và viết mô tả TikTok `out/final/<slug>-caption.txt` (người dùng 23/10/2026: mỗi video có file mô tả kèm theo): 1–2 câu trả lời đúng câu hook, 1 dòng nguồn ngắn, 3–5 hashtag, không viết đoạn dài, không thêm số lời không nói; `deliver.py` chuyển thành `du-lieu/video-xuat/<tên-giao>.txt` và cảnh báo khi thiếu bìa hoặc mô tả (chạy lại sau khi bổ sung thì chỉ chép phần thiếu). Chạy nền vì mất vài phút; nối các lệnh bằng `&&` để render lỗi không bị master lại bản cũ. **Mỗi video chỉ một file thành phẩm** (người dùng 22/10/2026): `deliver.py` chuyển `out/final/<slug>.mp4` sang `du-lieu/video-xuat/`, ghi đè bản trước, kèm bìa, xoá render thô; không tạo `-v2`, `-r1`, `box-<ip>/` hay bản chép thứ hai. Dừng một render đang chạy bằng `pkill -f '[r]emotion render.*<Id>'` (macOS/Linux): ngoặc vuông giữ cho mẫu không khớp chính dòng lệnh shell chứa nó (khớp thì shell tự bị giết, exit 144, và render vẫn chạy). Windows không có `pkill`: tìm PID bằng `powershell -NoProfile -c "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? CommandLine -match 'remotion render.*<Id>' | select ProcessId"` rồi `taskkill //PID <pid> //T //F`.
11. **QA bản final + critic.** `cut-strips.py <slug>` (hình + sóng âm ±1,5 s mọi điểm cắt, tự đánh dấu khung đen/bụp), `qa-frames.mjs … --every=15` + `face-check.py` (đồ họa che mặt), rồi giao bằng chứng cho critic sub-agent chỉ tìm lỗi; sửa lỗi CHẶN, tối đa 3 lượt; chọn giữa hai cách sửa bằng so cặp hai chiều (`references/critic-review.md`).
12. **Đưa bản sửa chung về template.** Lỗi sửa trong code khung (`src/talking`, `src/components`, `./scripts`) là lỗi của mọi video sau: chạy `uv run scripts/sync-template.py <project>` để thấy file lệch, `--pull <file...>` các file đã sửa, rồi typecheck template. Không làm thì project mới tạo từ skill mang lại lỗi cũ.
### Chạy song song

Ngay sau khi lời được duyệt, chạy cùng lúc bốn việc: đọc giọng (`tts-build.py`, chạy nền), sub-agent dò B-roll, agent A `sonnet` viết style, agent B `sonnet` viết đồ họa đặc trưng (`references/graphics-delegate.md`). Mỗi agent giữ file riêng; file video `<slug>-short.tsx`, registry và `.style-ledger` thuộc model chính. Khi chờ render, chạy critic trên bằng chứng QA của still đã có, đừng đợi.

Render bản cuối tại máy theo `references/edit-workflow.md` (mục render): `npx remotion render … && master-loudness.py && verify-final.py`, rồi `deliver.py`. Mỗi lúc chỉ chạy **một** render (cả `preflight-audio.py`): hai render cùng lúc trên một máy dễ treo hoặc hết RAM. Nhiều agent dựng song song thì để model chính chạy render nối tiếp trong một lệnh (`render a && render b`); `flock` không có trên macOS/Windows.

### Đa dạng

Mỗi video tạo **một style mới** hợp nội dung của nó (người dùng đã chốt: không chỉ xoay vòng style có sẵn), cộng thêm ít nhất 3 trục khác (hook, đồ họa đặc trưng, nhịp B-roll, câu kéo bình luận, bộ SFX). Danh mục style, cách chọn theo nội dung và cách thêm style: `references/style-presets.md`.

### Ràng buộc

- Không bịa thông tin: tên, chức danh, số liệu, lời hứa chỉ lấy từ lời người nói hoặc người dùng cung cấp. Đồ họa không ghi con số người nói không nói.
- Giữ nguyên nghĩa lời người nói; được cắt, không được ghép thành câu mang nghĩa khác. Câu nói nhịu làm ngược nghĩa thì bỏ.
- Khóa API (Pexels, Gemini...) chỉ đọc từ môi trường lúc chạy, không ghi vào file, không in ra.
- Chỉ dùng nguồn hình/âm có giấy phép thương mại (Mixkit Free, tài sản người dùng cung cấp, âm tổng hợp). Không dùng ảnh CC-BY-SA cho video quảng cáo.
- Mỗi video chỉ một file thành phẩm trong `du-lieu/video-xuat/`; bản sửa ghi đè file đó qua `deliver.py` và báo người dùng là đã thay. Video đã đăng thì không dựng lại.

### Checklist yêu cầu video (bắt buộc, đối chiếu từng ô trước khi báo xong)

Ô nào chưa đạt mà vẫn giao thì ghi vào "điểm chưa kiểm chứng" của báo cáo. Cách kiểm chi tiết từng ô: `references/video-checklist.md`.

**A. Phong cách mới (người dùng đã chốt: mỗi video một phong cách khác)**
- [ ] Style viết mới cho chính video này, hợp nội dung (có ẩn dụ hình ảnh từ chủ đề); style `new-video.py` gán lúc đầu chỉ là tạm.
- [ ] `uv run --with numpy python ./scripts/check-style-novelty.py <slug>` in `ĐẠT` **trước khi render**: style chưa video nào dùng, khác video trước ≥ 4/7 trục, có ít nhất một kiểu B-roll/chuyển cảnh/tiêu đề mới, **bộ khung (nền + chỗ đặt hình) khác video liền trước** và không dùng lại clip của video liền trước (`style-presets.md`, mục "Bộ khung"). Đặt still của video mới cạnh still video trước: nhìn lướt vẫn thấy cùng khuôn thì chưa đạt.
- [ ] Khác video trước thêm ≥ 3 trục: hook, đồ họa đặc trưng, nhịp B-roll, câu kéo bình luận, bộ SFX.

**B. Nội dung**
- [ ] Không bịa tên/số liệu/lời hứa; tên riêng theo tài liệu người dùng; giữ nghĩa câu, câu nói hai lần dùng lần trọn vẹn.
- [ ] Cold open là câu đắt nhất; đã bỏ lời chào, tiếng đếm "1, 2, 3, máy chạy", câu vấp; màn kết có câu kéo bình luận.

**C. Âm thanh**
- [ ] `measure-voice-noise.py` chênh giọng−nền ≥ 10 dB, hoặc đã `denoise-voice.py` và người dùng nghe A/B xác nhận.
- [ ] `find-voice-leaks.py` hết "BỎ ĐƯỢC" (cửa sổ "không kiểm được" đã nghe bằng `listen-edit.py`); `check-cut-edges.py` không còn đoạn chồng nhau, mép "giữa âm tiết" đã nghe.
- [ ] Giọng máy (VieNeu): đã phiên âm các từ cần phiên âm (từ nước ngoài, chữ viết tắt và mã, số và ký hiệu; điều kiện ở `references/tts-voice-version.md`, mục "Kịch bản") và chốt từ mới bằng file thử (4–6 cách viết, có cách để nguyên chữ gốc, đọc ở temperature 0,1 trong đúng câu của bài, người dùng nghe tai chọn; không tin whisper). Lấy mẫu mặc định 0,1 + top_k 10. Không lọc micro, không rút khoảng nghỉ, không tăng tốc, không chọn theo ngữ điệu (scripts tự làm khi có `out/tts/<slug>-voice.wav`). Giọng kênh Linh: Đoan Trang.
- [ ] `preflight-audio.py` đã chạy trước render hình: không còn chữ sai lớp SFX; chữ sai lớp GIỌNG/NHẠC đã ghi giây vào báo cáo.
- [ ] SFX đa dạng, `align` mặc định `start` (canh onset/peak đã thử, gây che chữ), không che chữ, một câu tối đa 2 hit, `check-style-novelty.py` không cảnh báo SFX lặp > 2; chữ nghe sai đã khoanh vùng theo lớp (giọng ghép → stem SFX → trước master), không đoán.

**D. Hình**
- [ ] Khung B-roll ≥ 45 % khung hình (cổng `check-style-novelty.py` chặn); ưu tiên clip dọc (`vertical-<từ khóa>`), clip 16:9 cắt sát chủ thể bằng `focusX` (người dùng chê hình minh họa nhỏ 22/10/2026).
- [ ] Không vẽ thanh tiến trình (timeline) chạy theo thời gian video: TikTok/Reels đã có thanh riêng (người dùng bỏ 22/10/2026).
- [ ] Không đoạn nào chỉ có đầu người nói; cảnh quay nhầm (chỉ có tiếng) phủ kín B-roll/đồ họa; B-roll đúng nghĩa đen, nhãn đúng cái đang thấy.
- [ ] Người trong B-roll hợp thị trường (kênh Việt/Hàn: người châu Á; không có thì tay/đồ vật/phố, không mặt người phương Tây); mọi clip đã gắn nhãn trong `public/broll/people-tags.jsonl` (`references/broll-and-sound.md`).
- [ ] Đã duyệt 8–12 still (có một khung đang chuyển cảnh): không chữ mồ côi, phụ đề trong vùng an toàn; nền màn kết có người nói.
- [ ] `face-check.py` không còn khung CHE MẶT; `cut-strips.py` không còn KHUNG ĐEN/BỤP và các tờ dải cắt đã đọc (nhảy hình, lớp phủ kẹt).
- [ ] Critic sub-agent đã chạy trên bằng chứng QA; không còn lỗi CHẶN (`references/critic-review.md`).

**D2. Chuyển động và bìa** (`references/motion-design.md`)
- [ ] Khung 0 là bìa sáng, tiêu đề hook đọc được trong vùng an toàn; poster bìa thiết kế riêng (`CoverPoster`, Still `<Id>Poster`) đã xuất `out/final/<slug>-cover.jpg` và đọc bản cắt 3:4; still khung 14 (bìa đang thu) không lộ khung đen.
- [ ] Không chuyển động tuyến tính (trừ kim đồng hồ), mọi `interpolate` có clamp; vào 2–3 thuộc tính, lệch nhịp; ra nhanh hơn vào; đồ họa đứng > 2 s có `breathe`.
- [ ] Một điểm nhấn màu mỗi khung; nét dạ quang/khoanh dùng `MarkerHighlight`/`MarkerCircle`, ≤ 2 nét mỗi đồ họa; không emoji làm icon; Lottie (nếu có) đã kiểm giấy phép từng file.

**E. Thương hiệu**
- [ ] Logo thương hiệu (và đối tác nếu được nhắc tên) ở hook/CTA, trên đồ họa có tên, ở màn kết; nền sáng; nguồn logo rõ ràng.

**F. Giao hàng**
- [ ] `verify-final.py`: 1080×1920@30, −14 LUFS, độ to từng đoạn không cảnh báo (màn kết lệch thoại ≤ 8 LU, cold open không nhỏ hơn thoại > 3 LU), không khung đen, whisper nghe đủ lời đúng thứ tự (ngoài câu bịa trên nhạc màn kết); render mới thật (so mtime), chuỗi lệnh nối `&&`.
- [ ] `uv run scripts/sync-template.py <project>` không còn file "project mới hơn" do bản sửa chung của lần dựng này.
- [ ] Mỗi video đúng một file trong `du-lieu/video-xuat/` (đã chạy `deliver.py`, `out/final` không còn bản của slug); báo cáo gồm thể loại và hướng dựng, style mới và vì sao hợp nội dung, những gì đã cắt, nguồn hình/âm/logo và giấy phép, điểm chưa kiểm chứng, câu hỏi còn mở. Lỗi đã gặp: `references/pitfalls.md`.

## Tài nguyên

- `references/video-checklist.md`: checklist yêu cầu video, mỗi dòng kèm cách kiểm.
- `references/graphics-delegate.md`: hợp đồng thiết kế, brief agent A (style) và agent B (đồ họa đặc trưng) chạy `sonnet` song song, phân quyền file.
- `references/motion-design.md`: luật chuyển động (rút từ remotion-dev/skills, haidrrrry/claude-remotion-skill, article-highlights), khung bìa, nét vẽ tay rough-notation, Lottie, thẻ bài báo cho video tin tức, cách kiểm.
- `references/tts-voice-version.md`: video giọng VieNeu (giấy phép, chọn giọng, cách viết chữ cho máy đọc, đọc 1 lần, chỉ đọc thêm câu sai chữ hoặc lên giọng sai bằng `tts-build.py` (`tts-takes.py` + `tts-pick.py`), người dùng nghe giọng trước khi dựng, file video không cảnh người nói).
- `references/critic-review.md`: chuẩn bị bằng chứng QA, prompt critic sub-agent, xử lý kết quả, so cặp hai chiều.
- `references/edit-workflow.md`: lệnh từng bước, cấu trúc `./scripts/edits/<slug>.json`, `BEATS`, `Headline`, duyệt và render.
- `references/viral-editing-playbook.md`: nhận diện thể loại, cấu trúc thời gian, quy tắc cắt/hình/chữ/âm, phản hồi người dùng đã chốt.
- `references/style-presets.md`: style có sẵn, cách tạo style mới cho mỗi video, các trục đa dạng.
- `references/voice-audio.md`: đo ồn, khử ồn DeepFilterNet, ngưỡng dò tiếng `vadThresholdDb`, mép cắt/chữ lặp, khoanh vùng SFX che chữ.
- `references/broll-and-sound.md`: nguồn hình và giấy phép, dò/tải Mixkit, thư viện SFX, gắn âm theo cảnh, ducking, nhạc nền.
- `references/pitfalls.md`: triệu chứng → nguyên nhân → cách xử lý.
- `uv run scripts/new-project.py <dir>`: tạo project từ `assets/template` (Remotion + script dựng), cài phụ thuộc, sinh nhạc, tải SFX.
- `uv run scripts/concat-footage.py <ra.mov> <file...>`: ghép nhiều file quay của một video thành một nguồn.
- `uv run scripts/new-video.py <project> <file> <slug> [style]`: chuẩn bị footage, chép lời, khung EDL/phụ đề, file video, đăng ký composition, ghi style.
- `uv run scripts/sync-template.py <project> [--pull|--push <file...>]`: liệt kê code khung lệch giữa project và `assets/template`, chép bản sửa chung theo chiều đã chọn.
- `assets/template/`: project mẫu; `src/talking/motion.tsx` (helper chuyển động), `src/talking/cover.tsx` (khung bìa); script trong project nằm ở `assets/template/scripts/` (chuẩn bị footage, cổng style mới `check-style-novelty.py`, QA `qa-frames.mjs` / `cut-strips.py` / `face-check.py`, giọng máy `tts-build.py` (`tts-takes.py` + `tts-pick.py`) / `tts-voiceover.py`, so âm `audio-same.py`, đo ồn `measure-voice-noise.py`, khử ồn `denoise-voice.py`, EDL, dò âm thừa, phụ đề, kiểm tra, dò Mixkit, tải B-roll/SFX, nhạc, master).
- `assets/video-template.tsx`: khung file video (BEATS, TalkingShort có `cover`, Headline).
