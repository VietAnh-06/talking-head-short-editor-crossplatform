# Áp dụng theo brief

Các ví dụ kênh Việt/Hàn bên dưới mô tả dự án cũ. Chọn người và bối cảnh theo brief hiện tại; không mặc định mọi video phải có người châu Á. Cổng `check-style-novelty.py` chỉ lọc nhãn người khi `.style-policy.json` có `allowedPeople`; xem `style-presets.md`. Kiểm giấy phép trên trang tài sản cụ thể trước khi sử dụng, không suy ra quyền thương mại chỉ từ tên kho.

# B-roll và âm thanh

## Nguồn hình

| Nguồn | Trạng thái | Ghi chú |
|---|---|---|
| Mixkit | Dùng được, không cần khóa | Giấy phép Mixkit Free: dùng thương mại, không cần ghi công. Bản miễn phí chỉ 720p ngang → đặt trong thẻ/polaroid/nửa trên, `fullbleed` sẽ hơi mềm |
| Pexels / Pixabay | Cần khóa API miễn phí | Có video dọc 4K; nếu người dùng cấp khóa thì ưu tiên |
| Gemini (ảnh AI) | Cần khóa đã bật Generative Language API | Khóa giới hạn referrer cần gửi header referer người dùng đã cấu hình; project chưa bật API thì 403 |
| Openverse | Không nên | Ảnh nhỏ, phần lớn CC-BY-SA (buộc ghi công, có thể buộc chia sẻ lại) |
| Ảnh/video thật của khách hàng | Tốt nhất cho tin cậy | Chỉ dùng khi họ cung cấp và đã có đồng ý của người trong hình |

Chỉ đọc khóa từ môi trường hoặc `~/.env` lúc chạy; không ghi khóa vào code hay log.

## Chọn cảnh

1. Lập danh sách danh từ cụ thể trong lời người nói (nghề, nơi chốn, đồ vật, hành động, khái niệm có biểu tượng: tiền, đồng hồ, bài thi).
2. Dò: `uv run python <project>/scripts/mixkit-scout.py video kitchen washing-dishes cashier factory seoul exam`. Ưu tiên clip dọc 9:16: dò `vertical-<từ khóa>` trước (`vertical-office`, `vertical-city`, `vertical-asian-woman`), không có thì mới lấy clip ngang và đặt `focusX` vào chủ thể. Kho Mixkit ít clip dọc (22/10/2026: trang đầu `vertical` 18 clip, `vertical-office` 4). `check-style-novelty.py` in số clip dọc của video.
3. Xem: `uv run <project>/scripts/mixkit-thumbs.py out/thumbs.jpg <mã...>` rồi đọc ảnh. Loại cảnh sai bối cảnh (đô la Mỹ khi nói lương ở Hàn, phố Tokyo khi nói Seoul), cảnh trẻ em nếu chủ đề người lớn, cảnh nhảy múa không liên quan.
4. Tải: `uv run <project>/scripts/fetch-mixkit-broll.py <mã...>` → `public/broll/mixkit-<mã>.mp4|.jpg`, in kích thước/thời lượng.
5. Chọn người/bối cảnh theo brief hiện tại. Ví dụ kênh du học Việt/Hàn có thể ưu tiên người châu Á; khi thiếu cảnh phù hợp, chọn tay/đồ vật/phố đúng ngữ cảnh. Xem thumbnail rồi gắn nhãn từng clip trong `public/broll/people-tags.jsonl`, mỗi dòng dạng `{"id":"12820","people":"asian","faces":true,"desc":"Sinh viên trước cổng trường"}`. Nhãn có thể là `none`, `hands`, `silhouette`, `asian`, `western`, `mixed`, `other`, `unclear`. Cổng luôn báo clip chưa gắn nhãn; chỉ lọc thị trường khi brief có `allowedPeople` trong `.style-policy.json`. Không suy ra yêu cầu của người dùng từ ví dụ kênh cũ.
6. Thiếu cảnh đúng bối cảnh (cửa hàng tiện lợi Hàn, bếp quán Hàn): dùng cảnh tương đương gần nhất và để nhãn gọi đúng tên; báo người dùng trong báo cáo.
7. Chuyển cảnh dài (`crt` 12 khung, màn đen giữa hai cảnh) không đặt ở mọi lần đổi cảnh: chỉ giữ ở 4–6 lần đổi ý lớn, các cảnh còn lại thêm `cut: true` vào BEATS để cắt thẳng (không tiếng chuyển cảnh). tien-015 lượt 1 có 24 lần CRT, khoảng 7,5 s màn đen; chuỗi cảnh nhanh (phụ bếp, dọn dẹp, bơm xăng) chỉ thấy 0,4 s mỗi cảnh. Clip có hành động đến muộn (tay vào khung ở giây 6–10) thì trích dải khung theo giây trước khi đặt `startSec`.

