import importlib.util,pathlib,unittest,datetime
s=importlib.util.spec_from_file_location('check_sources',pathlib.Path(__file__).resolve().parents[1]/'scripts/check_sources.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class SourceTests(unittest.TestCase):
 def test_ignores_executable_and_style_content(self):
  self.assertEqual(m.normalize('<script>malicious()</script><style>.a{}</style><p>税込 990円</p>'),'税込 990円')
 def test_includes_image_alt_prices(self):
  self.assertEqual(m.normalize('<img alt="月額1,390円"><p>20GB</p>'),'月額1,390円 20GB')
 def test_external_sources_not_allowed(self):
  self.assertEqual(m.observe('https://example.com/')['state'],'unavailable')
 def test_no_insecure_http(self):
  self.assertEqual(m.observe('http://ahamo.com/')['state'],'unavailable')
 def test_entity_normalization(self):
  self.assertEqual(m.normalize('<p>A &amp; B\n  C</p>'),'A & B C')
 def test_review_due_before_expiry(self):
  c={'plans':[{'id':'p','status':'verified','checkedAt':'2026-10-19','validThrough':'2026-11-18'}]}
  self.assertEqual(len(m.review_due(c,datetime.date(2026,11,11))),1)
  self.assertEqual(len(m.review_due(c,datetime.date(2026,11,10))),0)
if __name__=='__main__':unittest.main()
