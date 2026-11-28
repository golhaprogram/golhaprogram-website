#!/usr/bin/env python3
"""Keep each program's timed lyrics (.vtt) in step with its text (.md).

The .md is the only place the poems are written. A .vtt (made with Hamahang)
holds the times; its cue texts are copies of .md lines, and that is how the
site pairs a cue with a line. This script makes sure the copies stay copies:

* every cue is paired with an .md line: by text (ignoring spacing,
  nim-fasele, diacritics and punctuation), the k-th time a text is sung going
  to its k-th copy and any extra times to the last copy, like the site and
  Hamahang; a cue whose text no longer matches (the line was reworded or
  respelled in the .md) goes to the one line that has no cues and is clearly
  the most similar;
* every cue's text is then rewritten to its line, exactly as in the .md, so a
  spelling fix in the .md carries over to the .vtt (with --fix);
* a lyric line not ended by a line break (two trailing spaces) is fixed in the
  .md too: Markdown would join it with the next line and both lose their cues.

It fails when it can't be sure: a cue that matches no line well, or two lines
it can't tell apart. That is a real change (a line added, removed or
rewritten), and that program needs timing again in Hamahang.

Only cue texts change; times, cue ids and everything else stay as they are.

    python3 scripts/sync_vtt.py [--fix] [--github] [FILE...]

FILE can be a program's .md or .vtt; with none, every .vtt under content/.
"""
import argparse
import difflib
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_SIMILARITY = 0.75   # a changed line must still be this close to its old text
MIN_MARGIN = 0.1        # …and this much closer than the next best line


def norm(s):
    """Same as norm() in assets/js/components/LyricsSync.js."""
    s = unicodedata.normalize("NFC", s)
    s = re.sub("[ً-ٰٟ]", "", s)
    s = s.replace("ي", "ی").replace("ك", "ک")
    return "".join(ch for ch in s if unicodedata.category(ch)[0] in "LN")


