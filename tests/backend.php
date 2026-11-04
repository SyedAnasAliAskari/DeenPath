<?php
require __DIR__ . '/../backend/src/validation.php';
require __DIR__ . '/../backend/src/RewardEngine.php';
$count = 0;
function check(bool $v, string $label): void
{
  global $count;
  if (!$v) {
    throw new RuntimeException('FAIL: ' . $label);
  }
  $count++;
  echo "PASS: $label\n";
}
function rejected(callable $fn): bool
{
  try {
    $fn();
    return false;
  } catch (HttpError) {
    return true;
  }
}
check(
  rejected(fn() => validateRecord('users', 'x', [])),
  'reject client-selected privileged tables',
);
check(
  rejected(
    fn() => validateRecord('prayer_records', '2026-10-26:Fajr', [
      'day' => '2026-10-26',
      'prayer' => 'Isha',
    ]),
  ),
  'reject duplicate-key prayer identities',
);
check(
  rejected(fn() => validateRecord('tasbih_progress', 'x', ['count' => -1])),
  'reject negative counters',
);
check(
  rejected(fn() => passwordField(['password' => 'short'])),
  'require strong minimum password length',
);
check(!validDay('2026-02-30'), 'reject invalid calendar dates');
$r = [
  'r1' => [
    'frequency' => 'daily',
    'timezone' => 'UTC',
    'startDate' => '2026-10-01',
    'interval' => 1,
  ],
];
$done = [];
for ($d = 1; $d <= 7; $d++) {
  $done['r1:2026-10-' . str_pad((string) $d, 2, '0', STR_PAD_LEFT)] = true;
}
$now = new DateTimeImmutable('2026-10-09T12:00:00Z');
$a = RewardEngine::replay('user', $r, $done, $now);
check(
  $a['wallet'] === 0 && count($a['ledger']) === 2,
  'earn after seven successes, spend on eighth-day miss',
);
check(
  $a['streaks']['r1']['current_streak'] === 7,
  'freeze preserves streak without inventing completion',
);
check(
  $a === RewardEngine::replay('user', $r, $done, $now),
  'repeated replay has stable ledger identities and no duplicate rewards',
);
$done['r1:2026-10-08'] = true;
$b = RewardEngine::replay('user', $r, $done, $now);
check(
  $b['wallet'] === 1 && count($b['ledger']) === 1 && $b['streaks']['r1']['current_streak'] === 8,
  'late offline completion repairs the derived ledger',
);
$long = [];
for ($d = 0; $d < 35; $d++) {
  $long['r1:' . (new DateTimeImmutable('2026-10-01'))->modify("+$d days")->format('Y-m-d')] = true;
}
$c = RewardEngine::replay('user', $r, $long, new DateTimeImmutable('2026-11-05T12:00Z'));
check($c['wallet'] === 3, 'wallet never exceeds three');
$w = [
  'r1' => [
    'frequency' => 'weekly',
    'timezone' => 'UTC',
    'startDate' => '2026-10-05',
    'interval' => 1,
  ],
];
$weekly = RewardEngine::replay(
  'user',
  $w,
  ['r1:2026-10-05' => true],
  new DateTimeImmutable('2026-10-12T12:00Z'),
);
check(
  $weekly['streaks']['r1']['current_streak'] === 1 && $weekly['wallet'] === 0,
  'weekly streaks count periods and never earn daily freeze points',
);
check(
  RewardEngine::period(
    ['frequency' => 'interval', 'startDate' => '2026-10-01', 'interval' => 3],
    new DateTimeImmutable('2026-10-05'),
  ) === '2026-10-01:1',
  'PHP interval key matches client',
);
check(
  RewardEngine::period(
    ['frequency' => 'daily', 'deadline' => '04:00'],
    new DateTimeImmutable('2026-10-27T03:00:00Z'),
  ) === '2026-10-26',
  'custom daily deadline assigns early morning to preceding period',
);
$shifted = $r;
$shifted['r1']['deadline'] = '16:00';
check(
  RewardEngine::replay('user', $shifted, $done, new DateTimeImmutable('2026-10-08T12:00Z'))[
    'wallet'
  ] === 0,
  'custom deadline does not award a point before closing',
);
check(
  RewardEngine::replay('user', $shifted, $done, new DateTimeImmutable('2026-10-08T16:00Z'))[
    'wallet'
  ] === 1,
  'custom deadline awards after the period closes',
);
check(
  rejected(
    fn() => validateRecord('private_records', 'p', [
      'format' => 'aes-gcm-device-v1',
      'sealed' => base64_encode(str_repeat('a', 40)),
      'habit' => 'secret',
    ]),
  ),
  'reject plaintext fields in encrypted private records',
);
check(
  rejected(
    fn() => validateRecord('qaza_history', 'h', [
      'prayer' => 'Fajr',
      'quantity' => 1,
      'origin' => 'previous',
      'completed' => [['id' => 'a', 'at' => '2026-10-01', 'quantity' => 2]],
    ]),
  ),
  'reject over-completed historical Qaza',
);
check(
  rejected(
    fn() => validateRecord('qaza_history', 'h', [
      'prayer' => 'Fajr',
      'quantity' => 3,
      'origin' => 'previous',
      'completed' => [['id' => 'a', 'at' => '2026-10-01'], ['id' => 'a', 'at' => '2026-10-01']],
    ]),
  ),
  'reject duplicate historical completion identities',
);
$routines = $r;
foreach (['nafl', 'custom', 'protection', 'recovery'] as $kind) {
  $r = $routines;
  $r['r1']['kind'] = $kind;
  check(
    RewardEngine::replay('user', $r, $done, new DateTimeImmutable('2026-10-09T12:00Z'))[
      'wallet'
    ] === 0,
    "no Freeze Points for $kind",
  );
}
$hijri = [
  'frequency' => 'yearly',
  'startDate' => '2026-01-01',
  'calendar' => 'hijri',
  'hijriMonth' => 9,
  'hijriDay' => 2,
];
check(
  RewardEngine::due($hijri, new DateTimeImmutable('2026-02-19 UTC')),
  'PHP civil Hijri matches TypeScript and Kotlin',
);
$after = [
  'frequency' => 'after_prayer',
  'resetPrayers' => ['Fajr', 'Isha'],
  'startDate' => '2026-10-29',
  'timezone' => 'Asia/Karachi',
  'kind' => 'tasbih',
  'createdAt' => '2026-10-29T00:00Z',
  'resetSettings' => [
    'lat' => 24.8607,
    'lng' => 67.0011,
    'timezone' => 'Asia/Karachi',
    'method' => 'Karachi',
    'hanafi' => true,
    'adjustments' => [0, 0, 0, 0, 0],
  ],
];
check(
  RewardEngine::period($after, new DateTimeImmutable('2026-10-29T00:10Z')) === '2026-10-29:start' &&
    RewardEngine::period($after, new DateTimeImmutable('2026-10-29T02:00Z')) === '2026-10-29:Fajr',
  'selected prayer start resets without a prayer completion',
);
check(
  RewardEngine::period($after, new DateTimeImmutable('2026-10-29T20:00Z')) === '2026-10-29:Isha',
  'midnight does not create an unselected reset',
);
$afterResult = RewardEngine::replay(
  'user',
  ['r' => $after],
  ['r:2026-10-29:Fajr' => true],
  new DateTimeImmutable('2026-10-29T15:00Z'),
);
check(
  $afterResult['streaks']['r']['current_streak'] === 1 && $afterResult['wallet'] === 0,
  'prayer-start period replay matches client without daily Freeze Points',
);
$fixtures = json_decode(file_get_contents(__DIR__ . '/fixtures/prayer-starts.json'), true);
$matches = true;
foreach ($fixtures as $fixture) {
  if (DeenPrayerStarts::starts($fixture['day'], $fixture['settings']) != $fixture['expected']) {
    $matches = false;
  }
}
check(
  $matches && count($fixtures) === 384,
  '384 method/location/season/Asr prayer-start parity cases match the client',
);
$polar = $after;
$polar['resetSettings']['lat'] = 89.0;
$polar['startDate'] = '2026-06-20';
$polar['createdAt'] = '2026-06-20T00:00Z';
check(
  str_ends_with(
    RewardEngine::period($polar, new DateTimeImmutable('2026-06-21T12:00Z')),
    ':unavailable',
  ) &&
    RewardEngine::replay('user', ['p' => $polar], [], new DateTimeImmutable('2026-06-21T12:00Z'))[
      'wallet'
    ] === 0,
  'unavailable polar schedules fail closed without blocking other replay',
);
$validAfter=$after+['title'=>'After prayer','time'=>'21:00'];
$invalidNames=$validAfter;$invalidNames['resetPrayers']=[['Fajr']];check(rejected(fn()=>validateRecord('routines','r',$invalidNames)),'reject malformed reset-prayer selectors');
$invalidSettings=$validAfter;$invalidSettings['resetSettings']['adjustments']=['a'=>0,'b'=>0,'c'=>0,'d'=>0,'e'=>0];check(rejected(fn()=>validateRecord('routines','r',$invalidSettings)),'reject non-list prayer adjustments');
echo "$count backend unit checks passed. Database, mail, HTTP and file integration require configured hosting.\n";
