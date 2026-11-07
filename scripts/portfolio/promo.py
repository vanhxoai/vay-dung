"""Edit a voice-only walkthrough recording into an eye-catching vertical (1080 x 1920) video.

What it does, in order:
  1. Cuts: removes still moments between scenes and plays long waits at 3x.
  2. Camera: the phone sits on an animated background; the camera zooms in on
     each highlighted element and punches in on page changes.
  3. Motion graphics: title card, scene titles with a progress bar, spotlight
     highlights, pop-up stickers, burned-in captions, end card.
  4. Sound: upbeat music ducked under the voice, sound effects (soundtrack.py).

    python scripts/portfolio/promo.py vi <workDir>/voice-vi.mp4 docs/portfolio/vay-dung-walkthrough-vi.mp4

The edit plan (scene times, highlight boxes, sticker text) is edit-plan.json;
the sound-effect times for on-screen events are sound-cues.json. Both use times
in the source video, so re-check them after recording again.
Needs numpy, Pillow, ffmpeg and the Inter font (/usr/share/fonts/opentype/inter).
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
import soundtrack as st  # noqa: E402

HERE = Path(__file__).parent
W, H, FPS = 1080, 1920, 30
SRC_FPS = 25
SW, SH = 412, 860            # source frame size
BASE = 1.5                   # phone screen scale at rest
X0, Y0 = (W - SW * BASE) / 2, 300
CENTER = (W / 2, 960)
FONT_DIR = "/usr/share/fonts/opentype/inter"

YELLOW = (250, 204, 21)
COLORS = {"brand": YELLOW, "green": (34, 197, 94), "red": (239, 68, 68), "amber": (245, 158, 11)}
STICKER = {"brand": (YELLOW, (17, 24, 20)), "green": ((22, 163, 74), (255, 255, 255)),
           "red": ((220, 38, 38), (255, 255, 255)), "amber": ((245, 158, 11), (17, 24, 20))}

_fonts = {}


def font(weight, size):
    key = (weight, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(f"{FONT_DIR}/Inter-{weight}.otf", size)
    return _fonts[key]


# ---------- easing ----------

def clip01(x):
    return max(0.0, min(1.0, x))


def out_back(x, s=1.70158):
    x = clip01(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def in_back(x, s=1.70158):
    x = clip01(x)
    return (s + 1) * x ** 3 - s * x ** 2


def out_cubic(x):
    return 1 - (1 - clip01(x)) ** 3


def window_alpha(t, a, b, fin=0.25, fout=0.25):
    if t < a or t > b + fout:
        return 0.0
    return min(clip01((t - a) / fin), clip01((b + fout - t) / fout))


# ---------- timeline (cuts and speed-ups) ----------

def frame_diffs(src):
    w, h = 103, 215
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={w}:{h},format=gray",
                        "-f", "rawvideo", "-"], capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w).astype(np.int16)
    return (np.abs(np.diff(a, axis=0)) > 20).mean(axis=(1, 2))


def build_edl(scenes, diffs, src_dur, outro_len):
    """Segments (src_start, src_end, speed) that make up the output."""
    def still(a, b):
        i0, i1 = int(a * SRC_FPS), int(b * SRC_FPS)
        return diffs[max(0, i0 - 1):i1].max(initial=0) < 0.003

    segs, cur = [], 0.0
    for k in range(len(scenes) - 1):
        a, b = scenes[k][1] + 0.3, scenes[k + 1][0] - 0.75
        if b - a > 2.4:                       # long wait with things happening: 3x
            segs += [(cur, a, 1.0), (a, b, 3.0)]
            cur = b
        elif b - a > 0.25 and still(a, b):    # dead air: cut
            segs.append((cur, a, 1.0))
            cur = b
    end = min(src_dur, scenes[-1][1] + outro_len)
    segs.append((cur, end, 1.0))
    out, o = [], 0.0
    for a, b, s in segs:
        out.append((a, b, s, o))
        o += (b - a) / s
    return out, o


def src2out(edl, t):
    for a, b, s, o in edl:
        if t < a:
            return o                    # inside a cut: snap to the next kept moment
        if t <= b:
            return o + (t - a) / s
    a, b, s, o = edl[-1]
    return o + (b - a) / s


def out2src(edl, t):
    for a, b, s, o in edl:
        if t <= o + (b - a) / s:
            return a + (t - o) * s
    return edl[-1][1]


# ---------- captions ----------

def speech_segments(src):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "silencedetect=n=-42dB:d=0.18",
                        "-vn", "-f", "null", "-"], capture_output=True)
    segs, prev = [], 0.0
    for m in re.finditer(r"silence_(start|end): ([0-9.]+)", p.stderr.decode()):
        v = float(m.group(2))
        if m.group(1) == "start":
            if v - prev > 0.05:
                segs.append((prev, v))
        else:
            prev = v
    return segs


def chunk_text(text, maxc=40):
    words, chunks, cur = text.split(), [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if len(cand) > maxc and cur:
            chunks.append(cur)
            cur = w
        else:
            cur = cand
        if (cur.endswith((".", ":", ";")) and len(cur) > 12) or (cur.endswith(",") and len(cur) > 20):
            chunks.append(cur)
            cur = ""
    if cur:
        chunks.append(cur)
    return chunks


def caption_track(scenes, lines, numbers, speech):
    """(start, end, text) in source time, spread over the voiced parts of each scene."""
    out = []
    for (s0, s1, _), text in zip(scenes, lines):
        for a, b in numbers:
            text = text.replace(a, b)
        voiced = [(max(a, s0 - 0.05), min(b, s1 + 0.05)) for a, b in speech if b > s0 - 0.05 and a < s1 + 0.05]
        total = sum(b - a for a, b in voiced) or (s1 - s0)
        chunks = chunk_text(text)
        nchar = sum(len(c) for c in chunks)

        def at(frac):
            left = frac * total
            for a, b in voiced:
                if left <= b - a:
                    return a + left
                left -= b - a
            return s1

        done = 0
        starts = []
        for c in chunks:
            starts.append(at(done / nchar))
            done += len(c)
        for i, c in enumerate(chunks):
            end = starts[i + 1] if i + 1 < len(chunks) else s1 + 0.3
            out.append((starts[i], end, c))
    return out


# ---------- drawing helpers ----------

def text_img(text, f, fill, spacing=10):
    """Text as a tight RGBA image. "\n" starts a new, centred line."""
    lines = text.split("\n")
    boxes = [f.getbbox(ln) for ln in lines]
    lh = max(b[3] - b[1] for b in boxes) + spacing
    w = max(b[2] - b[0] for b in boxes)
    im = Image.new("RGBA", (w + 4, lh * len(lines) - spacing + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, (ln, b) in enumerate(zip(lines, boxes)):
        d.text((2 - b[0] + (w - (b[2] - b[0])) / 2, 2 - boxes[0][1] + i * lh), ln, font=f, fill=fill)
    return im


def pill_img(text, f, fg, bg, padx=34, pady=18, shadow=True, outline=None):
    """Rounded label. Long text shrinks to fit; "\n" makes a second (smaller) line."""
    lines = text.split("\n")
    size = f.size
    while size > 30 and f.font_variant(size=size).getlength(lines[0]) > 900:
        size -= 2
    f = f.font_variant(size=size)
    body = text_img(lines[0], f, fg)
    if len(lines) > 1:
        f2 = f.font_variant(size=int(size * 0.62))
        sub = text_img("\n".join(lines[1:]), f2, fg, 6)
        both = Image.new("RGBA", (max(body.width, sub.width), body.height + 8 + sub.height), (0, 0, 0, 0))
        both.paste(body, ((both.width - body.width) // 2, 0), body)
        both.paste(sub, ((both.width - sub.width) // 2, body.height + 8), sub)
        body = both
    w, h = body.width + 2 * padx, body.height + 2 * pady
    rad = min(h // 2, 46)
    sh = 10 if shadow else 0
    im = Image.new("RGBA", (w + 4, h + sh + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow:
        d.rounded_rectangle((2, 2 + sh, w + 2, h + 2 + sh), radius=rad, fill=(0, 0, 0, 110))
    if bg is not None:
        d.rounded_rectangle((2, 2, w + 2, h + 2), radius=rad, fill=bg)
    if outline is not None:
        d.rounded_rectangle((2, 2, w + 2, h + 2), radius=rad, outline=outline, width=3)
    im.paste(body, (2 + padx, 2 + pady), body)
    return im


def caption_img(text):
    f = font("Bold", 52)
    words = text.split()
    space = f.getlength(" ")
    lines, cur, curw = [], [], 0.0
    for w in words:
        ww = f.getlength(w)
        if cur and curw + space + ww > 920:
            lines.append(cur)
            cur, curw = [], 0.0
        cur.append(w)
        curw += (space if len(cur) > 1 else 0) + ww
    lines.append(cur)
    lh = 66
    widths = [sum(f.getlength(w) for w in ln) + space * (len(ln) - 1) for ln in lines]
    bw, bh = int(max(widths)) + 64, lh * len(lines) + 34
    im = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=30, fill=(4, 20, 14, 190))
    for i, ln in enumerate(lines):
        x = (bw - widths[i]) / 2
        y = 17 + i * lh
        for w in ln:
            hot = bool(re.search(r"\d|%|IRR", w))
            d.text((x, y), w, font=f, fill=YELLOW if hot else (255, 255, 255))
            x += f.getlength(w) + space
    return im


def blit(canvas, im, cx, cy, alpha=1.0, scale=1.0, rotate=0.0):
    """Paste an RGBA image centred at (cx, cy) with opacity, scale and rotation."""
    if alpha <= 0.01 or scale <= 0.01:
        return
    if abs(scale - 1) > 0.01:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    if abs(rotate) > 0.05:
        im = im.rotate(rotate, resample=Image.BICUBIC, expand=True)
    if alpha < 0.99:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        im = im.copy()
        im.putalpha(a)
    x, y = int(cx - im.width / 2), int(cy - im.height / 2)
    canvas.paste(im, (x, y), im)


def background_layers():
    yy = np.linspace(0, 1, H)[:, None, None]
    xx = np.linspace(0, 1, W)[None, :, None]

    def grad(top, bottom):
        top, bottom = np.array(top, float), np.array(bottom, float)
        g = top * (1 - yy) + bottom * yy + 18 * (xx - 0.5) * np.array([0, 1, 0.6])
        g = np.broadcast_to(g, (H, W, 3)).copy()
        g[::60, ::1, :] += 0  # keep shape
        dots = np.zeros((H, W), bool)
        dots[30::60, 30::60] = True
        dots[31::60, 30::60] = True
        dots[30::60, 31::60] = True
        dots[31::60, 31::60] = True
        g[dots] += 22
        return Image.fromarray(np.clip(g, 0, 255).astype(np.uint8), "RGB")

    def scrim(h, top_alpha, flip):
        a = (np.linspace(1, 0, h) ** 1.4 * top_alpha).astype(np.uint8)
        if flip:
            a = a[::-1]
        im = Image.new("RGBA", (W, h), (3, 30, 22, 0))
        im.putalpha(Image.fromarray(np.repeat(a[:, None], W, axis=1), "L"))
        return im

    G["scrim_top"], G["scrim_bottom"] = scrim(300, 240, False), scrim(330, 215, True)
    green = grad((4, 47, 34), (2, 22, 16))
    red = grad((70, 14, 14), (24, 6, 6))

    def blob(color, size, peak):
        r = np.linspace(-1, 1, size)
        d = np.sqrt(r[None, :] ** 2 + r[:, None] ** 2)
        a = np.clip(1 - d, 0, 1) ** 2 * peak
        im = Image.new("RGBA", (size, size), color + (0,))
        im.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
        return im

    blobs = [blob((16, 185, 129), 1100, 120), blob((20, 184, 166), 900, 90), blob((250, 204, 21), 800, 55)]
    return green, red, blobs


# ---------- render state (built in main, shared with workers by fork) ----------

G = {}


def phone_geometry(t):
    i = min(int(t * FPS), len(G["z"]) - 1)
    z, fx, fy = G["z"][i], G["fx"][i], G["fy"][i]
    dy = 0.0
    # intro: phone flies up from below
    land = G["land"]
    if t < land:
        dy = 1800 * (1 - out_back((t - (land - 0.55)) / 0.55, 1.2))
    # outro: phone drops away
    if t > G["outro"]:
        dy = 1700 * in_back((t - G["outro"]) / 0.45)
    s = BASE * z
    fwx, fwy = X0 + fx * BASE, Y0 + fy * BASE
    k = clip01((z - 1) / 0.4)
    fcx = fwx + (CENTER[0] - fwx) * k
    fcy = fwy + (CENTER[1] - fwy) * k + dy
    return fcx - fx * s, fcy - fy * s, s


def draw_phone(canvas, frame, L, T, s):
    sw, sh = SW * s, SH * s
    rad = 30 * s / BASE
    bez = 16 * s / BASE
    if T > H or T + sh < 0:
        return
    d = ImageDraw.Draw(canvas, "RGBA")
    d.rounded_rectangle((L - bez - 3, T - bez - 3, L + sw + bez + 3, T + sh + bez + 3), radius=rad + bez + 3,
                        fill=(52, 211, 153, 60))
    d.rounded_rectangle((L - bez, T - bez, L + sw + bez, T + sh + bez), radius=rad + bez, fill=(10, 14, 13))
    cx0, cy0 = max(0, int(math.ceil(L))), max(0, int(math.ceil(T)))
    cx1, cy1 = min(W, int(math.floor(L + sw))), min(H, int(math.floor(T + sh)))
    if cx1 <= cx0 or cy1 <= cy0:
        return
    box = (max(0.0, (cx0 - L) / s), max(0.0, (cy0 - T) / s), min(SW, (cx1 - L) / s), min(SH, (cy1 - T) / s))
    img = frame.resize((cx1 - cx0, cy1 - cy0), Image.BICUBIC, box=box)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((L - cx0, T - cy0, L + sw - cx0 - 1, T + sh - cy0 - 1), radius=rad, fill=255)
    canvas.paste(img, (cx0, cy0), mask)


def draw_highlights(canvas, t, L, T, s):
    d = ImageDraw.Draw(canvas, "RGBA")
    rects = []
    for a, b, box, color in G["highlights"]:
        al = window_alpha(t, a, b)
        if al <= 0:
            continue
        x0, y0, x1, y1 = L + box[0] * s, T + box[1] * s, L + box[2] * s, T + box[3] * s
        rects.append((x0, y0, x1, y1))
        sx0, sy0, sx1, sy1 = max(L, 0), max(T, 0), min(L + SW * s, W), min(T + SH * s, H)
        dim = (0, 0, 0, int(125 * al))
        for r in [(sx0, sy0, sx1, y0), (sx0, y1, sx1, sy1), (sx0, y0, x0, y1), (x1, y0, sx1, y1)]:
            if r[2] > r[0] and r[3] > r[1]:
                d.rectangle(r, fill=dim)
        pad = 8 + 30 * (1 - out_back((t - a) / 0.4))
        c = COLORS[color]
        for wdt, aa in ((22, 40), (13, 80), (6, 255)):
            d.rounded_rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), radius=18, outline=c + (int(aa * al),), width=wdt)
    return rects


def draw_header(canvas, t, alpha):
    if alpha <= 0:
        return
    d = ImageDraw.Draw(canvas, "RGBA")
    scenes = G["scene_out"]
    n = len(scenes)
    gap, x0, x1 = 8, 60, 1020
    segw = (x1 - x0 - gap * (n - 1)) / n
    cur = max([i for i, (a, _, _) in enumerate(scenes) if t >= a] or [0])
    for i in range(n):
        xa = x0 + i * (segw + gap)
        d.rounded_rectangle((xa, 34, xa + segw, 42), radius=4, fill=(255, 255, 255, int(60 * alpha)))
        if i < cur:
            frac = 1.0
        elif i == cur:
            nxt = scenes[i + 1][0] if i + 1 < n else G["outro"]
            frac = clip01((t - scenes[i][0]) / max(0.1, nxt - scenes[i][0]))
        else:
            frac = 0.0
        if frac > 0:
            d.rounded_rectangle((xa, 34, xa + max(8, segw * frac), 42), radius=4, fill=YELLOW + (int(255 * alpha),))
    blit(canvas, G["wordmark"], 60 + G["wordmark"].width / 2, 96, alpha)
    blit(canvas, G["pill"], 1020 - G["pill"].width / 2, 96, alpha)
    a0 = scenes[cur][0]
    p = out_cubic((t - a0) / 0.4)
    im = G["titles"][cur]
    blit(canvas, im, 60 + im.width / 2 - 50 * (1 - p), 190, alpha * p)


def draw_stickers(canvas, t, rects):
    for i, (a, b, im, _) in enumerate(G["stickers"]):
        if t < a or t > b + 0.2:
            continue
        pin = out_back((t - a) / 0.35, 2.2)
        pout = clip01((t - b) / 0.2)
        scale = (0.3 + 0.7 * pin) * (1 - 0.25 * pout)
        alpha = clip01((t - a) / 0.12) * (1 - pout)
        top_busy = any(r[1] < 560 and r[3] > 330 for r in rects)
        y = (1520 if top_busy else 420) + 6 * math.sin(2 * math.pi * (t - a) / 1.6)
        blit(canvas, im, W / 2, y, alpha, scale, rotate=3 if i % 2 else -3)


def draw_captions(canvas, t):
    for a, b, im in G["captions"]:
        if a <= t < b:
            p = out_cubic((t - a) / 0.18)
            blit(canvas, im, W / 2, 1755 + 24 * (1 - p), p)
            return


def draw_ff(canvas, t):
    for a, b in G["ff"]:
        if a <= t <= b:
            pulse = 1 + 0.06 * math.sin(2 * math.pi * (t - a) * 3)
            blit(canvas, G["ff_img"], 880, 330, clip01((t - a) / 0.1) * clip01((b - t) / 0.1), pulse)


def draw_intro(canvas, t):
    if t > G["land"] + 0.2:
        return
    title, tag = G["intro"]
    p = out_back((t - 0.05) / 0.5, 1.6)
    leave = clip01((t - (G["land"] - 0.6)) / 0.35)
    blit(canvas, title, W / 2, 820 - 120 * leave, (1 - leave) * clip01(t / 0.15), 0.7 + 0.3 * p)
    pt = out_cubic((t - 0.35) / 0.4)
    blit(canvas, tag, W / 2, 960 + 30 * (1 - pt) - 120 * leave, pt * (1 - leave))


def draw_outro(canvas, t):
    e = G["end_hit"]
    if t < e - 0.05:
        return
    title, tag, url, disc = G["outro_imgs"]
    blit(canvas, title, W / 2, 800, clip01((t - e) / 0.1), 0.6 + 0.4 * out_back((t - e) / 0.5, 1.8))
    pt = out_cubic((t - e - 0.25) / 0.4)
    blit(canvas, tag, W / 2, 940 + 30 * (1 - pt), pt)
    pu = out_back((t - e - 0.5) / 0.4, 2.0)
    blit(canvas, url, W / 2, 1070, clip01((t - e - 0.5) / 0.1), 0.3 + 0.7 * pu)
    pd = out_cubic((t - e - 0.75) / 0.4)
    blit(canvas, disc, W / 2, 1200, pd)


def render_frame(i):
    t = i / FPS
    src_t = out2src(G["edl"], t)
    fi = min(int(src_t * SRC_FPS + 1e-6), len(G["frames"]) - 1)
    frame = Image.fromarray(np.asarray(G["frames"][fi]), "RGB")
    for a, b, box in G["blur"]:  # pixelate e.g. a typed business name
        if a <= src_t <= b:
            reg = frame.crop(box)
            reg = reg.resize((max(1, reg.width // 12), max(1, reg.height // 12)), Image.BILINEAR)
            frame.paste(reg.resize((box[2] - box[0], box[3] - box[1]), Image.NEAREST), box[:2])

    red = max([window_alpha(t, a, b, 0.4, 0.5) for a, b, _, c in G["stickers"] if c == "red"] + [0])
    canvas = Image.blend(G["bg"], G["bg_red"], 0.85 * red) if red > 0 else G["bg"].copy()
    for k, b in enumerate(G["blobs"]):
        bx = W * (0.2 + 0.6 * k / 2) + 260 * math.sin(t * 0.35 + k * 2.1) - b.width / 2
        by = H * (0.25 + 0.3 * k) + 300 * math.cos(t * 0.27 + k * 1.3) - b.height / 2
        canvas.paste(b, (int(bx), int(by)), b)

    L, T, s = phone_geometry(t)
    draw_phone(canvas, frame, L, T, s)
    rects = draw_highlights(canvas, t, L, T, s)
    header_alpha = clip01((t - G["land"] + 0.2) / 0.35) * (1 - clip01((t - G["outro"]) / 0.3))
    if header_alpha > 0:
        canvas.paste(G["scrim_top"], (0, 0), G["scrim_top"])
        canvas.paste(G["scrim_bottom"], (0, H - G["scrim_bottom"].height), G["scrim_bottom"])
    draw_header(canvas, t, header_alpha)
    draw_ff(canvas, t)
    draw_stickers(canvas, t, rects)
    draw_captions(canvas, t)
    draw_intro(canvas, t)
    draw_outro(canvas, t)
    return canvas.tobytes()


# ---------- main ----------

def smooth_track(x, tau):
    a = 1 - math.exp(-1 / (FPS * tau))
    y = x.copy()
    for i in range(1, len(y)):
        y[i] = y[i - 1] + a * (y[i] - y[i - 1])
    for i in range(len(y) - 2, -1, -1):
        y[i] = y[i + 1] + a * (y[i] - y[i + 1])
    return y


def main():
    lang, src, out = sys.argv[1:4]
    plan = json.loads((HERE / "edit-plan.json").read_text())[lang]
    cues_src = json.loads((HERE / "sound-cues.json").read_text())[lang]
    narration = {n["id"]: n[lang] for n in json.loads((HERE / "narration.json").read_text())}
    scenes = plan["scenes"]

    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                           capture_output=True, text=True, check=True)
    src_dur = float(probe.stdout)
    diffs = frame_diffs(src)
    edl, _ = build_edl(scenes, diffs, src_dur, 4.0)
    m = lambda x: src2out(edl, x)  # noqa: E731

    outro = m(scenes[-1][1]) + 0.3
    end_hit = math.ceil((outro + 0.45) / st.BEAT) * st.BEAT
    total = end_hit + 2.9
    nframes = int(total * FPS)
    land = 1.95
    G.update(edl=edl, outro=outro, end_hit=end_hit, land=land, blur=plan.get("blur", []))

    # source frames on disk, memory-mapped
    tmp = Path(tempfile.mkdtemp())
    raw = tmp / "frames.raw"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", str(raw)], check=True)
    count = raw.stat().st_size // (SW * SH * 3)
    G["frames"] = np.memmap(raw, np.uint8, "r", shape=(count, SH, SW, 3))

    # camera track
    z = np.ones(nframes)
    fx = np.full(nframes, SW / 2)
    fy = np.full(nframes, SH / 2)
    hl = []
    for a, b, box, color in plan["highlights"]:
        oa, ob = m(a), m(b)
        hl.append((oa, ob, box, color))
        w, h = box[2] - box[0], box[3] - box[1]
        zt = max(1.0, min(1.55, 940 / (w * BASE), 1250 / (h * BASE)))
        i0, i1 = int(oa * FPS), int(ob * FPS)
        z[i0:i1] = zt
        fx[i0:i1] = (box[0] + box[2]) / 2
        fy[i0:i1] = (box[1] + box[3]) / 2
    # keep focus where it was while zoomed out, so the zoom-out doesn't slide sideways
    for i in range(1, nframes):
        if z[i] == 1.0 and z[i - 1] != 1.0:
            j = i
            while j < nframes and z[j] == 1.0:
                j += 1
            fx[i:j], fy[i:j] = SW / 2, SH / 2
    z, fx, fy = smooth_track(z, 0.16), smooth_track(fx, 0.16), smooth_track(fy, 0.16)
    tt = np.arange(nframes) / FPS
    z *= 1 + 0.012 * np.sin(2 * np.pi * tt / 7)
    whooshes = [m(t) for k, t in cues_src if k == "whoosh"]
    for tc in whooshes:
        dt = tt - tc
        dt = np.clip(dt, 0, None)
        z *= 1 + 0.08 * (1 - np.exp(-dt / 0.03)) * np.exp(-dt / 0.14)
    G.update(z=z, fx=fx, fy=fy, highlights=hl)

    # graphics
    G["scene_out"] = [(m(s0) - 0.6 if i else land, m(s1), title) for i, (s0, s1, title) in enumerate(scenes)]
    titles = []
    for i, (_, _, title) in enumerate(scenes):
        num = text_img(f"{i + 1:02d}", font("ExtraBold", 64), YELLOW)
        txt = text_img(title, font("ExtraBold", 64), (255, 255, 255))
        im = Image.new("RGBA", (num.width + 22 + txt.width, max(num.height, txt.height)), (0, 0, 0, 0))
        im.paste(num, (0, im.height - num.height), num)
        im.paste(txt, (num.width + 22, im.height - txt.height), txt)
        titles.append(im)
    G["titles"] = titles
    G["wordmark"] = text_img("Vay Đúng", font("ExtraBold", 44), (255, 255, 255))
    G["pill"] = pill_img(plan["pill"], font("SemiBold", 26), (255, 255, 255), (255, 255, 255, 30), 22, 10,
                         shadow=False, outline=(255, 255, 255, 150))
    G["ff_img"] = pill_img("3× »", font("ExtraBold", 44), (17, 24, 20), YELLOW, 26, 12)
    G["stickers"] = [(m(a), m(b), pill_img(text, font("ExtraBold", 52), STICKER[c][1], STICKER[c][0]), c)
                     for a, b, text, c in plan["stickers"]]
    G["intro"] = (text_img(plan["intro"][0], font("ExtraBold", 150), (255, 255, 255)),
                  text_img(plan["intro"][1], font("SemiBold", 46), YELLOW))
    o = plan["outro"]
    G["outro_imgs"] = (text_img(o[0], font("ExtraBold", 150), (255, 255, 255)),
                       text_img(o[1], font("SemiBold", 46), YELLOW),
                       pill_img(o[2], font("Bold", 46), (17, 24, 20), YELLOW, 36, 18),
                       text_img(o[3], font("SemiBold", 32), (255, 255, 255, 210), 14))
    speech = speech_segments(src)
    lines = [narration[f"s{i + 1:02d}"] for i in range(len(scenes))]
    G["captions"] = [(m(a), m(b), caption_img(text)) for a, b, text in
                     caption_track(scenes, lines, plan["numbers"], speech) if m(b) - m(a) > 0.05]
    G["ff"] = [(o_, o_ + (b - a) / s) for a, b, s, o_ in edl if s > 1]
    G["bg"], G["bg_red"], G["blobs"] = background_layers()

    preview = os.environ.get("PREVIEW")  # e.g. PREVIEW=3,12.5 writes stills instead of a video
    if preview:
        for x in preview.split(","):
            i = int(float(x) * FPS)
            Image.frombytes("RGB", (W, H), render_frame(i)).save(f"{out}-{float(x):06.2f}.png")
        print("edl", [(round(a, 2), round(b, 2), s, round(o_, 2)) for a, b, s, o_ in edl], "total", round(total, 2))
        return

    # ---- audio ----
    voice_src = st.read_audio(src)
    parts = []
    for a, b, s, _ in edl:
        if s == 1:
            parts.append(voice_src[int(a * st.SR):int(b * st.SR)])
        else:
            parts.append(np.zeros(int((b - a) / s * st.SR)))
    voice = np.concatenate(parts)
    n = int(total * st.SR)
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]

    # the music drops to a breakdown during the "too much" scene (the one with a red sticker)
    red_at = next(a for a, _, _, c in plan["stickers"] if c == "red")
    k8 = max(i for i, sc in enumerate(scenes) if sc[0] - 1 <= red_at)
    breaks = [(m(scenes[k8][0]) - 0.3, m(scenes[k8 + 1][0]) - 0.8)]
    bed = st.music(total, breaks=breaks, full_from=st.BAR, end_hit=end_hit)[:n] * st.db(-9.5)
    ta = np.arange(n) / st.SR
    bed *= (np.minimum(1, ta / 0.3) * np.clip((total - ta) / 1.5, 0, 1) * st.duck_gain(voice))[:, None]

    cues = [(k, m(t)) for k, t in cues_src if k != "outro"]
    cues += [("sticker", a) for a, _, _, _ in G["stickers"]]
    cues += [("shine", a) for a, _, _, _ in hl]
    cues += [("ff", a) for a, _ in G["ff"]]
    cues += [("whoosh", 0.05), ("riser", land - 1.25), ("impact", st.BAR)]
    cues += [("whoosh", outro), ("impact", end_hit), ("outro", end_hit + 0.05), ("sticker", end_hit + 0.5)]
    mix = st.master(voice, bed, st.place_sfx(cues, n))
    wav = tmp / "audio.raw"
    wav.write_bytes(st.to_pcm(mix))

    # ---- video ----
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-f", "s16le", "-ar", str(st.SR), "-ac", "2", "-i", str(wav),
                            "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "25",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                            "-shortest", out], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for k, buf in enumerate(pool.imap(render_frame, range(nframes), chunksize=6)):
            enc.stdin.write(buf)
            if k % 300 == 0:
                print(f"{lang}: frame {k}/{nframes}", flush=True)
    enc.stdin.close()
    enc.wait()
    print(lang, "->", out, f"{total:.1f}s")


if __name__ == "__main__":
    try:
        main()
    finally:  # the raw frame dump is ~3 GB: always remove it, even after a preview or an error
        if "frames" in G:
            raw = Path(G["frames"].filename)
            del G["frames"]
            shutil.rmtree(raw.parent, ignore_errors=True)
