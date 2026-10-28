# Sổ tay dựng short viral từ clip talking head

Đúc kết từ dựng thật hai video hỏi–đáp du học (người nói ngồi trước một bối cảnh cố định, quay dọc 4K) và phản hồi của người dùng qua nhiều vòng sửa.

## Nhận diện thể loại trước khi dựng

Xem 20–30 khung trích (mỗi 4 giây) và đọc bản chép lời. Phân loại:

| Thể loại | Dấu hiệu | Cách dựng chính |
|---|---|---|
| Hỏi–đáp chuyên gia (phổ biến nhất) | Một người đọc câu hỏi rồi trả lời; có ý 1-2-3 | Thẻ "trả lời bình luận" + B-roll nghĩa đen + tiêu đề từng ý |
| Mẹo / danh sách | "Thứ nhất, thứ hai..." | Checklist đánh dấu dần, mỗi ý một cảnh |
| Kể chuyện / trải nghiệm | Mốc thời gian, cảm xúc | Ít đồ họa, B-roll không khí, nhạc cảm xúc (style editorial/warm) |
| So sánh / cấp độ | "Trình độ thấp... cao..." | Đồ họa cấp độ (level, thang, cột), nhãn theo cấp |

Người xem thể loại giáo dục đến để lấy thông tin cụ thể và để quyết định có tin người nói hay không. Hình đứng yên quá 3–4 giây là mất người xem.

## Cấu trúc thời gian

1. **0–3 s, cold open:** câu đắt nhất của cả clip (thường là ẩn dụ hoặc kết luận: "như một cái nồi áp suất", "ngôn ngữ càng tốt càng nhiều cơ hội"), kèm tiêu đề hook 2–3 dòng chữ lớn. Không mở bằng lời chào.
2. **Câu hỏi:** nếu người nói đọc câu hỏi, hiện thành thẻ bình luận, chữ sáng dần theo lời; tắt phụ đề trong đoạn này để không lặp.
3. **Thân:** mỗi ý một tiêu đề lớn hai tầng; B-roll theo từng danh từ cụ thể.
4. **Kết:** lời khuyên của người nói (hiện toàn khung, giữ niềm tin) → màn kết 3–4 s: một câu hỏi kéo bình luận ("Chấm điểm 1–10", "Comment level 1, 2 hay 3"), logo, lời mời theo dõi/ưu đãi.

## Cắt

- Bỏ: lời chào, câu dẫn ("Đầu tiên chúng ta sẽ nói đến..."; tiêu đề đã làm việc đó), câu nói vấp, câu lặp ý, chữ nhịu, câu bị nói ngược nghĩa (phủ định kép). Rút 95 s còn 68–85 s là hợp lý.
- Bỏ tiếng đệm ("ừm", "ờ", "à") và chữ lặp ("em, em") kể cả khi nằm giữa câu: người xem nghe rõ dù bản chép lời không có. Dò bằng `find-voice-leaks.py`.
- Khoảng nghỉ > 0,28 s rút còn 0,1 s (jump cut). Lượng tử điểm cắt theo khung 1/30 s để hình, giọng, phụ đề không trôi.
- Ở chỗ nói liền không có khoảng lặng, đặt mốc cứng và nghe lại; chữ thừa thường lọt từ **điểm vào của đoạn sau**, không chỉ điểm ra của đoạn trước.
- Không thêm thông tin người nói không nói (tên, chức danh, số liệu). Thẻ bình luận ghi chung chung nếu không biết người hỏi là ai.

## Hình

- **Không để video chỉ có cái đầu người nói** và không dùng bong bóng mặt ở góc — người dùng đã bác cả hai. Dùng chuyển cảnh xen kẽ: người nói toàn khung ↔ cảnh minh họa toàn bố cục.
- B-roll nghĩa đen: người nói nói "rửa bát" thì thấy rửa bát. Mục tiêu 40–60% thời lượng là B-roll; người nói chỉ hiện ở câu hỏi, đầu mỗi ý/cấp độ và lời khuyên.
- Mỗi cảnh 1,5–4 s, neo vào cụm từ trong phụ đề (bật ~0,12 s trước khi từ được nói). Nhãn trên cảnh gọi tên cái đang thấy (2–4 từ).
- Một vùng một loại thông tin: trên = tiêu đề/đồ họa, giữa = hình, dưới = phụ đề. Tránh vùng giao diện app: trên 240 px, dưới 420 px.
- Punch-in xen kẽ hai cỡ ở các nhát cắt nhảy khi người nói hiện toàn khung (che bước nhảy của đầu).

