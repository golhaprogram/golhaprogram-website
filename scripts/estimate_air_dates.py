#!/usr/bin/env python3
"""Estimate an air date for every Golha-ye Rangarang program.

Reads data/air_dates.yaml and assumes programs aired in number order:
  1. "aired" anchors marked confirmed or likely become fixed points (the middle
     of their date: 1347 -> mid-1347, 1347-08 -> mid-Aban). Composition dates
     become points too (about six weeks later) unless they're out of order or
     would mean more than MAX_PER_MONTH programs a month (then the piece
     probably waited before airing, and the date stays a lower bound).
  2. Programs between two fixed points are spaced evenly between them.
     Programs after the last one continue at the pace of the last stretch.
  3. not_before / released_by bounds then push estimates later or earlier,
     and the result is kept in number order.

Writes data/air_date_estimates.yaml and prints a summary. Each estimate has
a precision in days: roughly how far it is from the nearest fixed point.
With --write it also sets date_aired: "YYYY-MM" (Solar Hijri year and month)
in each program's front matter; program pages show it as approximate.

  scripts/estimate_air_dates.py [--check | --write]
"""

import argparse
import re
from datetime import date, timedelta
from pathlib import Path

import jdatetime
import yaml

ROOT = Path(__file__).resolve().parent.parent
SERIES = "golhaye-rangarang"
COMPOSE_LAG = 45  # days from composition to broadcast, when used as a point
MAX_PER_MONTH = 5  # a composition date implying a faster pace stays a bound only


SUFFIX = {"": 0, "B": 1, "C": 2}
_extra = []  # numbers of known B/C parts, filled in main()


def key(program):
    """Position in broadcast order. B and C parts are separate programs that
    aired the following weeks (Amir), so each takes a full slot and pushes
    every later number one slot further."""
    m = re.fullmatch(r"(\d+)([A-Z]?)", program)
    n, suffix = int(m[1]), SUFFIX[m[2]]
    return n + sum(1 for b, sfx in _extra if b < n or (b == n and sfx <= suffix))


def span(d):
    """Solar Hijri 'YYYY[-MM[-DD]]' -> (first day, last day) in Gregorian."""
    parts = [int(x) for x in d.split("-")]
    y = parts[0]
    if len(parts) == 3:
        g = jdatetime.date(*parts).togregorian()
        return g, g
    if len(parts) == 2:
        m = parts[1]
        first = jdatetime.date(y, m, 1).togregorian()
        nxt = jdatetime.date(y + (m == 12), m % 12 + 1, 1).togregorian()
        return first, nxt - timedelta(days=1)
    first = jdatetime.date(y, 1, 1).togregorian()
    return first, jdatetime.date(y + 1, 1, 1).togregorian() - timedelta(days=1)


def mid(a, b):
    return a + (b - a) / 2


def to_fa(g):
    fa = jdatetime.date.fromgregorian(date=g)
    return f"{fa.year}-{fa.month:02d}-{fa.day:02d}"


