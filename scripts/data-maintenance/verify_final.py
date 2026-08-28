import json
import re

with open("nkword_meaning_ready.json", encoding="utf-8") as f:
    ready = json.load(f)

has_south = [r for r in ready if r["south_expression"].strip()]
print("뜻풀이 O + south_expression O:", len(has_south))

Q = "['‘’\"“”]"

# south_expression 문자열 일치 여부와 무관하게, meaning 문장 자체에 "정답을 그대로 알려주는 문구"가 남아있는지를 독립적으로 검사한다.
GIVEAWAY_PATTERNS = [
    re.compile(rf"{Q}.+?{Q}의 북한어"),         # '남한말'의 북한어  (남한말 자체를 알려줌)
    re.compile(rf"{Q}.+?{Q}\(?으?\)?로 다듬음"),  # '다른표현'으로 다듬음
    re.compile(r"규범 표기는"),                    # 북한어 자신의 표준 철자를 그대로 알려줌
]


def has_giveaway(meaning):
    return any(p.search(meaning) for p in GIVEAWAY_PATTERNS)


safe = [r for r in has_south if not has_giveaway(r["meaning"])]
leaked = [r for r in has_south if has_giveaway(r["meaning"])]

print("정답/철자를 그대로 알려주는 문구가 남은 것(제외):", len(leaked))
print("최종 안전:", len(safe))

# 구름 케이스 재확인
gureum = [r for r in safe if r["word"] == "구름"]
print("구름 포함됨?", len(gureum) > 0)

# 밤색무늬병 케이스가 이번엔 제대로 걸러지는지 확인
bam = [r for r in leaked if r["word"] == "밤색무늬병"]
print("밤색무늬병이 이번엔 제외됨?", len(bam) > 0)

with open("nkword_chosung_ready.json", "w", encoding="utf-8") as f:
    json.dump(sorted(safe, key=lambda r: r["word"]), f, ensure_ascii=False, indent=2)
with open("nkword_chosung_leaked.json", "w", encoding="utf-8") as f:
    json.dump(sorted(leaked, key=lambda r: r["word"]), f, ensure_ascii=False, indent=2)

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
save_csv(sorted(leaked, key=lambda r: r["word"]), "nkword_chosung_leaked.csv")

# 안전 목록 20개를 무작위성 없이 앞에서부터 눈으로 재검증
print()
print("안전 목록 샘플 (직접 눈으로 재확인용):")
for r in safe[:20]:
    print(" -", r["word"], "| meaning:", r["meaning"][:40], "| south:", r["south_expression"])
