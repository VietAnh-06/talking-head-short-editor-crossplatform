# Critic sub-agent và so cặp bản dựng

Người dựng tự duyệt ảnh của chính mình có thể bỏ sót lỗi. Sau khi các script QA chạy, nếu công cụ và quyền delegation cho phép, giao bằng chứng cho một người đánh giá riêng chỉ tìm lỗi. Nếu không có, tự làm một lượt review riêng theo prompt dưới đây và ghi rõ giới hạn độc lập. Không yêu cầu model hay loại agent cố định.

## Khi nào chạy

- Sau bước 10 (render → master → `verify-final.py`), trước khi báo người dùng.
- Sau mỗi lượt sửa lớn (đổi track giọng, đổi nhịp B-roll, đổi style).
- Mặc định tối đa 3 lượt critic → sửa → render trước khi báo lại vấn đề chưa tiến triển. Yêu cầu lặp hoặc giới hạn của người dùng trong phiên hiện tại có ưu tiên; không dừng khi còn lỗi đã có cách sửa và người dùng yêu cầu tiếp tục.

## Chuẩn bị bằng chứng (chạy trong project)

```bash
uv run --with numpy --with pillow python ./scripts/cut-strips.py <slug>                       # out/qa/<slug>-cuts-NN.jpg
node ./scripts/qa-frames.mjs <Composition> out/qa/<slug> --every=15                            # full-*.jpg, bare-*.jpg
uv run -p 3.12 --with mediapipe --with pillow --with numpy python ./scripts/face-check.py out/qa/<slug>
magick montage out/qa/<slug>/full-*.jpg -tile 10x -geometry 216x384+2+2 out/qa/<slug>-contact.jpg
uv run ./scripts/verify-final.py out/final/<slug>.mp4 > out/qa/<slug>-verify.txt
```

Ảnh ghép lớn hơn khoảng 400 KB bị chặn đọc. Trước khi giao, thu nhỏ bằng `magick … -resize 1100x -quality 55`, hoặc chia nhiều tờ.

## Brief cho critic hoặc lượt tự review

Prompt mẫu (điền đường dẫn thật):

```text
Bạn là biên tập viên khó tính duyệt một short dọc tiếng Việt trước khi đăng. CHỈ tìm lỗi, không khen.
Đọc: out/qa/<slug>-contact.jpg (khung mỗi 0,5 s), out/qa/<slug>-cuts-*.jpg (±1,5 s quanh mọi điểm cắt, có sóng âm),
out/qa/<slug>-verify.txt (thông số, độ to từng đoạn, whisper nghe lại), kết quả face-check, và checklist
<skill>/references/video-checklist.md. Nội dung lời nói đúng: <dán phụ đề cuối>.
Tìm: chữ mồ côi/tràn khung, đồ họa che mặt hoặc che phụ đề, lớp phủ đứng yên sau chuyển cảnh, khung đen/nhảy hình ở điểm cắt,
nhãn B-roll sai nghĩa với lời, cảnh B-roll lộ sai bối cảnh, chữ whisper nghe sai so với lời đúng, màn kết/hook nhỏ tiếng,
phong cách lặp lại video trước, thông tin không có trong lời (bịa),
khung 0 tối/không đọc được như ảnh bìa, đồ họa vào đồng loạt hoặc đứng im tuyệt đối > 2 s, ra chậm hơn vào,
hơn một điểm nhấn màu trong một khung, emoji dùng làm icon (references/motion-design.md).
Trả về danh sách xếp theo mức độ (CHẶN / NÊN SỬA / NHỎ), mỗi dòng: giây hoặc khung, mô tả lỗi, bằng chứng (tên ảnh + ô),
cách sửa đề xuất. Không có lỗi ở nhóm nào thì ghi "không thấy". Kết thúc bằng Status: DONE | DONE_WITH_CONCERNS.
```

Xử lý kết quả:

- **CHẶN:** phải sửa rồi render lại.
- **NÊN SỬA:** sửa nếu rẻ. Không sửa thì ghi vào "điểm chưa kiểm chứng" của báo cáo.
- **NHỎ:** ghi lại cho video sau.
- Critic có thể sai, nhất là khi suy chữ từ ảnh. Kiểm lại từng lỗi bằng nguồn (still ở scale 1, `listen-edit.py`, stem SFX) trước khi sửa.

## So cặp khi sửa lỗi thẩm mỹ

Khi phải chọn giữa hai cách (nhịp B-roll, màu nhãn, vị trí đồ họa), đừng tự chấm điểm tuyệt đối vì điểm số trôi theo cảm tính. Làm như sau:

1. Render cùng các khung (cùng `--frames`) cho bản A và bản B, ghép thành hai tờ ảnh cùng bố cục.
2. Hỏi critic "bản nào tốt hơn cho tiêu chí X, vì sao", với thứ tự **A rồi B**.
3. Hỏi lại với thứ tự **B rồi A** (thứ tự trình bày làm lệch phán đoán).
4. Bản mới chỉ được chọn khi thắng **cả hai** lượt. Hòa hoặc thắng một lượt thì giữ bản cũ, vì thay đổi không đáng.

## Ví dụ thật (clip-12, 10/2026)

Critic chạy trên bằng chứng QA của bản v6 (mọi script QA đã đạt) và vẫn tìm ra:

- **CHẶN, đã xác nhận bằng still độ phân giải gốc:** 0,4 s mặt tường quay nhầm lộ ra trước CTA. Sửa bằng `hardOut` + `atSec: cue('cta')`.
- **NÊN SỬA, đã sửa:**
  - B-roll học bổng là cảnh cụng ly bia: thay bằng cảnh tân cử nhân ôm hoa.
  - Dấu VISA đè 2,5 s sang cảnh sau: cho tắt sau 0,5 s.
  - Phụ đề một chữ: gộp trang trong `buildPages`.
  - Thước thu nhập mất chữ "khoảng": thêm "≈".
  - Khung đầu là hộp tiêu đề rỗng: `from={-24}`.
- **Bác, có lý do:** "nền màn kết không có người nói". Nền là khung CTA có người nói, làm mờ và phủ màu theo thiết kế; critic đọc ảnh thu nhỏ nên không thấy. Ghi lại để lần sau không sửa nhầm.

Script không bắt được lỗi hình chỉ kéo dài 0,4 s giữa hai khung lấy mẫu, cũng không phán được nội dung có hợp chủ đề hay không. Critic bù đúng hai chỗ đó.

Ý tưởng từ SeeCut (so cặp, đổi vị trí) và video-use (critic chỉ tìm lỗi, tối đa 3 lượt). Chỉ học ý tưởng; code SeeCut theo giấy phép phi thương mại.
