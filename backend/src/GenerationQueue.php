<?php
declare(strict_types=1);require_once __DIR__.'/CardProviders.php';
final class GenerationQueue {
 public function __construct(private PDO $db,private array $config){}
 private function q(string $sql,array $args=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($args);return $s;}
 public function enqueue(array $topic,?string $card=null):array {
  if(!is_string($topic['title']??null)||trim($topic['title'])===''||mb_strlen($topic['title'])>160||!in_array($topic['category']??'',CardRules::CATEGORIES[$topic['rarity']??'']??[],true))throw new InvalidArgumentException('Invalid generation topic');
  $topic=['title'=>trim($topic['title']),'category'=>$topic['category'],'rarity'=>$topic['rarity']];$key=hash('sha256',json_encode([$card,mb_strtolower($topic['title']),$topic['category'],$topic['rarity']],JSON_THROW_ON_ERROR));
  $this->db->beginTransaction();try{
   $this->q("INSERT IGNORE INTO provider_budgets(day,provider) VALUES(UTC_DATE(),'queue')");$this->q("SELECT reserved_units FROM provider_budgets WHERE day=UTC_DATE() AND provider='queue' FOR UPDATE");
   $old=$this->q('SELECT id,status FROM generation_jobs WHERE content_key=?',[$key])->fetch(PDO::FETCH_ASSOC);if($old){$this->db->commit();return $old;}
   if((int)$this->q("SELECT COUNT(*) FROM generation_jobs WHERE status IN ('queued','running')")->fetchColumn()>=20)throw new InvalidArgumentException('Generation queue is full');
   $id=uuid();$this->q("INSERT INTO generation_jobs(id,content_key,card_id,provider,payload,available_at) VALUES(?,?,?,'gemini-cloudflare',?,UTC_TIMESTAMP())",[$id,$key,$card,json_encode($topic,JSON_THROW_ON_ERROR)]);$this->db->commit();return ['id'=>$id,'status'=>'queued'];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function runOne(?CardProviders $provider=null):array {
  $providers=$this->config['providers']??[];if(($providers['enabled']??false)!==true)return ['status'=>'disabled'];
  // Validate configuration before leasing. An unconfigured cron cannot consume the retry budget.
  foreach(['gemini','cloudflare'] as $name)if(($providers[$name]['freeTierConfirmed']??false)!==true||empty($providers[$name]['key']))return ['status'=>'configuration_required'];
  $this->db->beginTransaction();try{
   $this->q("UPDATE generation_jobs SET status='failed',lease_until=NULL,error_code='LeaseExpired' WHERE status='running' AND lease_until<UTC_TIMESTAMP() AND attempts>=3");
   $job=$this->q("SELECT * FROM generation_jobs WHERE ((status='queued' AND available_at<=UTC_TIMESTAMP()) OR (status='running' AND lease_until<UTC_TIMESTAMP())) AND attempts<3 ORDER BY created_at,id LIMIT 1 FOR UPDATE")->fetch(PDO::FETCH_ASSOC);
   if(!$job){$this->db->commit();return ['status'=>'idle'];}
   $textCap=max(0,min(100,(int)($this->config['dailyTextRequests']??5)));$imageCap=max(0,min(100,(int)($this->config['dailyImages']??5)));$neuronCap=max(0,min(10000,(int)($this->config['dailyNeuronBudget']??2000)));
   foreach(['gemini'=>[1,$textCap],'cloudflare'=>[400,min($neuronCap,$imageCap*400)]] as $name=>[$units,$limit]){
    $this->q('INSERT IGNORE INTO provider_budgets(day,provider) VALUES(UTC_DATE(),?)',[$name]);$used=(int)$this->q('SELECT reserved_units FROM provider_budgets WHERE day=UTC_DATE() AND provider=? FOR UPDATE',[$name])->fetchColumn();
    if($used+$units>$limit){$this->db->rollBack();return ['status'=>'daily_limit'];}
    $this->q('UPDATE provider_budgets SET reserved_units=reserved_units+? WHERE day=UTC_DATE() AND provider=?',[$units,$name]);
   }
   $this->q("UPDATE generation_jobs SET status='running',attempts=attempts+1,lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE) WHERE id=?",[$job['id']]);$this->db->commit();
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
  try{
   $provider??=new CardProviders($providers);$topic=json_decode($job['payload'],true,16,JSON_THROW_ON_ERROR);$draft=$provider->draft($topic);$fingerprint=hash('sha256',mb_strtolower(preg_replace('/\s+/u',' ',trim($draft['english'].' '.$draft['urdu']))));
   $duplicate=$this->q('SELECT card_id FROM card_content_fingerprints WHERE content_hash=?',[$fingerprint])->fetchColumn();if($duplicate){$this->finish($job['id'],'duplicate',['cardId'=>$duplicate]);return ['status'=>'duplicate','id'=>$job['id']];}
   $image=$provider->image($draft['imagePrompt']);$duplicate=$this->q('SELECT card_id FROM card_artwork WHERE sha256=? LIMIT 1',[$image['sha256']])->fetchColumn();if($duplicate){$this->finish($job['id'],'duplicate',['cardId'=>$duplicate]);return ['status'=>'duplicate','id'=>$job['id']];}
   $dir=$this->config['artDirectory']??dirname(__DIR__).'/storage/card-art';if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Artwork storage unavailable');$dir=realpath($dir);if(!$dir)throw new RuntimeException('Artwork storage unavailable');
   $extension=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'][$image['mime']];$name=$image['sha256'].'.'.$extension;$path=$dir.DIRECTORY_SEPARATOR.$name;
   if(!is_file($path)){$file=@fopen($path,'xb');if(!$file)throw new RuntimeException('Artwork storage unavailable');try{if(fwrite($file,$image['bytes'])!==strlen($image['bytes']))throw new RuntimeException('Artwork write incomplete');}finally{fclose($file);}}
   if(!hash_equals($image['sha256'],hash_file('sha256',$path)))throw new RuntimeException('Artwork integrity mismatch');
   $card=$job['card_id']?:uuid();$art=uuid();$this->db->beginTransaction();
   if($job['card_id']){$old=$this->q('SELECT id FROM card_definitions WHERE id=? FOR UPDATE',[$card])->fetchColumn();if(!$old)throw new RuntimeException('Card no longer exists');$this->q("UPDATE card_definitions SET title=?,category=?,rarity=?,story=?,reference_data=?,verification='draft',status='flagged',generation_date=UTC_TIMESTAMP(),verified_at=NULL,verified_by=NULL,version=version+1 WHERE id=?",[$draft['title'],$draft['category'],$draft['rarity'],$draft['story'],json_encode($draft['references'],JSON_THROW_ON_ERROR),$card]);}
   else $this->q("INSERT INTO card_definitions(id,title,category,rarity,story,reference_data,verification,status,generation_date) VALUES(?,?,?,?,?,?,'draft','draft',UTC_TIMESTAMP())",[$card,$draft['title'],$draft['category'],$draft['rarity'],$draft['story'],json_encode($draft['references'],JSON_THROW_ON_ERROR)]);
   $this->q('INSERT INTO card_stories(card_id,title_urdu,summary,summary_urdu,english,urdu,edition,english_reviewed,urdu_reviewed,review_data) VALUES(?,?,?,?,?,?,2,0,0,?) ON DUPLICATE KEY UPDATE title_urdu=VALUES(title_urdu),summary=VALUES(summary),summary_urdu=VALUES(summary_urdu),english=VALUES(english),urdu=VALUES(urdu),edition=2,english_reviewed=0,urdu_reviewed=0,review_data=VALUES(review_data),version=version+1',[$card,$draft['titleUrdu'],$draft['summary'],$draft['summaryUrdu'],$draft['english'],$draft['urdu'],'{}']);
   $this->q('INSERT INTO card_content_fingerprints(content_hash,card_id) VALUES(?,?)',[$fingerprint,$card]);$this->q('INSERT INTO card_artwork(id,card_id,disk_name,sha256,mime,provider,license_data,verified) VALUES(?,?,?,?,?,?,?,0)',[$art,$card,$name,$image['sha256'],$image['mime'],$image['provider'],json_encode($image['license'],JSON_THROW_ON_ERROR)]);
   $this->q('INSERT INTO card_audit(id,card_id,actor,action,data) VALUES(?,?,?,?,?)',[uuid(),$card,'generation-worker','draft-generated',json_encode(['jobId'=>$job['id'],'artId'=>$art,'independentReviewRequired'=>true],JSON_THROW_ON_ERROR)]);
   $this->q("UPDATE generation_jobs SET status='awaiting_review',lease_until=NULL,result=?,error_code=NULL WHERE id=?",[json_encode(['cardId'=>$card,'artId'=>$art,'imagePrompt'=>$draft['imagePrompt'],'provider'=>$image['provider'],'steps'=>$image['steps'],'width'=>$image['width'],'height'=>$image['height'],'estimatedNeurons'=>ceil($image['width']/512)*ceil($image['height']/512)*4.8+$image['steps']*9.6],JSON_THROW_ON_ERROR),$job['id']]);
   $this->q("UPDATE provider_budgets SET completed_jobs=completed_jobs+1 WHERE day=UTC_DATE() AND provider IN ('gemini','cloudflare')");$this->db->commit();return ['status'=>'awaiting_review','id'=>$job['id'],'cardId'=>$card];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();$this->q("UPDATE generation_jobs SET status=IF(attempts>=3,'failed','queued'),available_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE),lease_until=NULL,error_code=? WHERE id=?",[get_class($e),$job['id']]);return ['status'=>'deferred','id'=>$job['id'],'errorCode'=>get_class($e)];}
 }
 private function finish(string $id,string $status,array $result):void{$this->q('UPDATE generation_jobs SET status=?,result=?,lease_until=NULL,error_code=NULL WHERE id=?',[$status,json_encode($result,JSON_THROW_ON_ERROR),$id]);}
}
