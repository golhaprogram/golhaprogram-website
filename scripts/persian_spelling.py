#!/usr/bin/env python3
"""Persian spelling for the site's markdown files (see "Persian spelling" in
CLAUDE.md, after the Farhangestan's دستور خط فارسی).

Two kinds of rules:

* fixes: unambiguous, applied with --fix (the "Normalize Persian Text"
  workflow commits them to the PR). Arabic letters and digits everywhere;
  word-level rules (گل‌ها، هٔ، hamza, nim-fasele) only in the body, never in
  front matter names, where a change would move a /singers/… page.
* warnings: need a person, because the same letters can be two words
  (می = wine or the verb prefix). Printed as GitHub annotations, so they show
  on the PR's changed lines; they never fail the check.

    python3 scripts/persian_spelling.py [--fix] [--github] [--base origin/main] FILE...
"""
import argparse
import re
import sys
from pathlib import Path

ZWNJ = "\u200c"
L = r"[^\W\d_]"            # a letter (any script)
# end of word: not followed by a letter, ZWNJ or a vowel mark («امّید», «اندُه»)
NL = r"(?![^\W\d_]|[\u200c\u064b-\u065f\u0670])"

# Applied to the whole file, front matter included (they were already).
CHARS = str.maketrans({"ك": "ک", "ي": "ی", "ة": "ه",
                       "٠": "۰", "١": "۱", "٢": "۲", "٣": "۳", "٤": "۴",
                       "٥": "۵", "٦": "۶", "٧": "۷", "٨": "۸", "٩": "۹"})

# Hamza seat: words that are only ever written one way.
HAMZA = {
    "تاثیر": "تأثیر", "تاثیرات": "تأثیرات", "تالیف": "تألیف", "تاسف": "تأسف",
    "متاسف": "متأسف", "متاسفانه": "متأسفانه", "تامل": "تأمل", "تاکید": "تأکید",
    "تامین": "تأمین", "تاسیس": "تأسیس", "تاخیر": "تأخیر", "ماخذ": "مأخذ",
    "مامور": "مأمور", "مانوس": "مأنوس", "ماوا": "مأوا", "مساله": "مسئله",
    "مسأله": "مسئله", "سوال": "سؤال", "سوالات": "سؤالات", "سوالاتی": "سؤالاتی",
    "موثر": "مؤثر", "مولف": "مؤلف", "موسسه": "مؤسسه", "رییس": "رئیس",
    "مسوول": "مسئول", "جرات": "جرئت", "هیات": "هیئت", "هیأت": "هیئت",
}

# (pattern, replacement, what) for the body.
WORD_FIXES = [
    (re.compile(r"گلها"), "گل" + ZWNJ + "ها", "گلها → گل‌ها"),
    (re.compile("ۀ"), "هٔ", "ۀ → هٔ"),
    # ezafe after silent heh: «خانه‌ی» / «خانه ی» → «خانهٔ»
    (re.compile("ه[\u200c ]ی" + NL), "ه\u0654", "ه‌ی → هٔ"),
    # plural and pronoun suffixes written with a space
    # (not «های های», «ها ها»: the sound of sobbing / laughing)
    (re.compile(r"(?<!های)(?<!(?<!" + L + r")ها)(?<=" + L + r") (ها|های|هایی|هایم|هایت|هایش|هایمان|هایتان|هایشان|هاست)" + NL),
     ZWNJ + r"\1", "ها with a space"),
    # (not after the words به، که، چه: «به امید», «که اند…»)
    (re.compile(r"(?<!(?<!" + L + r")[بکچ]ه)(?<=" + L + r"ه) (ام|ات|اش|ایم|اید|اند)" + NL),
     ZWNJ + r"\1", "‌ام/‌اند after ه"),
    # «از آن» shortened is the merged «زان», «زانکه», «زانچه»: not «زآن» / «ز آن».
    (re.compile(r"(?<!" + L + r")(?<!\u200c)ز ?آن(?=(?:\u200c?(?:که|چه)|ک|دم)?" + NL + ")"),
     "زان", "زآن → زان"),
    # «ز» (= از) before a noun stands apart, as in «ز دست»: «زآتش» → «ز آتش».
    # Not the merged «زان/زانکه/زین/کز/وز», nor «زآن…» (the pronoun آن).
    (re.compile(r"(?<!" + L + r")(?<!\u200c)ز(?=آ)(?!آن)"), "ز ", "ز joined to آ"),
    # نمی is always the verb prefix (unlike می, which can be wine)
    (re.compile(r"(?<!" + L + r")(?<!\u200c)نمی (?=" + L + ")"), "نمی" + ZWNJ, "نمی with a space"),
    (re.compile(r"(?<!" + L + r")(?<!\u200c)(" + "|".join(sorted(HAMZA, key=len, reverse=True)) + ")" + NL),
     lambda m: HAMZA[m.group(1)], "hamza"),
    # two spaces between words (not the trailing two that end a lyric line)
    (re.compile(r"(?<=\S)  +(?=\S)"), " ", "double space"),
]