def split_front_matter(text):
    m = re.match(r"(---\n.*?\n---\n)(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else ("", text)


def is_label(text):
    """Like Hamahang: «(مولوی)», or a heading."""
    t = text.strip()
    return bool(re.fullmatch(r"[(（].*[)）]", t)) or t.startswith("#")


def is_rule(text):
    return bool(re.fullmatch(r"([-*_])(\s*\1){2,}", text.strip()))


def md_lines(text):
    """The lyric lines of an .md body: [(line number in file, text)], plus the
    numbers of lines missing their hard line break."""
    fm, body = split_front_matter(text)
    offset = fm.count("\n")
    rows = body.split("\n")
    lines, unbroken = [], []
    for i, row in enumerate(rows):
        t = row.strip()
        if not t or is_rule(t):
            continue
        nxt = rows[i + 1].strip() if i + 1 < len(rows) else ""
        if nxt and not is_rule(nxt) and not re.search(r"(  |\\)$", row):
            unbroken.append(offset + i + 1)
        if not is_label(t):
            lines.append((offset + i + 1, t))
    return lines, unbroken


def parse_vtt(text):
    """Blocks of the file, keeping everything; cues get their text rows' span."""
    rows = text.replace("\r\n", "\n").split("\n")
    cues = []
    i = 0
    while i < len(rows):
        if "-->" in rows[i]:
            start = rows[i].split("-->")[0].strip()
            j = i + 1
            while j < len(rows) and rows[j].strip():
                j += 1
            cues.append({"time_row": i, "text_rows": (i + 1, j), "start": start,
                         "text": "\n".join(rows[i + 1:j]).strip()})
            i = j
        else:
            i += 1
    return rows, cues


def pair(cues, lines):
    """cue index -> line index. Returns (pairs, problems)."""
    by_text = {}
    for li, (_, t) in enumerate(lines):
        k = norm(t)
        if k:
            by_text.setdefault(k, []).append(li)
    pairs, seen, loose = {}, {}, {}
    for ci, cue in enumerate(cues):   # a VTT's cues are in time order
        k = norm(re.sub(r"<[^>]*>", "", cue["text"]))
        if not k:
            continue
        copies = by_text.get(k)
        if copies:
            n = seen.get(k, 0)
            seen[k] = n + 1
            pairs[ci] = copies[min(n, len(copies) - 1)]
        else:
            loose.setdefault(k, []).append(ci)

    # Texts that no longer match: each goes to the clearly most similar line
    # that no cue matched exactly.
    problems = []
    free = [li for li in range(len(lines)) if li not in set(pairs.values())]
    taken = {}
    for k, cis in loose.items():
        scores = sorted(((difflib.SequenceMatcher(None, k, norm(lines[li][1])).ratio(), li) for li in free), reverse=True)
        best, li = scores[0] if scores else (0, None)
        second = scores[1][0] if len(scores) > 1 else 0
        first_cue = cues[cis[0]]
        if best < MIN_SIMILARITY:
            problems.append((None, f"cue at {first_cue['start']} «{first_cue['text']}» matches no line of the text"))
        elif best - second < MIN_MARGIN:
            problems.append((None, f"cue at {first_cue['start']} «{first_cue['text']}» is as close to "
                                   f"«{lines[scores[0][1]][1]}» as to «{lines[scores[1][1]][1]}»"))
        elif li in taken:
            problems.append((lines[li][0], f"two different cue texts look like this line: «{taken[li]}» and «{first_cue['text']}»"))
        else:
            taken[li] = first_cue["text"]
            for ci in cis:
                pairs[ci] = li
    return pairs, problems


def sync(md_path, vtt_path, fix):
    """Returns (changes, problems) for one program; writes with fix."""
    md = md_path.read_text(encoding="utf-8")
    lines, unbroken = md_lines(md)
    rows, cues = parse_vtt(vtt_path.read_text(encoding="utf-8"))
    pairs, problems = pair(cues, lines)
    problems = [(md_path if ln else vtt_path, ln, msg) for ln, msg in problems]

    changes = []
    for ci, li in sorted(pairs.items()):
        cue, text = cues[ci], lines[li][1]
        if cue["text"] != text:
            changes.append(f"{vtt_path.name} {cue['start']}: «{cue['text']}» → «{text}»")
            a, b = cue["text_rows"]
            rows[a:b] = [text] + [""] * (b - a - 1)  # keep row count so later spans stay valid
    new_vtt = re.sub(r"\n{3,}", "\n\n", "\n".join(rows))

    md_rows = md.split("\n")
    for ln in unbroken:
        changes.append(f"{md_path.name}:{ln}: added the missing line break after «{md_rows[ln - 1].strip()}»")
        md_rows[ln - 1] = md_rows[ln - 1].rstrip() + "  "

    if fix and not problems:
        if unbroken:
            md_path.write_text("\n".join(md_rows), encoding="utf-8")
        if new_vtt != vtt_path.read_text(encoding="utf-8"):
            vtt_path.write_text(new_vtt, encoding="utf-8")
    return changes, problems


def programs(files):
    """(md, vtt) pairs for the given files: a .vtt, or an .md that has one."""
    if not files:
        files = [str(p) for p in sorted((ROOT / "content").rglob("*.vtt"))]
    out = {}
    for f in files:
        p = Path(f)
        if p.suffix not in (".md", ".vtt"):
            continue
        md, vtt = p.with_suffix(".md"), p.with_suffix(".vtt")
        if md.is_file() and vtt.is_file():
            out[vtt] = md
        elif p.suffix == ".vtt" and p.is_file():
            print(f"::error file={p}::no {md.name} next to it" if "--github" in sys.argv else f"{p}: no {md.name} next to it")
            out[vtt] = None
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*")
    ap.add_argument("--fix", action="store_true", help="write the changes")
    ap.add_argument("--github", action="store_true", help="print problems as GitHub annotations")
    args = ap.parse_args()

    failed = False
    nchanged = 0
    progs = programs(args.files)
    for vtt, md in progs.items():
        if md is None:
            failed = True
            continue
        changes, problems = sync(md, vtt, args.fix)
        for c in changes:
            print(("" if args.fix and not problems else "would change: ") + c)
        nchanged += bool(changes)
        for path, ln, msg in problems:
            failed = True
            if args.github:
                loc = f"file={path.relative_to(ROOT) if path.is_absolute() else path}" + (f",line={ln}" if ln else "")
                print(f"::error {loc},title=Timed lyrics::{msg}. Fix its timing in Hamahang.")
            else:
                print(f"{path}{':' + str(ln) if ln else ''}: {msg}")
    print(f"{len(progs)} timed program(s): {nchanged} {'synced' if args.fix else 'out of sync'}"
          + (", some need timing again" if failed else ""))
    return 1 if failed or (nchanged and not args.fix) else 0


if __name__ == "__main__":
    sys.exit(main())
