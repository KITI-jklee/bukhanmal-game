import json
import re

with open("nkword_chosung_leaked.json", encoding="utf-8") as f:
    leaked = json.load(f)

Q = "['‘’\"“”]"

# meaning 문장에서 스포일러 조각만 도려낸다
STRIP_PATTERNS = [
    re.compile(rf"{Q}.+?{Q}의 북한어\.?"),
    re.compile(rf"{Q}.+?{Q}\(?으?\)?로 다듬음\.?"),
    re.compile(rf"규범 표기는 {Q}.+?{Q}이다\.?"),
    re.compile(r"⇒\s*"),
]


def strip_giveaway(meaning):
    m = meaning
    for p in STRIP_PATTERNS:
        m = p.sub("", m)
    return m.strip(" .①②③④⑤⑥⑦⑧⑨⑩")


rescued = []
still_empty = []
still_leaking = []

GIVEAWAY_PATTERNS = [
    re.compile(rf"{Q}.+?{Q}의 북한어"),
    re.compile(rf"{Q}.+?{Q}\(?으?\)?로 다듬음"),
    re.compile(r"규범 표기는"),
]


def has_giveaway(meaning):
    return any(p.search(meaning) for p in GIVEAWAY_PATTERNS)


for r in leaked:
    stripped = strip_giveaway(r["meaning"])
    if not stripped:
        still_empty.append(r)
        continue
    if has_giveaway(stripped):
        still_leaking.append(r)
        continue
    new_row = dict(r)
    new_row["meaning"] = stripped
    new_row["meaning_note"] = "원문에서 남한말 안내문/철자 안내문을 제거하고 남은 부분"
    rescued.append(new_row)

print("원래 leaked:", len(leaked))
print("스포일러 제거 후 살릴 수 있는 것(rescued):", len(rescued))
print("제거하고 나니 아무것도 안 남는 것:", len(still_empty))
print("제거해도 여전히 스포일러 남는 것:", len(still_leaking))

print()
print("rescued 샘플 20개:")
for r in rescued[:20]:
    print(" -", r["word"], "| meaning:", r["meaning"][:50], "| south:", r["south_expression"])

with open("nkword_chosung_rescued.json", "w", encoding="utf-8") as f:
    json.dump(sorted(rescued, key=lambda r: r["word"]), f, ensure_ascii=False, indent=2)

import csv

fieldnames = ["word", "category", "meaning", "south_expression", "definitions_count", "raw_descripts", "meaning_note"]
with open("nkword_chosung_rescued.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for r in sorted(rescued, key=lambda r: r["word"]):
        r2 = dict(r)
        r2["raw_descripts"] = " | ".join(r2["raw_descripts"])
        w.writerow(r2)