Từ khóa Mixkit hữu ích đã thử: seoul, korea, kitchen, washing-dishes, restaurant, waiter, factory, packaging, office, meeting, job-interview, handshake, tutor, exam, studying, money, clock, steam, supermarket, cashier, translation, graduation, stress, barista, cleaning.

## Thư viện SFX

`src/talking/sfx-library.json` (tên → mã Mixkit), tải bằng `uv run <project>/scripts/fetch-mixkit-sfx.py` vào `public/sfx/<tên>.mp3` (đỉnh −1 dBFS), rồi `<project>/scripts/normalize-sfx.py` tạo `public/sfx-norm/` chuẩn hóa theo độ to cảm nhận (RMS 100 ms lớn nhất = −12 dBFS, limiter đỉnh −1 dBFS). `Sfx` dùng bản chuẩn hóa, `Ambience` dùng bản gốc. Chuẩn hóa theo đỉnh thì độ to thật chênh ~23 dB giữa các tiếng (page-turn −26,5, bass-hit −3,2 dBFS): cùng volume mà tiếng át lời, tiếng mất hút. Thêm SFX mới thì chạy lại `normalize-sfx.py`. Dò thêm: `uv run python <project>/scripts/mixkit-scout.py sfx whoosh pop notification game money kitchen paper city`.

| Nhóm | Tên |
|---|---|
| Chuyển cảnh | whoosh-cinematic, whoosh-fast, sweep-small, swoosh-fast, sweep-fast, sweep-air, swoosh-flying, slide-tech, zoom-vacuum, zoom-impact, swoosh-vacuum |
| Đồ họa | pop-long, pop-hard, pop-bubble, pop-dry, pop-explainer, pop-cluster, click-interface, click-check, click-select, correct, confirm |
| Nhấn | impact-trailer, impact-whoosh, impact-big, impact-deep, bass-hit, bass-hit-future, riser-trailer |
| Game, tiền | level-up, level-complete, achievement, coins-clink, coins-handling, coin-win, coin-notify |
| Theo hình | clock-fast, clock-tick, sizzle, sink-water, plates, pot-lid, steam, typing, page-turn, signing, pencil, heartbeat, factory-hit, record-scratch, fail-low |
| Âm nền | amb-city, amb-restaurant, amb-office |

## Gắn âm thanh

