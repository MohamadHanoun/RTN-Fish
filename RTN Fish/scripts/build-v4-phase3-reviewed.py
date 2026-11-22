#!/usr/bin/env python3
"""Promote only a hand-checked bilingual WordNet V4.2 allowlist.

The full research ledger is kept outside the deployed repository. This script
exports a tiny runtime subset and a complete three-state adjudication ledger.
"""

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


# Editorial screening: the two labels must name the SAME specific category
# member, not a plant part, fish habitat, general class, metaphor, or dish.
# Keep this list deliberately explicit. It is not a taxonomy-based auto-pass.
APPROVED = {
    7: """
      lansa; breadfruit; jak; canistel; icaco; ketembilla; akee;
      feijoa; genip; genipap; loquat; sapota; mammee; mombin;
      jaboticaba; longanberry; mamey; marang; plumcot; quandang;
      pulasan; kumquat; citron; damson; greengage; beach plum;
      sloe; granadilla; muscadine; cherimoya; ilama; bosc;
      anjou; bartlett; seckel; black currant; red currant;
      satsuma; sour orange; key lime; bing cherry; morello;
      scuppernong; Thompson Seedless; Valencia orange;
      Persian melon; casaba; Concord grape; Catawba;
      Red Delicious; Granny Smith; Macoun; Golden Delicious;
      Cox's Orange Pippin; Jaffa orange;
    """,
    8: """
      rhubarb; plantain; broccoli raab; summer squash; winter squash;
      gherkin; sunchoke; Bermuda onion; Vidalia onion; shallot;
      pascal celery; kohlrabi; wild spinach; salsify; parsnip;
      turnip greens; sorrel; French sorrel; cole; bok choi;
      yellow squash; cocozelle; pattypan squash; spaghetti squash;
      acorn squash; butternut squash; hubbard squash; turban squash;
      cushaw; alfalfa sprout; sugar beet; common bean; chicory;
      endive; cress; beefsteak tomato; cherry tomato; scorzonera;
      savoy; buttercup squash; butterhead lettuce; cos;
      leaf lettuce; snow pea; sugar snap pea; pinto bean;
      radicchio; witloof; garden cress; winter cress;
      plum tomato; Bibb lettuce; Boston lettuce; wax bean;
      runner bean; French bean;
    """,
    35: """
      aloe; sage; fern; star jasmine; wild basil; birch; elm;
      common dandelion; peppermint; wild thyme; staghorn fern;
      tree fern; sword fern; Christmas cactus; common bamboo;
      baobab; cork oak; white oak; weeping willow; Chinese elm;
      yellow birch; downy birch; scarlet oak; black oak;
      royal palm; damask rose; tea rose; live oak;
      barrel cactus; holm oak;
    """,
    74: """
      amblygonite; apatite; aragonite; argentite; augite;
      baddeleyite; bastnasite; beryl; bornite; carnallite;
      cassiterite; celestite; cerussite; chalcocite; chalcopyrite;
      chlorite; chrysoberyl; cinnabar; halite; cordierite;
      cristobalite; cryolite; dolomite; erythrite; galena;
      gibbsite; glauconite; gypsum; barite; ilmenite; jadeite;
      kaolinite; cyanite; malachite; molybdenite; monazite;
      nepheline; olivine; orpiment; pentlandite; pyrite;
      pyrolusite; pyromorphite; pyrophyllite; quartz;
      rhodochrosite; rhodonite; rutile; scheelite; sodalite;
      spinel; spodumene; stibnite; strontianite; sylvine;
      talc; tantalite; tourmaline; turquoise; vanadinite;
      vermiculite; wolframite; wollastonite; azurite; biotite;
      muscovite; lepidolite; calcite; hematite; magnetite;
      albite; anorthite; fluorapatite; hornblende;
    """,
    82: """
      argentinosaur; pachycephalosaur; psittacosaur;
      anatotitan; corythosaur; edmontosaurus;
      compsognathus; herrerasaur; eoraptor; Edmontonia;
      coelophysis; struthiomimus; deinocheirus;
      deinonychus; utahraptor;
    """,
    83: """
      northern snakehead; shrimpfish; coelacanth;
      Atlantic herring; Pacific herring; sprat; sockeye;
      chinook; chum; coho; brown trout; rainbow trout;
      lake trout; brook trout; lake whitefish; round whitefish;
      halfbeak; red snapper; gray snapper; squirrelfish;
      cow shark; thrasher; carpet shark; nurse shark;
      whale shark; cat shark; guitarfish; eagle ray;
      tarpon; lanternfish; opah; remora; red goatfish;
      yellow goatfish; dragonet; bowfin; loach; electric eel;
      reef squirrelfish; porbeagle; mako; basking shark;
      lemon shark; blue shark; tiger shark; spiny dogfish;
      bonnethead; spotted ray; channel cat; armored catfish;
      mediterranean anchovy; caplin; wrasse; archerfish;
      greenling; gurnard; spiny puffer; mola; flounder;
      tench; crucian carp; guppy; molly; shortfin mako;
      longfin mako; brown bullhead; blue cat; Atlantic cod;
      Pacific sardine; Arctic char; yellow perch;
      European perch; snook; tetra; cardinal tetra;
      European sea bream; Atlantic sea bream;
      bluehead; escolar; Atlantic tripletail; kelp greenling;
      Atlantic halibut; Pacific halibut; plaice;
      blue marlin; black marlin; striped marlin; white marlin;
      wahoo; Atlantic sailfish;
    """,
}

