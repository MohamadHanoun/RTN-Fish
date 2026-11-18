# RTN Fish — external-data research (NOT LIVE)

Collected on 18 Nov 2026. This research-only branch does **not** change the game, rules, questions, or Render deployment. The files are candidate reference data only, **not 274,912 accepted answers**.

## Verified intake

| Source | Records | Details |
|---|---:|---|
| Arabic WordNet v2 aligned to Princeton WordNet | 9,916 concepts | 6,884 nouns / 3,032 other; 37,335 Arabic lemma occurrences |
| GeoNames | 34,180 populated-place records | 11,146 places have at least one Arabic-script alternative spelling; 22,096 Arabic-script variants staged |
| Wiktionary (via Wiktextract, snapshot 2026-09-12) | 16,815 Arabic entries | English sense descriptions; 10,532 entries include noun senses (source count) |
| Wikidata-linked encyclopedia titles | 213,753 bilingual title pairs | Arabic/English Wikipedia article-title connections via Wikidata; 102,888 metadata/category pages excluded |
| Wikidata country identifiers | 248 country/territory entity IDs | QIDs only, not full encyclopedic entity data |
| **Total distinct source-record rows** | **274,912** | Not unique words or valid per-question answers |

GeoNames includes approximately 200,247 Latin-script alternate-name strings, which are **variants**, not guaranteed correct English translations. Of GeoNames records, 1,617 are in the Arab League's 22 ISO2 areas; 1,035 have Arabic-script alternatives. These population-filtered records are not a comprehensive gazetteer of every Arab village.

## How to use safely

**273K+ candidate records is not the same as 273K+ unique correct answers.** The Wikidata title pairs are cross-language entity references; do not accept or categorise them without checking the corresponding entity type and the game's prompt.

- Keep a canonical concept identifier per answer. Arabic and English names for the **same entity** should count as one; identical spellings of unrelated entities must stay separate.
- WordNet synset terms include some noisy or overly broad senses. English *glosses* from Wiktionary are descriptions, **not direct English aliases**.
- A place can share its name with many other places. Validate by country/region and never accept all GeoNames locations for a narrowly scoped city/landmark question.
- No runtime import will occur until the game's actual prompts and test inputs are audited and the user approves integration.

## Licenses and attribution

- Arabic WordNet AWN v2 via [Open Multilingual WordNet](https://omwn.org/omw1.html): **CC BY-SA 3.0**. English links from [Princeton WordNet](https://wordnet.princeton.edu/license-and-commercial-use) have the Princeton WordNet license. Attribution to WordNet/OMW and AWN authors must be retained.
- [GeoNames](https://www.geonames.org/about.html): **CC BY 4.0**. Attribute GeoNames contributors; data retrieved from the Stellarium/stellarium-data mirror.
- [English Wiktionary](https://en.wiktionary.org/) via [Wiktextract/Kaikki](https://kaikki.org/dictionary/) in the [Luraty language-packs](https://github.com/Luraty/language-packs) snapshot: **CC BY-SA 4.0**, separately retained.
- Wikidata-linked Arabic↔English article titles: [open-dict-data/wikidict-en](https://github.com/open-dict-data/wikidict-en) (CC0, as declared by the dataset). These names need Wikidata entity classes and validation before use in game prompts.
- Wikidata entity identifiers: [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access), **CC0**. IDs taken from datasets/country-codes; no UNTERM name fields or restricted content were copied.

Personal/private game use does **not** automatically exempt copies distributed through a public GitHub repository from license requirements. Source-specific files remain isolated.

## Layout

- `wordnet-nouns.jsonl` and `wordnet-other.jsonl`: WordNet concept candidates, bilingual terms grouped by synset ID, pending review.
- `geonames-cities-01.jsonl` through `geonames-cities-17.jsonl`: cities and other populated places, original IDs, countries, and alternate scripts, pending review.
- `wiktionary-ar-en-01.jsonl` through `wiktionary-ar-en-07.jsonl`: Arabic dictionary headwords with English definitions, **not** translations approved for answers.
- `wikidata-ar-en-01.tsv` through `wikidata-ar-en-17.tsv`: Wikidata-linked Arabic and English encyclopedia article titles, status: candidate only; each line has Arabic title, a TAB, then English title.
- `wikidata-country-ids.jsonl`: QIDs and country ISO2 cross-references only.
- `sources-and-statistics.json`: source provenance, licenses, and counts.

**No change to the live game or main branch.**
