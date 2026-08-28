# *- coding: utf-8 -*
"""
초성게임용 단어 데이터 재구성 스크립트
- 입력: raw_words.json (엑셀 'short_def_single_meaning.xlsx'에서 추출한 word/meaning 17,553개)
- 기존: chosung_words.json (24,288개) — south_expression/accepted_answers/category 재활용용
- 출력: chosung_words_v2.json (17,553개) — docs/chosung-difficulty-criteria.md 기준으로 난이도 재산정
"""
import json
import re

RAW_PATH = r"C:\Users\User\AppData\Local\Temp\claude\C--dev-projects-context\6ea1e9f3-70ab-4d99-bad9-aec5ce613645\scratchpad\raw_words.json"
OLD_PATH = r"C:\dev\projects\bukhanmal-game\public\data\chosung_words.json"
OUT_PATH = r"C:\dev\projects\context\scratchpad\chosung_words_v2.json"
REPORT_PATH = r"C:\dev\projects\context\scratchpad\chosung_v2_report.json"

CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

def get_initials(word):
    out = []
    for ch in word:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            out.append(CHOSUNG[(code - 0xAC00) // (21 * 28)])
        else:
            out.append(ch)
    return ''.join(out)

HANJA_RE = re.compile(r'[\u4E00-\u9FFF]')

# 전문 분야 키워드는 여러 개가 함께 등장할 때만 가점을 준다.
DOMAIN_KEYWORDS = {
    '의료·생물': ['질환', '병원체', '바이러스', '세균', '기생충', '병리', '해부', '생리학',
                 '유전자', '효소', '호르몬', '임상', '염색체', '항체', '세포', '종양', '백신'],
    '공학·기계': ['공정', '엔진', '모터', '부품', '회로', '전동기', '발전기', '기관차',
                 '기중기', '선반', '용접', '주조', '배전'],
    '물리화학수학': ['화학 반응', '원소', '분자', '원자', '화합물', '방정식', '좌표', '함수',
                    '전류', '전압', '자기장', '중력', '파장', '용액', '촉매'],
    '경제·특수용어': ['계획 경제', '배급', '수매', '소매가격', '도매가격', '무역', '외화',
                    '환율', '통화', '수매 가격', '유통 부문', '생산 수단'],
    '전문개념·단위': ['도량형', '규격', '지수(指數)', '역학', '통계학', '측정 단위'],
}

def domain_hits(meaning):
    hits = []
    for domain, kws in DOMAIN_KEYWORDS.items():
        if any(kw in meaning for kw in kws):
            hits.append(domain)
    return hits

def has_word_clue(word, meaning):
    """뜻풀이에 단어를 유추할 단서(2글자 이상 겹치는 조각)가 있는지.
    2글자 단어는 2글자 조각 = 단어 전체이므로(이미 뜻풀이 자기노출 단어는 제외된 상태)
    이 검사가 항상 '단서 없음'으로 나와 변별력이 없다 — 2글자 단어는 판단 보류(불이익 없음)."""
    if len(word) < 3:
        return True
    for i in range(len(word) - 1):
        frag = word[i:i + 2]
        if frag in meaning:
            return True
    return False

def score_difficulty(word, meaning, south_expression):
    score = 0
    length = len(word)

    # 1.
    if length == 3:
        score += 1
    elif length == 4:
        score += 2

    # 2.
    hits = domain_hits(meaning)
    if hits:
        score += 2
        if len(hits) >= 2:
            score += 1

    # 한자 표기 포함 → 전문어 신호
    if HANJA_RE.search(meaning):
        score += 1

    # 3.
    clue = has_word_clue(word, meaning)
    if not clue:
        score += 1

    # 4.
    has_south = bool(south_expression and south_expression.strip())
    if has_south:
        score -= 1

    # 5.
    if len(meaning) > 30:
        score += 1

    score = max(score, 0)

    if score <= 1:
        difficulty = '쉬움'
    elif score <= 3:
        difficulty = '보통'
    else:
        difficulty = '어려움'

    # 6.
    if length == 4 and len(hits) >= 2 and difficulty == '보통':
        difficulty = '어려움'

    # 6-1.
    if length == 3 and (not clue) and len(meaning) > 30 and difficulty == '보통':
        difficulty = '어려움'

    return difficulty, score, hits, clue, has_south


def main():
    raw = json.load(open(RAW_PATH, encoding='utf-8'))
    old = json.load(open(OLD_PATH, encoding='utf-8'))
    old_by_word = {x['word']: x for x in old}

    entries = []
    for r in raw:
        word = r['word']
        meaning = r['meaning']
        old_entry = old_by_word.get(word)
        south_expression = old_entry.get('south_expression', '') if old_entry else ''
        accepted_answers = old_entry.get('accepted_answers') if old_entry else None
        if not accepted_answers or word not in accepted_answers:
            accepted_answers = [word]
        category = old_entry.get('category') if old_entry else None
        meaning_source_type = old_entry.get('meaning_source_type') if old_entry else None
        source_name = old_entry.get('source_name', '통일부 남북한 언어비교·북한 용어사전') if old_entry else '통일부 남북한 언어비교·북한 용어사전'
        source_url = old_entry.get('source_url', 'https://www.data.go.kr/data/15151324/openapi.do') if old_entry else 'https://www.data.go.kr/data/15151324/openapi.do'

        difficulty, score, hits, clue, has_south = score_difficulty(word, meaning, south_expression)

        entries.append({
            'word': word,
            'meaning': meaning,
            'south_expression': south_expression,
            'initials': get_initials(word),
            'first_letter': word[0],
            'length': len(word),
            'category': category or '일상·기타',
            'difficulty': difficulty,
            'meaning_source_type': meaning_source_type or '통일부 북한 용어사전 원문 정의 기반 최종meaning(재추출·단문화)',
            'source_name': source_name,
            'source_url': source_url,
            'review_status': (
                '원천데이터 재추출(뜻풀이 단문화·단일의미화) 자동 가공 · 운영 전 표본 검수 권장'
                if has_south else
                '원천데이터 재추출(뜻풀이 단문화·단일의미화) 자동 가공(대응 남한말 없음 · 힌트1단계=첫글자 대체) · 운영 전 표본 검수 권장'
            ),
            'accepted_answers': accepted_answers,
            '_score': score,
            '_hits': hits,
        })

    # 가나다순 정렬
    entries.sort(key=lambda e: e['word'])

    # 초성·난이도·뜻풀이가 모두 같으면 구분할 수 없으므로 제외한다.
    group_seen = {}
    dropped_duplicate_meaning = []
    deduped_entries = []
    for e in entries:
        key = (e['difficulty'], e['initials'])
        seen_meanings = group_seen.setdefault(key, set())
        if e['meaning'] in seen_meanings:
            dropped_duplicate_meaning.append(e)
            continue
        seen_meanings.add(e['meaning'])
        deduped_entries.append(e)
    entries = deduped_entries

    final = []
    diff_dist = {}
    cat_dist = {}
    for i, e in enumerate(entries):
        eid = 'nk_' + str(i + 1).zfill(5)
        diff_dist[e['difficulty']] = diff_dist.get(e['difficulty'], 0) + 1
        cat_dist[e['category']] = cat_dist.get(e['category'], 0) + 1
        final.append({
            'id': eid,
            'word': e['word'],
            'accepted_answers': e['accepted_answers'],
            'meaning': e['meaning'],
            'south_expression': e['south_expression'],
            'initials': e['initials'],
            'first_letter': e['first_letter'],
            'length': e['length'],
            'category': e['category'],
            'difficulty': e['difficulty'],
            'meaning_source_type': e['meaning_source_type'],
            'source_name': e['source_name'],
            'source_url': e['source_url'],
            'review_status': e['review_status'],
        })

    # 정합성 점검 (chosung-check.ts [11]와 동일 관점)
    report = {
        'total': len(final),
        'dropped_duplicate_meaning': len(dropped_duplicate_meaning),
        'dropped_duplicate_meaning_words': [e['word'] for e in dropped_duplicate_meaning],
        'difficulty_distribution': diff_dist,
        'category_distribution': cat_dist,
        'one_char_words': sum(1 for w in final if w['length'] < 2),
        'missing_category': sum(1 for w in final if not w['category'].strip()),
        'missing_meaning': sum(1 for w in final if not w['meaning'].strip()),
        'meaning_exposes_word': sum(1 for w in final if w['word'] in w['meaning']),
        'accepted_answers_missing_word': sum(1 for w in final if w['word'] not in w['accepted_answers']),
        'south_expression_count': sum(1 for w in final if w['south_expression'].strip()),
    }

    # 초성+난이도 동일 && 뜻풀이 중복 그룹 검사
    from collections import defaultdict
    group_meanings = defaultdict(set)
    group_counts = defaultdict(int)
    for w in final:
        key = (w['difficulty'], w['initials'])
        group_meanings[key].add(w['meaning'])
        group_counts[key] += 1
    indistinguishable = sum(1 for k, c in group_counts.items() if c > len(group_meanings[k]))
    report['indistinguishable_groups'] = indistinguishable

    json.dump(final, open(OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    json.dump(report, open(REPORT_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('done')


if __name__ == '__main__':
    main()
