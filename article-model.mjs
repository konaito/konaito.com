export const platformOrder = ['note', 'X', 'Qiita'];
export const displayTimezone = 'Asia/Tokyo';

export function jstDate(timestamp) {
  if (typeof timestamp!=='string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) throw new Error(`Invalid absolute publication timestamp: ${timestamp}`);
  return new Date(Date.parse(timestamp)+9*60*60*1000).toISOString().slice(0,10);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function prepareArticles(input) {
  if (!Array.isArray(input)) throw new Error('articles.json must be an array.');
  const ids = new Set();
  const urls = new Set();
  return input.map(article => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.id || '') || ids.has(article.id)) throw new Error(`Duplicate or missing article id: ${article.id}`);
    ids.add(article.id);
    if (!article.title || !article.summary || !['work','life','society','experiment'].includes(article.theme)) throw new Error(`Incomplete content entry or unknown theme: ${article.id}`);
    if (!Array.isArray(article.sources) || !article.sources.length) throw new Error(`Missing provenance: ${article.id}`);
    const sources = article.sources.map(source => {
      if (!platformOrder.includes(source.platform)) throw new Error(`Unknown platform: ${source.platform}`);
      const url = new URL(source.url);
      if (url.protocol !== 'https:') throw new Error(`Non-HTTPS source: ${source.url}`);
      const hosts = {note:['note.com'],X:['x.com','twitter.com'],Qiita:['qiita.com']};
      if (!hosts[source.platform].includes(url.hostname)) throw new Error(`Platform and source URL mismatch: ${source.url}`);
      if (urls.has(source.url)) throw new Error(`Duplicate source URL across content entries: ${source.url}`);
      urls.add(source.url);
      if (source.publishedAtVerified && !validDate(source.publishedAt)) throw new Error(`Invalid verified publication date: ${article.id}`);
      if (source.publishedAtVerified && source.publishedTimestamp && source.publishedAt!==jstDate(source.publishedTimestamp)) throw new Error(`Publication date is not normalized to JST: ${source.url}`);
      return {...source};
    }).sort((a,b) => platformOrder.indexOf(a.platform)-platformOrder.indexOf(b.platform));
    if (article.primarySourceUrl && !sources.some(source=>source.url===article.primarySourceUrl)) throw new Error(`Primary source is missing from provenance: ${article.id}`);
    const dates = sources.filter(source => source.publishedAtVerified === true).map(source => source.publishedAt).sort();
    if (!dates.length) throw new Error(`No verified publication date: ${article.id}`);
    const verifiedSources=sources.filter(source=>source.publishedAtVerified===true);
    const allHaveTimestamps=verifiedSources.every(source=>typeof source.publishedTimestamp==='string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(source.publishedTimestamp) && !Number.isNaN(Date.parse(source.publishedTimestamp)));
    const earliestPublishedAt=allHaveTimestamps
      ? jstDate([...verifiedSources].sort((a,b)=>Date.parse(a.publishedTimestamp)-Date.parse(b.publishedTimestamp))[0].publishedTimestamp)
      : dates[0];
    if (article.earliestPublishedAt && article.earliestPublishedAt !== earliestPublishedAt) throw new Error(`Earliest publication mismatch: ${article.id}`);
    return {...article, sources, primarySourceUrl:article.primarySourceUrl || sources[0].url, earliestPublishedAt, displayTimezone, dateComparison:allHaveTimestamps?'publication_timestamps':'displayed_publication_dates'};
  }).sort((a,b) => b.earliestPublishedAt.localeCompare(a.earliestPublishedAt) || (a.priority || 999)-(b.priority || 999));
}
