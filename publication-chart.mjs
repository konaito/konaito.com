import { jstDate, categoryNames } from './article-model.mjs';

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const percent = value => Number(value.toFixed(6));
export const publicationGenres = {
  work: { label: categoryNames.work, color: '#8bbcf0', outline: '#517eaa' },
  life: { label: categoryNames.life, color: '#f0a8c0', outline: '#aa617c' },
  society: { label: categoryNames.society, color: '#c2ace8', outline: '#80669f' },
  experiment: { label: categoryNames.experiment, color: '#91d3b5', outline: '#4f826b' }
};

// One point per canonical work, ordered by the earliest verified publication instant.
export function publicationSeries(articles) {
  return articles.map(article => {
    const sources = article.sources.filter(source => source.publishedAtVerified === true);
    if (!sources.length || sources.some(source => !source.publishedTimestamp || !/(?:Z|[+-]\d{2}:\d{2})$/.test(source.publishedTimestamp) || !Number.isFinite(Date.parse(source.publishedTimestamp)))) {
      throw new Error(`The publication chart requires verified absolute timestamps: ${article.id}`);
    }
    const timestamp = Math.min(...sources.map(source => Date.parse(source.publishedTimestamp)));
    return { id: article.id, title: article.title, primaryCategory: article.primaryCategory, categories: article.categories, timestamp, date: jstDate(new Date(timestamp).toISOString()) };
  }).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id, 'en'))
    .map((point, index) => ({ ...point, ordinal: index + 1 }));
}

export function renderPublicationChart(articles) {
  const series = publicationSeries(articles);
  if (!series.length) return '';
  const start = series[0].timestamp;
  const end = series.at(-1).timestamp;
  const span = end - start || 1;
  const maximum = Math.max(10, Math.ceil(series.length / 5) * 5);
  const points = series.map(point => ({ ...point, x: percent((point.timestamp - start) / span * 100), y: percent(100 - point.ordinal / maximum * 100) }));
  const ticks = [];
  for (let value = 0; value <= maximum; value += 10) ticks.push(value);
  const grid = ticks.map(value => `<line x1="0" y1="${percent(100 - value / maximum * 100)}" x2="100" y2="${percent(100 - value / maximum * 100)}" vector-effect="non-scaling-stroke"/>`).join('');
  const labels = ticks.map(value => `<span class="publication-y-tick" style="top:${percent(100 - value / maximum * 100)}%">${value}</span>`).join('');
  const dateTicks = [{ timestamp: start, label: points[0].date.slice(0, 7).replace('-', '.'), edge: 'start' }];
  const firstYear = Number(points[0].date.slice(0, 4));
  const lastYear = Number(points.at(-1).date.slice(0, 4));
  for (let year = firstYear + 1; year <= lastYear; year++) {
    const timestamp = Date.parse(`${year}-01-01T00:00:00+09:00`);
    const position = (timestamp - start) / span;
    if (position > .14 && position < .86) dateTicks.push({ timestamp, label: String(year), edge: '' });
  }
  if (end !== start) dateTicks.push({ timestamp: end, label: points.at(-1).date.slice(0, 7).replace('-', '.'), edge: 'end' });
  const dates = dateTicks.map(tick => `<span class="publication-x-tick ${tick.edge}" style="left:${percent((tick.timestamp - start) / span * 100)}%">${tick.label}</span>`).join('');
  if (points.some(point => !publicationGenres[point.primaryCategory])) throw new Error('Unknown publication chart genre');
  const legend = Object.entries(publicationGenres).map(([theme, genre]) => `<li><span style="--publication-color:${genre.color};--publication-outline:${genre.outline}" aria-hidden="true"></span>${genre.label}</li>`).join('');
  const dots = points.map((point, index) => `<button type="button" class="publication-point" style="left:${point.x}%;top:${point.y}%;--publication-color:${publicationGenres[point.primaryCategory].color};--publication-outline:${publicationGenres[point.primaryCategory].outline}" data-publication-point data-genre="${publicationGenres[point.primaryCategory].label}" data-primary-category="${point.primaryCategory}" data-title="${escapeHTML(point.title)}" data-date="${point.date}" data-ordinal="${point.ordinal}" data-article-id="${escapeHTML(point.id)}" tabindex="${index === 0 ? '0' : '-1'}" aria-label="${point.ordinal}本目、${point.date.replaceAll('-', '.')}、${publicationGenres[point.primaryCategory].label}、${escapeHTML(point.title)}" aria-describedby="publication-chart-help"><span></span></button>`).join('\n');
  return `<figure class="publication-chart" aria-labelledby="publication-chart-heading">
  <figcaption id="publication-chart-heading">公開の記録<span>${series.length}本</span></figcaption>
  <p class="publication-chart-help" id="publication-chart-help">横軸は初出の時期、縦軸は何本目か。点に触れると作品名を表示します。<span class="visually-hidden">キーボードでは矢印キーで作品を選び、Escapeキーで閉じられます。</span></p>
  <ul class="publication-legend" aria-label="ジャンル">${legend}</ul>
  <div class="publication-plot">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="publication-grid">${grid}</g><polyline class="publication-line" points="${points.map(point => `${point.x},${point.y}`).join(' ')}" vector-effect="non-scaling-stroke"/></svg>
    ${labels}${dates}${dots}
  </div>
  <div class="publication-tooltip" id="publication-tooltip" role="tooltip" hidden><p class="publication-tooltip-meta"></p><p class="publication-tooltip-title"></p></div>
</figure>`;
}
