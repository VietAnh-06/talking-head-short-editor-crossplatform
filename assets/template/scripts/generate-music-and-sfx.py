#!/usr/bin/env python3
"""Tổng hợp nhạc nền và hiệu ứng âm thanh không bản quyền cho video.

Ghi public/audio/music-bed.wav (60 giây, 96 BPM, vòng D-A-Bm-G) và public/audio/sfx-*.wav.
Không dùng mẫu âm thanh bên ngoài: mọi âm thanh sinh từ dao động và nhiễu.
"""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
LENGTH = 60.0
OUT = Path(__file__).resolve().parent.parent / "public/audio"
RNG = np.random.default_rng(7)

# D - A - Bm - G, mỗi hợp âm một ô nhịp (MIDI)
CHORDS = [
    [50, 57, 62, 66, 69],
    [45, 52, 61, 64, 69],
    [47, 54, 62, 66, 71],
    [43, 50, 59, 62, 67],
]


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def lowpass(x: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    return sosfilt(butter(order, cutoff, "low", fs=SR, output="sos"), x)


def highpass(x: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    return sosfilt(butter(order, cutoff, "high", fs=SR, output="sos"), x)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def reverb(x: np.ndarray, seconds: float = 2.4, wet: float = 0.3) -> np.ndarray:
    n = int(seconds * SR)
    ir = RNG.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = lowpass(ir, 6000)
    ir /= np.sqrt(np.sum(ir**2))
    tail = fftconvolve(x, ir)[: len(x)]
    return (1 - wet) * x + wet * tail


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i >= len(buf):
        return
    end = min(len(buf), i + len(sig))
    buf[i:end] += gain * sig[: end - i]


def pad_note(freq: float, seconds: float) -> np.ndarray:
    t = t_axis(seconds)
    sig = np.zeros_like(t)
    for detune in (-0.12, 0.0, 0.11):
        f = freq * 2 ** (detune / 12)
        for h, a in ((1, 1.0), (2, 0.35), (3, 0.18), (4, 0.08)):
            sig += a * np.sin(2 * np.pi * f * h * t + RNG.uniform(0, 2 * np.pi))
    env = np.minimum(1, t / 0.9) * np.minimum(1, (seconds - t) / 0.8).clip(0)
    return sig * env


def pluck(freq: float, seconds: float = 0.9) -> np.ndarray:
    t = t_axis(seconds)
    sig = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t) + 0.1 * np.sin(2 * np.pi * 3 * freq * t)
    return sig * np.exp(-t * 5.5) * np.minimum(1, t / 0.004)


def kick() -> np.ndarray:
    t = t_axis(0.5)
    f = 48 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)


def hat() -> np.ndarray:
    t = t_axis(0.09)
    return highpass(RNG.standard_normal(len(t)), 7000) * np.exp(-t * 55)


def clap() -> np.ndarray:
    t = t_axis(0.25)
    burst = bandpass(RNG.standard_normal(len(t)), 900, 4000)
    env = np.exp(-t * 18) * (1 + 0.6 * np.exp(-((t - 0.012) ** 2) / 1e-5))
    return burst * env


