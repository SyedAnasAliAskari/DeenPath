<?php
declare(strict_types=1);
final class HttpError extends RuntimeException
{
  public function __construct(public int $status, string $message)
  {
    parent::__construct($message);
  }
}
function fail(int $status, string $message): never
{
  throw new HttpError($status, $message);
}
function uuid(): string
{
  $x = random_bytes(16);
  $x[6] = chr((ord($x[6]) & 15) | 64);
  $x[8] = chr((ord($x[8]) & 63) | 128);
  $h = bin2hex($x);
  return substr($h, 0, 8) .
    '-' .
    substr($h, 8, 4) .
    '-' .
    substr($h, 12, 4) .
    '-' .
    substr($h, 16, 4) .
    '-' .
    substr($h, 20);
}
function textField(array $b, string $k, int $max = 200): string
{
  $v = $b[$k] ?? null;
  if (!is_string($v) || trim($v) === '' || strlen($v) > $max) {
    fail(422, 'Invalid ' . $k);
  }
  return trim($v);
}
function emailField(array $b): string
{
  $e = strtolower(textField($b, 'email', 254));
  if (!filter_var($e, FILTER_VALIDATE_EMAIL)) {
    fail(422, 'Invalid email');
  }
  return $e;
}
function passwordField(array $b): string
{
  $p = $b['password'] ?? '';
  if (!is_string($p) || strlen($p) < 12 || strlen($p) > 128) {
    fail(422, 'Password must contain 12–128 bytes');
  }
  return $p;
}
function validDay(string $d): bool
{
  $v = DateTimeImmutable::createFromFormat('!Y-m-d', $d);
  return $v && $v->format('Y-m-d') === $d;
}
const ENTITIES = [
  'prayer_records',
  'qaza_records',
  'routines',
  'routine_completions',
  'tasbih_progress',
  'user_settings',
  'qaza_history',
  'milestone_events',
  'learning_progress',
  'private_records',
];
function validateRecord(string $entity, string $id, array $d): void
{
  if (!in_array($entity, ENTITIES, true) || !preg_match('/^[A-Za-z0-9:._-]{1,150}$/D', $id)) {
    fail(422, 'Invalid record identity');
  }
  if (strlen(json_encode($d)) > 65536) {
    fail(422, 'Record too large');
  }
  if ($entity === 'prayer_records' || $entity === 'qaza_records') {
    if (
      !validDay($d['day'] ?? '') ||
      !in_array($d['prayer'] ?? '', ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], true) ||
      $id !== $d['day'] . ':' . $d['prayer']
    ) {
      fail(422, 'Invalid prayer identity');
    }
    if (
      isset($d['status']) &&
      !in_array($d['status'], ['recorded', 'missed', 'unknown', 'qaza', 'na'], true)
    ) {
      fail(422, 'Invalid prayer status');
    }
    if (
      isset($d['midday']) &&
      $d['midday'] !== null &&
      !in_array($d['midday'], ['Dhuhr', 'Jumuah'], true)
    ) {
      fail(422, 'Invalid midday slot');
    }
    foreach (['completedAt', 'qazaAt'] as $k) {
      if (isset($d[$k]) && strtotime($d[$k]) === false) {
        fail(422, 'Invalid completion timestamp');
      }
    }
  }
  if ($entity === 'routines') {
    textField($d, 'title', 160);
    if (
      !in_array($d['kind'] ?? '', ['quran', 'dua', 'tasbih', 'nafl', 'custom'], true) ||
      !in_array(
        $d['frequency'] ?? '',
        [
          'daily',
          'weekly',
          'monthly',
          'yearly',
          'interval',
          'unscheduled',
          'once',
          'weekdays',
          'after_prayer',
        ],
        true,
      )
    ) {
      fail(422, 'Invalid routine');
    }
    if (
      ($d['frequency'] ?? '') === 'after_prayer' &&
      (!is_array($d['resetPrayers'] ?? null) ||
        count($d['resetPrayers']) < 1 ||
        count($d['resetPrayers']) > 5 ||
        count(array_filter($d['resetPrayers'], fn($v)=>!is_string($v))) ||
        count(array_unique($d['resetPrayers'])) !== count($d['resetPrayers']) ||
        count(array_diff($d['resetPrayers'], ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'])))
    ) {
      fail(422, 'Select valid reset prayers');
    }
    if (($d['frequency'] ?? '') === 'after_prayer') {
      $s = $d['resetSettings'] ?? [];
      if (
        !is_array($s) ||
        !is_numeric($s['lat'] ?? null) ||
        !is_numeric($s['lng'] ?? null) ||
        abs((float) $s['lat']) > 90 ||
        abs((float) $s['lng']) > 180 ||
        ($s['timezone'] ?? '') !== ($d['timezone'] ?? '') ||
        !is_bool($s['hanafi'] ?? null) ||
        !in_array(
          $s['method'] ?? '',
          [
            'Karachi',
            'MuslimWorldLeague',
            'Egyptian',
            'NorthAmerica',
            'UmmAlQura',
            'Dubai',
            'MoonsightingCommittee',
            'Singapore',
          ],
          true,
        ) ||
        !is_array($s['adjustments'] ?? null) ||
        !array_is_list($s['adjustments']) ||
        count($s['adjustments']) !== 5 ||
        count(array_filter($s['adjustments'], fn($v) => !is_int($v) || abs($v) > 180))
      ) {
        fail(422, 'Invalid routine prayer settings');
      }
    }

    if (
      isset($d['endDate']) &&
      $d['endDate'] !== '' &&
      (!validDay($d['endDate']) || $d['endDate'] < $d['startDate'])
    ) {
      fail(422, 'Invalid end date');
    }
    if (
      ($d['frequency'] ?? '') === 'weekdays' &&
      (!is_array($d['weekdays'] ?? null) ||
        count($d['weekdays']) < 1 ||
        count(array_filter($d['weekdays'], fn($v) => !is_int($v) || $v < 0 || $v > 6)))
    ) {
      fail(422, 'Invalid weekdays');
    }
    if (
      ($d['calendar'] ?? 'gregorian') === 'hijri' &&
      (($d['hijriMonth'] ?? 0) < 1 ||
        ($d['hijriMonth'] ?? 0) > 12 ||
        ($d['hijriDay'] ?? 0) < 1 ||
        ($d['hijriDay'] ?? 0) > 30)
    ) {
      fail(422, 'Invalid Hijri date');
    }
    if (isset($d['deadline']) && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $d['deadline'])) {
      fail(422, 'Invalid deadline');
    }
    if (
      !validDay($d['startDate'] ?? '') ||
      $d['startDate'] < '2000-01-01' ||
      !in_array($d['timezone'] ?? '', DateTimeZone::listIdentifiers(), true) ||
      !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $d['time'] ?? '')
    ) {
      fail(422, 'Invalid schedule');
    }
    if (($d['target'] ?? 1) < 1 || ($d['target'] ?? 1) > 1000000 || ($d['interval'] ?? 1) < 1) {
      fail(422, 'Invalid target or interval');
    }
  }
  if ($entity === 'routine_completions') {
    textField($d, 'routineId', 150);
    textField($d, 'period', 40);
    if (
      $id !== $d['routineId'] . ':' . $d['period'] ||
      strtotime($d['completedAt'] ?? '') === false
    ) {
      fail(422, 'Invalid completion');
    }
  }
  if ($entity === 'qaza_history') {
    if (
      !in_array($d['prayer'] ?? '', ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], true) ||
      !is_int($d['quantity'] ?? null) ||
      $d['quantity'] < 1 ||
      $d['quantity'] > 100000 ||
      ($d['origin'] ?? '') !== 'previous'
    ) {
      fail(422, 'Invalid previous Qaza');
    }
    if (!empty($d['date']) && !validDay($d['date'])) {
      fail(422, 'Invalid date');
    }
    $completed = $d['completed'] ?? [];
    if (!is_array($completed) || count($completed) > $d['quantity']) {
      fail(422, 'Invalid Qaza completion count');
    }
    $seen = [];
    $completedCount = 0;
    foreach ($completed as $item) {
      if (
        !is_array($item) ||
        !is_string($item['id'] ?? null) ||
        isset($seen[$item['id']]) ||
        strtotime($item['at'] ?? '') === false
      ) {
        fail(422, 'Invalid or duplicate Qaza completion');
      }
      $seen[$item['id']] = true;
      $qty = $item['quantity'] ?? 1;
      if (!is_int($qty) || $qty < 1) {
        fail(422, 'Invalid completion quantity');
      }
      $completedCount += $qty;
    }
  }
  if (isset($completedCount) && $completedCount > $d['quantity']) {
    fail(422, 'Qaza completion exceeds quantity');
  }
  if ($entity === 'private_records') {
    if (
      array_diff(array_keys($d), ['sealed', 'format']) ||
      ($d['format'] ?? '') !== 'aes-gcm-device-v1' ||
      !is_string($d['sealed'] ?? null) ||
      strlen($d['sealed']) < 40 ||
      base64_decode($d['sealed'], true) === false
    ) {
      fail(422, 'Encrypted private record required');
    }
  }
  if (
    $entity === 'milestone_events' &&
    (!is_string($d['subject'] ?? null) ||
      !is_int($d['best'] ?? null) ||
      $d['best'] < 1 ||
      strtotime($d['at'] ?? '') === false)
  ) {
    fail(422, 'Invalid milestone');
  }
  if (
    $entity === 'learning_progress' &&
    (!is_string($d['lessonId'] ?? null) || strtotime($d['completedAt'] ?? '') === false)
  ) {
    fail(422, 'Invalid lesson progress');
  }
  if ($entity === 'tasbih_progress') {
    if (!is_int($d['count'] ?? null) || $d['count'] < 0 || $d['count'] > 1000000) {
      fail(422, 'Invalid counter');
    }
  }
}
