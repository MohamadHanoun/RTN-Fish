#!/usr/bin/env python3
"""Export the editorially curated WordNet V4 answer subset from a Review ledger."""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


# Entries below were screened individually for unambiguous type, suitable Arabic
# form, and clear noun-sense definitions. Everything else stays in Review.
APPROVED = {
    10: """
        albatross; bald eagle; barn owl; barn swallow; bee eater;
        bird of paradise; black kite; black stork; black swan; budgie;
        cattle egret; cockatoo; common starling; condor; cormorant;
        curlew; dodo; emu; emperor penguin; frigate bird;
        hummingbird; ibis; kingfisher; magpie; pheasant; plover;
        quail; shrike; starling; wagtail; weaver;
        American crow; Andean condor; Atlantic puffin; California condor;
        European roller; Egyptian vulture; European bittern;
        downy woodpecker; cuckoo; black-necked stilt; black-winged stilt;
    """,
    12: """
        Aedes aegypti; Aedes albopictus; American cockroach; American copper;
        antlion; army ant; atlas moth; backswimmer; bark beetle;
        bean weevil; bee beetle; bee fly; black carpet beetle;
        boll weevil; bombardier beetle; bumblebee; cabbage butterfly;
        carpenter ant; carpenter bee; carpet moth; cat flea;
        chinch bug; clothes moth; common wasp; cricket; damselfly;
        digger wasp; dog flea; dung beetle; field cricket; fire ant;
        flea beetle; flour beetle; fungus gnat; giant water bug;
        ground beetle; honeybee; housefly; human botfly; katydid;
        killer bee; lacewing; leaf insect; leafhopper; luna moth;
        malaria mosquito; mason bee; medfly; migratory locust;
        mole cricket; mud dauber; pharaoh ant; red admiral;
        rhinoceros beetle; rice weevil; sandfly; scorpion fly;
        silverfish; stag beetle; stonefly; tiger beetle;
    """,
    24: """
        acoustic guitar; bagpipe; balalaika; bass clarinet; bass drum;
        bass guitar; celesta; clavichord; concertina; contrabassoon;
        cymbal; euphonium; fife; flugelhorn; glockenspiel;
        handbell; kazoo; koto; maraca; marimba; music box;
        ocarina; piccolo; recorder; sackbut; shawm; snare;
        steel drum; steel guitar; synthesiser; syrinx; theremin;
        timbrel; tom-tom; upright; viola d'amore; zill;
    """,
}

UNSAFE_TRANSLATION_EXAMPLES = (
    {"english": "cassowary", "arabic_from_awn": "شبنم", "reason": "Questionable Arabic translation; not activated"},
    {"english": "mallard", "arabic_from_awn": "بركة", "reason": "Arabic surface form is strongly ambiguous; not activated"},
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    review = json.loads(args.review.read_text(encoding="utf-8"))
    if review["version"] != "v4-wordnet-taxonomy-review-1" or review["summary"]["total_review_rows"] != 1487:
        raise ValueError("Unexpected taxonomy research snapshot")
    lookup = {(x["question_id"], x["english"].casefold()): x for x in review["records"]}
    output = {}
    for question_id, names in APPROVED.items():
        rows = []
        seen = set()
        for entry in names.split(";"):
            name = " ".join(entry.split()).strip()
            if not name:
                continue
            if name.casefold() in seen:
                raise ValueError(f"Repeated whitelist item: {name}")
            seen.add(name.casefold())
            record = lookup.get((question_id, name.casefold()))
            if not record:
                raise ValueError(f"WordNet concept absent: {question_id} / {name}")
            if record["review_bucket"] != "Candidate" or record["verification_status"] != "Review":
                raise ValueError(f"Not eligible for editorial approval: {question_id} / {name}: {record['review_bucket']}")
            if not record["definition_en"] or not record["ili"]:
                raise ValueError(f"Missing identity/definition: {name}")
            if len(record["normalized_ar"]) < 3 or len(record["normalized_en"]) < 3:
                raise ValueError(f"Short alias: {name}")
            rows.append([
                record["concept_id"], record["arabic"], record["english"],
                record["synset_id"], record["ili"], "Verified",
            ])
        output[str(question_id)] = rows
    result = {
        "version": "4.1.0-wordnet-reviewed",
        "createdUTC": datetime.now(timezone.utc).isoformat(),
        "source": "Open English WordNet 2024 taxonomy and Arabic WordNet 4.1 bilingual labels",
        "license": "CC BY 4.0; retain source notices; AI-assisted Arabic forms separately screened",
        "reviewPolicy": "Explicit manual allowlist only. No dictionary-wide lookup. Unique exact Arabic/English keys and no legacy matches. One concept per two aliases.",
        "unverifiedExcluded": True,
        "rejectedExamples": UNSAFE_TRANSLATION_EXAMPLES,
        "questions": output,
        "sourceCount": review["summary"]["total_review_rows"],
        "summary": {"questionCount": len(output), "curatedPairs": sum(map(len, output.values()))},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], indent=2))


if __name__ == "__main__":
    main()
