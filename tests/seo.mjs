import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readArticleContent} from '../content-model.mjs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
export function validateSEO(){
  const config=JSON.parse(read('site.config.json'));
  const base=new URL(process.env.SITE_URL||config.siteUrl);base.pathname=base.pathname.replace(/\/?$/,'/');
  const articles=JSON.parse(read('articles.json'));
  const bodies=readArticleContent(new URL('../',import.meta.url));
  const readable=articles.filter(a=>!(config.externalOnlyArticles||[]).includes(a.id));
  const files=['index.html',...readable.map(a=>`articles/${a.id}/index.html`),'404.html'];
  const pages=new Map(files.map(file=>[file,read(`dist/${file}`)]));
  const canonicalSet=new Set();
  const titles=new Set();
  let localLinks=0,structuredDataBlocks=0;
  for(const [file,html] of pages){
    const is404=file==='404.html';
    assert.equal((html.match(/<h1\b/g)||[]).length,1,`${file}: single H1`);
    assert.match(html,/<html lang="ja">/);
    assert.match(html,/<meta charset="utf-8">/);
    assert.ok(!/{{[A-Z_]+}}/.test(html),`${file}: template tokens expanded`);
    const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title&&!titles.has(title),`${file}: unique title`);titles.add(title);
    assert.match(html,/<meta name="description" content="[^"]+">/);
    const robots=html.match(/<meta name="robots" content="([^"]+)">/)?.[1];
    assert.ok(robots?.startsWith(is404||!config.indexable?'noindex,follow':'index,follow'),`${file}: indexing policy`);
    const canonical=html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if(is404)assert.equal(canonical,undefined,'404 does not canonicalize to the homepage');
    else{
      const expected=new URL(file.replace(/index\.html$/,''),base).href;
      assert.equal(canonical,expected,`${file}: canonical`);
      assert.ok(!canonicalSet.has(canonical),'Unique canonical');canonicalSet.add(canonical);
      assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
      const imageUrl=html.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
      assert.ok(imageUrl,`${file}: social image exists`);
      assert.equal(html.match(/<meta name="twitter:image" content="([^"]+)">/)?.[1],imageUrl);
      assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
      const imagePath=new URL(imageUrl).pathname.slice(base.pathname.length);
      const png=fs.readFileSync(path.join(root,'dist',imagePath));
      assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
      assert.ok(!html.match(/<meta name="twitter:title" content="([^"]*)">/)?.[1].includes('\n'),'Card title metadata has no artificial newlines');
    }
    const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size,`${file}: unique IDs`);
    for(const match of html.matchAll(/href="([^"]+)"/g)){
      const href=decode(match[1]);
      const pageUrl=new URL(file,base);
      const url=new URL(href,pageUrl);
      if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))continue;
      let relative=url.pathname.slice(base.pathname.length);
      if(!relative || relative.endsWith('/'))relative+='index.html';
      assert.ok(fs.existsSync(path.join(root,'dist',relative)),`${file}: local destination exists: ${href}`);
      if(url.hash&&relative.endsWith('.html')){
        const target=read(`dist/${relative}`);
        assert.ok(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`${file}: anchor exists: ${href}`);
      }
      localLinks++;
    }
    for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
      const data=JSON.parse(match[1]);assert.equal(data['@context'],'https://schema.org');structuredDataBlocks++;
      if(file.startsWith('articles/')){
        const article=data['@graph'].find(x=>x['@type']==='Article');assert.ok(article);
        const id=file.split('/')[1],body=bodies.find(b=>b.id===id);
        assert.equal(article.isBasedOn,body.sourceUrl);
        assert.equal(article.datePublished,config.articlePublicationDate,'On-site publication is distinct from the original source date');
        assert.ok(article.citation.length>0);assert.equal(article.author['@id'],new URL('#author',base).href);
      }
    }
    assert.ok(!/<(?:iframe|form)\b/i.test(html),`${file}: no third-party embeds or trackers`);
    assert.ok(!/\son[a-z]+\s*=/i.test(html),`${file}: no inline event handlers`);
    assert.ok(!/(?:href|src)="\s*(?:javascript|vbscript):/i.test(html),`${file}: safe URLs`);
  }
  for(const article of readable){
    const body=bodies.find(b=>b.id===article.id);assert.ok(body?.html&&body.textLength>0,'Full article content present');
    const html=pages.get(`articles/${article.id}/index.html`);
    assert.ok(!/<(?:script|style|iframe|form|svg)\b/i.test(body.html),`${article.id}: body has no executable or embedded markup`);
    assert.ok(html.includes(`<div class="article-body">${body.html}</div>`),`${article.id}: complete body rendered without truncation`);
    for(const heading of body.toc||[])assert.ok(body.html.includes(`id="${heading.id}"`),`${article.id}: TOC heading ID exists`);
    assert.ok(pages.get('index.html').includes(`href="${new URL(`articles/${article.id}/`,base).pathname}"`),'Home links to every article');
  }
  for(const id of config.externalOnlyArticles||[]){
    assert.ok(!bodies.some(b=>b.id===id),'External-only body is absent from public content data');
    assert.ok(!fs.existsSync(path.join(root,'dist','articles',id)),'External-only article has no local reader page');
    assert.ok(pages.get('index.html').includes(articles.find(a=>a.id===id).primarySourceUrl),'Original external entry is retained');
  }
  const sitemap=read('dist/sitemap.xml');
  const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));
  assert.equal(new Set(locations).size,locations.length,'No duplicate sitemap URL');
  assert.deepEqual([...locations].sort(),config.indexable?[...canonicalSet].sort():[],'Sitemap contains exactly indexable canonical pages');
  assert.ok(!sitemap.includes('<lastmod>'),'No artificial date freshness');
  const robots=read('dist/robots.txt');
  assert.ok(robots.includes('Allow: /'),'Crawlers can read index/noindex metadata');
  assert.equal(robots.includes(`Sitemap: ${new URL('sitemap.xml',base).href}`),config.indexable);
  console.log(JSON.stringify({staticArticlePages:readable.length,canonicalPages:canonicalSet.size,localLinksVerified:localLinks,structuredDataBlocks,sitemapURLs:locations.length,completeBodiesPreserved:true,noTrackingEmbeds:true},null,2));
}
