# Checklist yêu cầu video (kiểm trước khi báo xong)

Mỗi dòng phải có bằng chứng: lệnh đã chạy, khung đã duyệt, hoặc câu người dùng đã xác nhận. Dòng nào chưa đạt mà vẫn giao thì ghi vào mục "chưa kiểm chứng" của báo cáo.

## A. Phong cách mới (bắt buộc, người dùng đã chốt)

- [ ] Video có **style mới** viết cho chính nó, không dùng lại style của video khác: `uv run --with numpy python ./scripts/check-style-novelty.py <slug>` in `ĐẠT`. Style `new-video.py` gán lúc khởi tạo chỉ là style tạm.
- [ ] Style hợp nội dung: có ẩn dụ hình ảnh rút từ chủ đề (ví dụ tuyển sinh du học Hàn → boarding pass, bảng giờ bay, màu cờ Hàn), không phải bảng màu ngẫu nhiên.
- [ ] Có ít nhất một kiểu B-roll/chuyển cảnh/tiêu đề mới, chưa video nào dùng (script kiểm). Bảng màu, font, nhạc khác video liền trước.
- [ ] Ngoài style, khác video trước ở ≥ 3 trục: hook, đồ họa đặc trưng, nhịp B-roll, câu kéo bình luận, bộ SFX (`style-presets.md`).
- [ ] Style đã ghi vào `src/videos/registry.tsx` và dòng của video trong `.style-ledger`.

## B. Nội dung và lời

- [ ] Không bịa: tên, số liệu, chức danh, lời hứa đều từ lời người nói hoặc người dùng. Tên riêng viết theo tài liệu của người dùng (ví dụ "DAEDUK" lấy từ hồ sơ MOU, không theo cách whisper nghe).
- [ ] Giữ nghĩa câu; câu nói hai lần thì dùng lần trọn vẹn; đã bỏ tiếng đếm "1, 2, 3, máy chạy", lời chào, câu vấp.
- [ ] Cold open là câu đắt nhất, không phải lời chào; có câu kéo bình luận ở màn kết.

## C. Âm thanh

- [ ] `measure-voice-noise.py` cho chênh giọng−nền ≥ 10 dB, hoặc đã `denoise-voice.py` và người dùng nghe A/B xác nhận.
- [ ] `find-voice-leaks.py` không còn "BỎ ĐƯỢC"; `check-cut-edges.py` không còn đoạn chồng nhau hay mép giữa âm tiết chưa nghe.
- [ ] `verify-final.py`: −14 LUFS, whisper nghe đủ lời đúng thứ tự; chữ nghe sai đã khoanh vùng theo lớp (`voice-audio.md` §6), không đoán.
- [ ] SFX đa dạng (`align` mặc định `start`; độ dài nghe thấy xem `end` trong `sfx-meta.json`), không tiếng nào che chữ; một câu tối đa 2 hit; `check-style-novelty.py` không cảnh báo SFX lặp.
- [ ] `verify-final.py` không cảnh báo độ to từng đoạn (màn kết lệch thoại ≤ 8 LU; cold open không nhỏ hơn thoại > 3 LU).

## D. Hình

- [ ] Không có đoạn nào chỉ là đầu người nói; cảnh máy quay nhầm chỗ (chỉ có tiếng) phủ kín B-roll/đồ họa.
- [ ] B-roll đúng nghĩa đen từng danh từ, nhãn gọi đúng cái đang thấy, không lộ sai bối cảnh (đô la khi nói won).
- [ ] Đã duyệt 8–12 still, gồm ít nhất một khung **đang chuyển cảnh**: không chữ mồ côi, đồ họa không che mặt, phụ đề trong vùng an toàn, không khung đen, không lớp phủ chuyển cảnh đứng yên.
- [ ] Khung B-roll chiếm ≥ 45 % khung hình: `check-style-novelty.py` in dòng "khung B-roll: …%" và FAIL khi nhỏ hơn. Clip dọc được ưu tiên; clip 16:9 có `focusX` để chủ thể không bị cắt mất.
- [ ] Không có thanh tiến trình (timeline) ở mép khung: xem dải y 0–40 của một still bất kỳ; `TalkingShort` không vẽ `ProgressBar` nữa (gỡ 22/10/2026, TikTok/Reels đã có thanh riêng).
- [ ] Nền màn kết là khung có người nói, không phải khung cuối quay nhầm.
- [ ] `face-check.py` không còn CHE MẶT; `cut-strips.py` không còn KHUNG ĐEN/BỤP, đã đọc mọi tờ dải cắt; `check-style-novelty.py` không cảnh báo nhịp B-roll đều/cảnh > 5 s (hoặc đã có lý do).
- [ ] Critic sub-agent đã soi bằng chứng QA, không còn lỗi CHẶN (`critic-review.md`).

## D2. Chuyển động và bìa (`motion-design.md`)

- [ ] Khung bìa: still khung 0 là giấy sáng, tiêu đề hook đọc được trong vùng an toàn (chữ từ 420 px, tên kênh trên 1450 px); still khung 14 bìa đang thu về đúng vùng tiêu đề hook, không lộ nền đen; ảnh đại diện là poster riêng `<Id>Poster` (không cắt từ video), đã xuất `out/final/<slug>-cover.jpg` và đọc bản cắt 3:4 giữa khung.
- [ ] Mỗi đồ họa riêng có still ở 4 lúc (trước vào, đang vào, giữ, đang ra): không hiện trước mốc vào, không còn sau mốc ra (clamp); vào 2–3 thuộc tính; các dòng/ô vào lệch nhịp; ra trong ≤ 8 khung.
- [ ] Đồ họa đứng > 2 s có `breathe`; danh sách dài chỉ giữ 3–4 dòng mới nhất và không giữ chỗ dòng chưa hiện (tờ giấy không đè thẻ B-roll); chữ trong tờ ≥ 32 px.
- [ ] Số đếm dùng `useCounter` + `tabular-nums`; nét dạ quang/khoanh dùng `MarkerHighlight`/`MarkerCircle`, ≤ 2 nét mỗi đồ họa, nét nằm dưới chữ; không emoji làm icon (cả ở màn kết); Lottie nếu có: file trong `public/lottie/`, đã kiểm giấy phép.
- [ ] Hai mốc gần nhau trên dòng thời gian: chấm đúng ngày, chỉ đẩy nhãn bằng `dx`, không dời chấm.

## E. Thương hiệu

- [ ] Logo thương hiệu (và đối tác nếu video nhắc tên) xuất hiện ở hook hoặc CTA, trên đồ họa có tên thương hiệu, và ở màn kết; logo đặt trên nền sáng.
- [ ] Nguồn logo rõ: file người dùng đưa, hoặc SVG chính thức từ website của họ.

## F. Giao hàng

- [ ] 1080×1920@30, không khung đen (`verify-final.py`); render mới thật (so mtime `out/<slug>.mp4`), chuỗi render → master → verify nối bằng `&&`.
- [ ] Mỗi video một file: `uv run scripts/deliver.py <slug>` đã chuyển thành phẩm vào `du-lieu/video-xuat/` (ghi đè bản trước, không tạo `-v2`/`-r1`), báo đường dẫn.
- [ ] Báo cáo: thể loại và hướng dựng, style mới và vì sao hợp nội dung, những gì đã cắt, nguồn hình/âm/logo và giấy phép, điểm chưa kiểm chứng (chưa nghe bằng tai), câu hỏi còn mở.