def write_date_aired(path, value):
    """Set date_aired in the front matter, keeping everything else as is."""
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    line = f'date_aired: "{value}"'
    for i in range(1, end):
        if lines[i].startswith("date_aired:"):
            if lines[i] == line:
                return False
            lines[i] = line
            break
    else:
        lines.insert(end, line)
    path.write_text("\n".join(lines), encoding="utf-8")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="only report problems")
    ap.add_argument("--write", action="store_true", help="also set date_aired in program files")
    args = ap.parse_args()

    data = yaml.safe_load((ROOT / "data" / "air_dates.yaml").read_text(encoding="utf-8"))
    entries = [e for e in data[SERIES] if e.get("date")]
    files = [p.stem for p in (ROOT / "content" / "programs" / SERIES).glob("*.md") if p.stem != "_index"]
    for p in set(files) | {e["program"] for e in data[SERIES]}:
        m = re.fullmatch(r"(\d+)([A-Z])", p)
        if m:
            _extra.append((int(m[1]), SUFFIX[m[2]]))
    programs = sorted(files, key=key)

    # 1. Fixed points: aired anchors, plus composition dates (not_before) that
    #    look like new work, i.e. aired about a month after composition. A piece
    #    composed earlier than an earlier-numbered point was kept on the shelf,
    #    so it only stays a lower bound.
    points = {}
    for e in entries:
        if e.get("kind", "aired") == "aired" and e["status"] in ("confirmed", "likely"):
            a, b = span(e["date"])
            points[key(e["program"])] = (mid(a, b), (b - a).days / 2)
    for e in sorted(entries, key=lambda e: key(e["program"])):
        x = key(e["program"])
        if e.get("kind") != "not_before" or x in points or e.get("point") is False:
            continue
        a, _ = span(e["date"])
        guess = a + timedelta(days=COMPOSE_LAG)
        prev = max((p for p in points if p < x), default=None)
        nxt = min((p for p in points if p > x), default=None)
        ok = True
        if prev is not None:  # in order, and no faster than MAX_PER_MONTH
            days = (guess - points[prev][0]).days
            ok = days >= 0 and (x - prev) <= MAX_PER_MONTH * max(days, 1) / 30
        if ok and nxt is not None:
            days = (points[nxt][0] - guess).days
            ok = days >= 0 and (nxt - x) <= MAX_PER_MONTH * max(days, 1) / 30
        if ok:
            points[x] = (guess, COMPOSE_LAG)
    xs = sorted(points)

    # 2. Interpolate between fixed points; extrapolate at the ends.
    def interpolate(x):
        if x in points:
            return points[x][0], points[x][1]
        lo = max((p for p in xs if p < x), default=None)
        hi = min((p for p in xs if p > x), default=None)
        if lo is None or hi is None:  # extrapolate using the nearest stretch
            a, b = (xs[0], xs[1]) if lo is None else (xs[-2], xs[-1])
            rate = (points[b][0] - points[a][0]).days / (b - a)
            base = a if lo is None else b
            est = points[base][0] + timedelta(days=rate * (x - base))
            return est, points[base][1] + abs(rate * (x - base))
        t = (x - lo) / (hi - lo)
        gap = (points[hi][0] - points[lo][0]).days
        est = points[lo][0] + timedelta(days=gap * t)
        # Precision: half the gap at most, less near either fixed point.
        prec = min(t, 1 - t) * gap + (points[lo][1] * (1 - t) + points[hi][1] * t)
        return est, prec

    est = {p: list(interpolate(key(p))) for p in programs}

    # 3. Apply bounds, then keep number order.
    problems = []
    for e in entries:
        kind = e.get("kind", "aired")
        p = e["program"]
        if p not in est or kind == "aired":
            continue
        a, b = span(e["date"])
        if kind == "not_before" and est[p][0] < a:
            est[p][0] = a
        if kind == "released_by" and est[p][0] > b:
            est[p][0] = b
    for i in range(1, len(programs)):  # never earlier than the program before
        prev, cur = est[programs[i - 1]], est[programs[i]]
        if cur[0] < prev[0]:
            cur[0] = prev[0]
    for e in entries:  # report bounds that ordering pushed past
        p, kind = e["program"], e.get("kind", "aired")
        if p in est and kind == "released_by" and est[p][0] > span(e["date"])[1]:
            problems.append(f"{p}: estimate {to_fa(est[p][0])} is after its release ({e['date']})")
    for perf in data.get("performers", []):
        y = re.match(r"~?(\d{4})(?:-(\d\d))?", perf["joined"])
        if not y:
            continue
        joined = span(y[1] + (f"-{y[2]}" if y[2] else ""))[0]
        fp = perf["first_program"]
        if fp in est and est[fp][0] < joined - timedelta(days=60):
            problems.append(f"{fp}: estimate {to_fa(est[fp][0])} is before {perf['name']} joined ({perf['joined']})")

    for msg in problems:
        print("PROBLEM:", msg)
    if args.check:
        return

    out = {}
    for p in programs:
        g, prec = est[p]
        out[p] = {
            "estimate": to_fa(g),
            "gregorian": g.isoformat(),
            "precision_days": int(round(prec)),
            "fixed": key(p) in points,
        }
    header = ("# Generated by scripts/estimate_air_dates.py from data/air_dates.yaml.\n"
              "# Do not edit: change the anchors and re-run.\n")
    (ROOT / "data" / "air_date_estimates.yaml").write_text(
        header + yaml.safe_dump(out, allow_unicode=True, sort_keys=False), encoding="utf-8")

    if args.write:
        changed = 0
        for p, v in out.items():
            if write_date_aired(ROOT / "content" / "programs" / SERIES / f"{p}.md", v["estimate"][:7]):
                changed += 1
        print(f"date_aired updated in {changed} file(s)")

    precs = sorted(v["precision_days"] for v in out.values())
    print(f"{len(out)} programs, {sum(v['fixed'] for v in out.values())} fixed points, "
          f"median precision ±{precs[len(precs) // 2]} days, worst ±{precs[-1]}")


if __name__ == "__main__":
    main()
