# Chia việc đồ họa khi có delegation

Chỉ chia việc khi môi trường có công cụ delegation và hướng dẫn phiên hiện tại cho phép. Dùng model sẵn có hoặc lựa chọn của người dùng, không yêu cầu tên model cố định. Nếu không có delegation, thực hiện các phần dưới đây tuần tự; hợp đồng thiết kế vẫn giúp tránh sai bố cục.

Model chính giữ những việc cần phán đoán: soát nội dung, chọn ẩn dụ và thiết kế, nối `BEATS`/`Headline` theo lời, duyệt still, critic, quyết sửa.

## Thứ tự

1. **Model chính chốt hợp đồng thiết kế** (khoảng 3 phút, trước khi giao việc). Ghi vào `out/qa/<slug>-design.md`:
   - Ẩn dụ và lý do hợp nội dung.
   - id style, bảng màu (11 khóa của `palette`), font display/body (đã kiểm có subset `vietnamese` và bản ESM), `caption`, tên kiểu `broll`/`transition`/`headline` (kiểu mới hay dùng lại).
   - Preset nhạc (bpm, hợp âm), bộ SFX.
   - **Hằng số bố cục bằng số:** ô B-roll (left/top/width/height, ≥ 45 % khung), vùng tiêu đề, vùng đồ họa đặc trưng, `PAGE[<layout>]` (`captionTop`, `headlineTop`, `light`), dòng `SKELETON`, `BROLL_AREA`.
   - Danh sách đồ họa đặc trưng. Với mỗi đồ họa ghi: tên component, props (mốc khung truyền vào), nội dung chữ và số **lấy nguyên từ lời đã duyệt**, cách vào và ra.

   Model chính tự thêm hằng số bố cục vào `broll.tsx` (`export const <TÊN> = {...}`) và tên kiểu vào các union type trong `style.tsx` trước khi giao. Nhờ vậy agent B import được ngay mà không phải chờ agent A.
2. **Giao các phần độc lập qua công cụ hiện có.** Khi được phép chạy song song, hai agent có thể chạy cùng lúc tạo giọng hoặc tìm B-roll:
   - **Agent A: style.** Được sửa `src/talking/style.tsx`, `src/talking/broll.tsx` (chỉ thêm nhánh/component mới, không sửa kiểu cũ), `src/talking/cover.tsx`, `scripts/check-style-novelty.py` (`SKELETON`, `BROLL_AREA`), `scripts/generate-music-beds.py`. Chạy sinh nhạc.
   - **Agent B: đồ họa đặc trưng.** Chỉ được sửa `src/videos/<slug>/overlays.tsx`.
   - Không agent nào sửa `src/videos/<slug>/<slug>-short.tsx`, registry hay `.style-ledger`. Các file đó thuộc model chính.
3. **Model chính ráp lại:**
   - Nối `BEATS`, `Headline` và đồ họa vào file video.
   - Chạy `check-style-novelty.py` và `qa-frames.mjs`, đọc still, sửa bố cục, chạy critic trên still.
   - Lỗi trong code của agent thì gửi tiếp cho đúng agent đó qua công cụ nhắn nội bộ kèm ảnh still và mô tả. Lỗi nhỏ thì tự sửa.

## Brief agent A (style)

```text
Việc: viết style mới '<id>' cho project Remotion <thư mục project> theo hợp đồng thiết kế out/qa/<slug>-design.md.
Đọc trước: file hợp đồng; <thư mục skill>/references/style-presets.md (mục "Thêm style mới", "Bộ khung"),
motion-design.md; trong src/talking/: style.tsx (STYLES, FONT_LOADERS, PAGE), broll.tsx (mẫu gần nhất: <kiểu toàn trang gần nhất>,
PageBackdrop, transitionStyle, các case của Headline), cover.tsx (biến thể theo st.broll).
Được sửa: src/talking/style.tsx, src/talking/broll.tsx (chỉ THÊM nhánh/component/case mới), src/talking/cover.tsx,
scripts/check-style-novelty.py (SKELETON, BROLL_AREA), scripts/generate-music-beds.py.
Không sửa: src/videos/**, registry, .style-ledger, kiểu cũ của style khác.
Ràng buộc: dùng đúng hằng số bố cục trong hợp đồng (đã export trong broll.tsx); màu lấy từ s.palette, không ghi mã màu rời ngoài
chi tiết vật liệu; chuyển động theo motion-design.md (spring/interpolate có clamp, vào 2–3 thuộc tính, ra nhanh hơn vào);
lớp phủ chuyển cảnh trả undefined khi không chuyển; font có subset vietnamese.
Xong khi: `npx tsc --noEmit -p .` sạch; `uv run --with numpy --with scipy python ./scripts/generate-music-beds.py <preset>` đã chạy;
`node scripts/qa-frames.mjs <Composition> out/qa/<slug>-style --frames=<danh sách> --scale=0.5` render được (bìa khung 0, một khung
B-roll, một khung tiêu đề, một khung đang chuyển cảnh). Thu nhỏ ảnh ghép (magick … -resize 1100x -quality 55), tự xem và sửa chữ tràn hoặc chồng lớp.
Trả về: file đã sửa, đường dẫn ảnh ghép still, điểm còn băn khoăn.
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
```

## Brief agent B (đồ họa đặc trưng)

```text
Việc: viết các component đồ họa đặc trưng cho video <slug> trong src/videos/<slug>/overlays.tsx theo hợp đồng out/qa/<slug>-design.md.
Đọc trước: file hợp đồng; <thư mục skill>/references/motion-design.md; mẫu src/videos/<video trước>/overlays.tsx nếu có;
src/talking/motion.tsx, overlays-common.tsx (useWindow), sfx.tsx (tên SFX).
Được sửa: chỉ src/videos/<slug>/overlays.tsx.
Ràng buộc: đặt trong vùng đồ họa của hợp đồng (import hằng số bố cục từ ../../talking/broll), chừa cột nút TikTok bên phải 150 px
và vùng phụ đề; màu từ useStyle().palette; chữ và số đúng nguyên văn hợp đồng, không thêm số; mốc khung là số tuyệt đối
(MarkerHighlight at = khung tuyệt đối); vỏ thẻ không hiện trống trước dòng chữ đầu; vào lệch nhịp, ra bằng exitStyle,
thở bằng breathe khi đứng > 2 s; tối đa 2 nét MarkerHighlight/MarkerCircle; không emoji; mỗi khung một điểm nhấn màu.
Xong khi: `npx tsc --noEmit -p .` sạch (style mới có thể chưa xong; lỗi ở file khác thì bỏ qua và ghi lại).
Trả về: tên component + props, khoảng chiều cao từng đồ họa, điểm còn băn khoăn.
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
```

## Lưu ý

- Agent B không render still được nếu style chưa xong và file video chưa nối đồ họa. Model chính duyệt still của agent B sau khi ráp.
- Hai agent không cùng sửa một file. Agent A cần thêm hằng số bố cục ngoài hợp đồng thì chỉ được thêm, không đổi số đã chốt, và phải ghi trong báo cáo.
- Brief đã có đủ bối cảnh, nên agent không cần đọc lịch sử hội thoại. Truyền cwd, timezone Asia/Saigon và yêu cầu trả lời tiếng Việt.