# Factual translation/type errors discovered while screening. This list is not
# exhaustive; every unselected item remains Review, not auto-rejected.
REJECTED = {
    (8, 'Chinese celery'): 'AWN Arabic means Chinese cabbage, while English sense is celery.',
    (8, 'rabbit food'): 'Generic uncooked vegetable, not a named vegetable type.',
    (8, 'julienne'): 'A cut/preparation technique, not a vegetable type.',
    (8, 'baked potato'): 'Prepared dish rather than a vegetable type.',
    (8, 'chips'): 'Prepared fried potato dish rather than vegetable type.',
    (74, 'earth color'): 'Generic natural pigment category rather than a mineral name.',
    (74, 'rhinestone'): 'Imitation stone may be glass, not a verified mineral.',
    (83, 'bottom-feeder'): 'Feeding niche, not a named fish type.',
    (83, 'spawner'): 'Reproductive role, not a named fish type.',
    (83, 'young fish'): 'Life stage rather than a fish type.',
    (83, 'two-wing flying fish'): 'AWN Arabic states single wing, conflicting with English.',
}


def tokens(text):
    return [' '.join(name.split()) for name in text.split(';') if name.strip()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--review', required=True, type=Path)
    parser.add_argument('--runtime', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--adjudication', required=True, type=Path)
    args = parser.parse_args()
    stage = json.loads(args.review.read_text(encoding='utf-8'))
    runtime = json.loads(args.runtime.read_text(encoding='utf-8'))
    if stage['version'] != 'v4-phase3-wordnet-review-1' or len(stage['records']) != 5767:
        raise ValueError('Unexpected phase 3 research ledger')
    if sum(map(len, runtime['questions'].values())) < 140:
        raise ValueError('Unrecognized V4 runtime')
    if '4.1.0' not in runtime['version'] and '4.2.0' not in runtime['version']:
        raise ValueError('Unexpected previous runtime version')
    originals = {qid: rows for qid, rows in runtime['questions'].items() if int(qid) in (10, 12, 24)}
    if sum(map(len, originals.values())) != 140:
        raise ValueError('V4.1 baseline must remain exactly 140 entries')
    lookup = {(r['question_id'], r['english'].casefold()): r for r in stage['records']}
    chosen = set()
    out_questions = dict(originals)
    for qid, selected in APPROVED.items():
        rows = []
        for name in tokens(selected):
            key = (qid, name.casefold())
            if key in chosen:
                raise ValueError(f'Duplicate editorial approval: {key}')
            record = lookup.get(key)
            if record is None or record['review_bucket'] != 'Candidate':
                raise ValueError(f'Candidate not eligible: {key}')
            if not record['definition_en'] or not record['ili'] or not record['synset_id']:
                raise ValueError(f'Incomplete definition/identity: {key}')
            if not (record['normalized_ar'] and record['normalized_en']):
                raise ValueError(f'Missing normalized aliases: {key}')
            if key in REJECTED:
                raise ValueError(f'Attempted to approve rejected entry: {key}')
            chosen.add(key)
            rows.append([record['concept_id'], record['arabic'], record['english'],
                         record['synset_id'], record['ili'], 'Verified'])
        if not rows:
            raise ValueError(f'No verified records for question {qid}')
        out_questions[str(qid)] = rows
    missing_rejected = set((qid, name.casefold()) for qid, name in REJECTED) - set(lookup)
    if missing_rejected:
        raise ValueError(f'Rejection not in research: {missing_rejected}')
    now = datetime.now(timezone.utc).isoformat()
    ledger = {**{k: v for k, v in stage.items() if k != 'records'},
              'version': 'v4-phase3-adjudication-1', 'adjudicated_utc': now,
              'records': []}
    states = Counter()
    by_question = Counter()
    for source in stage['records']:
        record = dict(source)
        key = (record['question_id'], record['english'].casefold())
        if key in chosen:
            record['verification_status'] = 'Verified'
            record['review_notes'] += ' Approved in explicit V4.2 editorial bilingual allowlist.'
            by_question[record['question_id']] += 1
        elif key in {(q, n.casefold()) for q, n in REJECTED}:
            record['verification_status'] = 'Rejected'
            record['review_notes'] += f' Rejected: {REJECTED[(record["question_id"], record["english"])]}'
        else:
            record['verification_status'] = 'Review'
        states[record['verification_status']] += 1
        ledger['records'].append(record)
    ledger['summary'] = {
        'total_review_rows': len(stage['records']), 'verified': states['Verified'],
        'review': states['Review'], 'rejected': states['Rejected'],
        'by_question': {str(q): n for q, n in sorted(by_question.items())},
        'deploy_scope': 'Only Verified rows are included in the tiny runtime subset.',
    }
    total = sum(map(len, out_questions.values()))
    final = {
        **{k: v for k, v in runtime.items() if k not in ('questions', 'summary', 'sourceCount')},
        'version': '4.2.0-wordnet-reviewed', 'createdUTC': now,
        'source': 'Open English WordNet 2024 taxonomy and Arabic WordNet 4.1 bilingual labels',
        'sources': stage['sources'],
        'reviewPolicy': 'Explicit bilingual editorial allowlist; source taxonomy and names are not automatically accepted.',
        'unverifiedExcluded': True,
        'rejectedExamples': [
            {'questionId': qid, 'english': name, 'reason': reason}
            for (qid, name), reason in REJECTED.items()
        ],
        'questions': out_questions,
        'sourceCount': 1487 + len(stage['records']),
        'summary': {'questionCount': len(out_questions), 'curatedPairs': total,
                    'phase3Curated': states['Verified'],
                    'phase3Review': states['Review'],
                    'phase3Rejected': states['Rejected'],
                    'phase3ByQuestion': ledger['summary']['by_question']},
    }
    if states['Verified'] != len(chosen) or total != 140 + len(chosen):
        raise ValueError('Lost editorial approvals')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.adjudication.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(final, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    args.adjudication.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(final['summary'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
