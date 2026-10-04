// Presentation repairs only. The verified imported HTML remains unchanged on disk.
// Never infer numbers, rewrite prose, or parse arbitrary math/HTML here.
import {createHash} from 'node:crypto';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const decode=s=>s.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
export const cellWidth=s=>[...s].reduce((n,c)=>n+(/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60\uffe0-\uffe6]/u.test(c)?2:1),0);
const pad=(s,n)=>s+' '.repeat(Math.max(0,n-cellWidth(s)));

export function alignReviewedDiagram(text){
  const hash=createHash('sha256').update(text).digest('hex');
  if(hash==='cd5f8b52bf2e7ff4d20249fe58e211e360baec8872d3a8fc52c5281d0cc6d837'){
    const edge='─'.repeat(50), inner='─'.repeat(26);
    const row=s=>'│'+pad(s,50)+'│';
    return ['┌'+edge+'┐',row('  コンテキストウィンドウ'),row(''),row('  ┌'+inner+'┐'),row('  │'+pad(' INDEX.md (~数百トークン)',26)+'│ ← 常にロード'),row('  │'+pad(' タイトル | 要約 | タグ',26)+'│'),row('  └'+inner+'┘'),row('           │'),row('           │ 関連記事のみ選択的にロード'),row('           ▼'),row('  ┌'+inner+'┐'),row('  │'+pad(' article-a.md',26)+'│ ← 必要な時だけ'),row('  └'+inner+'┘'),row(''),row('  残りのコンテキスト → 実際のタスクに使える'),'└'+edge+'┘'].join('\n');
  }
  if(hash==='ec0e4375091bcdc4dbff8c7f3b8fc8e22bb6d0a111de40b495b040b3bd42f441'){
    return text.split('\n').map((line,i)=>{
      if(i===0)return pad('エージェント',30)+'Perplexity API';
      if(!line.startsWith('    │'))return line;
      const right=line.lastIndexOf('│');
      if(right===4)return line;
      const middle=line.slice(5,right);
      return '    │'+pad(middle.trimEnd(),31)+'│'+line.slice(right+1);
    }).join('\n');
  }
  return text;
}

export function formatArticleBody(body){
  let html=body.html;
  if(body.id==='friction')html=html.replace('**受動人間に大きな不満はない。**','<strong>受動人間に大きな不満はない。</strong>');
  if(new URL(body.sourceUrl).hostname==='x.com'){
    html=html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g,(whole,inside)=>{
      // X long-form stores intentional line breaks inside text nodes, not <br>.
      if(!inside.includes('\n')||/<(?:a|img|pre)\b/.test(inside))return whole;
      const text=decode(inside.replace(/<[^>]*>/g,''));
      if(/[█]/.test(text)||/^\s*↓\s*$/m.test(text))return `<blockquote class="diagram-quote"><pre class="text-diagram" tabindex="0" aria-label="原文の文字図">${escape(text)}</pre></blockquote>`;
      return `<blockquote class="source-lines">${inside}</blockquote>`;
    });
    // Only the three simple, source-confirmed formulas in this article.
    if(body.id==='exponential-ai')html=html.replace(/\\\((n|n\^2|e\^t)\\\)/g,(_,formula)=>{
      const [base,power]=formula.split('^');
      return `<span class="inline-math"><i>${base}</i>${power?`<sup>${power==='t'?'<i>t</i>':power}</sup>`:''}</span>`;
    });
  }
  if(body.id==='knowledge-space')html=html.replace(/<pre>([\s\S]*?)<\/pre>/g,(whole,inside)=>{
    const text=decode(inside.replace(/<[^>]*>/g,''));
    if(!/[┌│├└]/.test(text))return whole;
    return `<pre class="text-diagram" tabindex="0" aria-label="原文の文字図"><code>${escape(alignReviewedDiagram(text))}</code></pre>`;
  });
  return html;
}
