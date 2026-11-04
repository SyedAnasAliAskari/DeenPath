<?php
declare(strict_types=1);
require_once __DIR__ . '/PrayerStarts.php';
/** Deterministic replay handles late offline completions and explicit corrections.
 * Derived ledger entries keep stable identities; no append-only double rewards.
 */
final class RewardEngine
{
  public static function prayerResets(
    array $r,
    array $unused,
    DateTimeImmutable $now,
    ?string $from = null,
  ): array {
    $events = [];
    $zone = new DateTimeZone($r['timezone']);
    $day = max($r['startDate'], $from ?? $r['startDate']);
    $until = $now->setTimezone($zone)->format('Y-m-d');
    if (!empty($r['endDate'])) {
      $until = min($until, $r['endDate']);
    }
    while ($day <= $until) {
      try {
        $starts = DeenPrayerStarts::starts($day, $r['resetSettings']);
      } catch (InvalidArgumentException | DivisionByZeroError $error) {
        $day = gmdate('Y-m-d', strtotime($day . ' UTC') + 86400);
        continue;
      }
      foreach ($starts as $prayer => $at) {
        if (in_array($prayer, $r['resetPrayers'], true) && $at <= (float) $now->format('U.u')) {
          $events[] = ['period' => $day . ':' . $prayer, 'day' => $day, 'at' => $at];
        }
      }
      $day = gmdate('Y-m-d', strtotime($day . ' UTC') + 86400);
    }
    usort($events, fn($a, $b) => [$a['at'], $a['period']] <=> [$b['at'], $b['period']]);
    return $events;
  }
  public static function period(array $r, DateTimeImmutable $d, array $prayers = []): string
  {
    if ($r['frequency'] === 'after_prayer') {
      $anchor = $d->setTimezone(new DateTimeZone($r['timezone']))->format('Y-m-d');
      if (!empty($r['endDate'])) {
        $anchor = min($anchor, $r['endDate']);
      }
      try {
        DeenPrayerStarts::starts($anchor, $r['resetSettings']);
      } catch (InvalidArgumentException | DivisionByZeroError $error) {
        return $r['startDate'] . ':unavailable';
      }
      $events = self::prayerResets(
        $r,
        [],
        $d,
        gmdate('Y-m-d', strtotime($anchor . ' UTC') - 86400),
      );
      return $events ? $events[count($events) - 1]['period'] : $r['startDate'] . ':start';
    }
    if ($r['frequency'] === 'daily' && $d->format('H:i') < ($r['deadline'] ?? '00:00')) {
      $d = $d->modify('-1 day');
    }
    if (($r['calendar'] ?? '') === 'hijri') {
      return $d->format('Y-m-d');
    }
    return match ($r['frequency']) {
      'unscheduled' => 'lifetime',
      'weekly' => $d->modify('monday this week')->format('Y-m-d'),
      'monthly' => $d->format('Y-m'),
      'yearly' => $d->format('Y'),
      'interval' => $r['startDate'] .
        ':' .
        (int) floor(
          (strtotime($d->format('Y-m-d') . ' UTC') - strtotime($r['startDate'] . ' UTC')) /
            86400 /
            max(1, (int) $r['interval']),
        ),
      default => $d->format('Y-m-d'),
    };
  }
  public static function scheduleOn(array $r, string $day): array
  {
    foreach ($r['scheduleHistory'] ?? [] as $entry) {
      if ($day < $entry['until']) {
        return $entry['schedule'];
      }
    }
    return $r;
  }
  public static function due(array $r, DateTimeImmutable $day): bool
  {
    if (!empty($r['endDate']) && $day->format('Y-m-d') > $r['endDate']) {
      return false;
    }
    if (($r['frequency'] ?? '') === 'unscheduled') {
      return false;
    }
    if (($r['calendar'] ?? '') === 'hijri') {
      $date = $day->modify(sprintf('%+d days', (int) ($r['hijriAdjustment'] ?? 0)));
      $j = strtotime($date->format('Y-m-d') . ' UTC') / 86400 + 2440587.5;
      $year = (int) floor((30 * ($j - 1948439.5) + 10646) / 10631);
      $jd = fn($m, $d) => $d +
        ceil(29.5 * ($m - 1)) +
        ($year - 1) * 354 +
        floor((3 + 11 * $year) / 30) +
        1948439.5 -
        1;
      $month = min(12, (int) ceil(($j - (29 + $jd(1, 1))) / 29.5) + 1);
      $dayNumber = (int) ($j - $jd($month, 1) + 1);
      return $month === (int) $r['hijriMonth'] && $dayNumber === (int) $r['hijriDay'];
    }
    return match ($r['frequency']) {
      'unscheduled' => false,
      'once' => $day->format('Y-m-d') === $r['startDate'],
      'weekdays' => in_array((int) $day->format('w'), $r['weekdays'] ?? [], true),
      'weekly' => (int) $day->format('w') === (int) ($r['weekday'] ?? 1),
      'monthly' => (int) $day->format('j') ===
        min((int) ($r['monthday'] ?? 1), (int) $day->format('t')),
      'yearly' => $day->format('m-d') === substr($r['startDate'], 5),
      'interval' => ((int) ((strtotime($day->format('Y-m-d') . ' UTC') -
        strtotime($r['startDate'] . ' UTC')) /
        86400)) %
        max(1, (int) $r['interval']) ===
        0,
      default => true,
    };
  }
  public static function replay(
    string $uid,
    array $routines,
    array $completions,
    DateTimeImmutable $now,
    array $prayers = [],
  ): array {
    $events = [];
    $states = [];
    $seen = [];
    foreach ($routines as $rid => $r) {
      $original = $r;
      if (
        !in_array($r['kind'] ?? 'quran', ['quran', 'dua', 'tasbih'], true) ||
        !empty($r['generated'])
      ) {
        continue;
      }
      $zone = new DateTimeZone($r['timezone']);
      $start = new DateTimeImmutable($r['startDate'], $zone);
      $today = $now->setTimezone($zone)->setTime(0, 0);
      $states[$rid] = [
        'current_streak' => 0,
        'best_streak' => 0,
        'success_run' => 0,
        'last_day' => null,
        'last_period' => null,
      ];
      if ($r['frequency'] === 'after_prayer') {
        $previous = $r['startDate'] . ':start';
        $previousDay = $r['startDate'];
        foreach (self::prayerResets($r, $prayers, $now) as $reset) {
          if ($reset['at'] > strtotime($r['createdAt'] ?? $r['startDate'] . 'T00:00Z')) {
            $events[] = [
              'rid' => $rid,
              'period' => $previous,
              'day' => $previousDay,
              'close' => $reset['at'],
              'daily' => false,
              'done' => isset($completions[$rid . ':' . $previous]),
            ];
          }
          $previous = $reset['period'];
          $previousDay = $reset['day'];
        }
        continue;
      }
      if ($r['frequency'] === 'unscheduled' && empty($r['scheduleHistory'])) {
        continue;
      }
      for ($day = $start; $day < $today; $day = $day->modify('+1 day')) {
        $r = self::scheduleOn($original, $day->format('Y-m-d'));
        if (!self::due($r, $day)) {
          continue;
        }
        $key = self::period($r, $day->setTime(23, 59));
        if (isset($seen[$rid][$key])) {
          continue;
        }
        $seen[$rid][$key] = true;
        $close = match ($r['frequency']) {
          'weekly' => $day->modify('monday next week')->setTime(0, 0),
          'monthly' => $day->modify('first day of next month')->setTime(0, 0),
          'yearly' => ($r['calendar'] ?? '') === 'hijri'
            ? $day->modify('+1 day')
            : $day->modify('first day of january next year')->setTime(0, 0),
          'interval' => $start->modify(
            '+' .
              ((int) substr($key, strrpos($key, ':') + 1) + 1) * max(1, (int) $r['interval']) .
              ' days',
          ),
          default => $day->modify('+1 day'),
        };
        if ($r['frequency'] === 'daily') {
          $parts = explode(':', $r['deadline'] ?? '00:00');
          $close = $close->setTime((int) $parts[0], (int) $parts[1]);
        }
        if ($close > $now) {
          continue;
        }
        $events[] = [
          'rid' => $rid,
          'period' => $key,
          'day' => $day->format('Y-m-d'),
          'close' => $close->getTimestamp(),
          'daily' => $r['frequency'] === 'daily',
          'done' => isset($completions[$rid . ':' . $key]),
        ];
      }
    }
    usort($events, fn($a, $b) => [$a['close'], $a['rid']] <=> [$b['close'], $b['rid']]);
    $balance = 0;
    $ledger = [];
    foreach ($events as $e) {
      $s = &$states[$e['rid']];
      $kind = null;
      $delta = 0;
      if ($e['done']) {
        $s['current_streak']++;
        $s['success_run']++;
        if ($e['daily'] && $s['success_run'] % 7 === 0 && $balance < 3) {
          $kind = 'award';
          $delta = 1;
        }
      } else {
        $s['success_run'] = 0;
        if ($e['daily'] && $balance > 0) {
          $kind = 'spend';
          $delta = -1;
        } else {
          $s['current_streak'] = 0;
        }
      }
      if ($kind) {
        $balance += $delta;
        $hex = hash('sha256', implode('|', [$uid, $e['rid'], $e['period'], $kind]));
        $id =
          substr($hex, 0, 8) .
          '-' .
          substr($hex, 8, 4) .
          '-' .
          substr($hex, 12, 4) .
          '-' .
          substr($hex, 16, 4) .
          '-' .
          substr($hex, 20, 12);
        $ledger[] = [
          'id' => $id,
          'routine_id' => $e['rid'],
          'day' => $e['day'],
          'kind' => $kind,
          'delta' => $delta,
          'balance_after' => $balance,
        ];
      }
      $s['best_streak'] = max($s['best_streak'], $s['current_streak']);
      $s['last_day'] = $e['day'];
      $s['last_period'] = $e['period'];
      unset($s);
    }
    return ['wallet' => $balance, 'streaks' => $states, 'ledger' => $ledger];
  }
}
