import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root = new URL('../../../',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('social-card-manifest.json',root),'utf8'));

test('all 32 generated PNGs match their dimensions, manifests and conservative size budget',async()=>{
  const records={...manifest.articles,index:manifest.index};assert.equal(Object.keys(records).length,32);
  for (const [id,record] of Object.entries(records)) {
    const bytes=await fs.readFile(new URL(`assets/og/${id}.png`,root));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
    assert(bytes.length<5_000_000);assert.equal(record.bytes,bytes.length);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);
  }
});

test('actual rendered title ink stays inside all safe gutters with no edge clipping',async()=>{
  for (const id of [...Object.keys(manifest.articles),'index']) {
    const image=await loadImage(await fs.readFile(new URL(`assets/og/${id}.png`,root)));
    const canvas=createCanvas(1200,630),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,140,1200,380).data;
    let xMin=1200,xMax=0,yMin=630,yMax=0;
    for(let y=0;y<380;y++) for(let x=0;x<1200;x++) {
      const p=(y*1200+x)*4;
      if(data[p]<140&&data[p+1]<140&&data[p+2]<140) {xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);yMin=Math.min(yMin,y+140);yMax=Math.max(yMax,y+140);}
    }
    assert(xMin>=80&&xMax<1120&&yMin>=156&&yMax<505,`${id}: title ink at ${xMin},${yMin}–${xMax},${yMax}`);
    assert(xMax>xMin&&yMax>yMin,`${id}: missing title pixels`);
  }
});
