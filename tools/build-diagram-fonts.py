#!/usr/bin/env python3
"""Optional, offline asset regeneration. Requires fontTools and system Noto.
Normal site builds consume the checked-in WOFF files, with no font dependencies.
"""
from pathlib import Path
import hashlib, html, json, re
from fontTools import subset
from fontTools.ttLib import TTFont, TTCollection

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/fonts'; OUT.mkdir(exist_ok=True)
LATIN=Path('/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf')
CJK=Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
parts=[]
for file in (ROOT/'content').glob('*.json'):
 for article in json.loads(file.read_text()):
  if article['id'] in {'capitalism-socialism','knowledge-space'}:
   parts.extend(re.findall(r'<(?:pre|blockquote)\b[^>]*>(.*?)</(?:pre|blockquote)>',article['html'],re.S))
chars=set(html.unescape(re.sub('<[^>]*>','',''.join(parts))))
latin=TTFont(LATIN); jp=TTCollection(CJK).fonts[5]
latin_chars={chr(n) for n in range(32,127)}|{c for c in chars if ord(c) in latin.getBestCmap()}
jp_chars=chars-latin_chars
manifest=[]
for font,name,wanted,path in [(latin,'diagram-latin',latin_chars,LATIN),(jp,'diagram-japanese',jp_chars,CJK)]:
 options=subset.Options();options.flavor='woff';options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
 sub=subset.Subsetter(options=options);sub.populate(unicodes=[ord(c) for c in wanted]);sub.subset(font)
 # Subset names are intentionally distinct from the upstream font family.
 for record in font['name'].names:
  if record.nameID in {1,3,4,6,16,17}:
   value={'1':name,'3':name+' 1.0','4':name,'6':name,'16':name,'17':'Regular'}[str(record.nameID)]
   record.string=value.encode(record.getEncoding())
 font.flavor='woff';dest=OUT/(name+'.woff');font.save(dest)
 manifest.append({'file':dest.name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'source':path.name,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'unicodeRange':','.join('U+%X'%ord(c) for c in sorted(wanted))})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
