"""Music and sound effects for the walkthrough videos, synthesized with numpy.

No sample libraries are used, so there are no licensing questions. promo.py
imports this module to score the edited (vertical) videos. Run directly, it
scores a plain recording without editing it:

    python scripts/portfolio/soundtrack.py vi voice-vi.mp4 out.mp4

The input must be the voice-only video that mux.mjs writes.
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


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def onepole_lp(x, cutoff):
    """One-pole low-pass. `cutoff` is a number or an array (a sweep). Short signals only."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def smooth(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def pan(mono, p):
    """p from -1 (left) to 1 (right), equal power."""
    ang = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(ang), mono * np.sin(ang)], axis=1)


def reverb(stereo, seconds=1.6, mix=0.25):
    n = int(seconds * SR)
    env = np.exp(-6.9 * np.arange(n) / n)
    ir = rng.standard_normal((n, 2)) * env[:, None]
    ir[:, 0] = smooth(ir[:, 0], 4)
    ir[:, 1] = smooth(ir[:, 1], 4)
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    size = 1 << int(np.ceil(np.log2(len(stereo) + n)))
    out = np.empty_like(stereo)
    for ch in range(2):
        wet = np.fft.irfft(np.fft.rfft(stereo[:, ch], size) * np.fft.rfft(ir[:, ch], size), size)
        out[:, ch] = wet[: len(stereo)]
    return stereo * (1 - mix) + out * mix * 1.6


def seq(notes):
    """notes: list of (start seconds, mono signal, pan)."""
    end = max(int(st * SR) + len(sig) for st, sig, _ in notes)
    out = np.zeros((end, 2))
    for st, sig, p in notes:
        i = int(st * SR)
        out[i:i + len(sig)] += pan(sig, p)
    return out


# ---------- sound effects (levels are peak-ish dBFS; the voice peaks near -3) ----------

def sfx_tap():
    t = t_axis(0.07)
    body = np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.01)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.002) * 0.4
    return pan((body + click) * db(-20), 0.0)


def sfx_pop():
    t = t_axis(0.2)
    f = 500 + 500 * (1 - np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)
    return pan(s * db(-15), 0.1)


def sfx_sticker():  # bubbly pop with a bright tail, for pop-up stickers
    t = t_axis(0.35)
    f = 300 + 900 * (1 - np.exp(-t / 0.025))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)
    sparkle = np.sin(2 * np.pi * 2637 * t) * np.exp(-t / 0.12) * 0.25
    return pan((body + sparkle) * db(-13), 0.0)


def sfx_shine():  # soft glassy ping when a highlight appears
    t = t_axis(0.6)
    s = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) * a
            for f, d, a in [(1568, 0.25, 1), (2349, 0.18, 0.6), (3136, 0.12, 0.4)])
    s *= np.minimum(1, t / 0.004)
    return reverb(pan(s * db(-20), 0.25), 0.8, 0.3)


def sfx_air(sec, f0, f1, level, peak=0.45):
    t = t_axis(sec)
    x = t / sec
    env = np.where(x < peak, (x / peak) ** 2, ((1 - x) / (1 - peak)) ** 1.5)
    sweep = np.where(x < peak, f0 + (f1 - f0) * x / peak, f1 + (f0 - f1) * (x - peak) / (1 - peak))
    n = rng.standard_normal(len(t))
    band = onepole_lp(n, sweep) - onepole_lp(n, sweep * 0.25)
    band /= np.abs(band).max()
    ang = (x - 0.5 + 1) * np.pi / 4  # moves left to right
    s = band * env * db(level)
    return np.stack([s * np.cos(ang), s * np.sin(ang)], axis=1)


def sfx_swish():
    return sfx_air(0.35, 900, 4000, -19)


def sfx_whoosh():
    return sfx_air(0.55, 400, 5000, -13, peak=0.55)


def sfx_riser():  # 1.3 s noise rise into the intro hit
    return sfx_air(1.3, 300, 7000, -16, peak=0.92)


def sfx_ff():  # fast-forward: quick rising swish
    return sfx_air(0.45, 600, 6000, -15, peak=0.8)


def sfx_impact():
    t = t_axis(0.9)
    f = 40 + 90 * np.exp(-t / 0.04)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.25)
    n = rng.standard_normal(len(t))
    crash = (n - smooth(n, 3)) * np.exp(-t / 0.3) * 0.25
    return reverb(pan((boom + crash) * db(-9), 0), 1.2, 0.2)


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


def sfx_good():  # bright rising pair: "within the guideline"
    return seq([(0, bell(mtof(84), 1.6, -11), -0.2), (0.1, bell(mtof(88), 1.6, -12), 0),
                (0.2, bell(mtof(91), 1.8, -12), 0.2)])


