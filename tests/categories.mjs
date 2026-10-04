import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { prepareArticles, categoryNames } from '../article-model.mjs';
import { publicationGenres } from '../publication-chart.mjs';
const input=JSON.parse(fs.readFileSync(new URL('../articles.json',import.meta.url),'utf8'));
const articles=prepareArticles(input);
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const entries=[...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match=>match[0]);
const dots=[...html.matchAll(/<button\b[^>]*data-publication-point[^>]*>/g)].map(match=>match[0]);
assert.equal(entries.length,31);
assert.equal(dots.length,31);
for(const article of articles){
  const entry=entries.find(entry=>entry.includes(`id="${article.id}"`));
  const dot=dots.find(dot=>dot.includes(`data-article-id="${article.id}"`));
  assert.ok(entry.includes(`data-categories="${article.categories.join(' ')}"`));
  const labels=entry.match(/<p class="entry-categories"[^>]*>(.*?)<\/p>/)[1];
  for(const category of article.categories)assert.ok(labels.includes(categoryNames[category]));
  assert.ok(dot.includes(`data-primary-category="${article.primaryCategory}"`));
  assert.ok(dot.includes(`data-genre="${categoryNames[article.primaryCategory]}"`));
  assert.ok(dot.includes(`--publication-color:${publicationGenres[article.primaryCategory].color}`));
}
const mutate=fn=>{const data=structuredClone(input);fn(data);return data;};
assert.throws(()=>prepareArticles(mutate(rows=>rows[0].categories=[])),/Invalid categories/);
assert.throws(()=>prepareArticles(mutate(rows=>rows[0].categories=['unknown'])),/Invalid categories/);
assert.throws(()=>prepareArticles(mutate(rows=>rows[0].categories.push(rows[0].categories[0]))),/Invalid categories/);
assert.throws(()=>prepareArticles(mutate(rows=>rows[0].primaryCategory='missing')),/Primary category/);
// Exercise the production filtering listener with the same category data as the DOM.
const state={value:'all',selectedOptions:[{textContent:'すべて'}],addEventListener(type,listener){assert.equal(type,'change');this.change=listener;}};
const rows=articles.map(article=>({dataset:{categories:article.categories.join(' ')},hidden:false}));
const status={textContent:''};
const document={getElementById:id=>id==='theme-select'?state:status,querySelectorAll:selector=>{assert.equal(selector,'[data-categories]');return rows;},querySelector:()=>null};
vm.runInNewContext(fs.readFileSync(new URL('../assets/script.js',import.meta.url),'utf8'),{document});
for(const [category,label] of Object.entries(categoryNames)){
  state.value=category;state.selectedOptions[0].textContent=label;state.change();
  rows.forEach((row,index)=>assert.equal(!row.hidden,articles[index].categories.includes(category)));
  assert.equal(rows.filter(row=>!row.hidden).length,articles.filter(article=>article.categories.includes(category)).length);
}
state.value='all';state.selectedOptions[0].textContent='すべて';state.change();
assert.equal(rows.filter(row=>!row.hidden).length,31);
assert.ok(status.textContent.includes('31本'));
// Pastel fills stay light; their thin colored boundaries provide 3:1 contrast on white.
for(const genre of Object.values(publicationGenres)){
  const luminance=hex=>{
    const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  assert.ok(luminance(genre.color)>.35,'Category fills remain visibly pastel');
  assert.ok(1.05/(luminance(genre.outline)+.05)>=3,'Colored point boundaries retain contrast');
  assert.ok(html.includes(`--publication-outline:${genre.outline}`));
}
console.log('Categories: all 31 list labels and primary dot colors agree; every category filter and reset, validation errors, and color contrast passed.');
