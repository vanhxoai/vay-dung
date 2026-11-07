"""Add background music and sound effects to a walkthrough video.

Everything is synthesized here with numpy (no sample libraries, so no licensing
questions). The music is ducked under the voiceover, and the video stream is
copied unchanged.

    python scripts/portfolio/soundtrack.py vi in.mp4 out.mp4
    python scripts/portfolio/soundtrack.py en in.mp4 out.mp4

Run it on the voice-only video that mux.mjs writes. Cue times live in
sound-cues.json next to this file.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def db(x):
    return 10 ** (x / 20)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def onepole_lp(x, cutoff):
    """One-pole low-pass. `cutoff` is a number or an array (a sweep)."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def pan(mono, p):
    """p from -1 (left) to 1 (right), equal power."""
    ang = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(ang), mono * np.sin(ang)], axis=1)


def reverb(stereo, seconds=2.2, mix=0.25):
    n = int(seconds * SR)
    env = np.exp(-6.9 * np.arange(n) / n)
    ir = rng.standard_normal((n, 2)) * env[:, None]
    ir[:, 0] = onepole_lp_fast(ir[:, 0])
    ir[:, 1] = onepole_lp_fast(ir[:, 1])
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    size = 1 << int(np.ceil(np.log2(len(stereo) + n)))
    out = np.empty_like(stereo)
    for ch in range(2):
        wet = np.fft.irfft(np.fft.rfft(stereo[:, ch], size) * np.fft.rfft(ir[:, ch], size), size)
        out[:, ch] = wet[: len(stereo)]
    return stereo * (1 - mix) + out * mix * 1.6


def onepole_lp_fast(x, k=4):
    """Cheap darkening for long signals: moving average of k samples."""
    return np.convolve(x, np.ones(k) / k, mode="same")


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------- sound effects ----------

def sfx_tap():
    t = t_axis(0.06)
    body = np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.008)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.002) * 0.3
    return pan((body + click) * db(-28), 0.0)


def sfx_pop():
    t = t_axis(0.18)
    f = 520 + 420 * (1 - np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)
    return pan(s * db(-24), 0.1)


def sfx_air(sec, f0, f1, level, peak=0.45):
    t = t_axis(sec)
    x = t / sec
    env = np.where(x < peak, (x / peak) ** 2, ((1 - x) / (1 - peak)) ** 1.5)
    sweep = np.where(x < peak, f0 + (f1 - f0) * x / peak, f1 + (f0 - f1) * (x - peak) / (1 - peak))
    n = rng.standard_normal(len(t))
    band = onepole_lp(n, sweep) - onepole_lp(n, sweep * 0.25)
    band /= np.abs(band).max()
    # gentle left-to-right movement
    p = -0.5 + x
    ang = (p + 1) * np.pi / 4
    s = band * env * db(level)
    return np.stack([s * np.cos(ang), s * np.sin(ang)], axis=1)


def sfx_swish():
    return sfx_air(0.35, 900, 3500, -26)


def sfx_whoosh():
    return sfx_air(0.6, 400, 4200, -23, peak=0.55)


def bell(freq, sec, level, decay=0.5):
    t = t_axis(sec)
    s = (np.sin(2 * np.pi * freq * t) * np.exp(-t / decay)
         + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t / (decay * 0.3))
         + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t / (decay * 0.15)))
    s *= np.minimum(1, t / 0.003)
    return s * db(level)


def mallet(freq, sec, level, decay=0.25):
    t = t_axis(sec)
    s = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t / 0.03))
    s *= np.exp(-t / decay) * np.minimum(1, t / 0.002)
    return s * db(level)


def seq(notes):
    """notes: list of (start, mono signal, pan)."""
    end = max(int(st * SR) + len(sig) for st, sig, _ in notes)
    out = np.zeros((end, 2))
    for st, sig, p in notes:
        i = int(st * SR)
        out[i:i + len(sig)] += pan(sig, p)
    return out


def sfx_good():  # bright rising pair: "within the guideline"
    return seq([(0, bell(mtof(84), 1.6, -21), -0.2), (0.12, bell(mtof(91), 1.8, -22), 0.2)])


def sfx_caution():  # soft falling minor third: "we don't recommend", calm, not alarming
    return seq([(0, mallet(mtof(69), 0.9, -19, 0.3), -0.1), (0.18, mallet(mtof(65), 1.1, -19, 0.38), 0.1)])


def sfx_alert():  # two low knocks: "not on the licensed list"
    return seq([(0, mallet(mtof(62), 0.6, -19, 0.18), 0), (0.16, mallet(mtof(62), 0.8, -20, 0.25), 0)])


def sfx_outro():  # rising arpeggio of the home chord
    ns = [65, 69, 72, 76, 79, 84]
    return seq([(i * 0.09, bell(mtof(m), 2.5, -25, 0.9), -0.6 + i * 0.24) for i, m in enumerate(ns)])


SFX = {"tap": sfx_tap, "pop": sfx_pop, "swish": sfx_swish, "whoosh": sfx_whoosh,
       "good": sfx_good, "caution": sfx_caution, "alert": sfx_alert, "outro": sfx_outro}


# ---------- music ----------

BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
# Fmaj7 - Am7 - Dm7 - Bbmaj7 (calm, warm, major)
CHORDS = [(41, [53, 57, 60, 64]), (45, [52, 57, 60, 64]), (38, [53, 57, 60, 62]), (46, [53, 57, 58, 62])]


