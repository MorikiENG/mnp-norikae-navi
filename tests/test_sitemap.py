import json, os, pathlib, shutil, subprocess, tempfile, unittest
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

class SitemapTests(unittest.TestCase):
 def test_production_sitemap_is_valid_nonempty_and_matches_generated_pages(self):
  with tempfile.TemporaryDirectory(prefix='mnp-sitemap-') as directory:
   work = pathlib.Path(directory)
   shutil.copytree(ROOT/'data', work/'data')
   shutil.copytree(ROOT/'src', work/'src')
   env = dict(os.environ)
   for key in ['SITE_URL','PRODUCTION','PUBLICATION_APPROVED','CF_PAGES','CF_PAGES_BRANCH']: env.pop(key,None)
   env.update(CF_PAGES='1', CF_PAGES_BRANCH='main')
   subprocess.run(['node',str(ROOT/'scripts/build.mjs')],cwd=work,env=env,check=True,capture_output=True,text=True)
   tree = ET.parse(work/'dist/sitemap.xml')
   self.assertEqual(tree.getroot().tag,'{'+NS['s']+'}urlset')
   urls = [node.text for node in tree.findall('s:url/s:loc',NS)]
   self.assertEqual(len(urls),20)
   self.assertEqual(len(set(urls)),len(urls))
   origin = json.loads((work/'data/publication.json').read_text())['origin']
   for url in urls:
    self.assertTrue(url.startswith(origin+'/'))
    page = work/'dist'/url.removeprefix(origin).lstrip('/')/'index.html'
    self.assertTrue(page.is_file(),url)
    self.assertNotIn('noindex,nofollow',page.read_text(),url)
   self.assertIn('Sitemap: '+origin+'/sitemap.xml',(work/'dist/robots.txt').read_text())
   self.assertNotIn('Disallow: /',(work/'dist/robots.txt').read_text())

if __name__ == '__main__': unittest.main()
