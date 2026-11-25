#!/usr/bin/env python3
"""Check program files for formatting and data problems.

  check_content.py                  # check every program
  check_content.py FILE...          # check only these
  check_content.py --fix FILE...    # also fix formatting in place

--fix only touches formatting, never the data: trailing spaces in the front
matter and on the --- lines, blank lines inside the front matter, Windows
line endings, a byte-order mark, and the number of newlines at the end of
the file. The lyrics are left alone (their trailing double spaces are
Markdown line breaks).

Everything else is reported with a GitHub annotation, so it shows on the
PR's "Files changed" tab. Errors fail the check (exit status 1); warnings,
such as a missing date, are shown but don't.
"""

import argparse
import datetime
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PROGRAMS = ROOT / "content" / "programs"

FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
# Letter suffix in the file name -> Persian letter in program_number
# (209B.md -> ۲۰۹ب, 275C.md -> ۲۷۵ث), matching the existing files.
SUFFIXES = {"": "", "B": "ب", "C": "ث"}

ROLES = [r["key"] for r in yaml.safe_load((ROOT / "data" / "roles.yaml").read_text(encoding="utf-8"))]
REQUIRED = ["program_type", "program_number", "dastgah", "singers"]
# Reported as warnings: shown on the PR but don't fail it.
WANTED = ["date"]
OTHER_FIELDS = ["date_aired", "draft", "mode", "audio_bytes", "audio_duration"]
KNOWN = set(REQUIRED) | set(WANTED) | set(ROLES) | set(OTHER_FIELDS)


def series_types():
    """Folder name -> expected program_type, from each series' _index.md title."""
    out = {}
    for idx in PROGRAMS.glob("*/_index.md"):
        fm = yaml.safe_load(idx.read_text(encoding="utf-8").split("---")[1]) or {}
        if fm.get("title"):
            out[idx.parent.name] = fm["title"].strip().replace(" ", "-")
    return out


