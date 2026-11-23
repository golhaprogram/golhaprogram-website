#!/usr/bin/env python3
"""Download the programs' MP3s from music.golhaprogram.com to a local folder.

The MP3 URL of each program follows layouts/partials/audio-url.html:
  https://music.golhaprogram.com/{PREFIX}_{FILE NAME}.mp3
  (content/programs/golhaye-rangarang/209B.md -> GR_209B.mp3)

Files are saved as <out>/<series>/<PREFIX>_<NAME>.mp3. Each download goes to
a .part file first, is resumed with a Range request if interrupted, and is
renamed only after its size (and SHA1, when the server gives one) checks out.
So a run can be stopped with Ctrl+C at any time; the next run skips finished
files and resumes the partial one.

Usage:
  download_audio.py --out ~/golha-music                              # everything
  download_audio.py --out ~/golha-music --only golhaye-rangarang/570 # one program
  download_audio.py --out ~/golha-music --series golhaye-tazeh       # one series
  download_audio.py --out ~/golha-music --list                       # print URLs only
  add --verify to re-check finished files against the server (size + SHA1),
  --workers N to download N files at once (default 1).

Exits with status 1 if any MP3 could not be downloaded.
"""

import argparse
import hashlib
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROGRAMS = ROOT / "content" / "programs"
AUDIO_HOST = "music.golhaprogram.com"  # site.Params.audioHost
USER_AGENT = "golhaprogram-audio-download/1.0 (+https://golhaprogram.com)"
CHUNK = 256 * 1024
RETRIES = 5

# Same mapping as layouts/partials/audio-url.html.
PREFIXES = {
    "golhaye-rangarang": "GR",
    "golhaye-tazeh": "GT",
    "golhaye-javidan": "GJ",
    "yek-shakhe-gol": "YSG",
    "golhaye-sahraee": "GS",
}


def natural_key(name):
    m = re.match(r"(\d+)(.*)", name)
    return (int(m.group(1)), m.group(2)) if m else (float("inf"), name)


def find_programs(series=None, only=None):
    """Return a list of dicts: series, name, url, expected size (from front matter)."""
    programs = []
    for folder in sorted(p for p in PROGRAMS.iterdir() if p.is_dir()):
        if series and folder.name not in series:
            continue
        prefix = PREFIXES.get(folder.name)
        files = sorted((f for f in folder.glob("*.md") if f.name != "_index.md"),
                       key=lambda f: natural_key(f.stem))
        if files and not prefix:
            print(f"warning: no audio prefix for {folder.name}, skipped", file=sys.stderr)
            continue
        for f in files:
            if only and f"{folder.name}/{f.stem}" not in only:
                continue
            m = re.search(r"^audio_bytes:\s*(\d+)", f.read_text(encoding="utf-8"), re.M)
            name = f"{prefix}_{f.stem}.mp3"
            programs.append({
                "series": folder.name,
                "name": name,
                "url": f"https://{AUDIO_HOST}/{name}",
                "size": int(m.group(1)) if m else None,
            })
    return programs


