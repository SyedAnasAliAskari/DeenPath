<?php
declare(strict_types=1);
require_once __DIR__.'/GemRules.php';
require_once __DIR__.'/ThemeRules.php';
/** Call reconcileLocked within a transaction after taking users.id FOR UPDATE. */
final class GemLedger {
 public function __construct(private PDO $db,private array $config=[]){}
 private function q(string $sql,array $args=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($args);return $s;}
 public function reconcileLocked(string $uid):void {
  $this->q('INSERT IGNORE INTO gem_wallets(user_id,balance) VALUES(?,0)',[$uid]);
  $balance=(int)$this->q('SELECT balance FROM gem_wallets WHERE user_id=? FOR UPDATE',[$uid])->fetchColumn();
  $records=[];
  foreach(['prayer_records','qaza_history','routines','routine_completions'] as $table)foreach($this->q("SELECT id,data,deleted FROM $table WHERE user_id=?",[$uid])->fetchAll(PDO::FETCH_ASSOC) as $r){$r['entity']=$table;$r['data']=json_decode($r['data'],true,32,JSON_THROW_ON_ERROR);$records[]=$r;}
  $sources=GemRules::sources($records);$prior=[];
  foreach($this->q('SELECT * FROM gem_claims WHERE user_id=?',[$uid])->fetchAll(PDO::FETCH_ASSOC) as $claim)$prior[$claim['source']]=$claim;
  foreach(array_unique(array_merge(array_keys($prior),array_keys($sources))) as $source){
   $old=$prior[$source]??null;$kind=$sources[$source]??null;$rates=$old?json_decode($old['rates'],true):[];
   if($kind!==null&&!isset($rates[$kind]))$rates[$kind]=max(0,min(10000,(int)($this->config['rewards'][$kind]??GemRules::REWARDS[$kind])));
   $amount=$kind!==null?$rates[$kind]:0;$before=$old&&$old['active']?(int)$old['amount']:0;
   if($amount===$before&&($kind===null||($old['kind']??null)===$kind))continue;
   $revision=(int)($old['revision']??0)+1;$delta=$amount-$before;$balance+=$delta;
   $this->q('INSERT INTO gem_claims(user_id,source,kind,amount,active,revision,rates) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE kind=VALUES(kind),amount=VALUES(amount),active=VALUES(active),revision=VALUES(revision),rates=VALUES(rates)',[$uid,$source,$kind??$old['kind'],$amount,(int)($kind!==null),$revision,json_encode($rates,JSON_THROW_ON_ERROR)]);
   $this->q('INSERT INTO gem_transactions(user_id,id,source,kind,delta,balance_after,data) VALUES(?,?,?,?,?,?,?)',[$uid,hash('sha256',$source.':'.$revision),$source,$kind??'correction',$delta,$balance,json_encode(['claimRevision'=>$revision],JSON_THROW_ON_ERROR)]);
  }
  $this->q('UPDATE gem_wallets SET balance=? WHERE user_id=?',[$balance,$uid]);
 }
 public function reconcile(string $uid):array {
  $this->db->beginTransaction();try{$this->q('SELECT id FROM users WHERE id=? FOR UPDATE',[$uid]);$this->reconcileLocked($uid);$result=$this->snapshot($uid);$this->db->commit();return $result;}catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function snapshot(string $uid):array {
  $wallet=$this->q('SELECT balance,studio_unlocked FROM gem_wallets WHERE user_id=?',[$uid])->fetch(PDO::FETCH_ASSOC);$claims=[];$transactions=[];
  foreach($this->q('SELECT * FROM gem_claims WHERE user_id=?',[$uid])->fetchAll(PDO::FETCH_ASSOC) as $r)$claims[$r['source']]=['kind'=>$r['kind'],'amount'=>(int)$r['amount'],'active'=>(bool)$r['active'],'revision'=>(int)$r['revision'],'rates'=>json_decode($r['rates'],true)];
  foreach($this->q('SELECT * FROM gem_transactions WHERE user_id=? ORDER BY created_at,id',[$uid])->fetchAll(PDO::FETCH_ASSOC) as $r)$transactions[$r['id']]=['id'=>$r['id'],'source'=>$r['source'],'kind'=>$r['kind'],'delta'=>(int)$r['delta'],'at'=>str_replace(' ','T',$r['created_at']).'Z','balanceAfter'=>(int)$r['balance_after']];
  $custom=$this->q('SELECT data,revision FROM user_customizations WHERE user_id=?',[$uid])->fetch(PDO::FETCH_ASSOC);$orders=[];
  foreach($this->q('SELECT id,result FROM economy_orders WHERE user_id=? ORDER BY created_at,id',[$uid])->fetchAll(PDO::FETCH_ASSOC) as $row){$order=json_decode($row['result'],true);$orders[$row['id']]=['id'=>$row['id'],'kind'=>$order['kind'],'payload'=>(object)($order['payload']??[]),'createdAt'=>$order['createdAt']??'','cost'=>$order['cost'],'status'=>'accepted'];}
  $prices=ThemeRules::PRICES;foreach($prices as $key=>$value)$prices[$key]=$key==='default'?0:max(0,min(100000,(int)($this->config['prices'][$key]??$value)));
  $prices['pack']=max(1,min(100000,(int)($this->config['prices']['pack']??500)));
  $rarities=$this->config['rarities']??['common'=>55,'uncommon'=>30,'rare'=>12,'ultra'=>3];
  $rewards=GemRules::REWARDS;foreach($rewards as $key=>$value)$rewards[$key]=max(0,min(10000,(int)($this->config['rewards'][$key]??$value)));
  return ['theme'=>$custom?json_decode($custom['data']):(object)[],'themeRevision'=>(int)($custom['revision']??0),'orders'=>(object)$orders,'prices'=>(object)$prices,'rarities'=>(object)$rarities,'rewardValues'=>(object)$rewards,'version'=>1,'balance'=>(int)($wallet['balance']??0),'studioUnlocked'=>(bool)($wallet['studio_unlocked']??false),'claims'=>(object)$claims,'transactions'=>(object)$transactions];
 }
}
