import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const listeners=()=>({listeners:{},addEventListener(type,handler){this.listeners[type]=handler;}});
const elements={};
const plot={...listeners(),contains:node=>points.includes(node)};
const chart={...listeners(),querySelector:selector=>elements[selector],querySelectorAll:()=>points,contains:node=>node===plot||node===tooltip||points.includes(node),getBoundingClientRect:()=>({left:0,top:0,width:356,height:275})};
const meta={textContent:''};const title={textContent:''};
const tooltip={hidden:true,style:{},offsetWidth:320,offsetHeight:95,querySelector:selector=>selector.endsWith('meta')?meta:title};
elements['.publication-plot']=plot;elements['.publication-tooltip']=tooltip;
const points=Array.from({length:3},(_,index)=>({
  dataset:{title:`作品${index+1}`,date:'2026-10-04',ordinal:String(index+1),genre:'人間と暮らし'},
  classList:{values:new Set(),add(value){this.values.add(value);},remove(value){this.values.delete(value);}},
  attributes:{},tabIndex:index===0?0:-1,
  setAttribute(key,value){this.attributes[key]=value;},
  closest:()=>points[index],matches:()=>false,
  getBoundingClientRect:()=>({left:318+index,top:155-index*6,width:24,height:24}),
  focus(){document.activeElement=this;}
}));
const select={...listeners()};const status={};
const document={...listeners(),activeElement:null,getElementById:id=>id==='theme-select'?select:status,querySelectorAll:()=>[],querySelector:()=>chart};
const window={...listeners()};
vm.runInNewContext(fs.readFileSync(new URL('../assets/script.js',import.meta.url),'utf8'),{document,window});
const pointer=(index,extra={})=>({clientX:330+index,clientY:167-index*6,pointerType:'mouse',target:points[index],detail:1,...extra});
// The centres are closer than the hit boxes: nearest-centre selection still reaches each one.
for(let index=0;index<points.length;index++){
  plot.listeners.pointermove(pointer(index));
  assert.equal(title.textContent,`作品${index+1}`);
}
assert.equal(tooltip.style.left,'28px','Long tooltips stay within narrow page bounds');
assert.ok(parseFloat(tooltip.style.top)>=0);
assert.ok(meta.textContent.includes('人間と暮らし'));
chart.listeners.pointerleave();assert.equal(tooltip.hidden,true);
plot.listeners.pointermove(pointer(0,{pointerType:'touch'}));assert.equal(tooltip.hidden,true);
plot.listeners.click(pointer(0));assert.equal(tooltip.hidden,false);
chart.listeners.pointerleave();assert.equal(tooltip.hidden,false,'Tapped tooltip stays open');
plot.listeners.click(pointer(0));assert.equal(tooltip.hidden,true,'Repeat tap closes');
plot.listeners.click(pointer(1));assert.equal(tooltip.hidden,false);
document.listeners.pointerdown({target:{}});assert.equal(tooltip.hidden,true,'Outside tap closes');
plot.listeners.click(pointer(2));document.listeners.keydown({key:'Escape'});assert.equal(tooltip.hidden,true,'Escape closes');
let prevented=false;
plot.listeners.keydown({target:points[0],key:'End',preventDefault(){prevented=true;}});
assert.equal(prevented,true);assert.equal(document.activeElement,points[2]);assert.equal(title.textContent,'作品3');
assert.deepEqual(points.map(point=>point.tabIndex),[-1,-1,0]);
plot.listeners.keydown({target:points[2],key:'ArrowLeft',preventDefault(){}});assert.equal(title.textContent,'作品2');
plot.listeners.focusout({relatedTarget:{}});assert.equal(tooltip.hidden,true);
console.log('Publication interactions: nearest-dot hover, touch/click persistence, repeat/outside/Escape dismissal, keyboard traversal, and narrow-tooltip positioning passed.');
