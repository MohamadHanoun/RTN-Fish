#!/usr/bin/env python3
"""Export explicitly reviewed bilingual WordNet names from quarantined V4 research."""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


# A source taxonomy match alone is never approval. Each English name here was
# compared with its specific question, Arabic label, and English definition.
# Every omitted research record remains in Review or its earlier Rejected state.
APPROVED = {
    9: """naked mole rat; Damaraland mole rat; tree shrew; bandicoot;
        wombat; tenrec; cotton rat; wood-rat; jumping mouse; dormouse;
        squirrel; prairie dog; cavy; capibara; agouti; chinchilla;
        rock hyrax; common opossum; crab-eating opossum; bilby;
        musk kangaroo; cuscus; thylacine; numbat; starnose mole;
        common shrew; masked shrew; least shrew; civet; fossa; genet;
        meerkat; brown bat; mouse-eared bat; vampire bat; house mouse;
        brown rat; roof rat; Eurasian hamster; Syrian hamster;
        Old World porcupine; New World porcupine; hazel mouse;
        chipmunk; groundhog; red squirrel; black squirrel;
        American flying squirrel; vicuna; peccary; mink; skunk;
        ant bear; silky anteater; tamandu; aye-aye; slow loris;
        galago; African elephant; common wallaby;
        rock wallaby; pademelon; potoroo; bettong; coyote; dingo;
        raccoon dog; Hyaena hyaena; brown hyena; spotted hyena;
        aardwolf; grizzly; Kodiak; ichneumon; suricate;
        European rabbit; cottontail; European hare; jackrabbit;
        grasshopper mouse; prairie vole; pine vole; fox squirrel;
        rock squirrel; Indian rhinoceros; Diceros simus;
        Diceros bicornis; Indian tapir; babirusa; warthog;
        javelina; prongbuck; chevrotain; dromedary; Bactrian camel;
        guanaco; American mink; striped skunk; spotted skunk;
        Taxidea taxus; Meles meles; gorilla;
        chimp; orang; mandrill; baboon; pygmy marmoset; capuchin;
        spider monkey; squirrel monkey; okapi; impala;
        hartebeest; kudu; bongo; caribou; sika; sambar;
        mountain goat; chamois; saiga; nilgai; musk ox; wisent""",
    57: """triple cream; process cheese; brick cheese;
        chevre; Liederkranz; string cheese; Swiss cheese; Velveeta;
        double cream; Danish blue; Bavarian blue; sapsago""",
    58: """bap; bun; garlic bread; graham bread; flatbrod; fry bread;
        Italian bread; French loaf; nut bread; date-nut bread;
        quick bread; sour bread; salt-rising bread; gluten bread;
        scone; hard roll; soft roll; Parker House roll;
        clover-leaf roll; onion roll; sweet roll; bialy;
        cinnamon bun; pretzel;
        corn muffin; bran muffin; baking-powder biscuit;
        soda biscuit; hoecake; skillet corn bread""",
    65: """""",
    66: """cola nut; bunya bunya; quandong nut; butternut;
        souari nut; chincapin; grugru nut""",
    70: """goa bean; marrowfat pea; common bean; snow pea;
        sugar snap pea; pinto bean; frijole; wax bean;
        runner bean; French bean; haricot; butterbean;
        Fordhooks""",
    75: """sedimentary rock; metamorphic rock; igneous rock;
        greisen; argillite; argillaceous rock; rudaceous rock;
        marlite; aplite; peridotite; pegmatite;
        porphyry; volcanic glass; oil shale; brownstone;
        pitchstone; tachylite; greensand;
        humic shale; pillow lava""",
    84: """ounce; sabertooth; catamountain; caffer cat;
        panther; Bengal tiger""",
    85: """bluebottle; cosmea; billy buttons; sun marigold;
        blue daisy; marguerite; cineraria; stokes' aster;
        tithonia; Easter daisy; xeranthemum; cyclamen;
        centaury; gentian; coral drops; Christmas bells;
        bellwort; commelina; scabiosa; achimenes;
        streptocarpus; phacelia; gerardia; toadflax;
        veronica; browallia; schizanthus; verbena;
        red valerian; Adonis annua; rue anemone;
        rocket larkspur; nigella; peace lily; soapwort;
        globe amaranth; spring beauty; candytuft;
        sweet alison; poppy; aster; China aster;
        Barberton daisy; oxeye daisy; shasta daisy;
        Rudbeckia hirta; silver-lace; orchis; jewel orchid;
        brassavola; calanthe; cymbid; dendrobium;
        fringed orchid; lizard orchid; maxillaria;
        oncidium; bee orchid; sobralia; vanda;
        Rosa banksia; damask rose; Cherokee rose;
        musk rose; tea rose; pink calla; golden calla;
        sweet William; china pink; Iceland poppy;
        oriental poppy; California poppy; blue poppy;
        sea aster; common daisy; male orchis;
        yellow lady-slipper; wax begonia; Begonia rex;
        China rose; tuberous begonia; star begonia;
        Christmas begonia; white snapdragon; hybrid petunia;
        wood anemone; Canada anemone; snowdrop; crown daisy;
        Swan River daisy; corn poppy; common ageratum""",
}


