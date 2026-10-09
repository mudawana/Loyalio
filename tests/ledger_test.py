import sqlite3, pathlib, re, unittest

source=pathlib.Path('app/api/data/route.ts').read_text()
mutation=re.search(r"prepare\('(INSERT OR IGNORE INTO ledger.*?)'\)",source).group(1)
access=re.search(r"prepare\('(SELECT \* FROM shops WHERE id=.*?)'\)",source).group(1)
class LedgerTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  for migration in sorted(pathlib.Path('drizzle').glob('*.sql')):
   self.db.executescript(migration.read_text())
  self.db.execute("INSERT INTO shops(id,owner,name,color,reward,target,created) VALUES ('shop-a','alice','A','#214f40','Coffee',10,'now')")
  self.db.execute("INSERT INTO shops(id,owner,name,color,reward,target,created) VALUES ('shop-b','bob','B','#214f40','Tea',10,'now')")
  self.db.execute("INSERT INTO cards(id,shop,name,created) VALUES ('card-a','shop-a','Test','now')")
 def award(self,id,delta):
  return self.db.execute(mutation,(id,'card-a',delta,'stamp' if delta>0 else 'redeem','alice','now',delta,'card-a',10)).rowcount
 def test_duplicate_request_awards_once(self):
  self.assertEqual(self.award('one',1),1)
  self.assertEqual(self.award('one',1),0)
  self.assertEqual(self.db.execute('SELECT SUM(delta) FROM ledger').fetchone()[0],1)
 def test_redemption_cannot_overdraw(self):
  self.assertEqual(self.award('early',-10),0)
  for i in range(12): self.award(str(i),1)
  self.assertEqual(self.award('reward',-10),1)
  self.assertEqual(self.award('reward',-10),0)
  self.assertEqual(self.award('reward-again',-10),0)
  self.assertEqual(self.db.execute('SELECT SUM(delta) FROM ledger').fetchone()[0],2)
 def test_tenant_access_and_staff_revocation(self):
  self.assertIsNone(self.db.execute(access,('shop-b','alice','alice@test.be')).fetchone())
  self.assertIsNotNone(self.db.execute(access,('shop-a','alice','alice@test.be')).fetchone())
  self.db.execute("INSERT INTO staff VALUES ('staff-a','shop-a','cashier@test.be','now')")
  self.assertIsNotNone(self.db.execute(access,('shop-a','cashier','cashier@test.be')).fetchone())
  self.db.execute("DELETE FROM staff WHERE id='staff-a'")
  self.assertIsNone(self.db.execute(access,('shop-a','cashier','cashier@test.be')).fetchone())
if __name__=='__main__':unittest.main()
