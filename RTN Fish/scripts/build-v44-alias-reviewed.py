#!/usr/bin/env python3
"""Manually adjudicate alias labels for existing V4.2 WordNet concepts."""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


# Every item is an alternate SAME-SENSE name for an existing approved concept.
# These were individually reviewed against the source concept and game question.
APPROVED = {
    7: {
        'ar': """برقوق أخضر; كمثرى بارتليت; تفاح غولدن ديليشس;
                 عنب برازيلي; ليمون مكسيكي; عين التنين; جرانديلا""",
        'en': """ackee; pineapple guava; Spanish lime; Seville orange;
                 bitter orange; greengage plum; bartlett pear;
                 seckel pear; cherimolla; Yellow Delicious; quandong""",
    },
    8: {
        'ar': """بروكلي راب; كرنب ساقي; ملفوف صيني; فاصولياء خضراء رفيعة;
                 قرع باتي بان; خس مفكك الأوراق""",
        'en': """broccoli rabe; bok choy; turnip cabbage; savoy cabbage;
                 cos lettuce; Belgian endive; haricots verts; haricot vert;
                 yellow bean; scarlet runner bean; loose-leaf lettuce""",
    },
    10: {
        'ar': """سمان; ببغاء الدرة; بلشون القطعان""",
        'en': """budgerigar; weaverbird; chimney swallow; weaver finch""",
    },
    12: {
        'ar': """صرصور الليل; خنفساء الروث; نحل أفريقي; عثة القمر""",
        'en': """humblebee; sand fly; house fly; Mediterranean fruit fly;
                 walking leaf; ant lion; antlion fly; stone fly""",
    },
    24: {
        'ar': """جيتار أكوستيك; كلارينيت جهير; بيانو عمودي;
                 طبلة جانبية; طبلة كبيرة""",
        'en': """synthesizer; upright piano; snare drum; panpipe;
                 orchestral bells; musical box; contrafagotto; Hawaiian guitar""",
    },
    35: {
        'ar': """ميرمية; باوباب; ورد دمشقي; صفصاف بابلي; خنشار""",
        'en': """birch tree; monkey-bread tree; Rosa damascena""",
    },
    74: {
        'ar': """كوارتز; ملح صخري; ذهب الحمقى; سينابار;
                 خام الطاووس; مغناطيس طبيعي""",
        'en': """fool's gold; rock salt; haematite; kyanite;
                 peacock ore; copper pyrites; barytes""",
    },
    82: {
        'en': """pachycephalosaurus; psittacosaurus; corythosaurus;
                 herrerasaurus""",
    },
    83: {
        'ar': """سلمون سوكي; سلمون شينوك; سلمون كوهو;
                 أنقليس كهربائي; قرش ماكو; قرش النمر; ريمورا;
                 سمكة شمس المحيط""",
        'en': """sockeye salmon; red salmon; chinook salmon; king salmon;
                 coho salmon; silver salmon; thresher shark;
                 spotted eagle ray; mako shark; capelin; chum salmon""",
    },
}


REJECTED = {
    (8, 'ar', 'خيار مخلل'): 'A pickle is a preparation, while a gherkin can be a fresh small cucumber.',
    (10, 'en', 'lovebird'): 'Lovebird (Agapornis) is not a budgerigar (Melopsittacus).',
    (12, 'ar', 'كلب الماء'): 'Commonly denotes an otter and may denote other animals: unsafe alias for mole cricket.',
    (24, 'ar', 'إكسيليفون'): 'Xylophone and marimba are different musical instruments.',
    (24, 'en', 'sweet potato'): 'An ocarina nickname is not a clear instrument answer in this game.',
    (82, 'en', 'superslasher'): 'Unclear nonstandard word, not an unambiguous dinosaur genus name.',
}


def tokens(s):
    return [' '.join(t.split()) for t in s.split(';') if t.strip()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--review', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--ledger', type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.review.read_text(encoding='utf-8'))
    if source['version'] != 'v4.3-verified-concept-alias-review-1':
        raise ValueError('Unrecognized alias research dataset')
    rows = source['records']
    if len(rows) != 463:
        raise ValueError('Source record count changed; must review again')
    approved = {(qid,lang,label) for qid, languages in APPROVED.items()
                for lang, text in languages.items() for label in tokens(text)}
    if len(approved) != sum(len(tokens(text)) for languages in APPROVED.values() for text in languages.values()):
        raise ValueError('Duplicate manual approval')
    if approved & REJECTED.keys():
        raise ValueError('Approved and rejected overlap')
    by_key = defaultdict(list)
    for row in rows:
        by_key[(row['question_id'],row['language'],row['label'])].append(row)
    for key in approved | REJECTED.keys():
        if len(by_key[key]) != 1:
            raise ValueError(f'Missing or duplicate source alias: {key}')
    for key in approved:
        if by_key[key][0]['review_bucket'] != 'Candidate':
            raise ValueError(f'Existing game collision or ambiguity: {key}')
    result = defaultdict(list)
    ledger = []
    counts = Counter()
    for row in rows:
        key = (row['question_id'],row['language'],row['label'])
        status = 'Verified' if key in approved else 'Rejected' if key in REJECTED else 'Review'
        counts[status] += 1
        ledger.append({
            'questionId':row['question_id'], 'conceptId':row['concept_id'],
            'language':row['language'], 'label':row['label'],
            'canonicalAr':row['canonical_ar'], 'canonicalEn':row['canonical_en'],
            'sourceId':row['source_id'], 'reviewBucket':row['review_bucket'],
            'status':status,
            'reason': ('Human-checked same-sense name; no game collision.' if status == 'Verified'
                       else REJECTED.get(key, 'Unreviewed, uncertain or context-dependent.')),
        })
        if status == 'Verified':
            result[str(row['question_id'])].append([
                row['concept_id'], row['canonical_ar'], row['canonical_en'],
                row['language'], row['label'], row['source_id'], 'Verified',
            ])
    now = datetime.now(timezone.utc).isoformat()
    runtime = {
        'version':'4.4.0-wordnet-reviewed-aliases', 'createdUTC':now,
        'reviewPolicy':'Manual same-sense alias allowlist; original answer identity and score are preserved.',
        'unverifiedExcluded':True, 'sources':source['sources'],
        'summary':{'reviewedAliases':counts['Verified'],'review':counts['Review'],
                   'rejected':counts['Rejected'],'sourceAliases':len(rows),
                   'sourceConcepts':source['summary']['source_concepts'],
                   'questionCount':len(result)},
        'rejectedExamples':[{'questionId':qid,'language':lang,'label':label,'reason':why}
                            for (qid,lang,label),why in REJECTED.items()],
        'questions':dict(result),
    }
    report = {
        'version':'v4.4-alias-adjudication-1', 'createdUTC':now,
        'sources':source['sources'], 'summary':dict(counts), 'records':ledger,
    }
    args.runtime.parent.mkdir(parents=True,exist_ok=True)
    args.runtime.write_text(json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    args.ledger.parent.mkdir(parents=True,exist_ok=True)
    args.ledger.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'summary':runtime['summary'],'byQuestion':{k:len(v) for k,v in result.items()}},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
