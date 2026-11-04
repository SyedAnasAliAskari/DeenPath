<?php
declare(strict_types=1);require __DIR__.'/../backend/src/CardRules.php';
function assertCard(bool $test,string $name):void{if(!$test)throw new RuntimeException($name);echo "PASS: $name\n";}
$cards=[];foreach(CardRules::WEIGHTS as $rarity=>$weight)for($i=0;$i<3;$i++)$cards[]=['id'=>$rarity.$i,'rarity'=>$rarity,'verification'=>'verified','status'=>'published','artVerified'=>true];
foreach([1=>'common',55=>'common',56=>'uncommon',85=>'uncommon',86=>'rare',97=>'rare',98=>'ultra',100=>'ultra'] as $roll=>$rarity){$calls=0;$draw=CardRules::pick($cards,static function(int $min,int $max)use($roll,&$calls):int{return $calls++%2===0?$roll:0;});assertCard(count(array_unique(array_column($draw,'id')))===3&&count(array_filter($draw,fn($c)=>$c['rarity']===$rarity))===3,'distinct per-draw boundary '.$roll);}
$draft=['title'=>'Symbolic test','rarity'=>'ultra','category'=>'prophets','story'=>'This is a synthetic test sentence. This second sentence tests schema shape. The third sentence makes no religious claim.','imagePrompt'=>'An empty desert landscape','references'=>[['title'=>'Fixture only','url'=>'https://example.invalid/fixture']],'verification'=>'verified'];
$draft+=['titleUrdu'=>'آزمائشی کہانی','summary'=>$draft['story'],'summaryUrdu'=>'یہ صرف جانچ کے لیے ایک مختصر تعارف ہے۔','english'=>$draft['story'],'urdu'=>'یہ آزمائشی کہانی ہے۔ اس میں کوئی تاریخی یا مذہبی دعویٰ نہیں ہے۔ تیسرا جملہ قاری اور زبان کی جانچ کے لیے ہے۔'];
assertCard(CardRules::draft($draft)['verification']==='draft','AI cannot mark its own references verified');
assertCard(CardRules::draft($draft)['references'][0]['checked']===false,'reference checking requires later independent review');
try{CardRules::pick(array_slice($cards,0,11));throw new RuntimeException('Incomplete library accepted');}catch(InvalidArgumentException){assertCard(true,'incomplete verified pool cannot silently change rarity probabilities');}
$cards[0]['artVerified']=false;try{CardRules::pick($cards);throw new RuntimeException('Unverified art accepted');}catch(InvalidArgumentException){assertCard(true,'unverified artwork is never distributed');}
assertCard(str_contains(CardRules::symbolicPrompt('Garden'),'No humans'),'symbolic-only provider prompt');
