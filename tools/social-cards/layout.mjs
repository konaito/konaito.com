import { loadDefaultJapaneseParser } from 'budoux';

const parser = loadDefaultJapaneseParser();
const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const noStart = /^[、。，．！？!?：:；;）)］\]｝}〉》」』】〕〗〙〛ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー々ゝゞヽヾ]/u;
const noEnd = /[（(［\[｛{〈《「『【〔〖〘〚]$/u;
const latin = /[\p{Script=Latin}\p{N}]/u;

export function normalizeTitle(value) {
  if (typeof value !== 'string') throw new TypeError('Card titles must be strings.');
  const normalized = value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n?/g, '\n');
  // Only <br> is a recognized control. No HTML is ever parsed or rendered.
  if (/<\/?[A-Za-z][^>]*>/u.test(normalized)) throw new Error('Only <br> tags are allowed in a card title.');
  if (/\p{Cc}/u.test(normalized.replace(/[\n\t]/g, ''))) throw new Error('Unsupported title control character.');
  const lines = normalized.split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim());
  if (lines.some(line => !line)) throw new Error('Card titles cannot contain blank lines.');
  if (normalized.length > 4096) throw new Error('Card title is too long.');
  return lines;
}

export function assertSameTitle(original, override) {
  const compact = text => normalizeTitle(text).join('').replace(/\s/gu, '');
  if (compact(original) !== compact(override)) {
    throw new Error('Card line-break config must preserve the complete article title, including punctuation.');
  }
}

export function titlePhrases(title) {
  // Return literal text fragments; callers must HTML-escape each fragment.
  return parser.parse(title);
}

export function validBoundary(before, after) {
  return !noEnd.test(before.trimEnd()) && !noStart.test(after.trimStart());
}

/** Find natural, width-balanced lines. BudouX boundaries are preferred, with
 * grapheme-safe emergency breaks only when a whole phrase/Latin token cannot fit.
 * Returns null rather than truncate if this count cannot contain the full text. */
export function balancedWrap(text, measure, maxWidth, lineCount) {
  const parts = Array.from(graphemes.segment(text), part => part.segment);
  const offsets = [0];
  for (const part of parts) offsets.push(offsets.at(-1) + part.length);
  const preferred = new Set([0, text.length]);
  let cursor = 0;
  for (const phrase of parser.parse(text)) { cursor += phrase.length; preferred.add(cursor); }
  const totalWidth = measure(text);
  const target = Math.min(maxWidth, totalWidth / lineCount);
  const n = parts.length;
  if (n > 600) return null;
  const memo = new Map();
  const widths = new Map();
  const segment = (i,j) => text.slice(offsets[i], offsets[j]).trim();
  const width = (i,j) => {
    const key=`${i}:${j}`;
    if (!widths.has(key)) widths.set(key, measure(segment(i,j)));
    return widths.get(key);
  };
  function solve(start, remaining) {
    if (start === n) return remaining === 0 ? { score: 0, lines: [], emergencyBreaks: 0 } : null;
    if (!remaining) return null;
    const key = `${start}:${remaining}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (let end = start + 1; end <= n; end++) {
      const value = segment(start,end);
      const measured = width(start,end);
      if (measured > maxWidth) break;
      if (!value || (remaining === 1 && end !== n)) continue;
      const tail = text.slice(offsets[end]);
      if (end < n && !validBoundary(value,tail)) continue;
      const rest = solve(end,remaining-1);
      if (!rest) continue;
      let penalty = 0;
      let emergency = false;
      if (end < n) {
        const boundary = offsets[end];
        const whitespace = /\s/u.test(parts[end-1]) || /\s/u.test(parts[end]);
        const punctuation = /[、。，．！？!?：:；;—–-]$/u.test(value);
        if (!preferred.has(boundary) && !whitespace && !punctuation) { penalty = 1e7; emergency = true; }
        if (latin.test(parts[end-1]) && latin.test(parts[end])) { penalty += 1e8; emergency = true; }
      }
      // Balance all lines rather than greedily fill the first and orphan the last.
      const score = rest.score + (measured - target) ** 2 + penalty;
      if (!best || score < best.score) best = { score, lines: [value,...rest.lines], emergencyBreaks: rest.emergencyBreaks + Number(emergency) };
    }
    memo.set(key,best);
    return best;
  }
  return solve(0,lineCount);
}

export function fitTitle(title, measureAtSize, { override, maxWidth = 1032, maxHeight = 338, minSize = 42, maxSize = 78, lineHeight = 1.32, maxLines = 5 } = {}) {
  if (![maxWidth,maxHeight,minSize,maxSize,lineHeight,maxLines].every(x=>Number.isFinite(x) && x>0) || minSize>maxSize) throw new Error('Invalid card layout dimensions.');
  const manual = override !== undefined;
  const explicit = normalizeTitle(manual ? override : title);
  if (manual) assertSameTitle(title,override);
  const hardBreaks = manual || explicit.length > 1;
  for (let size = maxSize; size >= minSize; size--) {
    const measure = text => measureAtSize(text,size);
    if (hardBreaks) {
      // Author-specified lines are never moved. A too-long line fails clearly.
      if (explicit.length <= maxLines && explicit.length * size * lineHeight <= maxHeight && explicit.every(line=>measure(line)<=maxWidth)) {
        return { lines:explicit, fontSize:size, lineHeight:size*lineHeight, source:'manual', emergencyBreaks:0 };
      }
    } else {
      const maxCount = Math.min(maxLines,Math.floor(maxHeight/(size*lineHeight)));
      const idealCount = Math.max(1,Math.ceil(measure(explicit[0])/maxWidth));
      for (let count=idealCount; count<=maxCount; count++) {
        const wrapped = balancedWrap(explicit[0],measure,maxWidth,count);
        if (wrapped && wrapped.emergencyBreaks === 0) return { ...wrapped, fontSize:size,lineHeight:size*lineHeight,source:'budoux' };
      }
    }
  }
  // Only at the readable minimum, use grapheme-safe emergency wrapping for an
  // overlong Latin word or phrase. Never silently alter manual hard breaks.
  if (!hardBreaks) {
    const measure=text=>measureAtSize(text,minSize);
    const maxCount=Math.min(maxLines,Math.floor(maxHeight/(minSize*lineHeight)));
    for (let count=1;count<=maxCount;count++) {
      const wrapped=balancedWrap(explicit[0],measure,maxWidth,count);
      if (wrapped) return {...wrapped,fontSize:minSize,lineHeight:minSize*lineHeight,source:'budoux-emergency'};
    }
  }
  throw new Error('Full title does not fit readably. Add better newline/<br> breaks, or adjust the card layout. Nothing was truncated.');
}
