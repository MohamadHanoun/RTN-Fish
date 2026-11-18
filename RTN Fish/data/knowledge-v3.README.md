# RTN Fish — V3 bilingual knowledge catalog

This folder contains a compact export of the answer-first research pack.
- \`knowledge-v3.json\`: 3,786 distinct bilingual concepts. Each row is
  \`[concept_id, canonical_ar, canonical_en, category, verification_status, confidence]\`.
  1,857 have a Verified *concept* status and 1,929 have Review status.
- \`knowledge-v3.js\`: a conservative adapter. Only Verified high-confidence concepts
  in explicitly scoped categories can add English/Arabic aliases to an answer
  already present in a question. This never imports arbitrary lexical items as
  accepted answers, and never changes game rules, rarity or question cycling.
- Answer-question evidence is different from a verified label. The research pack
  establishes just 41 externally verified question-answer relations. Other
  candidate relations and 146,505 standalone English dictionary words remain
  excluded from automatic answer acceptance.

Source provenance: offline RTN Fish V3 user-supplied research pack,
Unicode CLDR (Unicode License v3), pycountry ISO translations
(LGPL-2.1 plus ISO notices), and RTN Fish original first-party data.
Consult the complete V3 archive for underlying provenance, license notices,
review tables, reproduction scripts and source catalog.

Production does not require SQLite, Python, or a network call.
Run \`node tests/knowledge-v3.js\` and \`npm test\` before deployment.
