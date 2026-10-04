#!/usr/bin/env python3
"""Import verified body HTML. Uses only Python's standard library; never fetches content.

Usage: python3 scripts/import-article-bodies.py export.json [article-content.json]
The reviewed result is committed; normal builds only require Node.js.
"""
import datetime
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlsplit, unquote

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = json.loads((ROOT / 'articles.json').read_text())
BY_ID = {a['id']: a for a in ARTICLES}
SOURCE_TO_PATH = {s['url']: f"/articles/{a['id']}/" for a in ARTICLES for s in a['sources']}
SOURCE_TO_ARTICLE = {s['url']: a for a in ARTICLES for s in a['sources']}
for url, target in list(SOURCE_TO_PATH.items()):
    if urlsplit(url).hostname == 'x.com':
        SOURCE_TO_PATH[url.replace('/status/', '/article/')] = target
SOURCE_TITLES = {s['url']: a['title'] for a in ARTICLES for s in a['sources']}
NOTE_EMBEDS = {re.search(r'/n/(n[a-z0-9]+)$', s['url']).group(1): (SOURCE_TO_PATH[s['url']], a['title']) for a in ARTICLES for s in a['sources'] if s['platform']=='note'}
ALLOWED = set('p br hr h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code strong em b i u s del sub sup a img figure figcaption table thead tbody tfoot tr th td div span details summary dl dt dd'.split())
DROP = set('script style noscript form button input select textarea nav footer header svg canvas'.split())
VOID = {'br', 'hr', 'img'}

class BodyParser(HTMLParser):
    def __init__(self, source, metadata=None):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.parts = []
        self.text_parts = []
        self.stack = []
        self.drop_depth = 0
        self.toc = []
        self.heading = None
        self.images = []
        self.notes = []
        self.embedded = False
        self.embed_map = {e['src']: e.get('sourceUrl') or e.get('targetUrl') for e in (metadata or {}).get('embeds', []) + (metadata or {}).get('linkCards', []) if e.get('src') and (e.get('sourceUrl') or e.get('targetUrl'))}

    def safe_url(self, value, image=False):
        if not value:
            return None
        absolute = urljoin(self.source, value)
        parsed = urlsplit(absolute)
        if parsed.scheme not in ({'https'} if image else {'http', 'https'}) or parsed.username or parsed.password:
            return None
        return absolute

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.drop_depth:
            if tag not in VOID and tag not in {'input', 'meta', 'link', 'source'}:
                self.drop_depth += 1
            return
        if tag in DROP:
            if tag not in {'input'}:
                self.drop_depth = 1
            return
        if tag in {'iframe', 'video', 'audio'}:
            src = attrs.get('src', '')
            candidate = attrs.get('data-embed-source') or self.embed_map.get(src) or src
            if not attrs.get('data-embed-source') and attrs.get('data-content'):
                candidate = unquote(attrs['data-content'])
            link = self.safe_url(candidate)
            label = '埋め込みコンテンツを開く'
            note_match = re.search(r'note\.com/embed/notes/(n[a-z0-9]+)', src)
            if note_match and note_match.group(1) in NOTE_EMBEDS:
                link, label = NOTE_EMBEDS[note_match.group(1)]
            elif link:
                host = urlsplit(link).hostname
                if host in {'x.com', 'twitter.com'}:
                    label = '引用されたXの投稿を読む'
                elif host == 'speakerdeck.com':
                    label = 'スライドを読む（Speaker Deck）'
                elif host in {'www.youtube.com', 'youtube.com', 'youtu.be'}:
                    label = '動画を見る（YouTube）'
                else:
                    label = SOURCE_TITLES.get(link, link)
                link = SOURCE_TO_PATH.get(link, link)
            if link:
                self.parts.append(f'<p class="media-fallback"><a href="{html.escape(link, quote=True)}">{html.escape(label)}</a></p>')
                self.notes.append('Third-party player replaced with a direct source link.')
            return
        if tag not in ALLOWED:
            return
        output_tag = 'h2' if tag == 'h1' else tag
        out_attrs = {}
        if tag == 'div' and 'longform-unstyled' in attrs.get('class', '').split():
            out_attrs['class'] = 'source-paragraph'
        if re.fullmatch('h[1-6]', tag):
            section_id = f'section-{len(self.toc)+1}'
            self.heading = {'id': section_id, 'level': int(output_tag[1]), 'text': ''}
            self.toc.append(self.heading)
            out_attrs['id'] = section_id
        if tag == 'a':
            href = self.safe_url(attrs.get('href'))
            if href:
                out_attrs['href'] = SOURCE_TO_PATH.get(href, href)
                if not out_attrs['href'].startswith('/'):
                    out_attrs['rel'] = 'noopener noreferrer'
            if attrs.get('title'):
                out_attrs['title'] = attrs['title']
        if tag == 'img':
            src = self.safe_url(attrs.get('src') or attrs.get('data-src'), image=True)
            if not src:
                self.notes.append('An image with no public HTTPS source was omitted.')
                return
            out_attrs = {'src': src, 'alt': attrs.get('alt', ''), 'loading': 'lazy', 'decoding': 'async'}
            for dim in ['width', 'height']:
                if re.fullmatch(r'[1-9][0-9]{0,4}', attrs.get(dim, '')):
                    out_attrs[dim] = attrs[dim]
            self.images.append(src)
        if tag in {'td', 'th'}:
            for key in ['colspan', 'rowspan']:
                if re.fullmatch(r'[1-9][0-9]?', attrs.get(key, '')):
                    out_attrs[key] = attrs[key]
            if tag == 'th' and attrs.get('scope') in {'col','row','colgroup','rowgroup'}:
                out_attrs['scope'] = attrs['scope']
        if tag == 'ol' and re.fullmatch(r'-?[0-9]{1,5}', attrs.get('start', '')):
            out_attrs['start'] = attrs['start']
        if tag == 'code':
            classes = [c for c in attrs.get('class','').split() if re.fullmatch(r'language-[a-zA-Z0-9_+-]+', c)]
            if classes:
                out_attrs['class'] = ' '.join(classes)
        rendered = ''.join(f' {key}="{html.escape(value, quote=True)}"' for key, value in out_attrs.items())
        self.parts.append(f'<{output_tag}{rendered}>')
        if tag not in VOID:
            self.stack.append((tag, output_tag))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.drop_depth:
            self.drop_depth -= 1
            return
        positions = [i for i, (original, _) in enumerate(self.stack) if original == tag]
        if not positions:
            return
        index = positions[-1]
        for _, output_tag in reversed(self.stack[index:]):
            self.parts.append(f'</{output_tag}>')
            if re.fullmatch('h[1-6]', output_tag):
                self.heading = None
        self.stack = self.stack[:index]

    def handle_data(self, data):
        if self.drop_depth:
            return
        self.parts.append(html.escape(data, quote=False))
        self.text_parts.append(data)
        if self.heading:
            self.heading['text'] += data

    def result(self):
        for _, tag in reversed(self.stack):
            self.parts.append(f'</{tag}>')
        rendered = ''.join(self.parts).strip()
        # Service-generated heading permalink icons become empty after sanitizing.
        rendered = re.sub(r'<a\b[^>]*>(?:\s|<span></span>|<i></i>)*</a>', '', rendered)
        return rendered


