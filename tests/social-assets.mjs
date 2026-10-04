import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url));
export function validateSocialAssets(){
  const articles=JSON.parse(read('articles.json'));
  const config=JSON.parse(read('social-card-titles.json'));
  const manifest=JSON.parse(read('social-card-manifest.json'));
  const records={...manifest.articles,index:manifest.index};
  assert.deepEqual(Object.keys(manifest.articles).sort(),articles.map(a=>a.id).sort());
  assert.ok(Object.keys(config).every(id=>articles.some(a=>a.id===id)),'Card overrides use known article IDs');
  for(const a of articles){
    const record=records[a.id];assert.equal(record.title,a.title,'Card was generated for current article title');
    if(Object.hasOwn(config,a.id)){
      assert.equal(typeof config[a.id],'string');
      const lines=config[a.id].replace(/<br\s*\/?\s*>/gi,'\n').replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[\t ]+/g,' ').trim());
      assert.deepEqual(record.lines,lines,`${a.id}: regenerate cards after editing manual line breaks`);
      assert.equal(record.layoutSource,'manual');
    }else assert.ok(['budoux','budoux-emergency'].includes(record.layoutSource),`${a.id}: regenerate cards after removing manual line breaks`);
  }
  for(const [id,record] of Object.entries(records)){
    const bytes=read(`assets/og/${id}.png`);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
    assert.equal(bytes.length,record.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,`${id}: image matches generated manifest`);
  }
  console.log(`Verified ${Object.keys(records).length} social card images, titles, hashes, and manual line breaks.`);
}
