<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../src/validation.php';require __DIR__.'/../src/GenerationQueue.php';
$configFile=__DIR__.'/../config/production.php';if(!is_file($configFile)){fwrite(STDERR,"Private configuration is missing.\n");exit(1);}$config=require $configFile;
$db=new PDO('mysql:host='.$config['db_host'].';dbname='.$config['db_name'].';charset=utf8mb4',$config['db_user'],$config['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
try{echo json_encode((new GenerationQueue($db,$config['cards']??[]))->runOne(),JSON_THROW_ON_ERROR)."\n";}catch(Throwable){fwrite(STDERR,"Generation worker could not run; inspect private server logs.\n");exit(1);}
