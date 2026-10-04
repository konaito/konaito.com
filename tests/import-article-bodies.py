import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('importer',Path(__file__).resolve().parents[1]/'scripts/import-article-bodies.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
 def parse(self,html):
  p=module.BodyParser('https://note.com/konaito/n/n873e3164f4d7');p.feed(html);p.close();return p,p.result()
 def test_full_text(self):
  p,result=self.parse('<h1>見出し <em>内側</em></h1><p>そのまま &amp; 保持。</p><pre><code>a &lt; b\n  c</code></pre>')
  self.assertIn('<h2 id="section-1">見出し <em>内側</em></h2>',result)
  self.assertIn('a &lt; b\n  c',result);self.assertEqual(p.toc[0]['text'],'見出し 内側')
 def test_dangerous_markup(self):
  p,result=self.parse('<script>alert(1)</script><p onclick="x()">本文</p><a href="javascript:alert(1)">危険</a><img src="https://example.com/a.png" onerror="x()">')
  self.assertNotIn('alert',result);self.assertNotIn('onclick',result);self.assertNotIn('onerror',result);self.assertIn('本文',result);self.assertIn('loading="lazy"',result)
 def test_nested_drop(self):
  p,result=self.parse('<form><p>不要</p><input><div><button>不要</button></div></form><p>本文</p>')
  self.assertEqual(result,'<p>本文</p>')
 def test_embeds(self):
  p,result=self.parse('<iframe src="https://www.youtube.com/embed/test"></iframe><p>続き</p>')
  self.assertNotIn('<iframe',result);self.assertIn('https://www.youtube.com/embed/test',result);self.assertIn('続き',result)
 def test_internal_article_links(self):
  p,result=self.parse('<a href="https://note.com/konaito/n/n873e3164f4d7">愛</a>')
  self.assertIn('href="/articles/love/"',result)

if __name__=='__main__': unittest.main()