def names(block):
    return [' '.join(term.split()) for term in block.split(';') if term.strip()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--research', required=True, type=Path)
    parser.add_argument('--prior-ledger', required=True, type=Path)
    parser.add_argument('--runtime', required=True, type=Path)
    parser.add_argument('--ledger', required=True, type=Path)
    args = parser.parse_args()
    research = json.loads(args.research.read_text(encoding='utf-8'))
    prior = json.loads(args.prior_ledger.read_text(encoding='utf-8'))
    if (research.get('version') != 'v4.3-wordnet-research-only-1'
            or prior.get('version') != 'v4.4-land-adjudication-1'
            or len(research['records']) != 2011
            or len(prior['records']) != 2011
            or len(research['sources']) != 2):
        raise ValueError('Unexpected frozen source or prior-ledger version')
    by_name = defaultdict(list)
    by_concept = {}
    for row in research['records']:
        by_name[(row['question_id'], row['english'])].append(row)
        by_concept[(row['question_id'], row['concept_id'])] = row
    prior_by_concept = {(row['questionId'], row['conceptId']): row for row in prior['records']}
    approved_keys = {(q, term) for q, block in APPROVED.items() for term in names(block)}
    if len(approved_keys) != sum(len(names(block)) for block in APPROVED.values()):
        raise ValueError('Duplicate allowlisted name')
    verified = defaultdict(list)
    selected = set()
    invalid = []
    for key in approved_keys:
        rows = by_name.get(key, [])
        if len(rows) != 1:
            invalid.append(f'Missing or ambiguous: {key} ({len(rows)})')
            continue
        row = rows[0]
        prior_status = prior_by_concept[key[0], row['concept_id']]['status']
        if row['review_bucket'] != 'Candidate' or prior_status != 'Review':
            invalid.append(f'Not eligible: {key}, bucket={row["review_bucket"]}, prior={prior_status}')
            continue
        if not all(row.get(k) for k in ('arabic', 'english', 'concept_id', 'synset_id', 'ili')):
            raise ValueError(f'Incomplete bilingual concept: {key}')
        if not ('\u0600' <= row['arabic'][0] <= '\u06ff'):
            raise ValueError(f'Unexpected Arabic label: {key}: {row["arabic"]}')
        concept_key = (row['question_id'], row['concept_id'])
        if concept_key in selected:
            raise ValueError(f'Duplicate concept ID: {concept_key}')
        selected.add(concept_key)
        verified[str(row['question_id'])].append([
            row['concept_id'], row['arabic'], row['english'],
            row['synset_id'], row['ili'], 'Verified',
        ])
    if invalid:
        raise ValueError('Allowlist must be revised:\n' + '\n'.join(sorted(invalid)))
    for rows in verified.values():
        rows.sort(key=lambda row: row[2].casefold())
    ledger = []
    statuses = Counter()
    for prior_row in prior['records']:
        key = (prior_row['questionId'], prior_row['conceptId'])
        source_row = by_concept[key]
        status = 'Verified' if key in selected else prior_row['status']
        statuses[status] += 1
        ledger.append({
            'questionId': key[0], 'conceptId': key[1],
            'english': source_row['english'], 'arabic': source_row['arabic'],
            'status': status, 'priorStatus': prior_row['status'],
            'reason': ('Explicit same-sense bilingual category review for V4.5.'
                       if key in selected else prior_row['reason']),
        })
    now = datetime.now(timezone.utc).isoformat()
    new_count = len(selected)
    runtime = {
        'version': '4.5.0-wordnet-reviewed', 'createdUTC': now,
        'source': 'Open English WordNet 2024 + Arabic WordNet 4.1',
        'license': 'CC BY 4.0; retain attribution; AWN Arabic labels individually screened',
        'reviewPolicy': 'Explicit bilingual concept+question allowlist; no automatic taxonomy promotion',
        'unverifiedExcluded': True, 'sources': research['sources'],
        'summary': {
            'curatedPairs': new_count, 'totalPhase4Verified': statuses['Verified'],
            'review': statuses['Review'], 'rejected': statuses['Rejected'],
            'questionCount': len(verified), 'sourceCandidates': 2011,
        },
        'questions': dict(verified),
    }
    audit = {
        'version': 'v4.5-offline-adjudication-1', 'createdUTC': now,
        'sources': research['sources'], 'summary': dict(statuses),
        'newVerified': new_count, 'records': ledger,
        'note': 'Only V4.5 newly Verified rows are exported to the runtime; all Review rows remain quarantined.',
    }
    args.runtime.parent.mkdir(parents=True, exist_ok=True)
    args.runtime.write_text(json.dumps(runtime, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    args.ledger.parent.mkdir(parents=True, exist_ok=True)
    args.ledger.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'newVerified': new_count, 'statuses': dict(statuses),
                      'questions': {q: len(rows) for q, rows in verified.items()}}, indent=2))


if __name__ == '__main__':
    main()
