<?php
declare(strict_types=1);
final class CardRules {
 public const WEIGHTS=['common'=>55,'uncommon'=>30,'rare'=>12,'ultra'=>3];
 public const CATEGORIES=['common'=>['history','scholars','discoveries','institutions'],'uncommon'=>['events'],'rare'=>['sahabah'],'ultra'=>['prophets']];
 public static function pick(array $library,?callable $random=null,array $weights=self::WEIGHTS):array {
  $random??=static fn(int $min,int $max):int=>random_int($min,$max);
  if(array_keys($weights)!==array_keys(self::WEIGHTS)||array_sum($weights)!==100||array_filter($weights,fn($v)=>!is_int($v)||$v<1))throw new InvalidArgumentException('Invalid rarity weights');
  $pools=array_fill_keys(array_keys(self::WEIGHTS),[]);$seen=[];
  foreach($library as $card)if(($card['verification']??'')==='verified'&&($card['status']??'')==='published'&&!empty($card['artVerified'])&&!empty($card['id'])&&!isset($seen[$card['id']])&&isset($pools[$card['rarity']??''])){$pools[$card['rarity']][]=$card;$seen[$card['id']]=true;}
  // Three in every rarity makes every per-draw probability possible, including three ultra draws.
  foreach($pools as $pool)if(count($pool)<3)throw new InvalidArgumentException('The verified card library is still being prepared. No Gems were spent.');
  $draws=[];
  for($i=0;$i<3;$i++){$roll=$random(1,100);if($roll<1||$roll>100)throw new InvalidArgumentException('Invalid random source');$ceiling=0;$rarity='';foreach($weights as $key=>$weight){$ceiling+=$weight;if($roll<=$ceiling){$rarity=$key;break;}}$index=$random(0,count($pools[$rarity])-1);if(!isset($pools[$rarity][$index]))throw new InvalidArgumentException('Invalid random source');$draws[]=$pools[$rarity][$index];array_splice($pools[$rarity],$index,1);}
  return $draws;
 }
 public static function draft(array $input):array {
  foreach(['title','titleUrdu','category','rarity','summary','summaryUrdu','english','urdu','imagePrompt'] as $key)if(!is_string($input[$key]??null)||trim($input[$key])==='')throw new InvalidArgumentException('Missing card '.$key);
  if(mb_strlen($input['title'])>160||mb_strlen($input['summary'])>500||mb_strlen($input['summaryUrdu'])>500||mb_strlen($input['english'])>100000||mb_strlen($input['urdu'])>100000||mb_strlen($input['titleUrdu'])>160||strlen($input['imagePrompt'])>2048)throw new InvalidArgumentException('Card content is too long');
  if(!in_array($input['category'],self::CATEGORIES[$input['rarity']]??[],true))throw new InvalidArgumentException('Card rarity/category mismatch');
  if(mb_strlen(trim($input['english']))<50||mb_strlen(trim($input['urdu']))<50||!preg_match('/[A-Za-z]/',$input['english'])||!preg_match('/[\x{0600}-\x{06FF}]/u',$input['urdu'])||!preg_match('/[\x{0600}-\x{06FF}]/u',$input['titleUrdu']))throw new InvalidArgumentException('Complete English and proper Urdu stories are required');
  $refs=$input['references']??null;if(!is_array($refs)||count($refs)<1||count($refs)>8)throw new InvalidArgumentException('References required');
  $clean=[];foreach($refs as $ref){if(!is_array($ref)||!is_string($ref['title']??null)||!is_string($ref['url']??null)||strlen($ref['title'])>500||strlen($ref['url'])>2000)throw new InvalidArgumentException('Invalid reference');$parts=parse_url($ref['url']);if(($parts['scheme']??'')!=='https'||empty($parts['host'])||isset($parts['user'])||isset($parts['pass']))throw new InvalidArgumentException('Use HTTPS references');$clean[]=['title'=>$ref['title'],'url'=>$ref['url'],'checked'=>false];}
  // Provider claims of verification are discarded. Only a later authenticated moderator can approve.
  return ['title'=>trim($input['title']),'category'=>$input['category'],'rarity'=>$input['rarity'],'story'=>trim($input['summary']),'titleUrdu'=>trim($input['titleUrdu']),'summary'=>trim($input['summary']),'summaryUrdu'=>trim($input['summaryUrdu']),'english'=>trim($input['english']),'urdu'=>trim($input['urdu']),'edition'=>2,'references'=>$clean,'imagePrompt'=>trim($input['imagePrompt']),'verification'=>'draft','status'=>'draft'];
 }
 public static function symbolicPrompt(string $prompt):string {
  return 'Respectful Islamic educational illustration. Empty environment, architecture, landscape, geometric patterns or symbolic objects only. No humans, faces, portraits, silhouettes, bodies, angels or depictions of any Prophet or Companion. No invented scripture or lettering. Scene: '.mb_substr($prompt,0,1500);
 }
}
