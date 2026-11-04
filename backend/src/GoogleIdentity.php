<?php
declare(strict_types=1);
final class GoogleIdentity {
 public static function claims(string $token,string $audience,string $nonce,?callable $verify=null):array {
  if($audience===''||!preg_match('/^[a-f0-9]{64}$/D',$nonce)||strlen($token)>16384)throw new InvalidArgumentException('Invalid Google sign-in request');
  if($verify===null){
   $autoload=dirname(__DIR__).'/vendor/autoload.php';if(!is_file($autoload))throw new RuntimeException('Google authentication dependencies are not installed');require_once $autoload;
   $cache=new Symfony\Component\Cache\Adapter\FilesystemAdapter('google-certs',3600,dirname(__DIR__).'/storage/auth-cache');
   $http=Google\Auth\HttpHandler\HttpHandlerFactory::build(new GuzzleHttp\Client(['timeout'=>10,'connect_timeout'=>5,'allow_redirects'=>false]));
   $access=new Google\Auth\AccessToken($http,$cache);$verify=static fn($value,$aud)=>$access->verify($value,['audience'=>$aud]);
  }
  try{$claims=$verify($token,$audience);}catch(Throwable){throw new InvalidArgumentException('Google identity could not be verified');}
  if(!is_array($claims)||!is_string($claims['sub']??null)||strlen($claims['sub'])<1||strlen($claims['sub'])>255||!in_array($claims['iss']??'', ['accounts.google.com','https://accounts.google.com'],true)||($claims['aud']??null)!==$audience||!is_int($claims['exp']??null)||$claims['exp']<=time()||!is_int($claims['iat']??null)||$claims['iat']>time()+60||!is_string($claims['nonce']??null)||!hash_equals($nonce,$claims['nonce'])||($claims['email_verified']??false)!==true||!is_string($claims['email']??null)||!filter_var($claims['email'],FILTER_VALIDATE_EMAIL))throw new InvalidArgumentException('Google identity could not be verified');
  return ['subject'=>$claims['sub'],'email'=>strtolower($claims['email']),'name'=>mb_substr(trim((string)($claims['name']??'DeenPath user')),0,160)?:'DeenPath user'];
 }
 public function __construct(private PDO $db){}
 private function q(string $sql,array $args=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($args);return $s;}
 public function challenge():string{
  $nonce=bin2hex(random_bytes(32));$this->q('INSERT INTO google_signin_challenges(nonce_hash,expires_at) VALUES(?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))',[hash('sha256',$nonce)]);
  $this->q('DELETE FROM google_signin_challenges WHERE expires_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)');return $nonce;
 }
 /** A matching email alone never links an existing password account. */
 public function associate(array $claims,string $nonce,?string $linkOwner=null):string {
  $this->db->beginTransaction();try{
   $challenge=$this->q('SELECT nonce_hash FROM google_signin_challenges WHERE nonce_hash=? AND expires_at>UTC_TIMESTAMP() AND consumed=0 FOR UPDATE',[hash('sha256',$nonce)])->fetchColumn();if(!$challenge)throw new InvalidArgumentException('Google sign-in has expired; please try again');
   $existing=$this->q('SELECT user_id FROM google_identities WHERE subject=? FOR UPDATE',[$claims['subject']])->fetchColumn();
   if($linkOwner!==null){$this->q('SELECT id FROM users WHERE id=? FOR UPDATE',[$linkOwner]);if($existing&&$existing!==$linkOwner)throw new InvalidArgumentException('This Google account is linked to another profile');$uid=$linkOwner;}
   elseif($existing)$uid=$existing;
   else{
    if($this->q('SELECT id FROM users WHERE email=? FOR UPDATE',[$claims['email']])->fetchColumn())throw new InvalidArgumentException('Sign in with your existing email and password first, then link Google in your profile');
    $uid=uuid();$this->q('INSERT INTO users(id,name,email,password_hash,verified_at) VALUES(?,?,?,?,UTC_TIMESTAMP())',[$uid,$claims['name'],$claims['email'],password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT)]);$this->q('INSERT INTO freeze_wallets(user_id,balance) VALUES(?,0)',[$uid]);
   }
   if(!$existing&&$this->q('SELECT subject FROM google_identities WHERE user_id=?',[$uid])->fetchColumn())throw new InvalidArgumentException('This profile already has a linked Google account');
   if(!$existing)$this->q('INSERT INTO google_identities(subject,user_id) VALUES(?,?)',[$claims['subject'],$uid]);
   $this->q('UPDATE google_signin_challenges SET consumed=1 WHERE nonce_hash=?',[hash('sha256',$nonce)]);$this->db->commit();return $uid;
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
}
