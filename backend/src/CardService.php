<?php
declare(strict_types=1);
require_once __DIR__.'/GemLedger.php';require_once __DIR__.'/CardRules.php';
final class CardService {
 public function __construct(private PDO $db,private array $config=[]){}
 private function q(string $sql,array $args=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($args);return $s;}
 private function begin(string $uid):void{$this->db->beginTransaction();$this->q('SELECT id FROM users WHERE id=? FOR UPDATE',[$uid]);}
 private function audit(string $card,string $actor,string $action,array $data=[]):void{$this->q('INSERT INTO card_audit(id,card_id,actor,action,data) VALUES(?,?,?,?,?)',[uuid(),$card,$actor,$action,json_encode((object)$data,JSON_THROW_ON_ERROR)]);}
 private function view(array $r):array{
  $card=['id'=>$r['id'],'title'=>$r['title'],'category'=>$r['category'],'rarity'=>$r['rarity'],'story'=>$r['story'],'references'=>json_decode($r['reference_data'],true),'verification'=>$r['verification'],'status'=>$r['status'],'generationDate'=>$r['generation_date'],'version'=>(int)$r['version'],'artId'=>$r['artId']??null,'artVerified'=>(bool)($r['artVerified']??false)];
  $edition=$this->q('SELECT * FROM card_stories WHERE card_id=?',[$r['id']])->fetch(PDO::FETCH_ASSOC);
  if($edition){$card+=['titleUrdu'=>$edition['title_urdu'],'summary'=>$edition['summary'],'summaryUrdu'=>$edition['summary_urdu'],'english'=>$edition['english'],'urdu'=>$edition['urdu'],'edition'=>(int)$edition['edition'],'englishReviewed'=>(bool)$edition['english_reviewed'],'urduReviewed'=>(bool)$edition['urdu_reviewed']];}
  return $card;
 }
 public function catalog():array{return array_map(function($card){unset($card['english'],$card['urdu']);return $card;},$this->library());}
 public function details(array $ids):array{
  if(count($ids)<1||count($ids)>3||count(array_filter($ids,fn($id)=>!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/D',$id))))throw new InvalidArgumentException('Request one to three cards');
  return array_values(array_filter($this->library(),fn($card)=>in_array($card['id'],$ids,true)));
 }
 public function library():array {
  $rows=$this->q("SELECT c.*,a.id AS artId,a.verified AS artVerified FROM card_definitions c JOIN card_artwork a ON a.id=(SELECT z.id FROM card_artwork z WHERE z.card_id=c.id AND z.verified=1 ORDER BY z.created_at DESC,z.id LIMIT 1) WHERE c.status='published' AND c.verification='verified' AND EXISTS(SELECT 1 FROM card_stories t WHERE t.card_id=c.id AND t.edition>=2 AND t.english_reviewed=1 AND t.urdu_reviewed=1) ORDER BY c.id")->fetchAll(PDO::FETCH_ASSOC);
  return array_values(array_filter(array_map(function($r){$card=$this->view($r);if(!$this->art($card['artId'])||!is_array($card['references'])||count($card['references'])<1)$card['artVerified']=false;return $card;},$rows),fn($card)=>$card['artVerified']));
 }
 public function art(?string $id):?array {
  if(!$id||!preg_match('/^[a-f0-9-]{36}$/D',$id))return null;
  $row=$this->q("SELECT a.* FROM card_artwork a JOIN card_definitions c ON c.id=a.card_id WHERE a.id=? AND a.verified=1 AND c.status='published' AND c.verification='verified'",[$id])->fetch(PDO::FETCH_ASSOC);if(!$row)return null;
  $base=realpath($this->config['artDirectory']??dirname(__DIR__).'/storage/card-art');if(!$base||basename($row['disk_name'])!==$row['disk_name'])return null;$path=realpath($base.DIRECTORY_SEPARATOR.$row['disk_name']);
  if(!$path||dirname($path)!==$base||!is_file($path)||filesize($path)>8388608)return null;
  $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);if(!in_array($mime,['image/png','image/jpeg','image/webp'],true)||$mime!==$row['mime'])return null;
  return ['path'=>$path,'mime'=>$mime];
 }
 public function availability():array {return $this->q("SELECT id,status,(verification='verified') AS verified FROM card_definitions WHERE status<>'published' OR verification<>'verified'")->fetchAll(PDO::FETCH_ASSOC);}
 public function collection(string $uid):array {
  $rows=$this->q("SELECT o.id AS copyId,o.order_id,o.position,o.revealed,o.acquired_at,c.*,(SELECT a.id FROM card_artwork a WHERE a.card_id=c.id AND a.verified=1 ORDER BY a.created_at DESC,a.id LIMIT 1) AS artId FROM owned_cards o JOIN card_definitions c ON c.id=o.card_id WHERE o.user_id=? AND c.status<>'withdrawn' AND c.verification='verified' ORDER BY o.acquired_at DESC,o.order_id,o.position",[$uid])->fetchAll(PDO::FETCH_ASSOC);
  return array_map(fn($r)=>['copyId'=>$r['copyId'],'orderId'=>$r['order_id'],'position'=>(int)$r['position'],'revealed'=>(bool)$r['revealed'],'acquiredAt'=>$r['acquired_at'],'card'=>$this->view($r)],$rows);
 }
 public function pack(string $uid,string $id,?int $expectedCost=null):array {return $this->purchasePack($uid,$id,null,null,$expectedCost);}
 public function importPack(string $uid,string $id,array $cardIds,array $copyIds,int $expectedCost):array {
  foreach([$cardIds,$copyIds] as $ids)if(count($ids)!==3||count(array_unique($ids))!==3||count(array_filter($ids,fn($value)=>!is_string($value)||!preg_match('/^[a-f0-9-]{36}$/D',$value))))throw new InvalidArgumentException('A guest pack must contain three different valid cards and copies');
  return $this->purchasePack($uid,$id,array_values($cardIds),array_values($copyIds),$expectedCost);
 }
 private function purchasePack(string $uid,string $id,?array $cardIds,?array $copyIds,?int $expectedCost):array {
  if(!preg_match('/^[a-f0-9-]{36}$/D',$id))throw new InvalidArgumentException('Invalid pack identifier');$hash=hash('sha256',json_encode($cardIds===null?['pack',[]]:['guest-pack',$cardIds,$copyIds,$expectedCost],JSON_THROW_ON_ERROR));
  $this->begin($uid);try{
   $prior=$this->q('SELECT request_hash,result FROM economy_orders WHERE user_id=? AND id=?',[$uid,$id])->fetch(PDO::FETCH_ASSOC);
   if($prior){if(!hash_equals($prior['request_hash'],$hash))throw new InvalidArgumentException('This purchase identifier was already used');$this->db->commit();$result=json_decode($prior['result'],true);$result['payload']=(object)($result['payload']??[]);return $result;}
   $ledger=new GemLedger($this->db,$this->config);$ledger->reconcileLocked($uid);$balance=(int)$this->q('SELECT balance FROM gem_wallets WHERE user_id=? FOR UPDATE',[$uid])->fetchColumn();$cost=max(1,min(100000,(int)($this->config['prices']['pack']??500)));
   if($expectedCost!==null&&$expectedCost!==$cost)throw new InvalidArgumentException('The pack price changed. Review the current price before buying again.');
   if($balance<$cost)throw new InvalidArgumentException('Not enough Gems');
   // Lock eligible definitions against moderation changes until the purchase commits.
   $this->q("SELECT id FROM card_definitions WHERE status='published' AND verification='verified' ORDER BY id LOCK IN SHARE MODE")->fetchAll();
   if($cardIds===null)$cards=CardRules::pick($this->library(),null,$this->config['rarities']??CardRules::WEIGHTS);
   else{
    $cards=[];foreach($cardIds as $cardId){
     // Guest ownership is retained even if a formerly verified card was later withdrawn; it stays hidden.
     $row=$this->q("SELECT c.*,(SELECT a.id FROM card_artwork a WHERE a.card_id=c.id AND a.verified=1 ORDER BY a.created_at DESC,a.id LIMIT 1) AS artId FROM card_definitions c WHERE c.id=? AND c.verification='verified'",[$cardId])->fetch(PDO::FETCH_ASSOC);
     if(!$row||!$row['artId'])throw new InvalidArgumentException('This guest pack needs review because a card is no longer verified');$row['artVerified']=true;$cards[]=$this->view($row);
    }
    foreach($copyIds as $copyId)if($this->q('SELECT id FROM owned_cards WHERE user_id=? AND id=?',[$uid,$copyId])->fetchColumn())throw new InvalidArgumentException('This card copy already belongs to another pack');
   }
   $copies=[];
   foreach($cards as $position=>$card){$copy=$copyIds[$position]??uuid();$this->q('INSERT INTO owned_cards(user_id,id,card_id,order_id,position) VALUES(?,?,?,?,?)',[$uid,$copy,$card['id'],$id,$position]);$copies[]=['copyId'=>$copy,'card'=>$card,'position'=>$position,'revealed'=>false];}
   $balance-=$cost;$this->q('UPDATE gem_wallets SET balance=? WHERE user_id=?',[$balance,$uid]);$result=['id'=>$id,'kind'=>'pack','payload'=>$cardIds===null?(object)[]:(object)['cardIds'=>$cardIds,'copyIds'=>$copyIds],'cost'=>$cost,'createdAt'=>gmdate('Y-m-d\TH:i:s\Z'),'copies'=>$copies,'balance'=>$balance];
   $this->q('INSERT INTO economy_orders(user_id,id,request_hash,kind,cost,result) VALUES(?,?,?,?,?,?)',[$uid,$id,$hash,'pack',$cost,json_encode($result,JSON_THROW_ON_ERROR)]);
   $this->q('INSERT INTO gem_transactions(user_id,id,source,kind,delta,balance_after,data) VALUES(?,?,?,?,?,?,?)',[$uid,hash('sha256','order:'.$id),'order:'.$id,'pack',-$cost,$balance,json_encode(['orderId'=>$id],JSON_THROW_ON_ERROR)]);
   $this->db->commit();return $result;
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function hiddenCopies(string $uid):array {return $this->q("SELECT o.id FROM owned_cards o JOIN card_definitions c ON c.id=o.card_id WHERE o.user_id=? AND (c.status='withdrawn' OR c.verification<>'verified')",[$uid])->fetchAll(PDO::FETCH_COLUMN);}
 public function revealMany(string $uid,array $copies):void {if(count($copies)<1||count($copies)>100||count(array_filter($copies,fn($id)=>!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/D',$id))))throw new InvalidArgumentException('Invalid card copies');$this->begin($uid);try{foreach(array_unique($copies) as $id)$this->reveal($uid,$id);$this->db->commit();}catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}}
 public function reveal(string $uid,string $copy):void{$this->q('UPDATE owned_cards SET revealed=1 WHERE user_id=? AND id=?',[$uid,$copy]);}
 public function report(string $uid,string $card,string $reason,string $detail):array {
  if(!in_array($reason,['islamic','history','artwork','offensive','other'],true)||mb_strlen($detail)>2000)throw new InvalidArgumentException('Invalid report');
  $this->begin($uid);try{
   $exists=$this->q('SELECT id FROM card_definitions WHERE id=? FOR UPDATE',[$card])->fetchColumn();if(!$exists)throw new InvalidArgumentException('Card not found');
   $user=$this->q('SELECT verified_at,created_at FROM users WHERE id=?',[$uid])->fetch(PDO::FETCH_ASSOC);$credible=!empty($user['verified_at'])||strtotime($user['created_at'])<=time()-604800;
   $prior=$this->q('SELECT id FROM card_reports WHERE user_id=? AND card_id=?',[$uid,$card])->fetchColumn();
   if(!$prior){$this->q('INSERT INTO card_reports(id,user_id,card_id,reason,detail,credible) VALUES(?,?,?,?,?,?)',[uuid(),$uid,$card,$reason,trim($detail),(int)$credible]);$this->audit($card,$uid,in_array($reason,['artwork','offensive'],true)?'critical-report':'report',['reason'=>$reason,'credible'=>$credible]);}
   $count=(int)$this->q("SELECT COUNT(DISTINCT user_id) FROM card_reports WHERE card_id=? AND credible=1 AND status='open'",[$card])->fetchColumn();
   if($count>=max(1,min(100,(int)($this->config['reportThreshold']??5))))$this->q("UPDATE card_definitions SET status='flagged',version=version+1 WHERE id=? AND status='published'",[$card]);
   $this->db->commit();return ['saved'=>true,'duplicate'=>(bool)$prior,'reviewQueued'=>in_array($reason,['artwork','offensive'],true)||$count>=max(1,(int)($this->config['reportThreshold']??5))];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function admin(string $uid):void{if(!in_array($uid,$this->config['adminUsers']??[],true))throw new RuntimeException('Administrator access required');}
 public function queue(string $uid):array{$this->admin($uid);return $this->q("SELECT c.id,c.title,c.status,r.reason,r.detail,r.credible,r.created_at FROM card_reports r JOIN card_definitions c ON c.id=r.card_id WHERE r.status='open' ORDER BY (r.reason IN ('offensive','artwork')) DESC,r.created_at LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);}
 public function reviewQueue(string $uid):array{
  $reports=$this->queue($uid);return ['reports'=>$reports,'drafts'=>$this->q("SELECT id,title,category,rarity,status,verification FROM card_definitions WHERE verification<>'verified' OR status='flagged' ORDER BY created_at DESC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC),'jobs'=>$this->q('SELECT id,status,attempts,error_code,created_at FROM generation_jobs ORDER BY created_at DESC LIMIT 50')->fetchAll(PDO::FETCH_ASSOC),'budgets'=>$this->q('SELECT day,provider,reserved_units,completed_jobs FROM provider_budgets WHERE day=UTC_DATE()')->fetchAll(PDO::FETCH_ASSOC),'generationEnabled'=>($this->config['providers']['enabled']??false)===true];
 }
 public function adminCard(string $uid,string $id):array{
  $this->admin($uid);$row=$this->q('SELECT * FROM card_definitions WHERE id=?',[$id])->fetch(PDO::FETCH_ASSOC);if(!$row)throw new InvalidArgumentException('Card not found');$art=$this->q('SELECT id,mime,provider,license_data,verified,created_at FROM card_artwork WHERE card_id=? ORDER BY created_at DESC,id DESC',[$id])->fetchAll(PDO::FETCH_ASSOC);foreach($art as &$asset)$asset['license']=json_decode($asset['license_data'],true);unset($asset);return ['card'=>$this->view($row),'artwork'=>$art];
 }
 private function storedArtwork(array $row):?array{
  $base=realpath($this->config['artDirectory']??dirname(__DIR__).'/storage/card-art');if(!$base||basename($row['disk_name'])!==$row['disk_name'])return null;$path=realpath($base.DIRECTORY_SEPARATOR.$row['disk_name']);if(!$path||dirname($path)!==$base||!is_file($path)||filesize($path)>8388608)return null;
  $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);$size=@getimagesize($path);if(!$size||$size[0]>4096||$size[1]>4096||!in_array($mime,['image/png','image/jpeg','image/webp'],true)||$mime!==$row['mime']||!hash_equals($row['sha256'],hash_file('sha256',$path)))return null;return ['path'=>$path,'mime'=>$mime];
 }
 public function adminArt(string $uid,string $id):?array{$this->admin($uid);$row=$this->q('SELECT * FROM card_artwork WHERE id=?',[$id])->fetch(PDO::FETCH_ASSOC);return $row?$this->storedArtwork($row):null;}
 public function moderate(string $uid,string $card,string $action,array $body):array {
  $this->admin($uid);if(!in_array($action,['approve','correct','regenerate','withdraw'],true))throw new InvalidArgumentException('Unknown review action');
  $this->begin($uid);try{
   $old=$this->q('SELECT * FROM card_definitions WHERE id=? FOR UPDATE',[$card])->fetch(PDO::FETCH_ASSOC);if(!$old)throw new InvalidArgumentException('Card not found');
   if($action==='approve'){
    if(($body['englishReviewed']??false)!==true||($body['urduReviewed']??false)!==true)throw new InvalidArgumentException('Review both complete English and Urdu editions before publication');
    $edition=$this->q('SELECT * FROM card_stories WHERE card_id=? FOR UPDATE',[$card])->fetch(PDO::FETCH_ASSOC);if(!$edition||mb_strlen($edition['english'])<50||mb_strlen($edition['urdu'])<50||!preg_match('/[\x{0600}-\x{06ff}]/u',$edition['urdu']))throw new InvalidArgumentException('Complete bilingual stories are required');
    if(($body['referencesChecked']??false)!==true||($body['artworkChecked']??false)!==true)throw new InvalidArgumentException('Independent reference and artwork review are required');
    $references=json_decode($old['reference_data'],true);if(!is_array($references)||count($references)<1)throw new InvalidArgumentException('Reliable references are required before approval');
    foreach($references as &$ref){if(!is_array($ref)||!is_string($ref['title']??null)||trim($ref['title'])===''||!is_string($ref['url']??null)||!filter_var($ref['url'],FILTER_VALIDATE_URL)||parse_url($ref['url'],PHP_URL_SCHEME)!=='https')throw new InvalidArgumentException('Review valid HTTPS references before approval');$ref['checked']=true;$ref['checkedBy']=$uid;$ref['checkedAt']=gmdate('c');}unset($ref);
    if(!is_string($body['artId']??null))throw new InvalidArgumentException('Select the exact artwork you reviewed');$artRow=$this->q('SELECT * FROM card_artwork WHERE id=? AND card_id=?',[$body['artId'],$card])->fetch(PDO::FETCH_ASSOC);if(!$artRow||!$this->storedArtwork($artRow))throw new InvalidArgumentException('Valid stored artwork is required');
    $this->q('UPDATE card_stories SET english_reviewed=1,urdu_reviewed=1,review_data=? WHERE card_id=?',[json_encode(['reviewedBy'=>$uid,'reviewedAt'=>gmdate('c')],JSON_THROW_ON_ERROR),$card]);
    $art=$artRow['id'];$this->q('UPDATE card_artwork SET verified=1 WHERE id=?',[$art]);$this->q('UPDATE card_definitions SET reference_data=? WHERE id=?',[json_encode($references,JSON_THROW_ON_ERROR),$card]);$this->q("UPDATE card_definitions SET verification='verified',status='published',verified_at=UTC_TIMESTAMP(),verified_by=?,version=version+1 WHERE id=?",[$uid,$card]);$this->q("UPDATE card_reports SET status='reviewed' WHERE card_id=?",[$card]);
   }elseif($action==='correct'){
    $draft=CardRules::draft($body['draft']??[]);$this->q('INSERT INTO card_stories(card_id,title_urdu,summary,summary_urdu,english,urdu,review_data) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title_urdu=VALUES(title_urdu),summary=VALUES(summary),summary_urdu=VALUES(summary_urdu),english=VALUES(english),urdu=VALUES(urdu),english_reviewed=0,urdu_reviewed=0,review_data=VALUES(review_data),version=version+1',[$card,$draft['titleUrdu'],$draft['summary'],$draft['summaryUrdu'],$draft['english'],$draft['urdu'],'{}']);$this->q("UPDATE card_definitions SET title=?,category=?,rarity=?,story=?,reference_data=?,verification='draft',status='flagged',verified_at=NULL,verified_by=NULL,version=version+1 WHERE id=?",[$draft['title'],$draft['category'],$draft['rarity'],$draft['story'],json_encode($draft['references'],JSON_THROW_ON_ERROR),$card]);
   }elseif($action==='withdraw')$this->q("UPDATE card_definitions SET status='withdrawn',version=version+1 WHERE id=?",[$card]);
   else{
    $pending=$this->q("SELECT id FROM generation_jobs WHERE card_id=? AND status IN ('queued','running') LIMIT 1",[$card])->fetchColumn();if($pending){$this->db->commit();return ['saved'=>true,'action'=>'regenerate','jobId'=>$pending];}
    if((int)$this->q("SELECT COUNT(*) FROM generation_jobs WHERE status IN ('queued','running')")->fetchColumn()>=20)throw new InvalidArgumentException('Generation queue is full');
    $key=hash('sha256','regenerate:'.$card.':'.$old['version']);$this->q("INSERT IGNORE INTO generation_jobs(id,content_key,card_id,provider,payload,available_at) VALUES(?,?,?,'gemini-cloudflare',?,UTC_TIMESTAMP())",[uuid(),$key,$card,json_encode(['title'=>$old['title'],'category'=>$old['category'],'rarity'=>$old['rarity']],JSON_THROW_ON_ERROR)]);$this->q("UPDATE card_definitions SET status='flagged',version=version+1 WHERE id=?",[$card]);
   }
   $this->audit($card,$uid,$action,['previousVersion'=>$old['version'],'previous'=>$old]);$this->db->commit();return ['saved'=>true,'action'=>$action];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
}
