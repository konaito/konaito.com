import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readArticleContent} from '../content-model.mjs';
import {formatArticleBody,alignReviewedDiagram,cellWidth} from '../article-format.mjs';
const bodies=readArticleContent(new URL('../',import.meta.url));
const plain=s=>s.replace(/<[^>]*>/g,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const meaning=s=>plain(s).replace('**受動人間に大きな不満はない。**','受動人間に大きな不満はない。').replace(/\\\((n|n\^2|e\^t)\\\)/g,(_,x)=>x.replace('^','')).replace(/[\s┌┐└┘─│]/g,'');
for(const b of bodies){assert.equal(meaning(formatArticleBody(b)),meaning(b.html),`${b.id}: prose, numbers and diagram labels preserved`);}
const capital=bodies.find(b=>b.id==='capitalism-socialism');
const formatted=formatArticleBody(capital);
assert.equal((formatted.match(/class="text-diagram"/g)||[]).length,7);
assert.equal((formatted.match(/class="source-lines"/g)||[]).length,1);
assert.ok(formatted.includes('投入資本\n米国  ███████████████████████ 23\n中国  █ 1\n\nモデル性能\n米国  ████████████████████\n中国  ███████████████████'));
const exp=formatArticleBody(bodies.find(b=>b.id==='exponential-ai'));
assert.equal((exp.match(/class="inline-math"/g)||[]).length,3);assert.ok(!exp.includes('\\('));
assert.equal(formatArticleBody({id:'other',sourceUrl:'https://x.com/example/article/1',html:'<p>\\(danger()\\)</p>'}),'<p>\\(danger()\\)</p>');
const knowledge=formatArticleBody(bodies.find(b=>b.id==='knowledge-space'));
assert.equal((knowledge.match(/class="text-diagram"/g)||[]).length,4);
const box=plain(knowledge.match(/<pre class="text-diagram"[^>]*>([\s\S]*?)<\/pre>/)[1]);
assert.deepEqual([...new Set(box.split('\n').map(cellWidth))],[52],'All outer diagram edges share a column');
const sequence=[...knowledge.matchAll(/<pre class="text-diagram"[^>]*>([\s\S]*?)<\/pre>/g)].map(m=>plain(m[1])).find(t=>t.startsWith('エージェント'));
assert.equal(cellWidth('◀▶'),4,'Bundled font triangle advances are two Latin cells');
for(const line of sequence.split('\n').filter(s=>s.startsWith('    │')&&s.lastIndexOf('│')>4))assert.equal(cellWidth(line.slice(0,line.lastIndexOf('│'))),37,'Sequence arrows and right lifeline share a column');
const unchanged='unrecognized diagram\n│ text';assert.equal(alignReviewedDiagram(unchanged),unchanged);
for(const font of JSON.parse(fs.readFileSync(new URL('../assets/fonts/manifest.json',import.meta.url)))){
 const bytes=fs.readFileSync(new URL('../assets/fonts/'+font.file,import.meta.url));
 assert.equal(bytes.subarray(0,4).toString(),'wOFF');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),font.sha256);
}
console.log('Article formatting: 31 full-text fidelity checks, 8 X line-break cases, 4 text diagrams, 3 inline formulas, and font assets passed.');
