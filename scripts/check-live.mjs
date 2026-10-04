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
// Cloudflare's existing email protection encodes visible email text in transit.
// Normalize only that reversible transform; retain raw hashes in the report.
const normalizeEmailProtection=html=>html
  .replace(/<(a|span)\b[^>]*class="__cf_email__"[^>]*data-cfemail="([a-f0-9]+)"[^>]*>[\s\S]*?<\/\1>/gi,(_,tag,hex)=>{
    const bytes=Buffer.from(hex,'hex'), key=bytes[0];
    return Buffer.from(bytes.subarray(1).map(byte=>byte^key)).toString('utf8').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  })
  .replace(/<script data-cfasync="false" src="\/cdn-cgi\/scripts\/[a-f0-9]+\/cloudflare-static\/email-decode\.min\.js"><\/script>/g,'');
const results=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor<files.length){
    const file=files[cursor++];
    const url=new URL(file.replace(/index\.html$/,''),base);
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,`${url}: status`);
    const bytes=Buffer.from(await response.arrayBuffer());
    const local=fs.readFileSync(path.join(root,'dist',file));
    const compared=file.endsWith('.html')?Buffer.from(normalizeEmailProtection(bytes.toString('utf8'))):bytes;
    assert.equal(sha(compared),sha(local),`${url}: live content differs from this build`);
    const expectedType=file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.xml')?'xml':'text/plain';
    assert.ok(response.headers.get('content-type')?.includes(expectedType),`${url}: content type`);
    results.push({url:url.href,status:response.status,bytes:bytes.length,sha256:sha(bytes),comparison:sha(bytes)===sha(local)?'exact':'cloudflare-email-normalized'});
  }
}));
const missingUrl=new URL('missing-page-verification-20261004/',base);
const missing=await fetch(missingUrl,{signal:AbortSignal.timeout(30000)});
assert.equal(missing.status,404,'Missing URL must return HTTP 404');
assert.match(await missing.text(),/<meta name="robots" content="noindex,follow">/,'Custom 404 is noindex');
console.log(JSON.stringify({checkedAt:new Date().toISOString(),verifiedFiles:results.length,missingPageStatus:missing.status,results:results.sort((a,b)=>a.url.localeCompare(b.url))},null,2));
