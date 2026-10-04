import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareArticles } from './article-model.mjs';
import { readArticleContent } from './content-model.mjs';
import { formatArticleBody } from './article-format.mjs';
import { renderPublicationChart } from './publication-chart.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const config=JSON.parse(read('site.config.json'));
if(!/^\d{4}-\d{2}-\d{2}$/.test(config.articlePublicationDate) || Number.isNaN(Date.parse(config.articlePublicationDate))) throw new Error('articlePublicationDate must be the actual on-site publication date.');
const base=new URL(process.env.SITE_URL || config.siteUrl);
if(base.protocol!=='https:' || base.pathname!=='/' || base.search || base.hash || base.username || base.password) throw new Error('SITE_URL must be an HTTPS origin without a path, query, fragment, or credentials.');
base.pathname=base.pathname.replace(/\/?$/,'/');
const siteUrl=base.href;
const absolute=relative=>new URL(relative,siteUrl).href;
const local=relative=>new URL(relative,siteUrl).pathname;
const assetVersion=relative=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets',relative))).digest('hex').slice(0,12);
const assetURL=relative=>`${absolute(relative)}?v=${assetVersion(relative)}`;
const assetPath=relative=>`${local(relative)}?v=${assetVersion(relative)}`;
const articles=prepareArticles(JSON.parse(read('articles.json')));
const byId=new Map(articles.map(a=>[a.id,a]));
const externalOnly=new Set(config.externalOnlyArticles||[]);
if([...externalOnly].some(id=>!byId.has(id)))throw new Error('Unknown external-only article.');
const readableArticles=articles.filter(a=>!externalOnly.has(a.id));
const bodies=readArticleContent(new URL('./',import.meta.url));
const bodyById=new Map(bodies.map(body=>[body.id,body]));
if(bodies.length!==readableArticles.length || bodyById.size!==readableArticles.length || bodies.some(body=>externalOnly.has(body.id))) throw new Error('Full text is required for each enabled reader, and external-only content must not be included.');
for(const a of readableArticles){
  const body=bodyById.get(a.id);
  if(!body || !body.html || !body.textLength || !a.sources.some(source=>source.url===body.sourceUrl)) throw new Error(`Missing verified full text: ${a.id}`);
  if(body.sourceUrl!==a.sources[0].url) throw new Error(`Body must use preferred source order note, X, Qiita: ${a.id}`);
}
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>x.replaceAll('-','.');
const titlePhrases=JSON.parse(read('title-phrases.json'));
const titleHTML=a=>{
  const entry=titlePhrases[a.id];
  if(!entry || entry.title!==a.title || entry.phrases.join('')!==a.title) throw new Error(`Stale Japanese title phrases: ${a.id}`);
  return entry.phrases.map(esc).join('<wbr>');
};
const articlePath=id=>`articles/${id}/`;
const articleHref=a=>bodyById.has(a.id)?local(articlePath(a.id)):a.primarySourceUrl;
const themeNames={work:'AIと仕事',life:'人間と暮らし',society:'社会と未来',experiment:'技術を試す'};
const person={'@type':'Person','@id':absolute('#author'),name:'内藤剛汰',alternateName:'konaito',url:'https://konaito.github.io/',sameAs:['https://github.com/konaito','https://note.com/konaito','https://x.com/konaito_copilot','https://qiita.com/konaito']};
const website={'@type':'WebSite','@id':absolute('#website'),url:siteUrl,name:'konaito',alternateName:'konaito — 文章と記録',inLanguage:'ja',publisher:{'@id':person['@id']}};
const rows=articles.map(a=>{
  const sourceLinks=a.sources.map(source=>`<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"${source.publishedAtVerified?` title="公開日：${esc(date(source.publishedAt))}（日本時間）"`:''} aria-label="${esc(a.title)}を${esc(source.label||source.platform)}で読む">${esc(source.label||source.platform)}</a>`).join('<span class="source-divider" aria-hidden="true">/</span>');
  return `<article class="article-entry" id="${esc(a.id)}" data-theme="${esc(a.theme)}"><time datetime="${esc(a.earliestPublishedAt)}" title="最初の公開日（日本時間）">${esc(date(a.earliestPublishedAt))}</time><div class="entry-content"><h2 class="balanced-title"><a href="${esc(articleHref(a))}">${titleHTML(a)}</a></h2><p>${esc(a.summary)}</p><div class="source-links" aria-label="掲載元"><span class="source-caption">掲載元${a.sources.length>1?`（${a.sources.length}）`:''}</span>${sourceLinks}</div></div></article>`;
}).join('\n');
const template=read('template.html');
function render({title,description,relative='',content,graph=[],notFound=false,script=false,imageId='index',imageAlt='konaito — 文章と記録'}){
  const canonical=absolute(relative);
  const imagePath=`og/${imageId}.png`;
  const imageExists=fs.existsSync(path.join(root,'assets',imagePath));
  if(!imageExists&&!notFound)throw new Error(`Missing social card: ${imagePath}`);
  const socialImage=imageExists?`<meta property="og:image" content="${assetURL(imagePath)}">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta property="og:image:alt" content="${esc(imageAlt)}">\n  <meta name="twitter:image" content="${assetURL(imagePath)}">\n  <meta name="twitter:image:alt" content="${esc(imageAlt)}">`:'';
  const values={SOCIAL_IMAGE:socialImage,TWITTER_CARD:imageExists?'summary_large_image':'summary',PAGE_TITLE:esc(title),DESCRIPTION:esc(description),ROBOTS:notFound||!config.indexable?'noindex,follow':'index,follow,max-image-preview:large',CANONICAL_URL:esc(canonical),CANONICAL_TAG:notFound?'':`<link rel="canonical" href="${esc(canonical)}">`,STYLE_URL:esc(assetPath('style.css')),HOME_PATH:esc(local('')),MAIN_CONTENT:content,PAGE_SCRIPT:script?`<script src="${assetPath('script.js')}" defer></script>`:'',STRUCTURED_DATA:graph.length?`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')}</script>`:''};
  // One pass prevents article text from being interpreted as template syntax.
  return template.replace(/{{([A-Z_]+)}}/g,(_,key)=>{if(!(key in values))throw new Error(`Unknown template token ${key}`);return values[key];});
}
const title='konaito | AI・仕事・暮らしの文章と技術の記録';
const description='内藤剛汰（konaito）がnote・X・Qiitaに掲載した文章の一覧。AIと仕事、人間と暮らし、社会と未来、技術の実験をテーマに、紹介文・初回公開日・各掲載元をまとめています。';
const homeContent=read('template-index.html').replace('<!--PUBLICATION_CHART-->',renderPublicationChart(articles)).replace('<!--ARTICLE_CARDS-->',rows).replaceAll('{{HOME_PATH}}',esc(local('')));
const homeGraph=[person,website,{'@type':'CollectionPage','@id':absolute('#page'),url:siteUrl,name:title,description,inLanguage:'ja',isPartOf:{'@id':website['@id']},about:{'@id':person['@id']},mainEntity:{'@type':'ItemList',numberOfItems:articles.length,itemListElement:articles.map((a,i)=>({'@type':'ListItem',position:i+1,name:a.title,url:bodyById.has(a.id)?absolute(articlePath(a.id)):a.primarySourceUrl}))}}];
const pages=[{relative:'',html:render({title,description,content:homeContent,graph:homeGraph,script:true})}];
for(const a of readableArticles){
  const body=bodyById.get(a.id);
  const relative=articlePath(a.id);
  const pageTitle=`${a.title} | konaito`;
  const description=a.summary;
  const sourceList=a.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.label||s.platform)}の掲載版</a><span>公開：<time datetime="${esc(s.publishedTimestamp)}">${date(s.publishedAt)}</time>（日本時間）</span></li>`).join('');
  const relatedArticles=readableArticles.filter(other=>other.id!==a.id && other.theme===a.theme).slice(0,3);
  const related=relatedArticles.map(target=>`<li><a href="${esc(local(articlePath(target.id)))}">${esc(target.title)}</a><p>${esc(target.summary)}</p></li>`).join('');
  const toc=body.toc?.length?`<details class="table-of-contents"><summary>目次</summary><ol>${body.toc.filter(h=>h.level<=3).map(h=>`<li class="toc-level-${h.level}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('')}</ol></details>`:'';
  const source=body.sourceUrl;
  const preferredPlatform=a.sources.find(s=>s.url===source).platform;
  const content=`<nav class="breadcrumbs" aria-label="パンくず"><a href="${local('')}">記事一覧</a><span aria-hidden="true"> / </span><span>${themeNames[a.theme]}</span></nav>
<article class="reading-page"><header class="article-header"><p class="eyebrow">${themeNames[a.theme]}</p><h1 class="balanced-title">${titleHTML(a)}</h1><p class="publication"><a href="https://konaito.github.io/" rel="author">konaito</a><span aria-hidden="true"> · </span>初出 <time datetime="${a.earliestPublishedAt}">${date(a.earliestPublishedAt)}</time></p><p class="source-edition"><a href="${esc(source)}">${preferredPlatform}掲載版</a>の本文を収録</p></header>
${toc}<div class="article-body">${formatArticleBody(body)}</div>
<section class="article-provenance" aria-labelledby="sources"><h2 id="sources">掲載元</h2><ul class="publication-sources">${sourceList}</ul><p class="summary-note">初出・各掲載版の日付は日本時間です。このサイトへの本文掲載：<time datetime="${esc(config.articlePublicationDate)}">${date(config.articlePublicationDate)}</time>。本文は取得時点の掲載版です。原文の段落・見出しをもとに表示し、外部プレーヤーなどの埋め込みは掲載元へのリンクで案内しています。</p></section>
<section class="related-section" aria-labelledby="related"><h2 id="related">あわせて読む</h2><ul class="related-reading">${related}</ul></section><p class="back-link"><a href="${local('')}#${a.id}">記事一覧に戻る</a><a href="#top">先頭へ戻る</a></p></article>`;
  const graph=[person,website,{'@type':'WebPage','@id':absolute(relative)+'#page',url:absolute(relative),name:pageTitle,description,inLanguage:'ja',isPartOf:{'@id':website['@id']},mainEntity:{'@id':absolute(relative)+'#article'},breadcrumb:{'@id':absolute(relative)+'#breadcrumb'}},{'@type':'Article','@id':absolute(relative)+'#article',headline:a.title,description,inLanguage:'ja',mainEntityOfPage:{'@id':absolute(relative)+'#page'},author:{'@id':person['@id']},publisher:{'@id':person['@id']},datePublished:config.articlePublicationDate,isBasedOn:source,citation:a.sources.map(s=>s.url),...(fs.existsSync(path.join(root,'assets',`og/${a.id}.png`))?{image:[assetURL(`og/${a.id}.png`)]}:{})},{'@type':'BreadcrumbList','@id':absolute(relative)+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'記事一覧',item:siteUrl},{'@type':'ListItem',position:2,name:a.title,item:absolute(relative)}]}];
  pages.push({relative,html:render({title:pageTitle,description,relative,content,graph,imageId:a.id,imageAlt:a.title})});
}
const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
if(fs.existsSync(path.join(root,'assets','og')))fs.cpSync(path.join(root,'assets','og'),path.join(dist,'og'),{recursive:true});
if(fs.existsSync(path.join(root,'assets','media')))fs.cpSync(path.join(root,'assets','media'),path.join(dist,'media'),{recursive:true});
for(const name of ['style.css','script.js'])fs.copyFileSync(path.join(root,'assets',name),path.join(dist,name));
fs.cpSync(path.join(root,'assets/fonts'),path.join(dist,'fonts'),{recursive:true});
for(const page of pages){const target=path.join(dist,page.relative,'index.html');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,page.html);}
fs.writeFileSync(path.join(dist,'.nojekyll'),'');
fs.writeFileSync(path.join(dist,'404.html'),render({title:'ページが見つかりません | konaito',description:'指定されたページは見つかりませんでした。記事一覧から文章を探せます。',relative:'404.html',notFound:true,content:`<section class="reading-page"><h1>ページが見つかりません</h1><p>URLが変わったか、存在しないページです。</p><p class="back-link"><a href="${local('')}">記事一覧へ戻る</a></p></section>`}));
// Allow crawling even in noindex mode so crawlers can read the robots meta tag.
fs.writeFileSync(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\n${config.indexable?`\nSitemap: ${absolute('sitemap.xml')}\n`:''}`);
fs.writeFileSync(path.join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${config.indexable?pages.map(p=>`  <url><loc>${esc(absolute(p.relative))}</loc></url>`).join('\n'):''}\n</urlset>\n`);
console.log(`Built ${articles.length} articles, ${readableArticles.length} full article pages, and ${config.indexable?pages.length:0} indexable pages.`);
