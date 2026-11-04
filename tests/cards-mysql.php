<?php
declare(strict_types=1);require __DIR__.'/../backend/src/validation.php';require __DIR__.'/../backend/src/CardService.php';
$db=new PDO('mysql:host=127.0.0.1;port=33307;dbname=deenpath_economy_test;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$directory=str_replace('\\','/',(string)$db->query('SELECT @@datadir')->fetchColumn());if(!str_contains(strtolower($directory),'/salahguide/.tools/economy-mysql/'))throw new RuntimeException('Refusing non-isolated database');
$db->exec(file_get_contents(__DIR__.'/../backend/sql/migrations/005_bilingual_stories.sql'));
function cardCheck(bool $pass,string $label):void{if(!$pass)throw new RuntimeException($label);echo "PASS: $label\n";}
function cardUser(PDO $db):string{$uid=uuid();$s=$db->prepare('INSERT INTO users(id,name,email,password_hash,verified_at) VALUES(?,?,?,?,UTC_TIMESTAMP())');$s->execute([$uid,'Synthetic card test',$uid.'@example.invalid','not-a-real-password']);return $uid;}
$artDir=__DIR__.'/../.tools/card-art-tests';if(!is_dir($artDir))mkdir($artDir,0700,true);
foreach(CardRules::WEIGHTS as $rarity=>$weight)for($i=0;$i<3;$i++){
 $card=uuid();$art=uuid();$name=$art.'.png';$bytes=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');file_put_contents($artDir.'/'.$name,$bytes);
 $s=$db->prepare("INSERT INTO card_definitions(id,title,category,rarity,story,reference_data,verification,status,generation_date) VALUES(?,?,?,?,?,?,'verified','published',UTC_TIMESTAMP())");$s->execute([$card,'Synthetic fixture '.$i,CardRules::CATEGORIES[$rarity][0],$rarity,'A synthetic test sentence. Another synthetic test sentence. No religious claim is made here.',json_encode([['title'=>'Synthetic fixture reference','url'=>'https://example.invalid/fixture']])]);
 $s=$db->prepare("INSERT INTO card_stories(card_id,title_urdu,summary,summary_urdu,english,urdu,english_reviewed,urdu_reviewed,review_data) VALUES(?,?,?,?,?,?,1,1,'{}')");$s->execute([$card,'آزمائشی کہانی','Synthetic summary','مختصر آزمائشی تعارف',str_repeat('A synthetic sentence without any religious or historical claim. ',5),'یہ آزمائشی کہانی ہے۔ اس میں کوئی تاریخی یا مذہبی دعویٰ نہیں ہے۔ یہ صرف زبان اور قاری کی جانچ کے لیے ہے۔']);
 $s=$db->prepare("INSERT INTO card_artwork(id,card_id,disk_name,sha256,mime,provider,license_data,verified) VALUES(?,?,?,?,?,'synthetic-test','{}',1)");$s->execute([$art,$card,$name,hash('sha256',$bytes),'image/png']);
}
$uid=cardUser($db);$debt=['prayer'=>'Fajr','quantity'=>200,'origin'=>'previous','completed'=>[['id'=>uuid(),'quantity'=>200,'at'=>'2026-11-01T00:00:00Z']]];$s=$db->prepare('INSERT INTO qaza_history(user_id,id,data,version,deleted) VALUES(?,?,?,1,0)');$s->execute([$uid,uuid(),json_encode($debt)]);
$service=new CardService($db,['artDirectory'=>$artDir,'adminUsers'=>[$uid]]);$ledger=new GemLedger($db);$before=$ledger->reconcile($uid)['balance'];
try{(new CardService($db,['artDirectory'=>$artDir.'/missing']))->pack($uid,uuid());throw new RuntimeException('Unavailable artwork accepted');}catch(InvalidArgumentException){cardCheck($ledger->reconcile($uid)['balance']===$before,'unavailable library rolls back without a charge');}
$id=uuid();$pack=$service->pack($uid,$id);cardCheck($pack['balance']===$before-500&&count($pack['copies'])===3,'pack debit and three saved copies commit together');
cardCheck(count(array_unique(array_map(fn($c)=>$c['card']['id'],$pack['copies'])))===3,'three distinct definitions per pack');
cardCheck(json_encode($service->pack($uid,$id))===json_encode($pack),'interrupted response retries preserve the same copies and charge');
cardCheck(count($service->collection($uid))===3,'collection survives reopening without the reveal animation');
$copy=$pack['copies'][0]['copyId'];$service->reveal($uid,$copy);$service->reveal($uid,$copy);cardCheck(count(array_filter($service->collection($uid),fn($r)=>$r['copyId']===$copy&&$r['revealed']))===1,'reveal is idempotent');
$card=$pack['copies'][0]['card']['id'];$report=$service->report($uid,$card,'artwork','Synthetic review');cardCheck($report['reviewQueued'],'critical report queues immediate review');$again=$service->report($uid,$card,'islamic','Repeated');cardCheck($again['duplicate'],'one reporter cannot inflate counts by changing reasons');
for($i=0;$i<4;$i++)$service->report(cardUser($db),$card,'history','Synthetic report');
cardCheck(count(array_filter($service->library(),fn($r)=>$r['id']===$card))===0,'five distinct credible reporters stop new distribution');
cardCheck(count($service->collection($uid))===3,'pending review keeps ownership');
try{$service->moderate($uid,$card,'approve',[]);throw new RuntimeException('Unchecked approval accepted');}catch(InvalidArgumentException){cardCheck(true,'independent reference and art review are required');}
try{$service->queue(cardUser($db));throw new RuntimeException('Unauthorized admin accepted');}catch(RuntimeException $e){cardCheck($e->getMessage()==='Administrator access required','moderation requires explicit administrator identity');}
$review=$service->adminCard($uid,$card);$service->moderate($uid,$card,'approve',['englishReviewed'=>true,'urduReviewed'=>true,'referencesChecked'=>true,'artworkChecked'=>true,'artId'=>$review['artwork'][0]['id']]);cardCheck(count(array_filter($service->library(),fn($r)=>$r['id']===$card))===1,'approved content re-enters distribution after review');
$service->moderate($uid,$card,'withdraw',[]);cardCheck(count($service->collection($uid))===2,'withdrawn card disappears from visible collection');
$s=$db->prepare('SELECT COUNT(*) FROM owned_cards WHERE user_id=?');$s->execute([$uid]);cardCheck((int)$s->fetchColumn()===3,'withdrawal retains all ownership audit records');

$guest=cardUser($db);$s=$db->prepare('INSERT INTO qaza_history(user_id,id,data,version,deleted) VALUES(?,?,?,1,0)');$s->execute([$guest,uuid(),json_encode($debt)]);
$chosen=array_slice(array_column($service->library(),'id'),0,3);$copyIds=[uuid(),uuid(),uuid()];$guestOrder=uuid();$imported=$service->importPack($guest,$guestOrder,$chosen,$copyIds,500);
cardCheck(array_column($imported['copies'],'copyId')===$copyIds,'guest migration preserves original owned-copy identities');
cardCheck(json_encode($service->importPack($guest,$guestOrder,$chosen,$copyIds,500))===json_encode($imported),'guest import retry charges once and preserves the original pack');
$balance=$ledger->reconcile($guest)['balance'];try{$service->importPack($guest,uuid(),$chosen,[uuid(),uuid(),uuid()],400);throw new RuntimeException('Unapproved price accepted');}catch(InvalidArgumentException){cardCheck($ledger->reconcile($guest)['balance']===$balance,'changed pack quote is rejected without another debit');}
try{$service->importPack($guest,uuid(),[$chosen[0],$chosen[0],$chosen[1]],[uuid(),uuid(),uuid()],500);throw new RuntimeException('Duplicate guest cards accepted');}catch(InvalidArgumentException){cardCheck(true,'guest import cannot bypass distinct-card requirement');}
$service->revealMany($guest,[$copyIds[0],$copyIds[1]]);cardCheck(count(array_filter($service->collection($guest),fn($copy)=>$copy['revealed']))===2,'batch reveal replay retains offline flips');

cardCheck(!array_key_exists('english',$service->catalog()[0]),'public catalog excludes full story bodies');
cardCheck(count($service->details(array_slice(array_column($service->library(),'id'),0,3)))===3,'bounded detail fetch returns selected bilingual stories');

$candidate=$service->library()[0]['id'];$s=$db->prepare('UPDATE card_stories SET urdu_reviewed=0 WHERE card_id=?');$s->execute([$candidate]);cardCheck(!in_array($candidate,array_column($service->catalog(),'id'),true),'a missing Urdu review blocks new distribution even with reviewed English');
try{$service->moderate($uid,$candidate,'approve',['englishReviewed'=>true,'urduReviewed'=>false,'referencesChecked'=>true,'artworkChecked'=>true]);throw new RuntimeException('One-language approval accepted');}catch(InvalidArgumentException){cardCheck(true,'administrator must explicitly confirm both language reviews');}
$db->prepare('UPDATE card_stories SET urdu_reviewed=1 WHERE card_id=?')->execute([$candidate]);
