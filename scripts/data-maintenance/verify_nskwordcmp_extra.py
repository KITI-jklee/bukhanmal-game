import json

with open("nkword_meaning_ready.json", encoding="utf-8") as f:
    ready = json.load(f)
with open("nskwordcmp_all.json", encoding="utf-8") as f:
    cmp_items = json.load(f)

# 뜻풀이는 있지만 south_expression이 비어있는 것들
no_south = [r for r in ready if not r["south_expression"].strip()]
print("뜻풀이 O / south_expression 비어있음:", len(no_south))

# 1) 정확히 일치하는 nkword가 진짜 없는지 재확인
cmp_nkwords_exact = set((it.get("nkword") or "").strip() for it in cmp_items)
still_missing_exact = [r for r in no_south if r["word"] not in cmp_nkwords_exact]
print("정확히 일치하는 nkword 없음(재확인):", len(still_missing_exact))

# 2) 공백 제거 후 비교 (표기 차이로 인한 누락 가능성 체크)
def norm(s):
    return (s or "").replace(" ", "").strip()

cmp_by_norm = {}
for it in cmp_items:
    nk = norm(it.get("nkword"))
    ko = (it.get("koword") or "").strip()
    if nk and ko:
        cmp_by_norm.setdefault(nk, set()).add(ko)

recovered = []
for r in no_south:
    key = norm(r["word"])
    if key in cmp_by_norm:
        recovered.append((r, cmp_by_norm[key]))

print("공백 제거 기준으로 추가로 찾을 수 있는 것:", len(recovered))
for r, ko in recovered[:15]:
    print("  ", r["word"], "->", ko, "| meaning:", r["meaning"][:30])
