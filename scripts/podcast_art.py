#!/usr/bin/env python3
"""Render podcast cover images and upload them to Backblaze B2.

The list of images comes from Hugo (layouts/partials/podcast-art.html):

    hugo -e audioindex -d /tmp/audioindex      # writes art-index.json
    python3 scripts/podcast_art.py --index /tmp/audioindex/art-index.json --out /tmp/art
    python3 scripts/podcast_art.py --index ... --upload     # render missing + upload

Each image's name ends in a fingerprint of what is drawn on it, so an image
whose name already exists on music.golhaprogram.com is up to date and is
skipped. Changing a program (singers, estimated month) gives it a new name;
the feed points to the new one and this script renders it.

Rendering uses Chrome (Playwright), because it lays out Persian text
correctly. Fonts: Sahel from static/fonts, Vazirmatn (Latin footer) from
scripts/podcast-art/. Upload uses B2's S3 API with these environment variables:
B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_S3_ENDPOINT
(e.g. https://s3.us-west-004.backblazeb2.com).
"""
import argparse
import asyncio
import concurrent.futures
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAHEL = ROOT / "static/fonts/sahel-3.4.0"
LATIN = ROOT / "scripts/podcast-art/Vazirmatn-Regular.woff2"
SIZE = {"show": 3000, "episode": 1400}  # px; Apple: 1400-3000 square
# One colour theme per series (art_theme in the series' _index.md).
#   bg: background (dark), accent: title, frame and rule, text: number and
#   singers, muted: small labels.
THEMES = {
    "rangarang": {"bg": ("#2b1d3d", "#160e22"), "accent": "#f0a7b5", "text": "#fbf1f3", "muted": "#d8bfd0"},
    "tazeh":     {"bg": ("#174247", "#0a2326"), "accent": "#8fdad3", "text": "#effbf9", "muted": "#b7d7d3"},
    "javidan":   {"bg": ("#1d2b4d", "#0d1428"), "accent": "#a9c4f0", "text": "#f1f5fc", "muted": "#bfcbe0"},
    "shakhe":    {"bg": ("#4a1622", "#24090f"), "accent": "#f3b48a", "text": "#fdf2ec", "muted": "#e4c2b4"},
    "sahraee":   {"bg": ("#4a3317", "#22160a"), "accent": "#ecc985", "text": "#fdf6e8", "muted": "#e0cca6"},
    "sabz":      {"bg": ("#24401f", "#0f1d0d"), "accent": "#c4e08a", "text": "#f4faea", "muted": "#c7d6b3"},
}
PATTERN = False  # the faint petal rosette behind the text


def rosette(cx, cy, r, n, color, op):
    """A petal rosette drawn from rotated ellipses (an original design)."""
    petals = "".join(
        f'<ellipse cx="{cx}" cy="{cy - r * 0.5}" rx="{r * 0.22}" ry="{r * 0.5}" '
        f'transform="rotate({i * 360 / n} {cx} {cy})"/>' for i in range(n))
    return (f'<g fill="none" stroke="{color}" stroke-width="{r * 0.012}" opacity="{op}">{petals}'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 1.02}"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.12}"/></g>')


