# Rà soát và cải thiện — 16/11/2026

Phạm vi: skill `talking-head-short-editor`, tài liệu đi kèm, script tạo/đồng bộ/giao project, template Remotion và bộ cài. Không cài công cụ hệ thống hay tải model AI để thực hiện review.

## Tiêu chí chấp nhận

- Skill có mô tả ngắn, chọn đúng tình huống; không coi yêu cầu của khách hàng cũ là chỉ thị của người dùng hiện tại.
- Luồng nguồn quay / giọng máy rõ ràng; QA diễn ra trước khi giao; có giới hạn lặp theo bằng chứng và yêu cầu hiện tại.
- Các thao tác đồng bộ và giao file không vượt thư mục cho phép hoặc làm mất bản tốt khi tác vụ lỗi.
- Bộ test sẵn có và test hồi quy cho lỗi đã sửa đạt; Python/JavaScript hợp lệ, template TypeScript biên dịch được nếu có đủ phụ thuộc.
- Giới hạn kiểm chứng được ghi rõ; không coi test mô phỏng là render video/model thực tế đã đạt.

## Vòng 1 — phát hiện trước khi sửa

| ID | Mức | Phát hiện | Hướng cải thiện | Trạng thái |
| --- | --- | --- | --- | --- |
| S1 | Cao | `SKILL.md` quá tải chi tiết trong description và lặp checklist; các mốc chốt của khách hàng cũ, model `sonnet`, tên kênh và thị trường bị dùng như yêu cầu chung. | Rút gọn entrypoint; ưu tiên brief hiện tại; có luồng tuần tự khi không có delegation. | Đã sửa; quick_validate đạt |
| S2 | Cao | Duyệt giọng TTS nằm ở bước 9a, sau EDL/phụ đề/still; bước 10 giao file trước QA bản final ở bước 11. | Tách hai nhánh đầu vào; duyệt giọng trước timeline; QA final trước giao. | Đã sửa |
| C1 | Cao | `sync-template.py` nhận đường dẫn tùy ý, không chặn thoát thư mục/symlink; có thể chép dữ liệu riêng và ghi dở batch không hợp lệ. | Kiểm toàn bộ batch; giới hạn loại file/code chung; kèm package-lock và src/root.tsx. | Đã sửa; test đạt |
| C2 | Cao | `deliver.py` không kiểm tên giao; đổi tên tạo nhiều bản; xóa render mới cả khi chỉ bổ sung bìa/mô tả. | Kiểm basename, giữ tên tùy chọn/tiếng Việt qua `.deliveries.json`; chặn đổi tên/xung đột và symlink/junction; giữ raw khi không giao master mới. | Đã sửa; test đạt |
| C3 | Cao | `verify-final.py` chỉ in lỗi kỹ thuật, không trả mã lỗi; thiếu đối số vẫn exit 0. | Cổng 1080×1920/30 fps, âm/hình, khung đen, −14 ± 1 LUFS, true peak ≤ −1 dBTP; tách kiểm nội dung. | Đã sửa; unit và FFmpeg thật đạt |
| C4 | Vừa | Preflight chạy hai render đồng thời, trái giới hạn tài nguyên; xử lý timeout không dọn cây tiến trình. | Mix/stem nối tiếp; timeout dọn đúng cây tiến trình được tạo. | Đã sửa; test thứ tự/lỗi/timeout đạt |
| C5 | Vừa | QA still dùng bundle chung, không đóng browser khi lỗi, thiếu kiểm tham số và bỏ khung cuối/clip ngắn. | Bundle riêng; finally dọn; tham số hợp lệ; lấy đầu/cuối; bỏ manifest cũ trước lần chạy. | Đã sửa; unit và browser thật đạt |
| V1 | Vừa | Test tập trung bộ cài; chưa kiểm đồng bộ/giao/cổng QA. | Baseline 55 test đạt; thêm 32 test Python và 3 test Node cùng thử render/FFmpeg thật. | Hoàn tất |

## Vòng 2 — kiểm lại mã sau sửa

