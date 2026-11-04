<?php
// Copy to production.php in this PRIVATE directory. Never put it below a document root.
return [
  'db_host' => 'localhost',
  'db_name' => 'lendwhgp_salah_guard',
  'db_user' => 'lendwhgp_anasaskari',
  'db_password' => '',
  'uploads' => dirname(__DIR__) . '/storage/uploads',
  'max_file_bytes' => 8 * 1024 * 1024,
  'quota_bytes' => 100 * 1024 * 1024,
  'mail_from' => '',
  'mail_enabled' => false,
  'app_name' => 'DeenPath',
  // Server-controlled values. Existing claims retain the reward rate first awarded.
  'economy' => [
    'rewards' => ['prayer'=>10,'qaza'=>8,'tasbih'=>5,'dua'=>5,'custom'=>5],
    'prices' => ['unlock'=>1000,'colors'=>50,'wallpaper'=>100,'seasonal'=>200,'animated'=>300,'pack'=>500],
  ],
  // Web OAuth client ID, not the Android client ID. Blank keeps sign-in disabled.
  'google_web_client_id' => '',
  'cards' => [
    'artDirectory' => dirname(__DIR__).'/storage/card-art',
    'reportThreshold' => 5,
    // Explicit authenticated account UUID allowlist; empty disables moderation access.
    'adminUsers' => [],
    'dailyTextRequests' => 5, 'dailyImages' => 5, 'dailyNeuronBudget' => 2000,
    'providers' => [
      'enabled' => false,
      'gemini' => ['key'=>'','model'=>'','freeTierConfirmed'=>false],
      'cloudflare' => ['key'=>'','accountId'=>'','steps'=>4,'freeTierConfirmed'=>false],
    ],
  ],
  // Leave false in production. Only for PHP's loopback development server.
  'allow_local_http' => false,
];