def split(text):
    """(front matter lines, body lines) or None. Fences may have stray spaces."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[1:i], lines[i + 1:]
    return None


def tidy(text):
    """Return text with formatting fixed (front matter and file ending only)."""
    text = text.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")
    parts = split(text)
    if parts is None:
        return text
    fm, body = parts
    fm = [l.rstrip() for l in fm if l.strip()]
    out = "\n".join(["---", *fm, "---", *body])
    return out.rstrip("\n") + "\n"


def check(path, types, fix):
    """Return (errors, warnings) for one program file."""
    errors, warnings = [], []
    raw = path.read_text(encoding="utf-8")
    text = tidy(raw)
    if fix and text != raw:
        path.write_text(text, encoding="utf-8")
        print(f"fixed formatting: {path.relative_to(ROOT)}")
    elif text != raw:
        errors.append("formatting (trailing spaces, blank lines in front matter, or file ending); "
                      "run scripts/check_content.py --fix")

    parts = split(text)
    if parts is None:
        return errors + ["no front matter: the file must start and end its header with --- lines"], warnings
    try:
        fm = yaml.safe_load("\n".join(parts[0])) or {}
    except yaml.YAMLError as e:
        return errors + [f"front matter is not valid YAML: {e}".replace("\n", " ")], warnings
    if not isinstance(fm, dict):
        return errors + ["front matter is not a list of key: value lines"], warnings
    # YAML keeps only the last of two lines with the same key, so the first is lost silently.
    keys = [line.split(":", 1)[0] for line in parts[0] if line[:1].isalpha() and ":" in line]
    for key in sorted({k for k in keys if keys.count(k) > 1}):
        errors.append(f"{key} appears on more than one line; put all the names in one list")

    for key in REQUIRED:
        if fm.get(key) in (None, "", []):
            errors.append(f"missing {key}")
    for key in WANTED:
        if fm.get(key) in (None, ""):
            warnings.append(f"missing {key} (the podcast feed uses it to order episodes)")
    for key in sorted(set(fm) - KNOWN):
        errors.append(f"unknown field '{key}' (a typo? new fields go in data/roles.yaml or this script)")

    # File name, series folder, program_type and program_number must agree.
    m = re.fullmatch(r"(\d+)([A-Z]?)", path.stem)
    if not m or m.group(2) not in SUFFIXES:
        errors.append(f"file name {path.name} should be a number, optionally followed by "
                      f"{' or '.join(s for s in SUFFIXES if s)} (e.g. 209.md, 209B.md)")
    else:
        expected = m.group(1).translate(FA_DIGITS) + SUFFIXES[m.group(2)]
        pn = str(fm.get("program_number", "")).strip()
        if pn and pn != expected:
            errors.append(f"program_number is {pn!r} but the file name says {expected!r}")
    folder = path.parent.name
    if folder in types and fm.get("program_type") and fm["program_type"] != types[folder]:
        errors.append(f"program_type is {fm['program_type']!r} but the folder {folder}/ "
                      f"is {types[folder]!r}")

    date = fm.get("date")
    if date not in (None, "") and not isinstance(date, datetime.date):
        try:
            datetime.date.fromisoformat(str(date))
        except ValueError:
            errors.append(f"date {date!r} is not YYYY-MM-DD")

    aired = fm.get("date_aired")
    if aired not in (None, "") and not re.fullmatch(r"1[23]\d\d-(0[1-9]|1[0-2])", str(aired)):
        errors.append(f"date_aired {aired!r} should be a Solar Hijri year and month, like \"1346-08\" "
                      "(set by scripts/estimate_air_dates.py --write)")

    for key in ROLES:
        value = fm.get(key)
        if value is None:
            continue
        names = value if isinstance(value, list) else [value] if key == "dastgah" else None
        if names is None:
            errors.append(f"{key} should be a list, like {key}: [\"name\"]")
            continue
        for n in names:
            if not isinstance(n, str) or not n.strip():
                errors.append(f"{key} has an empty or non-text entry: {n!r}")
            elif n != n.strip() or "  " in n:
                errors.append(f"{key}: extra spaces in {n!r}")
            elif re.search("\u200c(?=\\s|$)|(?:^|(?<=\\s))\u200c|\u200c\u200c", n):
                errors.append(f"{key}: stray nim-fasele (ZWNJ) in {n!r}")
        seen = [n for n in names if isinstance(n, str)]
        dupes = sorted({n for n in seen if seen.count(n) > 1})
        if dupes:
            errors.append(f"{key} lists {', '.join(dupes)} more than once")

    for key in ("audio_bytes", "audio_duration"):
        if key in fm and not (isinstance(fm[key], int) and fm[key] > 0):
            errors.append(f"{key} should be a positive whole number (it is filled in automatically)")

    if not "\n".join(parts[1]).strip():
        warnings.append("no lyrics after the front matter")
    return errors, warnings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fix", action="store_true", help="fix formatting in place")
    ap.add_argument("files", nargs="*", help="program files (default: all)")
    args = ap.parse_args()

    files = [Path(f).resolve() for f in args.files] or sorted(PROGRAMS.glob("*/*.md"))
    files = [f for f in files if f.name != "_index.md" and f.exists()]
    types = series_types()

    n_err = n_warn = 0
    for path in files:
        rel = path.relative_to(ROOT)
        errors, warnings = check(path, types, args.fix)
        for level, msgs in (("error", errors), ("warning", warnings)):
            for msg in msgs:
                print(f"::{level} file={rel}::{msg}")
                print(f"{rel}: {level}: {msg}", file=sys.stderr)
        n_err += len(errors)
        n_warn += len(warnings)
    print(f"Checked {len(files)} file(s): {n_err} error(s), {n_warn} warning(s).")
    sys.exit(1 if n_err else 0)


if __name__ == "__main__":
    main()
