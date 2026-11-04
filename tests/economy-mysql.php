<?php
declare(strict_types=1);
require __DIR__.'/../backend/src/validation.php';require __DIR__.'/../backend/src/GemLedger.php';
// Deliberately fixed isolated port and database. Never reads production configuration.
$db=new PDO('mysql:host=127.0.0.1;port=33307;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$directory=str_replace('\\','/',(string)$db->query('SELECT @@datadir')->fetchColumn());
if(!str_contains(strtolower($directory),'/salahguide/.tools/economy-mysql/'))throw new RuntimeException('Refusing non-isolated database');
$db->exec('CREATE DATABASE IF NOT EXISTS deenpath_economy_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');$db->exec('USE deenpath_economy_test');
if(!$db->query("SHOW TABLES LIKE 'users'")->fetchColumn())$db->exec(file_get_contents(__DIR__.'/../backend/sql/install.sql'));
$sql=file_get_contents(__DIR__.'/../backend/sql/migrations/004_economy.sql');$db->exec($sql);$db->exec($sql);
$uid=uuid();$s=$db->prepare('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)');$s->execute([$uid,'Economy test',$uid.'@example.invalid',password_hash('fixture',PASSWORD_DEFAULT)]);
$record=['day'=>'2026-11-02','prayer'=>'Fajr','windowStart'=>'2026-11-02T00:00:00Z','windowEnd'=>'2026-11-02T01:00:00Z','completedAt'=>'2026-11-02T00:15:00Z'];
$s=$db->prepare('INSERT INTO prayer_records(user_id,id,data,version,deleted) VALUES(?,?,?,1,0)');$s->execute([$uid,'2026-11-02:Fajr',json_encode($record)]);
$ledger=new GemLedger($db);$check=static function(bool $condition,string $label):void{if(!$condition)throw new RuntimeException($label);echo 'PASS: '.$label."\n";};
$a=$ledger->reconcile($uid);$check($a['balance']===10,'canonical completion awards ten');
$b=$ledger->reconcile($uid);$check(json_encode($a)===json_encode($b),'repeated reconciliation is idempotent');
$s=$db->prepare('UPDATE prayer_records SET deleted=1 WHERE user_id=?');$s->execute([$uid]);$c=$ledger->reconcile($uid);$check($c['balance']===0&&count((array)$c['transactions'])===2,'correction reverses original claim once');
$s=$db->prepare('UPDATE prayer_records SET deleted=0 WHERE user_id=?');$s->execute([$uid]);$d=(new GemLedger($db,['rewards'=>['prayer'=>1000]]))->reconcile($uid);$check($d['balance']===10,'re-completion cannot farm or substitute new reward rates');
$record['qazaAt']='2026-11-02T02:00:00Z';unset($record['completedAt']);$s=$db->prepare('UPDATE prayer_records SET data=? WHERE user_id=?');$s->execute([json_encode($record),$uid]);$e=$ledger->reconcile($uid);$check($e['balance']===8,'Qaza reclassifies one prayer rather than double paying');
$check(count((array)$e['claims'])===1,'stable source identity across corrections');
$second=uuid();$s=$db->prepare('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)');$s->execute([$second,'Other',$second.'@example.invalid','unusable']);$check($ledger->reconcile($second)['balance']===0,'account isolation');
$check((int)$db->query("SELECT COUNT(*) FROM prayer_records WHERE user_id=".$db->quote($uid))->fetchColumn()===1,'migration and reconciliation preserve original worship data');
echo "Economy MySQL integration checks passed.\n";

require __DIR__.'/../backend/src/GemShop.php';
$debt=['prayer'=>'Fajr','quantity'=>200,'origin'=>'previous','completed'=>[['id'=>uuid(),'at'=>'2026-11-02T01:00:00Z','quantity'=>200]]];
$s=$db->prepare('INSERT INTO qaza_history(user_id,id,data,version,deleted) VALUES(?,?,?,1,0)');$s->execute([$uid,uuid(),json_encode($debt)]);
$shop=new GemShop($db);$order=uuid();$unlock=$shop->purchase($uid,$order,'unlock',[]);$check($unlock['balance']===608&&$unlock['studioUnlocked'],'unlock charges canonical balance atomically');
$check($shop->purchase($uid,$order,'unlock',[])['balance']===608,'purchase retry does not charge twice');
try{$shop->purchase($uid,$order,'colors',['primary'=>'#123456','secondary'=>'#654321']);throw new RuntimeException('Replay accepted');}catch(InvalidArgumentException){$check(true,'reused purchase id with changed request rejected');}
$paint=uuid();$applied=$shop->purchase($uid,$paint,'colors',['primary'=>'#123456','secondary'=>'#654321']);$check($applied['cost']===50&&$applied['balance']===558,'color application charged once');
$again=$shop->purchase($uid,uuid(),'colors',['primary'=>'#123456','secondary'=>'#654321']);$check($again['balance']===508,'reapplying a paid theme costs Gems again');
$free=$shop->purchase($uid,uuid(),'default',[]);$check($free['cost']===0&&$free['balance']===508&&(array)$free['theme']===[],'default themes stay free');
try{$shop->purchase($second,uuid(),'unlock',[]);throw new RuntimeException('Overspend accepted');}catch(InvalidArgumentException){$check($ledger->reconcile($second)['balance']===0,'insufficient purchase rolls back without debt');}
$check($ledger->reconcile($uid)['balance']===508,'reward reconciliation preserves purchases');