def sfx_caution():  # falling minor third: "we don't recommend", firm but not an alarm
    return seq([(0, mallet(mtof(69), 0.9, -10, 0.3), -0.1), (0.2, mallet(mtof(65), 1.1, -10, 0.38), 0.1)])


def sfx_alert():  # two low knocks: "not found"
    return seq([(0, mallet(mtof(62), 0.6, -10, 0.18), 0), (0.16, mallet(mtof(62), 0.8, -11, 0.25), 0)])


def sfx_outro():  # rising arpeggio of the home chord
    ns = [65, 69, 72, 77, 81, 84]
    return seq([(i * 0.07, bell(mtof(m), 2.5, -15, 0.9), -0.6 + i * 0.24) for i, m in enumerate(ns)])


SFX = {"tap": sfx_tap, "pop": sfx_pop, "swish": sfx_swish, "whoosh": sfx_whoosh,
       "good": sfx_good, "caution": sfx_caution, "alert": sfx_alert, "outro": sfx_outro,
       "sticker": sfx_sticker, "shine": sfx_shine, "riser": sfx_riser, "ff": sfx_ff, "impact": sfx_impact}


def place_sfx(cues, n):
    fx = np.zeros((n + SR * 4, 2))
    for kind, at in cues:
        s = SFX[kind]()
        i = max(0, int(at * SR))
        fx[i:i + len(s)] += s
    return fx[:n]


# ---------- upbeat music: 120 BPM house-pop, F - C - Dm - Bb ----------

BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # bass root, stab voicing
    (41, [60, 65, 69, 72]),
    (36, [60, 64, 67, 72]),
    (38, [62, 65, 69, 74]),
    (34, [62, 65, 70, 74]),
]
MOTIF = [(0, 77), (0.75, 76), (1.5, 72), (2.5, 74), (3.0, 72), (3.5, 69)]  # beats, midi (one bar)


def saw(freq, t, harmonics=8, detune=0.0):
    s = np.zeros_like(t)
    for h in range(1, harmonics + 1):
        s += np.sin(2 * np.pi * freq * h * (1 + detune) * t) / h
    return s


def kick():
    t = t_axis(0.3)
    f = 48 + 110 * np.exp(-t / 0.025)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return s + rng.standard_normal(len(t)) * np.exp(-t / 0.003) * 0.15


def clap():
    n = rng.standard_normal(int(0.25 * SR))
    n = n - smooth(n, 6)  # brighten
    t = np.arange(len(n)) / SR
    env = np.exp(-t / 0.07)
    for d in (0.0, 0.011, 0.022):
        env += 0.6 * np.exp(-np.clip(t - d, 0, None) / 0.006) * (t >= d)
    return n * env * 0.35


def hat(open_=False):
    sec = 0.18 if open_ else 0.04
    n = rng.standard_normal(int(sec * SR))
    n = np.diff(n, prepend=0)
    return n * np.exp(-np.arange(len(n)) / SR / (0.06 if open_ else 0.01))


def stab(notes, sec=0.32):
    t = t_axis(sec)
    s = sum(saw(mtof(m), t, 7, d) for m in notes for d in (-0.003, 0.003))
    return s * np.exp(-t / 0.11) * np.minimum(1, t / 0.003)


def bass(midi, sec=0.22):
    t = t_axis(sec)
    s = saw(mtof(midi), t, 5)
    return s * np.minimum(1, t / 0.004) * np.exp(-t / 0.12)


def pad(notes, sec):
    t = t_axis(sec)
    s = sum(saw(mtof(m - 12), t, 5, d) for m in notes[:3] for d in (-0.004, 0.004))
    return s * np.minimum(1, t / 0.3) * np.minimum(1, (sec - t) / 0.3)


def lead(midi):
    t = t_axis(0.5)
    s = np.sin(2 * np.pi * mtof(midi) * t) + 0.3 * np.sin(2 * np.pi * mtof(midi) * 2 * t) * np.exp(-t / 0.06)
    return s * np.exp(-t / 0.22) * np.minimum(1, t / 0.003)


