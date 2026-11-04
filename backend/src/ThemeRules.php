<?php
declare(strict_types=1);
final class ThemeRules {
 public const PRICES=['unlock'=>1000,'colors'=>50,'wallpaper'=>100,'seasonal'=>200,'animated'=>300,'default'=>0];
 public static function clean(string $kind,array $payload):array {
  if(!array_key_exists($kind,self::PRICES))throw new InvalidArgumentException('Unknown customization');
  if(in_array($kind,['unlock','default'],true))return [];
  if($kind==='colors'){
   foreach(['primary','secondary'] as $key)if(!is_string($payload[$key]??null)||!preg_match('/^#[a-f0-9]{6}$/Di',$payload[$key]))throw new InvalidArgumentException('Choose valid colors');
   return ['primary'=>strtolower($payload['primary']),'secondary'=>strtolower($payload['secondary'])];
  }
  if($kind==='wallpaper'){
   if(isset($payload['fileId'])){if(!is_string($payload['fileId'])||!preg_match('/^[a-f0-9-]{36}$/D',$payload['fileId']))throw new InvalidArgumentException('Invalid wallpaper file');return ['fileId'=>$payload['fileId']];}
   if(!in_array($payload['wallpaper']??'', ['sand','garden','night'],true))throw new InvalidArgumentException('Choose a wallpaper');return ['wallpaper'=>$payload['wallpaper']];
  }
  if($kind==='seasonal'){if(!in_array($payload['seasonal']??'',['ramadan','eid'],true))throw new InvalidArgumentException('Choose a seasonal theme');return ['seasonal'=>$payload['seasonal']];}
  $effects=$payload['effects']??null;if(!is_array($effects)||count($effects)<1||count($effects)>4||count(array_filter($effects,fn($e)=>!is_string($e)))||count(array_unique($effects))!==count($effects)||array_diff($effects,['stars','lanterns','clouds','geometry']))throw new InvalidArgumentException('Choose one or more effects');sort($effects);return ['effects'=>$effects];
 }
 public static function apply(array $theme,string $kind,array $payload):array {
  if($kind==='default')return [];
  if($kind==='unlock')return $theme;
  if($kind==='colors')return array_merge($theme,$payload);
  if($kind==='wallpaper'){$theme['wallpaper']=$payload;return $theme;}
  if($kind==='seasonal')return array_merge($theme,['wallpaper'=>['wallpaper'=>$payload['seasonal']],'primary'=>$payload['seasonal']==='ramadan'?'#245858':'#573c76','secondary'=>'#b28b34']);
  $theme['effects']=$payload['effects'];return $theme;
 }
}