def main():
    export = json.loads(Path(sys.argv[1]).read_text())
    raw = export if isinstance(export, list) else export['articles']
    for item in raw:
        supplied_url=item['sourceUrl']
        canonical_url=supplied_url.replace('/article/', '/status/') if urlsplit(supplied_url).hostname=='x.com' else supplied_url
        if canonical_url not in SOURCE_TO_ARTICLE:
            raise ValueError(f'Unrecognized article source: {supplied_url}')
        item['id']=SOURCE_TO_ARTICLE[canonical_url]['id']
        item['retrievedFromUrl']=supplied_url
        item['sourceUrl']=canonical_url
    if len(raw) != len(BY_ID) or {a['id'] for a in raw} != set(BY_ID):
        raise ValueError('Export must contain exactly the 31 audited works, once each.')
    external_only = set(json.loads((ROOT / 'site.config.json').read_text()).get('externalOnlyArticles', []))
    result = []
    for item in raw:
        if item['id'] in external_only:
            continue
        original = BY_ID[item['id']]
        if item['sourceUrl'] not in {s['url'] for s in original['sources']}:
            raise ValueError(f"Unknown source for {item['id']}")
        if not item.get('html'):
            raise ValueError(f"Missing full HTML body: {item['id']}")
        parser = BodyParser(item.get('retrievedFromUrl', item['sourceUrl']), item.get('metadata'))
        parser.feed(item['html'])
        parser.close()
        sanitized = parser.result()
        text = re.sub(r'\s+', ' ', ''.join(parser.text_parts)).strip()
        if not text:
            raise ValueError(f"Empty article: {item['id']}")
        result.append({
            'id': item['id'], 'sourceUrl': item['sourceUrl'],
            'sourceTitle': item.get('sourceTitle', original['title']),
            'html': sanitized, 'textLength': len(text),
            'toc': [{**h, 'text': re.sub(r'\s+', ' ', h['text']).strip()} for h in parser.toc if h['text'].strip()],
            'images': list(dict.fromkeys(parser.images)),
            'extractedAt': item.get('extractedAt'),
            'notes': list(dict.fromkeys(parser.notes)),
            'sourceEdited': any(s.get('edited') is True and s.get('platform')==original['sources'][0]['platform'] for s in item.get('metadata',{}).get('sources',[])),
        })
    if len(sys.argv)>2:
        Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    else:
        directory=ROOT / 'content'
        directory.mkdir(exist_ok=True)
        # Replace only generated content parts after every source passed validation.
        for old in directory.glob('*.json'):
            old.unlink()
        for article in result:
            (directory / (article['id']+'.json')).write_text(json.dumps([article], ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'articles': len(result), 'textCharacters': sum(a['textLength'] for a in result), 'images': sum(len(a['images']) for a in result)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