## Chữ

- Phụ đề là kênh chính (đa số xem không tiếng): 1–3 khối mỗi trang, tô theo từng từ; cụm từ khóa sáng thành một khối và không bao giờ bị chẻ sang trang sau.
- Sửa chính tả whisper bằng bảng `fixes`; viết hoa đầu câu theo dấu câu/khoảng nghỉ thật.
- Tiêu đề hai tầng: nhãn nhỏ ("Ảnh hưởng #1", "Lời khuyên", "Tóm lại") + câu chính 3–6 từ, 1–2 từ khóa tô màu. Ngắt dòng chủ động (`\n`) để không mồ côi chữ.

## Âm thanh

- SFX thật, đa dạng, không lặp: chuyển cảnh xoay vòng nhiều tiếng; tiếng gắn với hình (bát đĩa, đồng xu, bút viết, đồng hồ); âm nền cảnh rất nhỏ.
- SFX phải nghe rõ: ngang đỉnh giọng khi nghỉ, ngang giọng trung bình khi đang nói (ducking nhẹ 0,6, SFX chuẩn hóa theo độ to cảm nhận). Nếu whisper nghe sai chữ ở chỗ có tiếng hit, bỏ hoặc dời tiếng đó.
- Giọng phải sạch trước mọi thứ khác: nền thấp hơn giọng < 10 dB là người xem nghe "xào xạc" (`voice-audio.md`).
- Nhạc nền 0,07 dưới giọng, lên ~0,3 ở màn kết. Master −14 LUFS, true-peak −1,5 dBTP.

## Phản hồi người dùng cần nhớ

| Phản hồi | Cách xử lý đã được chấp nhận |
|---|---|
| "Dùng khá ít hình minh họa" | B-roll theo từng danh từ, 19–25 cảnh / video |
| "Thay cả cảnh gốc bằng ảnh và video minh họa, text cần tốt hơn" | Bố cục explainer, tiêu đề hai tầng, phụ đề khối |
| "Không nên chỉ có cái đầu người nói, dùng chuyển cảnh" | Bỏ bong bóng mặt; xen kẽ toàn khung với chuyển cảnh |
| "SFX quá ít và lặp lại, cần SFX chất lượng cao, viral" | Thư viện Mixkit ~54 tiếng, xoay vòng, tiếng theo hình, ducking |
| "Thêm đa dạng style để video không giống nhau" | 5 style preset + xoay vòng theo `.style-ledger` |
| "SFX của các video mờ nhạt quá, cần tăng âm lượng" (editor chuyên nghiệp) | Chuẩn hóa SFX theo độ to cảm nhận, `SFX_GAIN` 1,6, ducking 0,6: SFX to hơn 4–6 dB, số chữ bị che không tăng |
| "Cắt âm thanh vẫn có chỗ lệch, như 2 từ 'em, em' rất ngắn whisper không detect" | `find-voice-leaks.py` (nghe nguyên văn + xác nhận + cắt thử), `drop` trong EDL, phụ đề tự dời mốc |
| "Tôi tưởng tạo style mới cho đa dạng? Luôn tạo style mới phù hợp nội dung" | Mỗi video một style mới (ẩn dụ hình ảnh + 1–3 kiểu B-roll/chuyển cảnh/tiêu đề mới), không chỉ xoay vòng `.style-ledger` |
| "Chèn logo LETCO, Daeduk vào chứ" | Logo thương hiệu + đối tác trên nền sáng: hook/CTA, thẻ B-roll, đồ họa có tên trường, màn kết |
| "Âm thanh nền xào xạc lắm, có vẻ là của voice" | Đo nền bằng `measure-voice-noise.py`, khử ồn DeepFilterNet, gửi A/B 6 s; người dùng nghe xác nhận "ngon" |