def pad_note(freq, sec):
    t = t_axis(sec)
    s = np.zeros_like(t)
    for h in range(1, 7):
        for det in (-0.12, 0.12):
            s += np.sin(2 * np.pi * freq * h * (1 + det / 100 * h) * t + rng.uniform(0, 6.28)) / h ** 1.6
    att, rel = 0.8, 1.0
    env = np.minimum(1, t / att) * np.minimum(1, (sec - t) / rel)
    return s * env


def pluck(freq, sec=0.9):
    t = t_axis(sec)
    s = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t / 0.08)
         + 0.08 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t / 0.04))
    return s * np.exp(-t / 0.28) * np.minimum(1, t / 0.004)


def bass_note(freq, sec):
    t = t_axis(sec)
    s = np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * 2 * freq * t)
    return s * np.minimum(1, t / 0.02) * np.exp(-t / 1.2) * np.minimum(1, (sec - t) / 0.08)


def hat(sec=0.05):
    n = rng.standard_normal(int(sec * SR))
    n = np.diff(n, prepend=0)
    return n * np.exp(-np.arange(len(n)) / SR / 0.012)


def kick():
    t = t_axis(0.25)
    f = 45 + 70 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)


def music(total):
    n = int(total * SR)
    pad = np.zeros((n, 2))
    arp = np.zeros((n, 2))
    low = np.zeros((n, 2))
    perc = np.zeros((n, 2))

    def put(buf, i, sig2):
        if i >= n:
            return
        m = min(len(sig2), n - i)
        buf[i:i + m] += sig2[:m]

    bars = int(np.ceil(total / BAR)) + 1
    pattern = [0, 1, 2, 3, 2, 1, 3, 2]
    for b in range(bars):
        root, tones = CHORDS[b % 4]
        start = int(b * BAR * SR)
        for k, m in enumerate(tones):
            put(pad, start, pan(pad_note(mtof(m), BAR + 1.0) * 0.05, -0.5 + k / 3))
        put(low, start, pan(bass_note(mtof(root), BAR * 0.5) * 0.22, 0))
        put(low, int((b * BAR + 2 * BEAT) * SR), pan(bass_note(mtof(root), BAR * 0.5) * 0.18, 0))
        if b >= 1:  # arpeggio enters after the first bar
            for s, idx in enumerate(pattern):
                m = tones[idx] + 12
                vel = 0.12 if s % 2 == 0 else 0.08
                put(arp, int((b * BAR + s * BEAT / 2) * SR), pan(pluck(mtof(m)) * vel, 0.45 if s % 2 else -0.45))
        if b >= 2:  # light beat from bar 3
            for beat in range(4):
                put(perc, int((b * BAR + beat * BEAT + BEAT / 2) * SR), pan(hat() * 0.035, 0.3))
            put(perc, start, pan(kick() * 0.22, 0))
            put(perc, int((b * BAR + 2.5 * BEAT) * SR), pan(kick() * 0.14, 0))

    mix = reverb(pad + arp, 2.6, 0.35) + low + perc
    mix /= np.abs(mix).max()
    return mix


# ---------- mixing ----------

def read_audio(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR),
                        "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).astype(float)


def duck_gain(voice, floor_db=-9.0):
    """Music gain that dips while the voice is talking (smooth attack and release)."""
    hop = 441
    frames = len(voice) // hop + 1
    v = np.pad(voice, (0, frames * hop - len(voice)))
    rms = np.sqrt((v.reshape(frames, hop) ** 2).mean(axis=1))
    talking = (20 * np.log10(rms + 1e-9) > -42).astype(float)
    g = np.empty(frames)
    acc = 0.0
    for i, x in enumerate(talking):  # attack ~60 ms, release ~600 ms
        k = 0.17 if x > acc else 0.017
        acc += (x - acc) * k
        g[i] = acc
    # hold through short pauses between sentences
    g = np.maximum(g, np.convolve(g, np.ones(25) / 25, mode="same"))
    gain_db = floor_db * np.clip(g, 0, 1)
    return np.repeat(db(gain_db), hop)[: len(voice)]


def main():
    lang, src, out = sys.argv[1:4]
    cues = json.loads((Path(__file__).parent / "sound-cues.json").read_text())[lang]
    voice = read_audio(src)
    n = len(voice)
    total = n / SR

    bed = music(total + 1)[:n] * db(-14)
    t = np.arange(n) / SR
    fade_in = np.minimum(1, t / 1.5)
    fade_out = np.clip((total - t) / 3.0, 0, 1)
    bed *= (fade_in * fade_out * duck_gain(voice))[:, None]

    fx = np.zeros((n + SR * 4, 2))
    for kind, at in cues:
        s = SFX[kind]()
        i = int(at * SR)
        fx[i:i + len(s)] += s
    fx = fx[:n]

    mix = bed + fx + voice[:, None] * db(-1.0)
    peak = np.abs(mix).max()
    lim = db(-1.0)
    if peak > lim:  # soft knee above 0.7 so peaks never clip
        over = np.abs(mix) > 0.7
        mix[over] = np.sign(mix[over]) * (0.7 + (lim - 0.7) * np.tanh((np.abs(mix[over]) - 0.7) / (lim - 0.7)))
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes()

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src,
                    "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", "-shortest", out], input=pcm, check=True)
    print(lang, "->", out)


if __name__ == "__main__":
    main()
