#!/usr/bin/env python3
"""Export narrow, country-verified city answers from the RTN Fish V4 research DB."""

import argparse
import json
import re
import sqlite3
import subprocess
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


COUNTRY_QUESTIONS = {
    'اذكر مدينة في السعودية': 'SA', 'اذكر مدينة في سوريا': 'SY', 'اذكر مدينة في مصر': 'EG',
    'اذكر مدينة في المغرب': 'MA', 'اذكر مدينة في الجزائر': 'DZ', 'اذكر مدينة في تونس': 'TN',
    'اذكر مدينة في ليبيا': 'LY', 'اذكر مدينة في السودان': 'SD', 'اذكر مدينة في اليمن': 'YE',
    'اذكر مدينة في عمان': 'OM', 'اذكر مدينة في الإمارات': 'AE', 'اذكر مدينة في قطر': 'QA',
    'اذكر مدينة في الكويت': 'KW', 'اذكر مدينة في البحرين': 'BH', 'اذكر مدينة في الأردن': 'JO',
    'اذكر مدينة في لبنان': 'LB', 'اذكر مدينة في فلسطين': 'PS', 'اذكر مدينة في العراق': 'IQ',
    'اذكر مدينة في موريتانيا': 'MR', 'اذكر مدينة في الصومال': 'SO',
    'اذكر مدينة في جيبوتي': 'DJ', 'اذكر مدينة في جزر القمر': 'KM',
    'اذكر مدينة في تركيا': 'TR', 'اذكر مدينة في إيطاليا': 'IT',
    'اذكر مدينة في فرنسا': 'FR', 'اذكر مدينة في ألمانيا': 'DE',
    'اذكر مدينة في إسبانيا': 'ES', 'اذكر مدينة في بريطانيا': 'GB',
    'اذكر مدينة في الولايات المتحدة': 'US', 'اذكر مدينة في اليابان': 'JP',
    'اذكر مدينة في الهند': 'IN', 'اذكر مدينة في البرازيل': 'BR',
    'اذكر مدينة في الصين': 'CN',
}
ARAB_COUNTRIES = frozenset(('SA','SY','EG','MA','DZ','TN','LY','SD','YE','OM','AE','QA','KW','BH','JO','LB','PS','IQ','MR','SO','DJ','KM'))
FEATURES = frozenset(('PPL','PPLA','PPLA2','PPLA3','PPLC'))


def norm(s):
    s = unicodedata.normalize('NFKC',s).lower()
    s = re.sub('[\u064b-\u065f\u0670\u0640\u06d6-\u06ed]','',s)
    s = s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ؤ':'و','ئ':'ي','ة':'ه'}))
    s = re.sub(r'[^\w\s]', ' ', s, flags=re.UNICODE)
    return ' '.join(s.split())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args = parser.parse_args()
    game_root = Path(__file__).resolve().parent.parent
    source = sqlite3.connect(f'file:{args.db.resolve()}?mode=ro',uri=True)
    code = "const {questions}=require('./data/questions');process.stdout.write(JSON.stringify(questions.map(q=>({id:q.id,prompt:q.prompt,aliases:q.answers.flatMap(a=>a.aliases)}))))"
    game = json.loads(subprocess.run(['node','-e',code],cwd=game_root,check=True,capture_output=True).stdout)
    by_prompt = {q['prompt']:q for q in game}
    for question in COUNTRY_QUESTIONS:
        if question not in by_prompt:
            raise ValueError('Missing expected country question: '+question)
    if 'اذكر مدينة عربية' not in by_prompt:
        raise ValueError('Missing Arab city question')
    cities = defaultdict(list)
    for geoid,ar,en,code,feature,pop in source.execute('''SELECT p.geoname_id,c.canonical_ar,c.canonical_en,p.country_code,p.feature_code,p.population
        FROM places p JOIN concepts c ON c.concept_id=p.concept_id
        WHERE p.population>=100000 AND c.canonical_ar IS NOT NULL AND c.canonical_en IS NOT NULL'''):
        if code not in set(COUNTRY_QUESTIONS.values()) or feature not in FEATURES:
            continue
        if not re.search('[\u0600-\u06ff]',ar) or not re.search('[A-Za-z]',en):
            continue
        if not (3 <= len(norm(ar)) <= 60 and 3 <= len(norm(en)) <= 60):
            continue
        cities[code].append([geoid,ar,en,pop,code])
    exported = {}
    skipped_ambiguous = 0
    skipped_existing = 0
    for q in game:
        codes = ARAB_COUNTRIES if q['prompt']=='اذكر مدينة عربية' else ({COUNTRY_QUESTIONS[q['prompt']]} if q['prompt'] in COUNTRY_QUESTIONS else set())
        if not codes:
            continue
        choices = [row for country in codes for row in cities[country]]
        owners = defaultdict(set)
        for row in choices:
            for alias in (row[1],row[2]):
                owners[norm(alias)].add(row[0])
        already = {norm(a) for a in q['aliases']}
        rows = []
        for row in sorted(choices,key=lambda r:(-r[3],r[0])):
            keys = [norm(row[1]),norm(row[2])]
            if any(len(owners[k])>1 for k in keys):
                skipped_ambiguous += 1
                continue
            if any(k in already for k in keys):
                skipped_existing += 1
                continue
            rows.append(row)
        if rows:
            exported[str(q['id'])] = rows
    result = {
        'version':'4.0.0-geo-verified',
        'origin':'GeoNames cities500/alternateNamesV2 from RTN Fish V4 research database',
        'policy':'Only >=100,000 population, populated place/capital feature, geocoded country, Arabic/English names, zero normalized aliases collisions per question. Exact matching only. Non-geographic research remains Review.',
        'minPopulation':100000,
        'countryQuestions':COUNTRY_QUESTIONS,
        'arabCountries':sorted(ARAB_COUNTRIES),
        'questions':exported,
        'summary':{'questionCount':len(exported),'acceptedSourceCandidates':sum(len(x) for x in exported.values()),'skippedAmbiguous':skipped_ambiguous,'skippedAlreadyPresent':skipped_existing},
    }
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps(result['summary'],ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
