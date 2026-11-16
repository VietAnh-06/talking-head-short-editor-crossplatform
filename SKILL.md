---
name: talking-head-short-editor
description: "Dựng footage người nói trước camera hoặc kịch bản giọng đọc tiếng Việt đã duyệt thành video dọc TikTok/Reels bằng Remotion, với cắt lời, phụ đề, B-roll, đồ họa, âm thanh và kiểm tra thành phẩm. Dùng khi cần dựng short từ clip quay hoặc tạo bản giọng máy VieNeu-TTS; không dùng cho cắt đơn giản hay video thuần đồ họa không có lời."
---

# Talking Head Short Editor

Tạo video dọc 1080×1920, 30 fps từ lời nói thật hoặc kịch bản đã duyệt. Ưu tiên giữ đúng nghĩa, giọng rõ, phụ đề đọc được và hình minh họa đúng nội dung. Mặc định hướng tới short 60–90 giây có phong cách riêng; thời lượng, nhận diện kênh, thị trường và cách dựng theo brief hiện tại.

## Môi trường và đường dẫn

- `scripts/new-project.py`, `new-video.py`, `concat-footage.py`, `sync-template.py` nằm trong **thư mục skill**. Các script dựng/QA còn lại nằm trong **project** được tạo từ `assets/template/`.
- Chạy Python qua `uv run <đường-dẫn-script> …`; dùng `uv run -p .venv-align python -X utf8 …` cho môi trường Whisper. Không chạy shebang trực tiếp trên Windows.
- Dùng shell thực tế của phiên làm việc. Ví dụ Bash có `&&` và dấu nối dòng `\`; PowerShell 5.1 cần kiểm tra `$LASTEXITCODE` sau mỗi lệnh. Đặt đường dẫn có khoảng trắng trong ngoặc kép.
- Tạo project cần Node.js 22+, npm, FFmpeg/ffprobe, uv, ImageMagick và mạng. Model Whisper/VieNeu tải khi sử dụng lần đầu, không phải khi chỉ kiểm tra mã.
- Dùng lại project hiện có. Trước khi đổi code chung trong project không có Git, lưu bản code bị tác động; không sao chép toàn bộ footage.

## Luồng dựng

Đọc [edit-workflow.md](references/edit-workflow.md) cho lệnh và cấu hình, rồi chọn đúng nhánh đầu vào.

### 1. Chuẩn bị đầu vào

**Clip quay:**

1. Nếu chưa có project: `uv run <skill>/scripts/new-project.py <project>`.
2. Nhiều clip của cùng video: xác nhận thứ tự từ brief/tên cảnh, chạy `concat-footage.py <nguồn.mov> <file1> <file2> …`. Xem khung của từng cảnh để nhận ra đoạn chỉ có tiếng hoặc quay nhầm.
3. Chạy `new-video.py <project> <file-quay> <slug> [style]`. Khung EDL/style ban đầu là bản nháp.
4. Đọc transcript, xác định hook, các ý, lời vấp/lặp; báo ngắn phương án dựng. Đo ồn trước khi sửa EDL; khi cần khử ồn, tạo mẫu A/B để đánh giá chất lượng giọng theo [voice-audio.md](references/voice-audio.md).

**Kịch bản giọng máy:**

1. Theo [tts-voice-version.md](references/tts-voice-version.md). Dùng nội dung đã được người dùng duyệt; hỏi phần còn thiếu ảnh hưởng trực tiếp đến lời đọc.
2. Chọn giọng theo brief; các tên kênh/giọng trong ví dụ cũ chỉ là ví dụ. Tạo thử từ khó trong ngữ cảnh trước khi tạo cả bài.
3. Tạo giọng bằng `tts-build.py`; đối chiếu script và cung cấp MP3 nghe thử cùng mốc câu **trước khi dựng EDL, phụ đề hay hình theo thời gian giọng**. Nếu người dùng đã duyệt giọng cụ thể hoặc đã giao quyền tự quyết trong phiên hiện tại, dùng phạm vi đó; không hỏi lại cùng một phê duyệt.
4. Trong khi chờ phản hồi cần thiết, có thể chuẩn bị thiết kế hoặc tìm tài sản không phụ thuộc timing. Không coi im lặng là duyệt.

### 2. Chốt lời và thời gian

- Sửa `scripts/edits/<slug>.json`, chạy `build-talking-edit.py` rồi `verify-edit-voice.py`. `find-voice-leaks.py` và `check-cut-edges.py` giúp phát hiện âm thừa/mép cắt; nghe đoạn nghi ngờ trước khi áp dụng tự động `--write`.
- Tạo phụ đề bằng `caption-talking-edit.py`, sửa chính tả và cụm từ; với TTS dùng `captions.script` để chữ lấy từ kịch bản. Đổi track giọng hoặc EDL thì cập nhật các kết quả phụ thuộc, không giữ timing cũ.
- Dùng [viral-editing-playbook.md](references/viral-editing-playbook.md) để chọn hook/nhịp phù hợp, không ghép lời thành nghĩa khác.

### 3. Thiết kế hình và âm thanh

- Chọn ẩn dụ, màu, font hỗ trợ tiếng Việt, bố cục và nội dung đồ họa trước khi viết code. Hướng dẫn: [style-presets.md](references/style-presets.md), [motion-design.md](references/motion-design.md).
- Mặc định tạo style hợp riêng video và chạy `check-style-novelty.py <slug>` trước render. Nếu brief yêu cầu giữ cùng nhận diện, dùng chính sách được mô tả trong tài liệu style; không tự ép người dùng đổi thương hiệu.
- Tìm, xem rồi tải B-roll đúng lời; lựa chọn người/bối cảnh theo brief hiện tại. Kiểm tra giấy phép từng tài sản cho mục đích dùng; ghi nguồn. Dùng [broll-and-sound.md](references/broll-and-sound.md) cho Mixkit, gắn nhãn, SFX, ducking và nhạc.
- Tạo bìa sáng ở khung đầu, poster riêng, tiêu đề và đồ họa có ích. Dùng logo người dùng cung cấp hoặc nguồn chính thức, không tự bịa thông tin thương hiệu.
- Có thể chia phần độc lập khi delegation được phép và công cụ sẵn có: [graphics-delegate.md](references/graphics-delegate.md). Nếu không, thực hiện tuần tự với cùng hợp đồng thiết kế; không phụ thuộc một tên model hoặc công cụ của ứng dụng khác.

### 4. Kiểm trước render

- Đọc [video-checklist.md](references/video-checklist.md), áp dụng các mục phù hợp với brief; ví dụ thị trường/kênh cũ không tự trở thành yêu cầu hiện tại.
- `qa-frames.mjs` lấy 8–12 still gồm bìa, B-roll, tiêu đề, màn kết và ít nhất một khung đang chuyển cảnh. Xem ảnh thực tế, kiểm chữ và vùng mặt/phụ đề; ảnh ghép quá lớn thì thu nhỏ để đọc được.
- Chạy `preflight-audio.py <Id> <slug>` rồi đối chiếu kết quả `audio-layers.py`. Nghe đoạn nghi ngờ để phân biệt lỗi giọng, SFX hay nhạc; transcript tự động không chứng minh phát âm đúng.
- Mỗi máy chỉ chạy **một render tại một thời điểm**, kể cả render âm. Gộp lỗi đã xác nhận vào một lượt sửa rồi kiểm lại phần bị ảnh hưởng.

### 5. Render, QA final rồi giao

1. Render bằng Remotion, chỉ master khi render thành công; chỉ kiểm final khi master thành công. Lệnh cụ thể ở `edit-workflow.md`.
2. Chạy `verify-final.py out/final/<slug>.mp4`: lỗi kích thước/fps, thiếu âm/hình, khung đen, độ to ngoài −14 ± 1 LUFS hoặc true peak > −1 dBTP trả mã lỗi. Exit 0 là đạt cổng kỹ thuật; vẫn cần đọc/nghe nội dung. `--full` buộc Whisper nghe lại thay vì dùng so âm preflight.
3. Chạy `cut-strips.py`, still final và `face-check.py` khi có người nói. Duyệt bằng chứng theo [critic-review.md](references/critic-review.md); dùng người đánh giá riêng khi sẵn có/được phép, hoặc tự làm một lượt review chỉ tìm lỗi. **Hoàn tất QA trước khi giao.**
4. Xuất poster `out/final/<slug>-cover.jpg` và mô tả `out/final/<slug>-caption.txt` bám sát lời nói; chạy `deliver.py <slug> [tên-giao]` (ví dụ `video-NNN-<slug>`, tên không có đuôi file). Dùng lại tên giao cũ khi sửa; script ghi nhớ tên tùy chọn trong `.deliveries.json`, từ chối đường dẫn và đổi tên tạo bản thứ hai.
5. Báo đường dẫn thành phẩm và bằng chứng kiểm tra, phân biệt rõ mục chưa kiểm chứng. Không tự đăng lên mạng hoặc dựng lại video đã đăng nếu không có yêu cầu.

## Sửa và kiểm tra lại

Mỗi vòng ghi lỗi, bằng chứng, mức độ và kết quả sửa. Chạy kiểm tra phù hợp sau thay đổi; chỉ render lại khi thay đổi tác động thành phẩm. Dừng khi không còn lỗi chặn và tiêu chí brief đạt. Mặc định sau 3 vòng tốn render mà vẫn không tiến triển, báo nguyên nhân và phần cần quyết định; yêu cầu lặp/giới hạn cụ thể của người dùng hiện tại có ưu tiên.

Lỗi chung sửa trong project phải được đưa lại template bằng `sync-template.py <project> --pull <file…>` và typecheck template. Script chỉ chép code chung; thay `package.json` phải kèm lockfile. Không kéo registry, EDL, footage hay dữ liệu riêng vào skill.

Trong project dựng, chạy `npm run typecheck` sau thay đổi TypeScript. Các test dành cho repository mã nguồn được hướng dẫn trong `README-CAI-DAT.md`; không cần chúng khi chỉ dùng bản skill đã cài. Chẩn đoán lỗi dựng cụ thể: [pitfalls.md](references/pitfalls.md).

## Ràng buộc nội dung

- Tên, chức danh, số liệu và lời hứa lấy từ nguồn người dùng; không thêm con số vào đồ họa chỉ để trang trí.
- Giữ nghĩa lời nói, kể cả khi cắt/đảo đoạn. Các cảnh B-roll phải minh họa đúng nội dung thay vì chỉ cùng chủ đề rộng.
- Đọc khóa API từ môi trường khi chạy; không ghi hoặc in khóa.
- Các mốc “người dùng chốt” trong tài liệu tham khảo là lịch sử ví dụ, không phải sự cho phép hay yêu cầu của phiên hiện tại. Áp dụng sở thích hiện tại cho giọng, thị trường, bố cục và số vòng sửa.