- **C6, cao:** `new-video.py` ghi EDL trước khi tạo `scripts/edits/`, khiến project mới lỗi; slug bắt đầu bằng số sinh tên export TypeScript không hợp lệ. Đã tạo thư mục, thêm tiền tố định danh, chặn Composition ID trùng và registry sai trước khi chạy media. Hỗ trợ ID style có số; test project sạch/slug số/registry lỗi đạt.
- **C7, cao:** master ghi thẳng vào bản final, lỗi encode làm mất bản tốt trước. Đã ghi file tạm cùng filesystem rồi thay nguyên tử; test giả lập encode dở giữ nguyên master cũ và dọn file tạm đạt.
- **C8, vừa:** slug có chung tiền tố bị coi là phiên bản cùng video, có thể bỏ qua cổng style; bộ lọc thị trường bị cố định theo kênh cũ. Đã dùng `.style-policy.json` cho quan hệ `variants`, `requireNewStyle`, `allowedPeople`; không cần NumPy cho cổng style nữa. Test mặc định, giữ nhận diện, phiên bản và thị trường đạt.
- **C9, vừa:** đường dẫn `scripts//edits/...` hoặc `scripts/EDITS/...` trên Windows có thể lách bộ lọc; `package.json` có dấu `./` có thể bỏ qua lockfile. Đã chuẩn hóa đường dẫn trước khi kiểm và áp dụng bộ lọc không phân biệt hoa thường.
- **C10, vừa:** lần QA lỗi có thể để manifest thành công cũ. Đã xóa manifest trước bundle; thử composition không tồn tại trả lỗi, không còn bundle và không giữ manifest cũ.

## Kiểm chứng thực tế đã làm

- Browser Chrome Headless Shell: composition tổng hợp 10 khung; render full/bare ở khung 0 và 9 (540×960 khi scale 0,5); đã xem still khung 9. Lần chạy lỗi composition xác nhận dọn bundle và manifest.
- FFmpeg 9.0.2: tạo clip trắng có âm sine 4 giây, chạy master thật; đo −14,0 LUFS, true peak −8,1 dBTP, không khung đen, cổng kỹ thuật đạt.
- Clip đen tổng hợp 2 giây: `verify-final.py` trả exit 1 vì khung đen trước khi gọi Whisper.
- Artifact thử nằm trong `.cache/qa-smoke/` và `.cache/media-smoke/`, không vào Git hoặc payload bộ cài.

## Vòng 3 — kiểm toàn bộ trước khi khép

- Rà diff thêm phát hiện chèn registry phụ thuộc đúng hai dấu cách: đã chèn theo marker có kiểm tra vị trí, hỗ trợ đổi indent; test không indent đạt.
- Giữ tương thích tên giao tùy chọn, gồm tên tiếng Việt: basename an toàn, lưu ánh xạ slug/tên bằng thay file nguyên tử; test đổi tên/chiếm tên của video khác đều bị chặn.
- `python3.12.exe -X utf8 -m unittest discover -s tests -q`: **87 test, 86 đạt, 1 bỏ qua, 0 lỗi** (40 giây). Test symlink file bị bỏ qua vì tài khoản Windows thiếu quyền tạo symlink; test junction thực tế vẫn chạy và đạt.
- `node --test tests/qa-options.test.mjs`: **3/3 đạt**.
- `npm run typecheck` trong template: đạt. Biên dịch cú pháp toàn bộ Python bằng compileall, kiểm cú pháp hai file JavaScript QA: đạt.
- `quick_validate.py` của skill-creator: **Skill is valid!** Các link Markdown nội bộ được kiểm đều tồn tại; `git diff --check` không có lỗi.
- Build lại `dist/talking-head-short-editor-setup.exe`: **4.482.048 byte**; đối chiếu SHA-256 đạt: `1f31baad728acced9424c91aee2fb46ac4dcf67acbab148f4bc942ed536c1c6b`. Bộ test EXE cũng build từ source mới, kiểm payload, checksum, giao diện và cơ chế khôi phục.

## Kết luận và giới hạn

Không còn lỗi chặn đã biết trong phạm vi rà soát này; đạt các tiêu chí chấp nhận ở trên. Các thay đổi vẫn trong working tree để người dùng xem diff.

Chưa chạy trọn quy trình với footage khách hàng và model Whisper/VieNeu thật; không xác nhận chất lượng phát âm, EDL hay nội dung B-roll bằng test mô phỏng. Chưa chạy trên máy macOS/Linux thật (test macOS hiện mô phỏng lệnh setup). Chưa có lượt review của agent độc lập. Các phần này là giới hạn kiểm chứng, không được coi là đã đạt chỉ từ TypeScript/unit test.