def html(item):
    t = THEMES[item["theme"]]
    bg = f"radial-gradient(circle at 50% 42%, {t['bg'][0]} 0%, {t['bg'][1]} 100%)"
    if item["kind"] == "show":
        deco = rosette(500, 500, 430, 16, t["accent"], .16) + rosette(500, 500, 250, 12, t["accent"], .12)
        body = f"""<div class="series" style="font-size:112px">{item['series']}</div>
<div class="rule"></div>
<div class="label" style="font-size:44px">برنامهٔ گل‌ها · رادیو ایران</div>"""
    else:
        deco = rosette(500, 470, 300, 16, t["accent"], .13)
        num = item["number"]
        digits = num.rstrip("ابپتثج")
        suffix = num[len(digits):]
        num_html = digits + (f'<span class="suffix">{suffix}</span>' if suffix else "")
        s = item["singers"]
        # a long list may wrap, but only between names
        names = "، ".join(n.replace(" ", "\u00a0") for n in s.split("، "))
        size = 64 if len(s) < 20 else 54 if len(s) < 34 else 46 if len(s) < 44 else 40
        month = f'<div class="label month">{item["month"]}</div>' if item["month"] else ""
        body = f"""<div class="series" style="font-size:84px">{item['series']}</div>
<div class="label" style="font-size:44px;margin-top:6px">برنامهٔ</div>
<div class="num">{num_html}</div>
<div class="rule"></div>
<div class="singers" style="font-size:{size}px">{names}</div>{month}"""
    if not PATTERN:
        deco = ""
    return f"""<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{{font-family:Sahel;src:url({(SAHEL / 'Sahel.woff2').as_uri()});font-weight:400}}
@font-face{{font-family:Sahel;src:url({(SAHEL / 'Sahel-SemiBold.woff2').as_uri()});font-weight:600}}
@font-face{{font-family:Sahel;src:url({(SAHEL / 'Sahel-Bold.woff2').as_uri()});font-weight:700 900}}
@font-face{{font-family:Latin;src:url({LATIN.as_uri()})}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1000px;height:1000px;overflow:hidden}}
.c{{position:relative;width:1000px;height:1000px;background:{bg};color:{t['text']};font-family:Sahel;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}}
svg{{position:absolute;inset:0}}
.frame{{position:absolute;inset:34px;border:3px solid {t['accent']}8c;border-radius:6px}}
.frame2{{position:absolute;inset:46px;border:1px solid {t['accent']}59;border-radius:4px}}
.series{{font-weight:900;color:{t['accent']};line-height:1.4;position:relative}}
.num{{font-weight:900;font-size:250px;line-height:1;position:relative}}
.suffix{{font-size:110px;color:{t['accent']};margin-right:18px}}
.label{{font-weight:400;color:{t['muted']};position:relative}}
.month{{font-size:38px;margin-top:14px}}
.singers{{font-weight:700;position:relative;max-width:840px;line-height:1.5}}
.rule{{width:180px;height:3px;background:{t['accent']};opacity:.8;position:relative;margin:22px 0}}
.foot{{position:absolute;bottom:64px;font:26px Latin;color:{t['text']}b3;direction:ltr}}
</style></head><body><div class="c">
<svg viewBox="0 0 1000 1000">{deco}</svg><div class="frame"></div><div class="frame2"></div>
{body}
<div class="foot">golhaprogram.com</div>
</div></body></html>"""


async def render(items, out):
    from playwright.async_api import async_playwright
    from PIL import Image
    tmp = Path(tempfile.mkdtemp())
    page_file = tmp / "page.html"
    async with async_playwright() as p:
        chrome = os.environ.get("CHROME")
        browser = await (p.chromium.launch(executable_path=chrome) if chrome
                         else p.chromium.launch(channel="chrome"))
        pages = {}
        for item in items:
            size = SIZE[item["kind"]]
            if size not in pages:
                pages[size] = await browser.new_page(viewport={"width": 1000, "height": 1000},
                                                     device_scale_factor=size / 1000)
            pg = pages[size]
            page_file.write_text(html(item), encoding="utf-8")
            await pg.goto(page_file.as_uri())
            await pg.evaluate("document.fonts.ready")
            bad = await pg.evaluate(
                "[...document.fonts].filter(f => f.status == 'error').map(f => f.family)")
            if bad:
                sys.exit(f"{item['name']}: fonts failed to load: {bad}")
            png = tmp / "shot.png"
            await pg.screenshot(path=str(png))
            Image.open(png).convert("RGB").save(out / item["name"], quality=88, optimize=True)
            print("rendered", item["name"])
        await browser.close()


def exists(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "golha-podcast-art"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--index", required=True, help="art-index.json from hugo -e audioindex")
    ap.add_argument("--out", default=None, help="directory for the images (default: a temp dir)")
    ap.add_argument("--upload", action="store_true", help="upload to B2 the images not online yet")
    ap.add_argument("--only", nargs="*", help="only these image names or program numbers (testing)")
    args = ap.parse_args()

    items = json.loads(Path(args.index).read_text(encoding="utf-8"))
    if args.only:
        items = [i for i in items if i["name"] in args.only or i["name"].split("_", 1)[1].split("-")[0] in args.only]
    if args.upload:
        with concurrent.futures.ThreadPoolExecutor(16) as ex:
            online = list(ex.map(lambda i: exists(i["url"]), items))
        items = [i for i, ok in zip(items, online) if not ok]
        print(f"{len(online) - len(items)} images already online, {len(items)} to render")
    if not items:
        return
    out = Path(args.out or tempfile.mkdtemp())
    out.mkdir(parents=True, exist_ok=True)
    asyncio.run(render(items, out))

    if args.upload:
        import boto3
        s3 = boto3.client("s3", endpoint_url=os.environ["B2_S3_ENDPOINT"],
                          aws_access_key_id=os.environ["B2_KEY_ID"],
                          aws_secret_access_key=os.environ["B2_APPLICATION_KEY"])
        for i in items:
            s3.upload_file(str(out / i["name"]), os.environ["B2_BUCKET"], "art/" + i["name"],
                           ExtraArgs={"ContentType": "image/jpeg",
                                      "CacheControl": "public, max-age=31536000, immutable"})
            print("uploaded", i["name"])
    print(f"{len(items)} images in {out}")


if __name__ == "__main__":
    main()