- Chuyển cảnh: tự động trong `BrollLayer`, xoay vòng theo bộ của style (`style.sfx.whip/zoom`).
- Theo cảnh: `hit` (1–2 tiếng lúc cảnh bật, phát sau 8 khung) và `amb` (âm nền suốt cảnh, mặc định 0,1). Ví dụ: rửa bát → `hit: 'plates', amb: 'sink-water'`; bếp → `amb: 'sizzle'`; tiền → `coins-clink`; lương thấp → `['coins-handling', 'fail-low']`; CV → `['page-turn', 'signing']`; thi → `pencil`; giờ giấc → `clock-fast`; phố → `amb: 'amb-city', ambVolume: 0.14`.
- Đồ họa: `<Sfx at={cue('...')} name="level-up" volume={0.42} />` trong `overlays.tsx` của video. Mỗi khoảnh khắc một tiếng khác nhau; dùng `popSfx(i)` cho chuỗi chip.
- Không để quá dày: cảnh có hình đã nói rõ thì bỏ hit (vd phiên dịch viên). Một câu không quá 2 tiếng hit.
- Canh theo hình: `normalize-sfx.py` ghi `src/talking/sfx-meta.json` (`onset`, `peak`, `end` giây). `<Sfx align>` mặc định `start` (phát từ đầu file). Chuyển cảnh trong `BrollLayer` phát 3 khung trước nhát cắt (zoom về người nói: 4 khung). **Đã thử và lui lại** (clip-12, 10/2026): canh đỉnh âm vào nhát cắt (`peak`) buộc tiếng bắt đầu sớm tới 0,6 s nên đè chữ đứng ngay trước cụm neo ("LETCO" → "NETCO"); bỏ khoảng lặng đầu file (`onset`) dồn đỉnh âm lên phụ âm đầu chữ được neo ("Ký" → "Chỉ"). Video lời nói cắt sát nên khoảng lặng đầu file Mixkit là độ trễ tự nhiên giữ chữ rõ. Chỉ dùng `onset`/`peak` cho sự kiện hình rơi vào khoảng nghỉ không có lời. Thêm SFX mới thì chạy lại `normalize-sfx.py`.
- Xem độ dài nghe thấy (`end` trong `sfx-meta.json`, không phải độ dài file) trước khi gắn vào khoảnh khắc có lời: 18/54 tiếng kéo > 1,5 s. Tiếng dài đặt vào khoảng nghỉ vẫn kéo đè sang chữ kế tiếp.
- Sau khi khử ồn/cắt sát, khoảng nghỉ đệm trước câu mất: whoosh chuyển cảnh rơi đúng phụ âm đầu câu. Dùng `silent: true` cho nhịp đó, hoặc cho đồ họa cùng câu hiện lặng.
- Mức (trong `sfx.tsx`): volume × `SFX_GAIN` 1,6, ducking 0,6 khi người nói đang nói. Với volume 0,3: ≈ −18 dBFS khi nghỉ (ngang đỉnh giọng ≈ −19), ≈ −23 dBFS khi đang nói (ngang giọng trung bình ≈ −22). Âm lượng tham khảo: chuyển cảnh 0,28–0,3; hit 0,3; pop 0,2–0,35; impact 0,3–0,45. Đỉnh giọng/trung vị giọng đo bằng `<project>/scripts/sfx_loudness.py <voice.wav> --voice`.
- Cắt sát khoảng nghỉ nên gần như mọi SFX rơi vào lúc người nói đang nói: ducking quyết định độ to nghe thấy. Ducking 0,4 cũ (−8 dB) cộng volume 0,3 làm SFX thấp hơn giọng 6–8 dB, editor chuyên nghiệp nhận xét "mờ nhạt".
- Kiểm mức: render chỉ SFX bằng `--props='{"stem":"sfx"}'` (tắt giọng và nhạc) rồi đo đỉnh từng tiếng; kiểm che chữ bằng `uv run -p .venv-align python <project>/scripts/check-masking.py <slug> <bản cũ> <bản mới>` (so số chữ phụ đề whisper không nghe ra; tăng ở chỗ có SFX thì hạ tiếng đó).
- Kiểm tra bằng `verify-final.py`: chữ whisper nghe sai đúng ở chỗ có hit → bỏ hoặc dời tiếng đó.

## Nhạc nền

`public/audio/music-bed*.wav` sinh bằng `<project>/scripts/generate-music-and-sfx.py` (uplift) và `<project>/scripts/generate-music-beds.py` (news, lofi, piano, synth). Không bản quyền vì tổng hợp từ dao động. Khi đăng TikTok/Reels có thể thay bằng nhạc thịnh hành của nền tảng ngay trong app.

**Ảnh trang tin cho video tin thời sự** (24/10/2026): chụp tiêu đề kèm tên báo và ngày (Playwright Chromium viewport dọc), og:image và ảnh thân bài, lưu `public/news/<slug>/` kèm `sources.txt`. Dùng làm B-roll/bằng chứng (khung bài báo, khung đỏ quanh dòng số liệu), luôn có dòng nhỏ ghi tên báo và ngày. Bỏ hoặc cắt ảnh có mặt người phương Tây, nạn nhân, nghi phạm; không tô dòng số báo ghi sai, không dùng đồ họa của báo khi số trong đó thuộc diện khác (ví dụ số D-2 trong video nói về D-4).
