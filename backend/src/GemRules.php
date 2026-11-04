<?php
declare(strict_types=1);
/** Same stable completion identities as the offline projection. Never accepts client gem totals. */
final class GemRules {
 public const REWARDS=['prayer'=>10,'qaza'=>8,'tasbih'=>5,'dua'=>5,'custom'=>5];
 public static function sources(array $records,?int $now=null):array {
  $now??=time();$out=[];$valid=static fn($v)=>is_string($v)&&strtotime($v)!==false&&strtotime($v)<=$now+300;
  foreach($records as $r){if($r['deleted']??false)continue;$d=$r['data'];$id=$r['id'];$entity=$r['entity'];
   if($entity==='prayer_records'&&preg_match('/^\d{4}-\d{2}-\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$/D',$id)&&$id===($d['day']??'').':'.($d['prayer']??'')&&($d['status']??'')!=='na'){
    $start=strtotime($d['windowStart']??'');$end=strtotime($d['windowEnd']??'');if($start===false||$end===false||$end<=$start)continue;
    if($valid($d['completedAt']??null)&&strtotime($d['completedAt'])>=$start&&strtotime($d['completedAt'])<$end)$out['prayer:'.$id]='prayer';
    elseif($valid($d['qazaAt']??null)&&strtotime($d['qazaAt'])>=$end)$out['prayer:'.$id]='qaza';
   }
   if($entity==='qaza_history'){
    $count=max(0,min(100000,(int)($d['quantity']??0)));$seen=[];$earned=0;
    foreach($d['completed']??[] as $item)if(is_string($item['id']??null)&&$item['id']!==''&&!isset($seen[$item['id']])&&$valid($item['at']??null)){
     $seen[$item['id']]=true;$quantity=is_int($item['quantity']??1)?max(0,min($count-$earned,$item['quantity']??1)):0;
     for($i=0;$i<$quantity;$i++)$out['historical:'.$id.':'.$item['id'].':'.$i]='qaza';$earned+=$quantity;if($earned>=$count)break;
    }
   }
   if($entity==='routine_completions'&&$id===($d['routineId']??'').':'.($d['period']??'')&&$valid($d['completedAt']??null)){
    foreach($records as $routine)if($routine['entity']==='routines'&&$routine['id']===($d['routineId']??'')){$kind=$routine['data']['kind']??'';if(in_array($kind,['tasbih','dua','custom','quran','nafl'],true))$out['routine:'.$id]=in_array($kind,['tasbih','dua'],true)?$kind:'custom';break;}
   }
  }return $out;
 }
}