def music_bed() -> np.ndarray:
    n = int(LENGTH * SR)
    pads, arps, bass, drums = (np.zeros(n) for _ in range(4))
    bars = int(LENGTH / BAR) + 1
    for b in range(bars):
        start = b * BAR
        chord = CHORDS[b % 4]
        for m in chord[1:]:
            place(pads, pad_note(hz(m), BAR + 0.6), start, 0.05)
        place(bass, pad_note(hz(chord[0] - 12), BAR), start, 0.16)
        pattern = [chord[1] + 12, chord[2] + 12, chord[3] + 12, chord[4] + 12, chord[3] + 12, chord[2] + 12, chord[3] + 12, chord[4] + 12]
        for k, m in enumerate(pattern):
            place(arps, pluck(hz(m)), start + k * BEAT / 2, 0.11 if k % 2 == 0 else 0.075)
        if b >= 2:  # trống vào sau phần hook
            for beat in range(4):
                place(drums, kick(), start + beat * BEAT, 0.55 if beat in (0, 2) else 0.3)
                place(drums, hat(), start + beat * BEAT + BEAT / 2, 0.12)
            place(drums, clap(), start + BEAT, 0.16)
            place(drums, clap(), start + 3 * BEAT, 0.16)

    delayed = np.zeros(n)
    d = int(BEAT * 0.75 * SR)
    delayed[d:] = arps[:-d] * 0.35
    arps = arps + delayed
    pads = lowpass(pads, 2600)
    bass = lowpass(bass, 180)
    # sidechain nhẹ theo kick cho cảm giác "thở" của nhạc pop hiện đại
    pump = np.ones(n)
    for b in range(2, bars):
        for beat in range(4):
            i = int((b * BAR + beat * BEAT) * SR)
            seg = t_axis(BEAT)
            env = 1 - 0.35 * np.exp(-seg * 9)
            end = min(n, i + len(env))
            if i < n:
                pump[i:end] = np.minimum(pump[i:end], env[: end - i])
    mix = (reverb(pads + arps, wet=0.35) + bass) * pump + drums
    fade_in = np.minimum(1, t_axis(LENGTH) / 0.4)
    fade_out = np.clip((LENGTH - t_axis(LENGTH)) / 3.0, 0, 1)
    return mix * fade_in * fade_out


def whoosh(seconds: float = 0.7) -> np.ndarray:
    t = t_axis(seconds)
    noise = RNG.standard_normal(len(t))
    out = np.zeros_like(t)
    frame = 512
    for i in range(0, len(t), frame):
        p = i / len(t)
        centre = 400 + 5200 * np.sin(np.pi * p) ** 2
        seg = noise[max(0, i - 2048): i + frame]
        filt = bandpass(seg, centre * 0.6, min(centre * 1.6, SR / 2 - 100))
        out[i:i + frame] = filt[-len(out[i:i + frame]):]
    env = np.sin(np.pi * t / seconds) ** 1.6
    return out * env


def riser(seconds: float = 1.6) -> np.ndarray:
    t = t_axis(seconds)
    f = 180 * (12 ** (t / seconds))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = highpass(RNG.standard_normal(len(t)), 2500) * 0.6
    env = (t / seconds) ** 2.2
    return reverb((tone + noise) * env, 1.2, 0.25)


def impact() -> np.ndarray:
    t = t_axis(1.8)
    f = 38 + 70 * np.exp(-t * 14)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    crack = lowpass(RNG.standard_normal(len(t)), 3000) * np.exp(-t * 22) * 0.5
    return reverb(boom + crack, 2.0, 0.3)


def pop() -> np.ndarray:
    t = t_axis(0.12)
    f = 900 + 1400 * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38)


def chime() -> np.ndarray:
    sig = np.zeros(int(1.2 * SR))
    for k, m in enumerate((86, 90, 93)):
        t = t_axis(1.2 - k * 0.06)
        note = (np.sin(2 * np.pi * hz(m) * t) + 0.2 * np.sin(2 * np.pi * hz(m) * 2.01 * t)) * np.exp(-t * 4.5)
        place(sig, note, k * 0.06, 0.5)
    return reverb(sig, 1.5, 0.3)


def write(name: str, sig: np.ndarray, peak: float) -> None:
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * peak
    stereo = np.stack([sig, sig], axis=1).astype(np.float32)
    wavfile.write(OUT / name, SR, stereo)
    print(f"{name:20s} {len(sig) / SR:5.2f}s")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write("music-bed.wav", music_bed(), 0.7)
    write("sfx-whoosh.wav", whoosh(), 0.8)
    write("sfx-riser.wav", riser(), 0.7)
    write("sfx-impact.wav", impact(), 0.9)
    write("sfx-pop.wav", pop(), 0.6)
    write("sfx-chime.wav", chime(), 0.6)


if __name__ == "__main__":
    main()
