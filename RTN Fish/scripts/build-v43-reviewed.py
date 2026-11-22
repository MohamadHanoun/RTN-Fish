#!/usr/bin/env python3
"""Create a small, explicitly screened V4.3 bilingual game runtime and offline ledger."""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


# Each term was checked in the source definition and bilingual labels against
# the exact question. These are named members, not generic taxonomy descendants.
# Unlisted source rows are NOT accepted regardless of their Candidate bucket.
APPROVED = {
    57: """Edam; Cheshire cheese; double Gloucester; Limburger; Muenster;
           quark; mascarpone; Stilton; gorgonzola; Gruyere""",
    58: """anadama bread; caraway seed bread; cracked-wheat bread;
           English muffin; matzo; rye bread; grissino; bannock; chapati;
           Irish soda bread; Swedish rye; bagel; onion bagel; soft pretzel""",
    65: """five spice powder; allspice; fennel; mace; star anise""",
    66: """cedar nut; macadamia nut; pecan; hickory nut; black walnut;
           English walnut""",
    70: """kidney bean; pea bean; black bean; lima bean; string bean;
           field pea; split-pea""",
    75: """pumice; amphibolite; hornfels; andesite; gneiss; diorite;
           gabbro; rhyolite; shale; breccia; dacite; kimberlite""",
    84: """ocelot; eyra; margay; manul; Lynx lynx; Canada lynx;
           bobcat; Lynx pardina""",
    85: """marigold; zinnia; tuberose; African violet; snapdragon;
           petunia; begonia; peony; anemone; baby's breath""",
}

REJECTED = {
    (9, 'female mammal'): 'General class, not a named terrestrial animal.',
    (9, 'Persian cat'): 'Domestic breed; not a good named land-wildlife expansion.',
    (11, 'bycatch'): 'Bycatch is an accidental catch, not a species or creature.',
    (58, 'Host'): 'Religious ceremonial usage, not an ordinary variety of bread.',
    (58, 'meatloaf'): 'Meat dish, not bread.',
    (58, 'fish loaf'): 'Fish dish, not bread.',
    (58, 'salmon loaf'): 'Fish dish, not bread.',
    (66, 'pyrene'): 'Botanical fruit stone, not a culinary nut type.',
    (66, 'edible nut'): 'Generic nut class, not a specific nut.',
    (75, 'magma'): 'Molten material, not a named solid rock type.',
    (75, 'shingling'): 'Sedimentary orientation/structure, not a rock type.',
    (84, 'Persian cat'): 'Domestic cat breed; not a wild felid.',
    (84, 'Siamese'): 'Domestic cat breed; not a wild felid.',
    (84, 'alley cat'): 'Homeless domestic cat, not a wild species.',
    (84, 'mouser'): 'Domestic cat described by behavior.',
    (84, 'tom'): 'Cat sex, not a species.',
    (85, 'bloomer'): 'Generic blooming flower, not a named flower type.',
}


def names(block):
    return [' '.join(x.split()) for x in block.split(';') if x.strip()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--review', required=True, type=Path)
    parser.add_argument('--runtime', required=True, type=Path)
    parser.add_argument('--ledger', required=True, type=Path)
    args = parser.parse_args()
    stage = json.loads(args.review.read_text(encoding='utf-8'))
    if stage['version'] != 'v4.3-wordnet-research-only-1':
        raise ValueError('Unexpected research source version')
    rows = stage['records']
    if len(rows) != 2011 or len(stage['sources']) != 2:
        raise ValueError('Research dataset changed; re-review before export')
    by_name = defaultdict(list)
    for record in rows:
        by_name[(record['question_id'], record['english'])].append(record)
    approved_keys = {(qid, term) for qid, block in APPROVED.items() for term in names(block)}
    if len(approved_keys) != sum(len(names(block)) for block in APPROVED.values()):
        raise ValueError('Duplicate approved names')
    if approved_keys & REJECTED.keys():
        raise ValueError('Approved and Rejected sets overlap')
    for key in approved_keys | REJECTED.keys():
        if len(by_name[key]) != 1:
            raise ValueError(f'Missing or ambiguous source row: {key}')
    for key in approved_keys:
        row = by_name[key][0]
        if row['review_bucket'] != 'Candidate':
            raise ValueError(f'Unscreened collision: {key}: {row["review_bucket"]}')
        if not all(row.get(k) for k in ('arabic','english','concept_id','synset_id','ili')):
            raise ValueError(f'Incomplete bilingual identity: {key}')
    approved = defaultdict(list)
    ledger = []
    counters = Counter()
    for row in rows:
        key = (row['question_id'], row['english'])
        state = 'Verified' if key in approved_keys else 'Rejected' if key in REJECTED else 'Review'
        counters[state] += 1
        ledger.append({
            'question_id': row['question_id'], 'group': row['group'],
            'concept_id': row['concept_id'], 'arabic': row['arabic'],
            'english': row['english'], 'review_bucket': row['review_bucket'],
            'verification_status': state,
            'reason': ('Explicit same-sense bilingual named-member review; see OEWN definition and AWN label.'
                       if state == 'Verified' else REJECTED.get(key, 'Not yet independently reviewed.')),
        })
        if state == 'Verified':
            approved[str(row['question_id'])].append([
                row['concept_id'], row['arabic'], row['english'],
                row['synset_id'], row['ili'], 'Verified',
            ])
    assert counters['Verified'] == 72
    assert len(approved) == 8
    now = datetime.now(timezone.utc).isoformat()
    runtime = {
        'version': '4.3.0-wordnet-reviewed', 'createdUTC': now,
        'source': 'Open English WordNet 2024 + Arabic WordNet 4.1; curated from quarantined V4.3 research',
        'license': 'CC BY 4.0; retain attribution; AWN Arabic labels manually screened',
        'reviewPolicy': 'Explicit bilingual same-sense named-member allowlist; no broad WordNet hierarchy acceptance',
        'unverifiedExcluded': True, 'sources': stage['sources'],
        'summary': {
            'curatedPairs': counters['Verified'], 'review': counters['Review'],
            'rejected': counters['Rejected'], 'aliasReview': 463,
            'questionCount': len(approved), 'sourceCandidates': len(rows),
        },
        'rejectedExamples': [{'questionId': q, 'english': en, 'reason': why}
                             for (q, en), why in REJECTED.items()],
        'questions': dict(approved),
    }
    audit = {
        'version': 'v4.3-offline-adjudication-1', 'createdUTC': now,
        'sources': stage['sources'], 'summary': dict(counters), 'records': ledger,
        'note': 'Only Verified records are included in the deployed runtime. Source alternate aliases remain Review.',
    }
    args.runtime.parent.mkdir(parents=True, exist_ok=True)
    args.runtime.write_text(json.dumps(runtime, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    args.ledger.parent.mkdir(parents=True, exist_ok=True)
    args.ledger.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'verified': counters['Verified'], 'review': counters['Review'],
                      'rejected': counters['Rejected'], 'questions': len(approved)}, indent=2))


if __name__ == '__main__':
    main()
