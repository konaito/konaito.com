import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { normalizeTitle, assertSameTitle, titlePhrases, balancedWrap, fitTitle, validBoundary } from '../layout.mjs';

GlobalFonts.registerFromPath(process.env.CARD_FONT_BOLD || '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc');
const ctx=createCanvas(1200,630).getContext('2d');
const measure=(text,size)=>{ctx.font=`700 ${size}px "Noto Sans CJK JP"`;return ctx.measureText(text).width;};
const compact=text=>text.replace(/\s/gu,'');
const articles=JSON.parse(fs.readFileSync(new URL('../../../articles.json',import.meta.url)));
const overrides=JSON.parse(fs.readFileSync(new URL('../../../social-card-titles.json',import.meta.url)));

function checkLayout(title,layout,width=1032,height=338) {
  assert.equal(compact(layout.lines.join('')),compact(title),'the entire title must be retained');
  assert(layout.lines.length>0);
  assert(layout.lines.every(line=>measure(line,layout.fontSize)<=width+.1),'all lines fit');
  assert(layout.lines.length*layout.lineHeight<=height+.1,'all line boxes fit');
}

test('normalizes newline, CRLF, and all supported <br> spellings',()=>{
  assert.deepEqual(normalizeTitle('一行\r\n二行<br>三行<BR />四行<br/>五行'),['一行','二行','三行','四行','五行']);
});
test('rejects unrecognized markup and invalid blank lines',()=>{
  for(const value of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','a\n\nb','a<br class=x>b','']) assert.throws(()=>normalizeTitle(value));
  assert.deepEqual(normalizeTitle('A < B & C > D'),['A < B & C > D']);
});
test('manual config cannot change or truncate a title',()=>{
  assert.doesNotThrow(()=>assertSameTitle('AIを考える。人間を考える。','AIを考える。<br>人間を考える。'));
  assert.throws(()=>assertSameTitle('AIを考える。人間を考える。','AIを考える。'));
  assert.throws(()=>assertSameTitle('AIを考える。','AIを考える'));
});
test('manual hard breaks have priority over automatic wrapping',()=>{
  const title='AIは資本主義と社会主義の勝敗を決めるのか';
  const result=fitTitle(title,measure,{override:'AIは資本主義と<br>社会主義の勝敗を決めるのか'});
  assert.deepEqual(result.lines,['AIは資本主義と','社会主義の勝敗を決めるのか']);
  assert.equal(result.source,'manual');checkLayout(title,result);
});
test('impossible manual lines produce an actionable error instead of clipping or shortening',()=>{
  assert.throws(()=>fitTitle('非常に長いタイトル'.repeat(40),measure,{override:'非常に長いタイトル'.repeat(40)}),/Nothing was truncated/);
});
test('Japanese boundaries avoid starting with closing punctuation or ending with an opening bracket',()=>{
  assert.equal(validBoundary('見る','」と考える'),false);
  assert.equal(validBoundary('私たちは「','見る'),false);
  assert.equal(validBoundary('見る」','と考える'),true);
  const title='「考える」なんてAIにやらせろ、人間の仕事は「見る」ことだ';
  const result=fitTitle(title,measure);checkLayout(title,result);
  result.lines.slice(0,-1).forEach((line,i)=>assert(validBoundary(line,result.lines[i+1])));
});
test('mixed Japanese, Latin, accents and parentheses retain text without Latin token splits',()=>{
  const title='もし『Pokémon Trading Card Game Pocket（ポケポケ）』がオンチェーン化されたら？';
  const result=fitTitle(title,measure);checkLayout(title,result);
  assert.equal(result.emergencyBreaks,0);
  assert(result.lines.some(line=>line.includes('Pokémon')));
  assert(result.lines.some(line=>line.includes('Pocket')));
});
test('narrow layout preserves content and uses semantic boundaries when available',()=>{
  const title='AIが変える社会と人間の仕事を考える';
  const result=fitTitle(title,measure,{maxWidth:240,maxHeight:220,minSize:16,maxSize:24,maxLines:7});
  checkLayout(title,result,240,220);assert.equal(result.emergencyBreaks,0);
});
test('overlong Latin tokens fall back without dropping graphemes',()=>{
  const title='Supercalifragilisticexpialidocious';
  const result=fitTitle(title,measure,{maxWidth:160,maxHeight:200,minSize:16,maxSize:24,maxLines:7});
  checkLayout(title,result,160,200);assert(result.emergencyBreaks>0);
});
test('very long unfit titles fail rather than ellipsize',()=>{
  assert.throws(()=>fitTitle('長い日本語タイトル'.repeat(60),measure),/Nothing was truncated/);
});
test('balanced wrapping produces more even widths than greedy packing',()=>{
  const result=balancedWrap('今日は良い天気なので公園へ散歩に行こう',text=>measure(text,40),340,3);
  assert(result);assert.equal(compact(result.lines.join('')),compact('今日は良い天気なので公園へ散歩に行こう'));
  assert(result.lines.every(line=>measure(line,40)<=340));
});
test('BudouX phrase map reproduces original accessible title exactly',()=>{
  for(const article of articles) assert.equal(titlePhrases(article.title).join(''),article.title);
});
test('all 31 configured cards preserve manual breaks, fit, and stay comfortably readable',()=>{
  assert.equal(articles.length,31);assert.equal(Object.keys(overrides).length,31);
  for(const article of articles) {
    const result=fitTitle(article.title,measure,{override:overrides[article.id]});
    checkLayout(article.title,result);assert.equal(result.source,'manual');assert(result.fontSize>=53);
    assert.deepEqual(result.lines,normalizeTitle(overrides[article.id]));
  }
});
test('all 31 titles also have a non-truncating automatic fallback',()=>{
  for(const article of articles) checkLayout(article.title,fitTitle(article.title,measure));
});
