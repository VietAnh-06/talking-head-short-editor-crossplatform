#!/usr/bin/env python3
"""Sinh các nhạc nền không bản quyền theo từng style (tổng hợp từ dao động, không dùng mẫu ngoài).

Ghi public/audio/music-bed-<tên>.wav (60 giây). Bản "uplift" gốc là music-bed.wav do
generate-music-and-sfx.py sinh. Dùng: scripts/generate-music-beds.py [tên ...]
"""
import importlib.util
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("synth", HERE / "generate-music-and-sfx.py")
synth = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(synth)
SR, hz, t_axis, place, reverb, lowpass, highpass = synth.SR, synth.hz, synth.t_axis, synth.place, synth.reverb, synth.lowpass, synth.highpass
RNG = np.random.default_rng(11)
LENGTH = 60.0

PRESETS = {
    # bản tin: nhịp nhanh, giọng thứ, kick dồn, bass nảy, không arp
    "news": {"bpm": 112, "chords": [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]],
             "kick": "every", "hats": 16, "clap": True, "arp": None, "bass": "pulse", "pad": 0.05, "swing": 0, "crackle": 0, "pump": 0.25, "piano": False},
    # lo-fi: chậm, hợp âm 7, swing, pluck nghẹt, tiếng rè đĩa than
    "lofi": {"bpm": 78, "chords": [[41, 57, 64, 65, 69], [40, 55, 62, 64, 67], [38, 53, 60, 62, 65], [36, 52, 59, 60, 64]],
             "kick": "lofi", "hats": 8, "clap": True, "arp": "soft", "bass": "long", "pad": 0.06, "swing": 0.12, "crackle": 0.012, "pump": 0.15, "piano": False},
    # piano: không trống, nốt piano thưa, reverb dày
    "piano": {"bpm": 68, "chords": [[48, 60, 64, 67], [47, 59, 62, 67], [45, 57, 60, 64], [41, 57, 60, 65]],
              "kick": None, "hats": 0, "clap": False, "arp": "piano", "bass": "long", "pad": 0.035, "swing": 0, "crackle": 0, "pump": 0, "piano": True},
    # synth: kick bốn phách, arp 16 nốt sáng, sidechain mạnh
    "synth": {"bpm": 120, "chords": [[40, 52, 59, 64, 67], [36, 52, 55, 60, 64], [43, 55, 59, 62, 67], [38, 54, 57, 62, 66]],
              "kick": "four", "hats": 8, "clap": True, "arp": "saw", "bass": "pulse", "pad": 0.05, "swing": 0, "crackle": 0, "pump": 0.45, "piano": False},
    # kpop: hợp âm trưởng I-V-vi-IV sáng, kick bốn phách, hats 16, arp saw, dài hơn cho video ~80 s
    "kpop": {"bpm": 104, "chords": [[36, 52, 55, 60, 64], [43, 55, 59, 62, 67], [45, 57, 60, 64, 69], [41, 57, 60, 65, 69]],
             "kick": "four", "hats": 16, "clap": True, "arp": "saw", "bass": "pulse", "pad": 0.045, "swing": 0, "crackle": 0, "pump": 0.3, "piano": False, "length": 80.0},
    # ledger: giọng thứ i-VI-III-VII căng như đang đếm tiền, piano rải + bass đập phách, kick thưa, không clap
    "ledger": {"bpm": 92, "chords": [[38, 50, 57, 62, 65], [34, 50, 58, 62, 65], [41, 53, 57, 60, 65], [36, 52, 55, 60, 64]],
               "kick": "lofi", "hats": 8, "clap": False, "arp": "piano", "bass": "pulse", "pad": 0.05, "swing": 0, "crackle": 0, "pump": 0.2, "piano": True, "length": 100.0},
    # exam: phòng thi đang đếm giờ, vi-IV-I-V (Am add9, F, C, G), hats 16 đều như kim giây, arp mềm, không clap
    "exam": {"bpm": 86, "chords": [[45, 57, 60, 64, 71], [41, 53, 57, 60, 67], [48, 55, 60, 64, 67], [43, 55, 59, 62, 67]],
             "kick": "lofi", "hats": 16, "clap": False, "arp": "soft", "bass": "long", "pad": 0.05, "swing": 0, "crackle": 0, "pump": 0.15, "piano": False, "length": 120.0},
    # airmail: hồ sơ đang trên đường bay, trưởng sáng I-vi-IV-V (D, Bm, G, A), piano rải + bass nảy, swing nhẹ, clap thưa
    "airmail": {"bpm": 98, "chords": [[38, 50, 54, 57, 62], [35, 50, 54, 59, 62], [43, 55, 59, 62, 67], [45, 57, 61, 64, 69]],
                "kick": "lofi", "hats": 8, "clap": True, "arp": "piano", "bass": "pulse", "pad": 0.045, "swing": 0.06, "crackle": 0, "pump": 0.2, "piano": True, "length": 80.0},
    # passbook: sổ tiết kiệm nhích từng tháng, trưởng ấm I-iii-vi-IV (F, Am, Dm, Bb), piano rải chậm, bass dài, không clap
    "passbook": {"bpm": 84, "chords": [[41, 53, 57, 60, 65], [45, 57, 60, 64, 69], [38, 50, 57, 62, 65], [46, 53, 58, 62, 65]],
                 "kick": "lofi", "hats": 8, "clap": False, "arp": "piano", "bass": "long", "pad": 0.05, "swing": 0.04, "crackle": 0, "pump": 0.12, "piano": True, "length": 110.0},
    # app: giao diện app ngân hàng, trưởng sáng IV-I-V-vi (Bb, F, C, Dm), arp mềm 16 nốt, kick bốn phách nhẹ, clap
    "app": {"bpm": 108, "chords": [[46, 58, 62, 65, 69], [41, 57, 60, 65, 69], [48, 55, 60, 64, 67], [38, 57, 62, 65, 69]],
            "kick": "four", "hats": 16, "clap": True, "arp": "soft", "bass": "pulse", "pad": 0.04, "swing": 0, "crackle": 0, "pump": 0.28, "piano": False, "length": 130.0},
    # noir: dải phim tài liệu điều tra, giọng thứ i-VII-VI-V (Em, D, C, B), kick thưa, bass nảy, rè phim nhẹ
    # nightshift: ca làm thêm buổi tối, city pop trưởng 7 IV–iii–vi–ii (Fmaj7, Em7, Am7, Dm7), swing nhẹ, arp mềm, clap
    "nightshift": {"bpm": 100, "chords": [[41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [45, 57, 60, 64, 67], [38, 50, 57, 60, 65]],
                   "kick": "lofi", "hats": 16, "clap": True, "arp": "soft", "bass": "pulse", "pad": 0.045, "swing": 0.08, "crackle": 0, "pump": 0.22, "piano": False, "length": 75.0},
    # sikdang: quán cơm trưa ồn ào vui, trưởng sáng I–IV–ii–V (G, C, Am7, D), swing nảy như gõ đũa, piano rải, clap
    "sikdang": {"bpm": 94, "chords": [[43, 55, 59, 62, 67], [36, 52, 55, 60, 64], [45, 55, 60, 64, 67], [38, 54, 57, 62, 66]],
                "kick": "lofi", "hats": 8, "clap": True, "arp": "piano", "bass": "pulse", "pad": 0.04, "swing": 0.14, "crackle": 0, "pump": 0.18, "piano": True, "length": 70.0},
    # myeongse: kiểm phiếu lương, nghiêm nhưng không u ám, vi-IV-I-V (Am, F, C, G), piano rải + pluck, hats thưa, không clap
    "myeongse": {"bpm": 88, "chords": [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [36, 48, 55, 60, 64], [43, 55, 59, 62, 67]],
                 "kick": "lofi", "hats": 4, "clap": False, "arp": "piano", "bass": "long", "pad": 0.045, "swing": 0, "crackle": 0, "pump": 0.14, "piano": True, "length": 70.0},
    # suseup: tủ điều khiển, nghiêm và tò mò, i-VI-III-VII (Dm, Bb, F, C), pluck mềm + pad mỏng, kick nhẹ thưa, hats tích tắc thưa, không clap
    "suseup": {"bpm": 100, "chords": [[38, 50, 57, 62, 65], [46, 53, 58, 62, 65], [41, 53, 57, 60, 65], [36, 48, 55, 60, 64]],
               "kick": "lofi", "hats": 4, "clap": False, "arp": "soft", "bass": "long", "pad": 0.035, "swing": 0, "crackle": 0, "pump": 0.1, "piano": False, "length": 70.0},
    # simsa: thẩm tra hồ sơ trên hộp đèn, tò mò không bi kịch, i-VI-III-VII (Em, C, G, D), piano gõ mảnh + bass xung đều như đèn chớp, hats thưa, không clap
    "simsa": {"bpm": 92, "chords": [[40, 52, 59, 64, 67], [36, 48, 55, 60, 64], [43, 55, 59, 62, 67], [38, 50, 57, 62, 66]],
              "kick": "lofi", "hats": 4, "clap": False, "arp": "piano", "bass": "pulse", "pad": 0.035, "swing": 0, "crackle": 0, "pump": 0.14, "piano": True, "length": 72.0},
    # danso: truy quét tại hiện trường, khẩn trương không dọa, i-VI-III-VII (Gm, Eb, Bb, F), bass xung tám đều như đèn xe tuần tra nháy, hats gõ đều, "siren" = hai tông xen kẽ rất nhỏ mỗi 4 ô nhịp
    "danso": {"bpm": 112, "chords": [[43, 55, 58, 62, 65], [39, 51, 55, 58, 62], [46, 58, 62, 65, 69], [41, 53, 57, 60, 65]],
              "kick": "lofi", "hats": 8, "clap": False, "arp": "soft", "bass": "pulse", "pad": 0.035, "swing": 0, "crackle": 0, "pump": 0.14, "piano": False, "length": 70.0, "siren": True},
    # yeokjeon: đường chạy điền kinh vượt lên, trưởng hăng hái I–V–vi–IV (E, B, C#m, A), nhịp diễu hành (kick bốn phách như dậm chân, clap phách 2 và 4,
    # snare cuộn ngắn trước mỗi vòng bốn ô nhịp), bass xung tám, synth brass ngắn ngắt nhịp
    "yeokjeon": {"bpm": 112, "chords": [[40, 52, 56, 59, 64], [47, 54, 59, 63, 66], [49, 56, 61, 64, 68], [45, 57, 61, 64, 69]],
                 "kick": "four", "hats": 8, "clap": True, "arp": "brass", "bass": "pulse", "pad": 0.04, "swing": 0, "crackle": 0, "pump": 0.2, "piano": False, "length": 70.0, "roll": True},
    # hwanseung: sân ga tàu điện ngầm, tò mò và sáng, Fmaj7–Am7–Dm7–Bbmaj7, nốt rải kiểu marimba/electric piano gợi chuông báo tàu,
    # pad mỏng, kick nhẹ thưa, hats thưa, bass tròn đi nốt đen (bass "long" ngân cả ô nhịp)
    "hwanseung": {"bpm": 96, "chords": [[41, 53, 57, 60, 64], [45, 57, 60, 64, 67], [38, 50, 57, 60, 65], [46, 53, 57, 62, 65]],
                  "kick": "lofi", "hats": 4, "clap": True, "arp": "piano", "bass": "long", "pad": 0.035, "swing": 0, "crackle": 0, "pump": 0.1, "piano": False, "length": 74.0, "peak": 0.93},
    "noir": {"bpm": 90, "chords": [[40, 52, 55, 59, 64], [38, 50, 54, 57, 62], [36, 48, 52, 55, 60], [35, 51, 54, 59, 63]],
             "kick": "lofi", "hats": 16, "clap": True, "arp": "saw", "bass": "pulse", "pad": 0.05, "swing": 0, "crackle": 0.008, "pump": 0.22, "piano": False, "length": 90.0},
}