def music(total, breaks=(), full_from=None, end_hit=None):
    """Upbeat bed. `breaks`: (start, end) seconds where the drums drop out.
    `full_from`: when the drums start (before that it's a short build).
    `end_hit`: time of the final chord hit; after it only a sustained chord rings out."""
    n = int(total * SR) + SR
    drums = np.zeros((n, 2))
    bassb = np.zeros((n, 2))
    stabs = np.zeros((n, 2))
    pads = np.zeros((n, 2))
    leads = np.zeros((n, 2))
    full_from = BAR if full_from is None else full_from
    end_hit = total if end_hit is None else end_hit

    def put(buf, at, sig2):
        i = int(at * SR)
        if i >= n or i < 0:
            return
        m = min(len(sig2), n - i)
        buf[i:i + m] += sig2[:m]

    def in_break(x):
        return any(a <= x < b for a, b in breaks)

    K, C, HC, HO = kick(), clap(), hat(), hat(True)
    bars = int(np.ceil(end_hit / BAR))
    for b in range(bars):
        root, tones = CHORDS[b % 4]
        t0 = b * BAR
        if t0 >= end_hit:
            break
        brk = in_break(t0 + BAR / 2)
        full = t0 >= full_from - 1e-6 and not brk
        put(pads, t0, pan(pad(tones, BAR + 0.3), 0) * (0.05 if not brk else 0.08))
        for s16 in range(16):
            at = t0 + s16 * BEAT / 4
            if at >= end_hit:
                break
            if full:
                if s16 % 4 == 0:
                    put(drums, at, pan(K, 0) * 0.9)
                if s16 in (4, 12):
                    put(drums, at, pan(C, 0.1) * 0.8)
                if s16 % 4 == 2:
                    put(drums, at, pan(HO, 0.3) * 0.18)
                elif s16 % 2 == 1:
                    put(drums, at, pan(HC, -0.3) * 0.12)
                if s16 % 4 == 2:  # offbeat octave bass
                    put(bassb, at, pan(bass(root + 12 * (s16 // 4 % 2)), 0) * 0.3)
                elif s16 == 0:
                    put(bassb, at, pan(bass(root), 0) * 0.3)
            if s16 in (0, 3, 6, 10, 12):  # syncopated chord stabs
                put(stabs, at, pan(stab(tones), -0.25 if s16 % 2 else 0.25) * (0.05 if full else 0.035))
        if full and (b // 4) % 2 == 1:  # catchy motif on every other 4-bar phrase
            shift = [0, -5, -3, -7][b % 4]
            for beat, m in MOTIF:
                put(leads, t0 + beat * BEAT, pan(lead(m + shift), 0.2) * 0.13)

    # sidechain pump on everything melodic
    tt = np.arange(n) / SR
    phase = np.mod(tt, BEAT)
    pump = 1 - 0.55 * np.exp(-phase / 0.09)
    pump[tt < full_from] = 1.0
    for a, c in breaks:
        pump[(tt >= a) & (tt < c)] = 1.0
    melodic = reverb(stabs + pads + leads, 1.4, 0.28) * pump[:, None]
    # build-up before the drums: low-passed feel by fading stabs in
    mix = drums + bassb * pump[:, None] + melodic
    # final hit and ring-out
    root, tones = CHORDS[0]
    put(mix, end_hit, pan(stab([t + 12 for t in tones], 0.8), 0) * 0.08)
    put(mix, end_hit, pan(K, 0) * 0.9)
    put(mix, end_hit, reverb(pan(pad(tones, max(0.5, total - end_hit + 0.5)), 0) * 0.08, 2.0, 0.4))
    mix = mix[: int(total * SR)]
    return mix / np.abs(mix).max()


# ---------- mixing helpers ----------

def read_audio(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(SR),
                        "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).astype(float)


def duck_gain(voice, floor_db=-7.0):
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
    g = np.maximum(g, np.convolve(g, np.ones(25) / 25, mode="same"))  # hold through short pauses
    return np.repeat(db(floor_db * np.clip(g, 0, 1)), hop)[: len(voice)]


def loudness(stereo):
    """Integrated loudness (LUFS) measured by ffmpeg's ebur128."""
    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2").tobytes()
    p = subprocess.run(["ffmpeg", "-hide_banner", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                        "-af", "ebur128", "-f", "null", "-"], input=pcm, capture_output=True)
    lines = [l for l in p.stderr.decode().splitlines() if l.strip().startswith("I:")]
    return float(lines[-1].split()[1])


def master(voice, bed, fx, target_lufs=-14.0):
    """Mix voice (mono), music bed and effects (stereo), set loudness, soft-limit peaks."""
    mix = bed + fx + voice[:, None]
    mix *= db(target_lufs - loudness(mix))
    lim = db(-1.0)
    knee = 0.7
    a = np.abs(mix)
    over = a > knee
    mix[over] = np.sign(mix[over]) * (knee + (lim - knee) * np.tanh((a[over] - knee) / (lim - knee)))
    return mix


def to_pcm(mix):
    return (np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes()


def main():
    lang, src, out = sys.argv[1:4]
    cues = json.loads((Path(__file__).parent / "sound-cues.json").read_text())[lang]
    voice = read_audio(src)
    n = len(voice)
    total = n / SR
    bed = music(total)[:n] * db(-15)
    t = np.arange(n) / SR
    bed *= (np.minimum(1, t / 0.5) * np.clip((total - t) / 2.5, 0, 1) * duck_gain(voice))[:, None]
    mix = master(voice, bed, place_sfx(cues, n))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src,
                    "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", "-shortest", out], input=to_pcm(mix), check=True)
    print(lang, "->", out)


if __name__ == "__main__":
    main()
