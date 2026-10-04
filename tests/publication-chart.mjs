import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicationSeries, renderPublicationChart } from '../publication-chart.mjs';
const input=JSON.parse(fs.readFileSync(new URL('../articles.json',import.meta.url),'utf8'));
const series=publicationSeries(input);
assert.equal(series.length,31);
assert.equal(new Set(series.map(point=>point.id)).size,31);
assert.equal(series[0].id,'build-working-app');
assert.equal(series.at(-1).id,'capitalism-socialism');
assert.equal(series.at(-1).ordinal,31);
assert.equal(series.find(point=>point.id==='last-effort').date,'2026-03-11');
for(const [index,point] of series.entries()){
  const article=input.find(article=>article.id===point.id);
  assert.equal(point.timestamp,Math.min(...article.sources.map(source=>Date.parse(source.publishedTimestamp))));
  assert.equal(point.ordinal,index+1);
  if(index)assert.ok(point.timestamp>=series[index-1].timestamp);
}
assert.ok(series.find(point=>point.id==='exchange').ordinal<series.find(point=>point.id==='communication-redefined').ordinal,'Same-day order uses the exact instant');
assert.ok(series.some(point=>point.id==='genius-hermit-original')&&series.some(point=>point.id==='genius-hermit'),'Same-platform editions remain distinct');
const html=renderPublicationChart(input);
const rendered=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert.ok(rendered.includes(html));
assert.equal([...html.matchAll(/data-publication-point\b/g)].length,31);
assert.equal([...html.matchAll(/tabindex="0"/g)].length,1);
assert.ok(html.includes('role="tooltip" hidden'));
const coordinates=[...html.matchAll(/style="left:([\d.]+)%;top:([\d.]+)%" data-publication-point/g)].map(match=>[Number(match[1]),Number(match[2])]);
assert.equal(coordinates.length,31);
for(const [index,[x,y]] of coordinates.entries()){
  assert.ok(Math.abs(x-(series[index].timestamp-series[0].timestamp)/(series.at(-1).timestamp-series[0].timestamp)*100)<.000001,'Horizontal position is proportional to elapsed time');
  assert.ok(Math.abs(y-(100-(index+1)/35*100))<.000001,'Vertical position is the ordinal');
}
const sample=(id,date)=>({id,title:'<script> & "quoted"',sources:[{publishedAtVerified:true,publishedTimestamp:date}]});
const ties=[sample('z','2026-01-01T00:00:00Z'),sample('a','2026-01-01T00:00:00Z')];
assert.deepEqual(publicationSeries(ties).map(point=>point.id),['a','z']);
assert.deepEqual(publicationSeries(ties.reverse()).map(point=>point.id),['a','z']);
assert.ok(!renderPublicationChart(ties).includes('<script>'));
assert.ok(renderPublicationChart(ties).includes('&lt;script&gt;'));
assert.equal(renderPublicationChart([]),'');
assert.ok(!renderPublicationChart([sample('one','2026-01-01T00:00:00Z')]).includes('NaN'));
assert.throws(()=>publicationSeries([{id:'missing',sources:[]}]),/verified absolute timestamps/);
assert.throws(()=>publicationSeries([sample('bad','2026-01-01')]),/verified absolute timestamps/);
console.log('Publication chart: 31 verified chronological points, real-time spacing, exact timestamp ties, safe markup, and keyboard entry passed.');