WARNINGS = [
    (re.compile(r"(?<!" + L + r")(?<!\u200c)(?<!ن)می (?=" + L + ")"),
     "«می» + space: if it is the verb prefix write «می‌…»; if it means wine, leave it."),
    (re.compile(r"(?<!" + L + r")(?<!\u200c)(?<!ن)(?!میدان(?![^\W\d_]))(?:می|نمی)(?:کن|کرد|شو|شد|رو|رف|گوی|گف|دان|خواه|خوا|بین|دید|زن|زد|آی|آمد|آر|کش|خور|ماند|مان|گیر|گرف|ده|داد|رس|پرس|نشین|سوز|سوخ|نال|افت|فت)"
                + r"[^\W\d_]*" + NL),
     "«می» written solid: if it is the verb prefix write «می‌…» (negative imperatives like «میارید» stay)."),
]


def split_front_matter(text):
    m = re.match(r"(---\n.*?\n---\n)(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else ("", text)


def fix(text):
    """Returns (new text, list of rule names that changed something)."""
    text = text.translate(CHARS)
    fm, body = split_front_matter(text)
    used = []
    for pat, rep, what in WORD_FIXES:
        body, n = pat.subn(rep, body)
        if n:
            used.append(f"{what} ×{n}")
    # program_type is built from the series title, so it follows گل‌ها too.
    fm = re.sub(r"^(program_type:.*)$", lambda m: m.group(1).replace("گلها", "گل" + ZWNJ + "ها"), fm, flags=re.M)
    return fm + body, used


def warnings(text):
    """Yields (line number, column, message) for spots a person should check."""
    fm, body = split_front_matter(text)
    offset = fm.count("\n")
    for i, line in enumerate(body.split("\n"), start=offset + 1):
        for pat, msg in WARNINGS:
            for m in pat.finditer(line):
                two = m.group(0).endswith(" ")   # «می گوید»: show the next word too
                words = re.match(r"\S+ \S+" if two else r"\S+", line[m.start():]).group(0).rstrip("،.:؛!؟")
                yield i, m.start() + 1, f"«{words}»: {msg}"


def added_lines(path, base):
    """Line numbers of `path` added or changed since `base` (git diff -U0)."""
    import subprocess
    out = subprocess.run(["git", "diff", "-U0", f"{base}...HEAD", "--", path],
                         capture_output=True, text=True).stdout
    lines = set()
    for m in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", out, re.M):
        start, count = int(m.group(1)), int(m.group(2) or 1)
        lines.update(range(start, start + count))
    return lines


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*")
    ap.add_argument("--fix", action="store_true", help="write the fixes")
    ap.add_argument("--github", action="store_true", help="print warnings as GitHub annotations")
    ap.add_argument("--base", help="only warn about lines changed since this git ref (e.g. origin/main)")
    args = ap.parse_args()

    changed = 0
    nwarn = 0
    for f in args.files:
        p = Path(f)
        if not p.is_file():
            continue
        old = p.read_text(encoding="utf-8")
        new, used = fix(old)
        if new != old:
            changed += 1
            print(f"{'fixed' if args.fix else 'would fix'} {f}: {', '.join(used) or 'Arabic letters/digits'}")
            if args.fix:
                p.write_text(new, encoding="utf-8")
        only = added_lines(f, args.base) if args.base else None
        for line, col, msg in warnings(new):
            if only is not None and line not in only:
                continue
            nwarn += 1
            if args.github:
                print(f"::warning file={f},line={line},col={col},title=Persian spelling::{msg}")
            else:
                print(f"{f}:{line}:{col}: {msg}")
    print(f"{len(args.files)} file(s): {changed} {'fixed' if args.fix else 'to fix'}, {nwarn} to check by hand")


if __name__ == "__main__":
    sys.exit(main())
