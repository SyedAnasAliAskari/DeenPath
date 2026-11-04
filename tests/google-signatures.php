<?php
declare(strict_types=1);require __DIR__.'/../backend/vendor/autoload.php';require __DIR__.'/../backend/src/GoogleIdentity.php';
use Firebase\JWT\JWT;use Google\Auth\AccessToken;use GuzzleHttp\Psr7\Response;
function signedCheck(bool $test,string $label):void{if(!$test)throw new RuntimeException($label);echo "PASS: $label\n";}
$pair=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);openssl_pkey_export($pair,$private);$details=openssl_pkey_get_details($pair);$url=static fn($s)=>rtrim(strtr(base64_encode($s),'+/','-_'),'=');
$jwks=['keys'=>[['kid'=>'fixture-key','kty'=>'RSA','alg'=>'RS256','use'=>'sig','n'=>$url($details['rsa']['n']),'e'=>$url($details['rsa']['e'])]]];$calls=0;
$access=new AccessToken(static function($request,$options=[])use($jwks,&$calls){$calls++;return new Response(200,['Cache-Control'=>'max-age=3600'],json_encode($jwks));});
$nonce=str_repeat('a',64);$aud='fixture.apps.googleusercontent.com';$payload=['sub'=>'fixture-subject','email'=>'fixture@example.invalid','email_verified'=>true,'iss'=>'https://accounts.google.com','aud'=>$aud,'iat'=>time(),'exp'=>time()+300,'nonce'=>$nonce];
$verify=static fn($token,$audience)=>$access->verify($token,['audience'=>$audience]);$token=JWT::encode($payload,$private,'RS256','fixture-key');
signedCheck(GoogleIdentity::claims($token,$aud,$nonce,$verify)['subject']==='fixture-subject','official Google library accepts the correctly signed fixture');
$parts=explode('.',$token);$changed=$payload;$changed['sub']='attacker';$parts[1]=$url(json_encode($changed));try{GoogleIdentity::claims(implode('.',$parts),$aud,$nonce,$verify);throw new RuntimeException('Tampered signature accepted');}catch(InvalidArgumentException){signedCheck(true,'tampered signed payload rejected');}
$expired=JWT::encode(array_merge($payload,['exp'=>time()-10]),$private,'RS256','fixture-key');try{GoogleIdentity::claims($expired,$aud,$nonce,$verify);throw new RuntimeException('Expired signature accepted');}catch(InvalidArgumentException){signedCheck(true,'expired signed token rejected');}
$wrong=JWT::encode(array_merge($payload,['aud'=>'attacker.apps.googleusercontent.com']),$private,'RS256','fixture-key');try{GoogleIdentity::claims($wrong,$aud,$nonce,$verify);throw new RuntimeException('Wrong audience accepted');}catch(InvalidArgumentException){signedCheck(true,'valid signature with the wrong audience rejected');}
signedCheck($calls===1,'certificate response cached across verification attempts');
