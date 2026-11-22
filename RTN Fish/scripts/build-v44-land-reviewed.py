#!/usr/bin/env python3
"""Curate clearly terrestrial named mammals for RTN Fish question 9."""

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


APPROVED = """aardvark; armadillo; jackal; badger; marten;
gray wolf; white wolf; red wolf; gray fox; sloth bear;
musk deer; alpaca; antelope; ibex; macaque; gibbon;
pine marten; giant kangaroo"""


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--research',required=True,type=Path)
    parser.add_argument('--prior-ledger',required=True,type=Path)
    parser.add_argument('--runtime',required=True,type=Path)
    parser.add_argument('--ledger',required=True,type=Path)
    args=parser.parse_args()
    source=json.loads(args.research.read_text(encoding='utf-8'))
    prior=json.loads(args.prior_ledger.read_text(encoding='utf-8'))
    if source['version']!='v4.3-wordnet-research-only-1' or len(source['records'])!=2011:
        raise ValueError('Unexpected research data')
    if prior['version']!='v4.3-offline-adjudication-1' or len(prior['records'])!=2011:
        raise ValueError('Unexpected previous adjudication')
    names={' '.join(x.split()) for x in APPROVED.split(';') if x.strip()}
    if len(names)!=18:
        raise ValueError('Wrong number of explicit names')
    source_by_id={(r['question_id'],r['concept_id']):r for r in source['records']}
    prior_by_id={(r['question_id'],r['concept_id']):r for r in prior['records']}
    selected=[]
    for english in names:
        rows=[r for r in source['records'] if r['question_id']==9 and r['english']==english]
        if len(rows)!=1 or rows[0]['review_bucket']!='Candidate':
            raise ValueError(f'Unrecognized or ambiguous: {english}')
        record=rows[0]
        if prior_by_id[9,record['concept_id']]['verification_status']!='Review':
            raise ValueError('Already settled in V4.3: '+english)
        selected.append(record)
    selected.sort(key=lambda r:r['english'].casefold())
    records=[]
    counts=Counter()
    for previous in prior['records']:
        row=source_by_id[previous['question_id'],previous['concept_id']]
        status=('Verified' if row['question_id']==9 and row['english'] in names
                else previous['verification_status'])
        counts[status]+=1
        records.append({
            'questionId':row['question_id'], 'conceptId':row['concept_id'],
            'english':row['english'], 'arabic':row['arabic'],
            'status':status, 'priorStatus':previous['verification_status'],
            'reason':('Explicit named terrestrial mammal, bilingual names reviewed against source definition.'
                      if status=='Verified' and previous['verification_status']=='Review'
                      else previous['reason']),
        })
    assert counts=={'Review':1904,'Rejected':17,'Verified':90}
    now=datetime.now(timezone.utc).isoformat()
    runtime={
        'version':'4.4.0-terrestrial-reviewed', 'createdUTC':now,
        'reviewPolicy':'18 explicit named terrestrial mammals for existing game question 9 only.',
        'unverifiedExcluded':True,'sources':source['sources'],
        'summary':{'curatedPairs':len(selected),'questionCount':1,'totalPhase4Verified':counts['Verified'],
                   'totalPhase4Review':counts['Review'],'totalPhase4Rejected':counts['Rejected']},
        'questions':{'9':[[r['concept_id'],r['arabic'],r['english'],
                          r['synset_id'],r['ili'],'Verified'] for r in selected]},
    }
    ledger={'version':'v4.4-land-adjudication-1','createdUTC':now,'sources':source['sources'],
            'summary':dict(counts),'records':records}
    args.runtime.parent.mkdir(parents=True,exist_ok=True)
    args.runtime.write_text(json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    args.ledger.parent.mkdir(parents=True,exist_ok=True)
    args.ledger.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'newVerified':len(selected),'totalPhase4':dict(counts)},ensure_ascii=False))


if __name__=='__main__':
    main() 
