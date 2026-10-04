import fs from 'node:fs';
import {prepareArticles, platformOrder} from './article-model.mjs';
const input=JSON.parse(fs.readFileSync(new URL('./articles.json',import.meta.url),'utf8'));
const articles=prepareArticles(input);
const urls=articles.flatMap(article=>article.sources.map(source=>source.url));
const baselinePath=process.argv[2];
if (baselinePath) {
  const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
  const missing=baseline.map(article=>article.url).filter(url=>!urls.includes(url));
  if (missing.length) throw new Error(`Previously covered sources were omitted: ${missing.join(', ')}`);
}
const coveragePath=new URL('./source-coverage.json',import.meta.url);
let auditedSourceCoverage=false;
if (fs.existsSync(coveragePath)) {
  const coverage=JSON.parse(fs.readFileSync(coveragePath,'utf8'));
  if (articles.length!==coverage.expectedWorks || urls.length!==coverage.expectedSources) throw new Error('Audited work/source count mismatch');
  if (new Set(coverage.urls).size!==coverage.urls.length) throw new Error('Audited source list contains duplicates');
  if (coverage.urls.length!==urls.length || coverage.urls.some(url=>!urls.includes(url)) || urls.some(url=>!coverage.urls.includes(url))) throw new Error('Audited source coverage mismatch');
  if (articles.some(article=>article.sources.some(source=>source.publishedAtVerified!==true || !source.publishedTimestamp))) throw new Error('Final audited sources require verified absolute publication timestamps');
  for (const source of articles.flatMap(article=>article.sources)) {
    if (Date.parse(source.publishedTimestamp)!==Date.parse(coverage.publishedTimestamps[source.url])) throw new Error(`Publication timestamp differs from the verified source audit: ${source.url}`);
  }
  auditedSourceCoverage=true;
}
const html=fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
if (new Set(ids).size!==ids.length) throw new Error('Duplicate DOM IDs');
const anchors=[...html.matchAll(/href="#([^"]+)"/g)].map(match=>match[1]);
if(anchors.some(id=>!ids.includes(id))) throw new Error('Broken internal anchor');
const entries=[...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match=>match[0]);
if(entries.length!==articles.length) throw new Error('Content entry count mismatch');
articles.forEach((article,i)=>{
  const entry=entries[i];
  if(!entry.includes(`datetime="${article.earliestPublishedAt}"`)) throw new Error(`Rendered earliest date mismatch: ${article.id}`);
  let last=-1;
  for (const source of article.sources) {
    const marker=`class="source-link" href="${source.url.replaceAll('&','&amp;')}"`;
    const index=entry.indexOf(marker);
    if(index<0||index<last) throw new Error(`Missing or misordered source: ${article.id}`);
    last=index;
  }
});
console.log(JSON.stringify({contentEntries:articles.length,sourceLinks:urls.length,multipleSourceEntries:articles.filter(a=>a.sources.length>1).length,sourceOrder:platformOrder,displayTimezone:'Asia/Tokyo',earliestVerifiedDates:true,noDuplicateSourceURLs:true,previousCoveragePreserved:!!baselinePath,auditedSourceCoverage,renderedLinksAndDates:true,validAnchorsAndIds:true},null,2));

const {validateSEO}=await import('./tests/seo.mjs');
validateSEO();
await import('./tests/model.mjs');
const {validateSocialAssets}=await import('./tests/social-assets.mjs');
validateSocialAssets();
