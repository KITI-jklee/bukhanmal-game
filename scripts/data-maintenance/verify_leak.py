import json
import re

with open("nkword_meaning_ready.json", encoding="utf-8") as f:
    ready = json.load(f)

has_south = [r for r in ready if r["south_expression"].strip()]

Q = "['‘’\"“”]"


def leaks_precise(row):
    m = row["meaning"]
    for sw in row["south_expression"].split(", "):
        sw = sw.strip()
        if not sw:
            continue
        sw_esc = re.escape(sw)
        patterns = [
            rf"{Q}{sw_esc}{Q}의 북한어",
            rf"규범 표기는 {Q}{sw_esc}{Q}",
            rf"{Q}{sw_esc}{Q}(으)?로 다듬음",
            rf"^{sw_esc}$",
        ]
        for p in patterns:
            if re.search(p, m):
                return sw
    return None


leaked = []
safe = []
for r in has_south:
    sw = leaks_precise(r)
    if sw:
        leaked.append((r, sw))
    else:
        safe.append(r)

print("has_south:", len(has_south))
print("정밀 패턴으로 재검증 유출:", len(leaked))
print("안전(새 기준):", len(safe))

gureum = [r for r in safe if r["word"] == "구름"]
print("구름 안전에 포함됨?", len(gureum) > 0)

with open("nkword_chosung_ready.json", "w", encoding="utf-8") as f:
    json.dump(sorted(safe, key=lambda r: r["word"]), f, ensure_ascii=False, indent=2)

with open("nkword_chosung_leaked.json", "w", encoding="utf-8") as f:
    json.dump(sorted([r for r, sw in leaked], key=lambda r: r["word"]), f, ensure_ascii=False, indent=2)

import csv


def save_csv(rows, path):
    fieldnames = ["word", "category", "meaning", "south_expression", "definitions_count", "raw_descripts"]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            r2 = dict(r)
            r2["raw_descripts"] = " | ".join(r2["raw_descripts"])
            w.writerow(r2)


save_csv(sorted(safe, key=lambda r: r["word"]), "nkword_chosung_ready.csv")
save_csv(sorted([r for r, sw in leaked], key=lambda r: r["word"]), "nkword_chosung_leaked.csv")

# sample check
print()
print("샘플 - 다시 안전 판정된 것 중 실제로 안전한지 눈으로 확인:")
import random

sample = [r for r in safe if r["definitions_count"] == 1][:0]
for r in safe[:0]:
    pass

# print a handful with south words that are short (previously flagged as risky)
short_examples = [r for r in safe if any(len(s.strip()) <= 2 for s in r["south_expression"].split(","))][:10]
for r in short_examples:
    print(" -", r["word"], "|", r["meaning"][:50], "|", r["south_expression"])
