<?php
declare(strict_types=1);
require_once __DIR__.'/GemLedger.php';require_once __DIR__.'/ThemeRules.php';
final class GemShop {
 public function __construct(private PDO $db,private array $config=[]){}
 private function q(string $sql,array $args=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($args);return $s;}
 public function purchase(string $uid,string $id,string $kind,array $payload,?int $expectedCost=null):array {
  if(!preg_match('/^[a-f0-9-]{36}$/D',$id))throw new InvalidArgumentException('Invalid purchase identifier');$payload=ThemeRules::clean($kind,$payload);$hash=hash('sha256',json_encode([$kind,$payload],JSON_THROW_ON_ERROR));
  $this->db->beginTransaction();try{
   $this->q('SELECT id FROM users WHERE id=? FOR UPDATE',[$uid]);
   $prior=$this->q('SELECT request_hash,result FROM economy_orders WHERE user_id=? AND id=?',[$uid,$id])->fetch(PDO::FETCH_ASSOC);
   if($prior){if(!hash_equals($prior['request_hash'],$hash))throw new InvalidArgumentException('This purchase identifier was already used');$this->db->commit();$result=json_decode($prior['result'],true,32,JSON_THROW_ON_ERROR);$result['payload']=(object)($result['payload']??[]);$result['theme']=(object)($result['theme']??[]);return $result;}
   $ledger=new GemLedger($this->db,$this->config);$ledger->reconcileLocked($uid);$wallet=$this->q('SELECT balance,studio_unlocked FROM gem_wallets WHERE user_id=? FOR UPDATE',[$uid])->fetch(PDO::FETCH_ASSOC);
   if(!in_array($kind,['unlock','default'],true)&&!$wallet['studio_unlocked'])throw new InvalidArgumentException('Unlock Theme Studio first');
   if($kind==='unlock'&&$wallet['studio_unlocked'])throw new InvalidArgumentException('Theme Studio is already unlocked');
   $cost=$kind==='default'?0:max(0,min(100000,(int)($this->config['prices'][$kind]??ThemeRules::PRICES[$kind])));
   if($expectedCost!==null&&$expectedCost!==$cost)throw new InvalidArgumentException('The customization price changed. Review the current price before applying again.');
   if($cost>0&&(int)$wallet['balance']<$cost)throw new InvalidArgumentException('Not enough Gems');
   if($kind==='wallpaper'&&isset($payload['fileId'])){
    $mime=$this->q('SELECT mime FROM user_files WHERE user_id=? AND id=?',[$uid,$payload['fileId']])->fetchColumn();if(!in_array($mime,['image/png','image/jpeg','image/webp'],true))throw new InvalidArgumentException('Upload your wallpaper image before syncing this purchase');
   }
   $old=$this->q('SELECT data,revision FROM user_customizations WHERE user_id=?',[$uid])->fetch(PDO::FETCH_ASSOC);$theme=ThemeRules::apply($old?json_decode($old['data'],true):[],$kind,$payload);$revision=(int)($old['revision']??0)+1;
   $this->q('INSERT INTO user_customizations(user_id,data,revision) VALUES(?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),revision=VALUES(revision)',[$uid,json_encode((object)$theme,JSON_THROW_ON_ERROR),$revision]);
   $balance=(int)$wallet['balance']-$cost;$this->q('UPDATE gem_wallets SET balance=?,studio_unlocked=? WHERE user_id=?',[$balance,(int)($wallet['studio_unlocked']||$kind==='unlock'),$uid]);
   $result=['id'=>$id,'kind'=>$kind,'payload'=>(object)$payload,'createdAt'=>gmdate('Y-m-d\TH:i:s\Z'),'cost'=>$cost,'theme'=>(object)$theme,'themeRevision'=>$revision,'balance'=>$balance,'studioUnlocked'=>(bool)($wallet['studio_unlocked']||$kind==='unlock')];
   $this->q('INSERT INTO economy_orders(user_id,id,request_hash,kind,cost,result) VALUES(?,?,?,?,?,?)',[$uid,$id,$hash,$kind,$cost,json_encode($result,JSON_THROW_ON_ERROR)]);
   $this->q('INSERT INTO gem_transactions(user_id,id,source,kind,delta,balance_after,data) VALUES(?,?,?,?,?,?,?)',[$uid,hash('sha256','order:'.$id),'order:'.$id,'purchase',-$cost,$balance,json_encode(['kind'=>$kind,'orderId'=>$id],JSON_THROW_ON_ERROR)]);
   $this->db->commit();return $result;
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
}
