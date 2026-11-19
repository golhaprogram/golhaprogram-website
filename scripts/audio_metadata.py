#!/usr/bin/env python3
"""Add audio_bytes and audio_duration to program front matter.

Reads audio-index.json (built with `hugo -e audioindex`), which maps each
program file to its MP3 URL. For each program that lacks the two fields, it
gets the size from a HEAD request and the duration from ffprobe (which reads
only part of the file), then writes both lines into the front matter.

Usage:
  audio_metadata.py --index /tmp/audioindex/audio-index.json            # all programs
  audio_metadata.py --index ... content/programs/golhaye-rangarang/570.md  # only these
  add --force to re-measure programs that already have the fields.

Exits with status 1 if any MP3 could not be measured; every program that
could be measured is still written.
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

FIELDS = ("audio_bytes", "audio_duration")
USER_AGENT = "golhaprogram-audio-metadata/1.0 (+https://golhaprogram.com)"


def split_front_matter(text):
    """Return (front_matter_lines, rest) or None if there is no YAML front matter."""
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":  # Hugo allows trailing spaces
        return None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[: i], lines[i:]
    return None


def has_fields(text):
    parts = split_front_matter(text)
    if parts is None:
        return False
    fm = "".join(parts[0])
    return all(re.search(rf"^{f}:", fm, re.M) for f in FIELDS)


def write_fields(path, size, duration):
    text = path.read_text(encoding="utf-8")
    fm, rest = split_front_matter(text)
    newline = "\r\n" if fm[0].endswith("\r\n") else "\n"
    fm = [l for l in fm if not re.match(rf"^({'|'.join(FIELDS)}):", l)]
    fm += [f"audio_bytes: {size}{newline}", f"audio_duration: {duration}{newline}"]
    path.write_text("".join(fm + rest), encoding="utf-8")


def measure(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            size = resp.headers.get("Content-Length")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}") from None
    if not size or not size.isdigit() or int(size) == 0:
        raise RuntimeError("no Content-Length")

    out = subprocess.run(
        ["ffprobe", "-v", "error", "-user_agent", USER_AGENT,
         "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", url],
        capture_output=True, text=True, timeout=300,
    )
    try:
        duration = round(float(out.stdout.strip()))
    except ValueError:
        raise RuntimeError(f"ffprobe failed: {out.stderr.strip()[:200]}") from None
    if duration <= 0:
        raise RuntimeError("zero duration")
    return int(size), duration


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", required=True, help="audio-index.json from `hugo -e audioindex`")
    ap.add_argument("--content", default="content", help="Hugo content directory")
    ap.add_argument("--force", action="store_true", help="re-measure even if fields exist")
    ap.add_argument("--report", help="write a Markdown summary to this file")
    ap.add_argument("files", nargs="*", help="limit to these program files")
    args = ap.parse_args()

    content = Path(args.content)
    index = json.loads(Path(args.index).read_text(encoding="utf-8"))
    wanted = {Path(f).resolve() for f in args.files}

    todo, problems = [], []
    for entry in index:
        path = content / entry["file"]
        if wanted and path.resolve() not in wanted:
            continue
        if not args.force and has_fields(path.read_text(encoding="utf-8")):
            continue
        if split_front_matter(path.read_text(encoding="utf-8")) is None:
            problems.append((path, entry["url"], "no YAML front matter"))
        elif Path(entry["url"]).name.startswith("_"):
            problems.append((path, entry["url"], "no MP3 prefix for this series in audio-url.html"))
        else:
            todo.append((path, entry["url"]))

    print(f"{len(todo)} program(s) to measure")

    def work(item):
        path, url = item
        try:
            return path, url, measure(url), None
        except Exception as e:  # report and carry on with the rest
            return path, url, None, str(e)

    done = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for path, url, result, error in pool.map(work, todo):
            if error:
                problems.append((path, url, error))
                print(f"FAIL {path}: {url}: {error}")
            else:
                write_fields(path, *result)
                done.append(path)
                print(f"ok   {path}: {result[0]} bytes, {result[1]} s")

    print(f"\nUpdated {len(done)} file(s); {len(problems)} problem(s).")
    for path, url, error in problems:
        print(f"  - {path}: {url}: {error}")

    if args.report:
        lines = [f"Updated **{len(done)}** program file(s)."]
        if problems:
            lines += ["", f"**{len(problems)} could not be measured:**", ""]
            lines += [f"- `{p}`: {u} ({e})" for p, u, e in problems]
        Path(args.report).write_text("\n".join(lines) + "\n", encoding="utf-8")

    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
