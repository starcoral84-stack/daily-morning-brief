#!/usr/bin/env python3
"""Sync the company class schedule (Google Sheet, CSV export) into the morning-brief site.

Reads the weekly grid from the sheet, then writes ONLY these files (Claude's lane):
  - schedule.html  : the Schedule tab (single self-contained file)
  - schedule.json  : the same data, for tabs.js
  - tabs.js        : tab bar + today/tomorrow strip, loaded by the brief with one script tag
It never reads or writes index.html, latest.md, llms.txt, archive/ or _headers
(those belong to the daily brief updater).

The sheet URL is NOT stored in this repo. Pass it with the SCHEDULE_CSV_URL
environment variable (a GitHub Actions secret), or use --file for a local CSV.
Standard library only.
"""
import argparse, csv, datetime as dt, hashlib, io, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
BKK = dt.timezone(dt.timedelta(hours=7))
MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
          "september", "october", "november", "december"]
DAY_RE = re.compile(r"^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,\s*(\d{1,2})\b", re.I)
TIME_RE = re.compile(r"\(\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*\)\s*$", re.I)
TRAIL_RE = re.compile(r"\s+(onsite|on-site|group online|online|e-learning)\s*$", re.I)

# The sheet does not list Speak Up! topics; keep them here, keyed by date (optional).
TOPICS = {
    "2026-10-07": "First Impressions & Personal Identity",
    "2026-10-09": "Connections & People Around You",
    "2026-10-14": "Everyday Belongings & Smart Shopping",
    "2026-10-16": "Daily Life, Meals & Routines",
    "2026-10-21": "Workplace Skills, Abilities & Celebrations",
    "2026-10-23": "Homes, Neighborhoods & Finding Your Way",
    "2026-10-28": "Well-being, Fitness & Childhood Memories",
    "2026-10-30": "Weekend Getaways, Past Adventures & New Goals",
}


def to24(s):
    t = dt.datetime.strptime(re.sub(r"\s+", " ", s.strip().upper()), "%I:%M %p")
    return t.strftime("%H:%M")


def classify(name, trailing):
    if re.fullmatch(r"\d{6,}", name):
        return "home"
    low = name.lower()
    if low.startswith("group onsite") or low.startswith("group on-site"):
        return "onsite"
    if low.startswith("group online"):
        return "online"
    if "online" in trailing:
        return "online"
    return "other"


def display_name(name, kind, date):
    if kind == "onsite":
        name = re.sub(r"^group on-?site\s*", "", name, flags=re.I).strip() or name
    if kind == "online":
        name = re.sub(r"^group online:?\s*", "", name, flags=re.I).strip() or name
        topic = TOPICS.get(date)
        if topic:
            name = "%s – %s" % (name.rstrip("!").strip() + "!" if name.lower().startswith("speak up") else name, topic)
    return re.sub(r"\s+", " ", name).strip()


def parse_cell(cell):
    cell = cell.strip()
    m = TIME_RE.search(cell)
    if not m:
        return None
    name = cell[: m.start()].strip()
    trailing = ""
    while True:
        t = TRAIL_RE.search(name)
        if not t:
            break
        trailing += " " + t.group(1).lower()
        name = name[: t.start()].strip()
    if not name:
        return None
    return {"name": name, "start": to24(m.group(1)), "end": to24(m.group(2)), "trailing": trailing}


def infer_year(month, today):
    y = today.year
    if month - today.month > 6:
        y -= 1
    elif today.month - month > 6:
        y += 1
    return y


def parse_sheet(text, today):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ValueError("empty CSV")
    title = (rows[0][0] if rows[0] else "").strip() or "Schedule"
    mm = next((i + 1 for i, n in enumerate(MONTHS) if n in title.lower()), None)
    if mm is None:
        raise ValueError("cannot find a month name in the sheet title: %r" % title)
    year = infer_year(mm, today)

    day_rows = []  # (dow, day_of_month, classes)
    for r in rows:
        if not r:
            continue
        m = DAY_RE.match(r[0])
        if not m:
            continue
        seen, classes = set(), []
        for cell in r[1:]:
            c = parse_cell(cell)
            if not c:
                continue
            key = (c["name"], c["start"], c["end"])
            if key in seen:
                continue
            seen.add(key)
            classes.append(c)
        day_rows.append((int(m.group(2)), classes))
    if not day_rows:
        raise ValueError("no day rows found")

    # Resolve months: first row in the previous month if its day number is large
    month, y = (mm, year)
    if day_rows[0][0] > 15:
        month -= 1
        if month == 0:
            month, y = 12, y - 1
    days, prev = [], None
    for dom, classes in day_rows:
        if prev is not None and dom < prev:
            month += 1
            if month == 13:
                month, y = 1, y + 1
        prev = dom
        date = dt.date(y, month, dom)
        ds = date.isoformat()
        out = []
        for c in sorted(classes, key=lambda c: c["start"]):
            kind = classify(c["name"], c["trailing"])
            out.append({"start": c["start"], "end": c["end"], "type": kind,
                        "name": display_name(c["name"], kind, ds)})
        days.append({"date": ds, "classes": out})
    days.sort(key=lambda d: d["date"])
    if not any(d["classes"] for d in days):
        raise ValueError("parsed %d days but found no classes - refusing to overwrite" % len(days))
    return {"title": title.replace("T. ", "", 1) if title.startswith("T. ") else title, "days": days}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "morning-brief-schedule-sync"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8-sig")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def render(template, **subs):
    for k, v in subs.items():
        template = template.replace(k, v)
    return template


def data_json(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def previous_data(path):
    if not os.path.exists(path):
        return None
    m = re.search(r'<script type="application/json" id="sched-data">(.*?)</script>', read(path), re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1).replace("<\\/", "</"))
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="local CSV instead of SCHEDULE_CSV_URL")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for tests")
    ap.add_argument("--out", default=ROOT, help="site folder (default: repo root)")
    a = ap.parse_args()

    today = dt.date.fromisoformat(a.today) if a.today else dt.datetime.now(BKK).date()
    if a.file:
        text = read(a.file)
    else:
        url = os.environ.get("SCHEDULE_CSV_URL", "").strip()
        if not url:
            sys.exit("Set SCHEDULE_CSV_URL (or use --file).")
        text = fetch(url)

    try:
        data = parse_sheet(text, today)
    except ValueError as e:
        sys.exit("error: could not read the schedule (%s). Files left unchanged." % e)
    sched_path = os.path.join(a.out, "schedule.html")
    prev = previous_data(sched_path)
    now = dt.datetime.now(BKK).replace(microsecond=0).isoformat()
    if prev and prev.get("days") == data["days"] and prev.get("title") == data["title"]:
        data["updated"] = prev.get("updated", now)
    else:
        data["updated"] = now
    blob = data_json(data)

    css, core = read(os.path.join(HERE, "core.css")), read(os.path.join(HERE, "core.js"))
    page = render(read(os.path.join(HERE, "page_template.html")),
                  **{"<!--CSS-->": css, "<!--DATA-->": blob, "<!--CORE-->": core})
    tabs = render(read(os.path.join(HERE, "tabs_template.js")),
                  **{"/*__CSS__*/": css, "/*__CORE__*/": core})
    js_blob = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    for name, content in (("schedule.html", page), ("schedule.json", js_blob), ("tabs.js", tabs)):
        with open(os.path.join(a.out, name), "w", encoding="utf-8") as f:
            f.write(content)

    n_classes = sum(len(d["classes"]) for d in data["days"])
    print("ok: %d days, %d classes, title=%r" % (len(data["days"]), n_classes, data["title"]))


if __name__ == "__main__":
    main()