def piano_note(freq: float, seconds: float = 2.4) -> np.ndarray:
    t = t_axis(seconds)
    sig = sum(a * np.sin(2 * np.pi * freq * h * t) * np.exp(-t * (1.6 + h * 0.9)) for h, a in ((1, 1.0), (2, 0.45), (3, 0.22), (4, 0.12), (5, 0.06)))
    return sig * np.minimum(1, t / 0.003)


def saw_pluck(freq: float, seconds: float = 0.35) -> np.ndarray:
    t = t_axis(seconds)
    sig = sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, 9))
    return lowpass(sig * np.exp(-t * 9), 5200)


def bed(p: dict) -> np.ndarray:
    length = p.get("length", LENGTH)
    beat = 60 / p["bpm"]
    bar = 4 * beat
    n = int(length * SR)
    pads, mel, bass, drums = (np.zeros(n) for _ in range(4))
    bars = int(length / bar) + 1
    for b in range(bars):
        start = b * bar
        chord = p["chords"][b % len(p["chords"])]
        for m in chord[1:]:
            place(pads, synth.pad_note(hz(m), bar + 0.6), start, p["pad"])
        if p["bass"] == "pulse":
            for k in range(8):
                place(bass, synth.pluck(hz(chord[0] - 12), 0.3), start + k * beat / 2, 0.3)
        else:
            place(bass, synth.pad_note(hz(chord[0] - 12), bar), start, 0.14)
        tones = [m + 12 for m in chord[1:]]
        if p["arp"] == "soft":
            for k in range(8):
                sw = p["swing"] * beat if k % 2 else 0
                place(mel, lowpass(synth.pluck(hz(tones[(k * 2) % len(tones)])), 1600), start + k * beat / 2 + sw, 0.12)
        elif p["arp"] == "saw":
            for k in range(16):
                place(mel, saw_pluck(hz(tones[k % len(tones)] + (12 if k % 8 == 7 else 0))), start + k * beat / 4, 0.06)
        elif p["arp"] == "piano":
            for k, m in enumerate([tones[0], tones[1], tones[2], tones[1]]):
                place(mel, piano_note(hz(m)), start + k * beat, 0.12 if k == 0 else 0.08)
        elif p["arp"] == "brass":
            # synth brass ngắn: hai nốt chồng (quãng năm) ngắt nhịp tại phách 1, giữa phách 2, phách 3, giữa phách 4
            for off in (0, 1.5, 2, 3.5):
                place(mel, saw_pluck(hz(tones[1]), 0.22) + saw_pluck(hz(tones[2]), 0.22), start + off * beat, 0.05)
        if p.get("roll") and b >= 1 and b % 4 == 3:
            # snare cuộn ngắn ở phách cuối của ô nhịp thứ tư, tăng dần
            for j in range(6):
                place(drums, synth.clap(), start + 3 * beat + j * beat / 6, 0.05 + 0.02 * j)
        if p.get("siren") and b % 4 == 3:
            # gợi còi xe tuần tra: hai nốt xen kẽ cách một phách, rất nhỏ
            for k, m in enumerate([chord[3] + 12, chord[1] + 24]):
                place(mel, lowpass(synth.pluck(hz(m), 0.5), 2200), start + (1 + k) * beat, 0.07)
        if b >= 1 and p["kick"]:
            for q in range(4):
                if p["kick"] in ("every", "four") or (p["kick"] == "lofi" and q in (0, 2)):
                    place(drums, synth.kick(), start + q * beat, 0.5 if q in (0, 2) else 0.38)
            if p["clap"]:
                place(drums, synth.clap(), start + beat, 0.13)
                place(drums, synth.clap(), start + 3 * beat, 0.13)
            steps = p["hats"]
            for k in range(steps):
                sw = p["swing"] * beat if (steps == 8 and k % 2) else 0
                place(drums, synth.hat(), start + k * bar / steps + sw, 0.08 if k % 2 else 0.11)
    mel = mel + np.concatenate([np.zeros(int(beat * 0.75 * SR)), mel[: -int(beat * 0.75 * SR)]]) * 0.3
    mix_tonal = reverb(lowpass(pads, 2600) + mel, wet=0.5 if p["piano"] else 0.33) + lowpass(bass, 220)
    pump = np.ones(n)
    if p["pump"]:
        for b in range(1, bars):
            for q in range(4):
                i = int((b * bar + q * beat) * SR)
                env = 1 - p["pump"] * np.exp(-t_axis(beat) * 9)
                end = min(n, i + len(env))
                if i < n:
                    pump[i:end] = np.minimum(pump[i:end], env[: end - i])
    mix = mix_tonal * pump + drums
    if p["crackle"]:
        crackle = highpass(RNG.standard_normal(n), 3000) * (RNG.random(n) > 0.9993) * 6
        mix += crackle * p["crackle"] + highpass(RNG.standard_normal(n), 800) * p["crackle"] * 0.15
    fade = np.minimum(1, t_axis(length) / 0.4) * np.clip((length - t_axis(length)) / 3.0, 0, 1)
    return mix * fade


def main() -> None:
    names = sys.argv[1:] or list(PRESETS)
    for name in names:
        # "peak" tùy chọn theo preset: bed có năng lượng trung bình thấp (màn kết nhỏ hơn thoại > 8 LU) thì nâng đỉnh chuẩn hóa
        synth.write(f"music-bed-{name}.wav", bed(PRESETS[name]), PRESETS[name].get("peak", 0.7))


if __name__ == "__main__":
    main()