def human(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024 or unit == "TB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024


def duration(seconds):
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h{m:02d}m" if h else f"{m}m{s:02d}s"


class Progress:
    """One status line: current file(s) and overall bytes, speed and ETA."""

    def __init__(self, count, total_bytes):
        self.count = count
        self.total = total_bytes          # estimate, from front matter
        self.done_files = 0
        self.done_bytes = 0               # bytes downloaded in this run
        self.start = time.monotonic()
        self.current = {}                 # name -> (got, size)
        self.lock = threading.Lock()
        self.tty = sys.stderr.isatty()
        self.last_draw = 0

    def update(self, name, got, size, added):
        with self.lock:
            self.done_bytes += added
            self.current[name] = (got, size)
            self.draw()

    def finish(self, name, skipped_bytes=0):
        with self.lock:
            self.current.pop(name, None)
            self.done_files += 1
            self.total -= skipped_bytes   # already on disk: not part of this run
            self.draw(force=True)

    def log(self, msg):
        with self.lock:
            if self.tty:
                sys.stderr.write("\r\033[K")
            print(msg, file=sys.stderr, flush=True)
            self.draw(force=True)

    def draw(self, force=False):
        now = time.monotonic()
        if not self.tty or (not force and now - self.last_draw < 0.2):
            return
        self.last_draw = now
        elapsed = max(now - self.start, 0.001)
        speed = self.done_bytes / elapsed
        left = max(self.total - self.done_bytes, 0)
        eta = duration(left / speed) if speed > 0 else "?"
        if len(self.current) == 1:
            (name, (got, size)), = self.current.items()
            pct = f"{100 * got / size:3.0f}%" if size else ""
            file_part = f"{name} {pct} {human(got)}/{human(size) if size else '?'}"
        elif self.current:
            file_part = f"{len(self.current)} files"
        else:
            file_part = ""
        line = (f"[{self.done_files}/{self.count}] {file_part} | "
                f"total {human(self.done_bytes)}/{human(self.total)} "
                f"{human(speed)}/s ETA {eta}")
        sys.stderr.write("\r\033[K" + line[:200])
        sys.stderr.flush()

    def close(self):
        if self.tty:
            sys.stderr.write("\r\033[K")
            sys.stderr.flush()


def request(url, method="GET", start=0):
    headers = {"User-Agent": USER_AGENT}
    if start:
        headers["Range"] = f"bytes={start}-"
    return urllib.request.urlopen(
        urllib.request.Request(url, method=method, headers=headers), timeout=60)


def remote_info(resp):
    """(total size, sha1 or None) from a 200 or 206 response."""
    size = None
    cr = resp.headers.get("Content-Range")          # bytes 100-999/1000
    if resp.status == 206 and cr and "/" in cr:
        size = int(cr.rsplit("/", 1)[1])
    elif resp.headers.get("Content-Length", "").isdigit():
        size = int(resp.headers["Content-Length"])
    sha1 = resp.headers.get("x-bz-content-sha1", "").lower()
    # B2 gives "none" or "unverified:..." for some large uploads.
    return size, sha1 if re.fullmatch(r"[0-9a-f]{40}", sha1) else None


def sha1_of(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def check(path, size, sha1):
    actual = path.stat().st_size
    if size is not None and actual != size:
        return f"size {actual} != {size}"
    if sha1 and sha1_of(path) != sha1:
        return "SHA1 mismatch"
    return None


def download(prog, out, progress, verify):
    dest = out / prog["series"] / prog["name"]
    part = dest.with_name(dest.name + ".part")
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        if verify:
            with request(prog["url"], "HEAD") as resp:
                size, sha1 = remote_info(resp)
            problem = check(dest, size, sha1)
            if problem:
                progress.log(f"{prog['name']}: {problem}, downloading again")
                dest.rename(part)
                part.unlink()
            else:
                progress.finish(prog["name"], dest.stat().st_size)
                return "ok"
        else:
            progress.finish(prog["name"], prog["size"] or dest.stat().st_size)
            return "ok"

    for attempt in range(1, RETRIES + 1):
        start = part.stat().st_size if part.exists() else 0
        try:
            with request(prog["url"], start=start) as resp:
                size, sha1 = remote_info(resp)
                if resp.status != 206:      # server ignored Range: start over
                    start = 0
                got = start
                with open(part, "ab" if start else "wb") as f:
                    while chunk := resp.read(CHUNK):
                        f.write(chunk)
                        got += len(chunk)
                        progress.update(prog["name"], got, size, len(chunk))
        except urllib.error.HTTPError as e:
            if e.code == 416 and part.exists():  # range past the end: re-check below
                with request(prog["url"], "HEAD") as resp:
                    size, sha1 = remote_info(resp)
            elif e.code in (403, 404):
                progress.finish(prog["name"], prog["size"] or 0)
                progress.log(f"{prog['name']}: not on the server (HTTP {e.code})")
                return "missing"
            else:
                progress.log(f"{prog['name']}: HTTP {e.code}, retry {attempt}/{RETRIES}")
                time.sleep(2 * attempt)
                continue
        except (OSError, urllib.error.URLError) as e:
            progress.log(f"{prog['name']}: {e}, retry {attempt}/{RETRIES}")
            time.sleep(2 * attempt)
            continue

        problem = check(part, size, sha1)
        if problem is None:
            part.rename(dest)
            progress.finish(prog["name"])
            return "ok"
        progress.log(f"{prog['name']}: {problem}, downloading again")
        part.unlink()

    progress.finish(prog["name"])
    progress.log(f"{prog['name']}: failed after {RETRIES} attempts")
    return "failed"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, required=False, help="folder to save the MP3s in")
    ap.add_argument("--series", action="append", choices=sorted(PREFIXES),
                    help="only this series (can be repeated)")
    ap.add_argument("--only", action="append", metavar="SERIES/NAME",
                    help="only this program, e.g. golhaye-rangarang/209B (can be repeated)")
    ap.add_argument("--workers", type=int, default=1, help="parallel downloads (default 1)")
    ap.add_argument("--verify", action="store_true",
                    help="re-check finished files against the server")
    ap.add_argument("--list", action="store_true", help="print the URLs and exit")
    args = ap.parse_args()

    programs = find_programs(args.series, args.only)
    if args.only:
        found = {f"{p['series']}/{p['name'].split('_', 1)[1][:-4]}" for p in programs}
        for o in args.only:
            if o not in found:
                print(f"warning: no program file for {o}", file=sys.stderr)
    if not programs:
        sys.exit("no programs to download")
    if args.list:
        for p in programs:
            print(p["url"])
        return
    if not args.out:
        ap.error("--out is required")

    out = args.out.expanduser().resolve()
    if out == ROOT or ROOT in out.parents:
        sys.exit(f"--out must be outside the repository ({ROOT})")
    out.mkdir(parents=True, exist_ok=True)

    known = [p["size"] for p in programs if p["size"]]
    average = sum(known) // len(known) if known else 0
    total = sum(p["size"] or average for p in programs)
    print(f"{len(programs)} programs, about {human(total)}, into {out}", file=sys.stderr)

    progress = Progress(len(programs), total)
    results = {"ok": 0, "missing": [], "failed": []}
    t0 = time.monotonic()
    try:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futures = [(p, pool.submit(download, p, out, progress, args.verify))
                       for p in programs]
            for p, fut in futures:
                status = fut.result()
                if status == "ok":
                    results["ok"] += 1
                else:
                    results[status].append(p["url"])
    except KeyboardInterrupt:
        progress.close()
        print("\nstopped; run the same command again to resume", file=sys.stderr)
        # Don't wait for the other workers' downloads to finish.
        import os
        os._exit(130)
    progress.close()

    print(f"done in {duration(time.monotonic() - t0)}: {results['ok']} ok, "
          f"{len(results['missing'])} missing, {len(results['failed'])} failed, "
          f"{human(progress.done_bytes)} downloaded", file=sys.stderr)
    for kind in ("missing", "failed"):
        for url in results[kind]:
            print(f"  {kind}: {url}", file=sys.stderr)
    if results["failed"] or results["missing"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
