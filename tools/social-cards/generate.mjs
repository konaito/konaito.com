import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fitTitle, titlePhrases } from './layout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here,'../..');
const args=process.argv.slice(2);
function argument(name,fallback) { const i=args.indexOf(name); return i<0 ? fallback : args[i+1]; }
const articlesFile=path.resolve(argument('--articles',path.join(root,'articles.json')));
const configFile=path.resolve(argument('--config',path.join(root,'social-card-titles.json')));
const output=path.resolve(argument('--out',path.join(root,'assets/og')));
const fontRegular=argument('--font-regular',process.env.CARD_FONT_REGULAR || '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc');
const fontBold=argument('--font-bold',process.env.CARD_FONT_BOLD || '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc');
const fontFamily=argument('--font-family','Noto Sans CJK JP');
for (const font of [fontRegular,fontBold]) {
  if (!existsSync(font) || !GlobalFonts.registerFromPath(font)) throw new Error(`Required font unavailable: ${font}. See README.md for Noto font setup.`);
}
if (!GlobalFonts.has(fontFamily)) throw new Error(`Font family unavailable: ${fontFamily}`);
const articles=JSON.parse(await fs.readFile(articlesFile,'utf8'));
const config=JSON.parse(await fs.readFile(configFile,'utf8'));
const ids=new Set(articles.map(article=>article.id));
if (ids.size !== articles.length) throw new Error('Duplicate article IDs.');
for (const id of Object.keys(config)) if (!ids.has(id)) throw new Error(`Unknown card config key: ${id}`);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const measurement=createCanvas(1200,630).getContext('2d');
function measureAtSize(text,size) { measurement.font=`700 ${size}px "${fontFamily}"`; return measurement.measureText(text).width; }
const themes={society:'社会',work:'仕事',life:'暮らし',experiment:'技術・実験',technology:'技術'};
const manifest={version:1,width:1200,height:630,format:'png',font:{family:fontFamily,regularSha256:sha(readFileSync(fontRegular)),boldSha256:sha(readFileSync(fontBold))},articles:{}};
const phrases={};
await fs.mkdir(output,{recursive:true});

async function render({id,title,theme,earliestPublishedAt},override) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Unsafe article ID: ${id}`);
  const layout=fitTitle(title,measureAtSize,{override});
  const canvas=createCanvas(1200,630),ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1200,630);
  ctx.textBaseline='alphabetic';ctx.fillStyle='#656565';
  ctx.font=`400 27px "${fontFamily}"`;ctx.fillText('konaito.com',84,94);
  ctx.fillStyle='#242424';ctx.fillRect(84,126,1032,2);
  ctx.font=`700 ${layout.fontSize}px "${fontFamily}"`;
  // Noto CJK's Latin/Japanese glyphs fit in a 1em cap area. Reserve an entire
  // line box above/below the measured block, leaving generous crop-safe margins.
  const blockHeight=layout.lines.length*layout.lineHeight;
  const startBaseline=164 + (338-blockHeight)/2 + layout.fontSize;
  layout.lines.forEach((line,i)=>ctx.fillText(line,84,startBaseline+i*layout.lineHeight));
  ctx.fillStyle='#656565';ctx.font=`400 23px "${fontFamily}"`;
  ctx.fillText(id==='index' ? 'AI・社会・仕事・暮らし' : (themes[theme] || '記事'),84,560);
  if (earliestPublishedAt && /^\d{4}-\d{2}-\d{2}$/.test(earliestPublishedAt)) {
    ctx.textAlign='right';ctx.fillText(earliestPublishedAt.replaceAll('-','.'),1116,560);
  }
  const bytes=await canvas.encode('png');
  if (bytes.length >= 5_000_000) throw new Error(`Card exceeds conservative 5 MB budget: ${id}`);
  await fs.writeFile(path.join(output,`${id}.png`),bytes);
  return {title,lines:layout.lines,fontSize:layout.fontSize,lineHeight:layout.lineHeight,layoutSource:layout.source,emergencyBreaks:layout.emergencyBreaks,maxLineWidth:Math.max(...layout.lines.map(line=>measureAtSize(line,layout.fontSize))),bytes:bytes.length,sha256:sha(bytes),imageAlt:`${title} — konaito.com`};
}
for (const article of articles) {
  manifest.articles[article.id]=await render(article,config[article.id]);
  phrases[article.id]={title:article.title,phrases:titlePhrases(article.title)};
}
manifest.index=await render({id:'index',title:'konaitoの文章',theme:'society'},'konaitoの文章');
await fs.writeFile(path.join(root,'social-card-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(root,'title-phrases.json'),JSON.stringify(phrases,null,2)+'\n');
console.log(`Generated ${articles.length} article cards + index, 1200×630 PNG. No titles truncated.`);
console.log(`Output: ${output}`);
console.log(`Font sizes: ${Math.min(...Object.values(manifest.articles).map(a=>a.fontSize))}–${Math.max(...Object.values(manifest.articles).map(a=>a.fontSize))} px`);
