// Read-only checks of the published HTML, sitemap, robots and social images.
// Usage: node scripts/check-live.mjs [https://konaito.com]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'site.config.json'),'utf8'));
const base=new URL(process.argv[2]||config.siteUrl);base.pathname=base.pathname.replace(/\/?$/,'/');
const articles=JSON.parse(fs.readFileSync(path.join(root,'articles.json'),'utf8'));
const files=['index.html','sitemap.xml','robots.txt',...articles.filter(a=>!(config.externalOnlyArticles||[]).includes(a.id)).map(a=>`articles/${a.id}/index.html`),...['index',...articles.map(a=>a.id)].map(id=>`og/${id}.png`)];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const results=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor<files.length){
    const file=files[cursor++];
    const url=new URL(file.replace(/index\.html$/,''),base);
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,`${url}: status`);
    const bytes=Buffer.from(await response.arrayBuffer());
    const local=fs.readFileSync(path.join(root,'dist',file));
    assert.equal(sha(bytes),sha(local),`${url}: live content differs from this build`);
    const expectedType=file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.xml')?'xml':'text/plain';
    assert.ok(response.headers.get('content-type')?.includes(expectedType),`${url}: content type`);
    results.push({url:url.href,status:response.status,bytes:bytes.length,sha256:sha(bytes)});
  }
}));
const missingUrl=new URL('missing-page-verification-20261004/',base);
const missing=await fetch(missingUrl,{signal:AbortSignal.timeout(30000)});
assert.equal(missing.status,404,'Missing URL must return HTTP 404');
assert.match(await missing.text(),/<meta name="robots" content="noindex,follow">/,'Custom 404 is noindex');
console.log(JSON.stringify({checkedAt:new Date().toISOString(),verifiedFiles:results.length,missingPageStatus:missing.status,results:results.sort((a,b)=>a.url.localeCompare(b.url))},null,2));
