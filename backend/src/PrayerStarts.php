<?php
/** Prayer starts derived from adhan-js 4.4.3, MIT / Batoul Apps.
 * Same supported calculation methods and minute rounding as the client.
 * See ADHAN-LICENSE.txt and https://github.com/batoulapps/adhan-js . */
final class DeenPrayerStarts
{
  private static array $cache = [];
  private static function degreesToRadians($x)
  {
    return ($x * M_PI) / 180;
  }
  private static function radiansToDegrees($x)
  {
    return ($x * 180) / M_PI;
  }
  private static function normalizeToScale($n, $m)
  {
    return $n - $m * floor($n / $m);
  }
  private static function unwindAngle($x)
  {
    return self::normalizeToScale($x, 360);
  }
  private static function quadrantShiftAngle($x)
  {
    return $x >= -180 && $x <= 180 ? $x : $x - 360 * self::jsRound($x / 360);
  }
  private static function jsRound($x)
  {
    return floor($x + 0.5);
  }
  private static function trunc($x)
  {
    return $x < 0 ? ceil($x) : floor($x);
  }
  public static function meanSolarLongitude($julianCentury)
  {
    $T = $julianCentury;

    $term1 = 280.4664567;
    $term2 = 36000.76983 * $T;
    $term3 = 0.0003032 * pow($T, 2);
    $L0 = $term1 + $term2 + $term3;
    return self::unwindAngle($L0);
  }
  public static function meanLunarLongitude($julianCentury)
  {
    $T = $julianCentury;

    $term1 = 218.3165;
    $term2 = 481267.8813 * $T;
    $Lp = $term1 + $term2;
    return self::unwindAngle($Lp);
  }
  public static function ascendingLunarNodeLongitude($julianCentury)
  {
    $T = $julianCentury;

    $term1 = 125.04452;
    $term2 = 1934.136261 * $T;
    $term3 = 0.0020708 * pow($T, 2);
    $term4 = pow($T, 3) / 450000;
    $Omega = $term1 - $term2 + $term3 + $term4;
    return self::unwindAngle($Omega);
  }
  public static function meanSolarAnomaly($julianCentury)
  {
    $T = $julianCentury;

    $term1 = 357.52911;
    $term2 = 35999.05029 * $T;
    $term3 = 0.0001537 * pow($T, 2);
    $M = $term1 + $term2 - $term3;
    return self::unwindAngle($M);
  }
  public static function solarEquationOfTheCenter($julianCentury, $meanAnomaly)
  {
    $T = $julianCentury;

    $Mrad = self::degreesToRadians($meanAnomaly);
    $term1 = (1.914602 - 0.004817 * $T - 0.000014 * pow($T, 2)) * sin($Mrad);
    $term2 = (0.019993 - 0.000101 * $T) * sin(2 * $Mrad);
    $term3 = 0.000289 * sin(3 * $Mrad);
    return $term1 + $term2 + $term3;
  }
  public static function apparentSolarLongitude($julianCentury, $meanLongitude)
  {
    $T = $julianCentury;
    $L0 = $meanLongitude;

    $longitude = $L0 + self::solarEquationOfTheCenter($T, self::meanSolarAnomaly($T));
    $Omega = 125.04 - 1934.136 * $T;
    $Lambda = $longitude - 0.00569 - 0.00478 * sin(self::degreesToRadians($Omega));
    return self::unwindAngle($Lambda);
  }
  public static function meanObliquityOfTheEcliptic($julianCentury)
  {
    $T = $julianCentury;

    $term1 = 23.439291;
    $term2 = 0.013004167 * $T;
    $term3 = 0.0000001639 * pow($T, 2);
    $term4 = 0.0000005036 * pow($T, 3);
    return $term1 - $term2 - $term3 + $term4;
  }
  public static function apparentObliquityOfTheEcliptic($julianCentury, $meanObliquityOfTheEcliptic)
  {
    $T = $julianCentury;
    $Epsilon0 = $meanObliquityOfTheEcliptic;

    $O = 125.04 - 1934.136 * $T;
    return $Epsilon0 + 0.00256 * cos(self::degreesToRadians($O));
  }
  public static function meanSiderealTime($julianCentury)
  {
    $T = $julianCentury;

    $JD = $T * 36525 + 2451545.0;
    $term1 = 280.46061837;
    $term2 = 360.98564736629 * ($JD - 2451545);
    $term3 = 0.000387933 * pow($T, 2);
    $term4 = pow($T, 3) / 38710000;
    $Theta = $term1 + $term2 + $term3 - $term4;
    return self::unwindAngle($Theta);
  }
  public static function nutationInLongitude(
    $julianCentury,
    $solarLongitude,
    $lunarLongitude,
    $ascendingNode,
  ) {
    $L0 = $solarLongitude;
    $Lp = $lunarLongitude;
    $Omega = $ascendingNode;

    $term1 = (-17.2 / 3600) * sin(self::degreesToRadians($Omega));
    $term2 = (1.32 / 3600) * sin(2 * self::degreesToRadians($L0));
    $term3 = (0.23 / 3600) * sin(2 * self::degreesToRadians($Lp));
    $term4 = (0.21 / 3600) * sin(2 * self::degreesToRadians($Omega));
    return $term1 - $term2 - $term3 + $term4;
  }
  public static function nutationInObliquity(
    $julianCentury,
    $solarLongitude,
    $lunarLongitude,
    $ascendingNode,
  ) {
    $L0 = $solarLongitude;
    $Lp = $lunarLongitude;
    $Omega = $ascendingNode;

    $term1 = (9.2 / 3600) * cos(self::degreesToRadians($Omega));
    $term2 = (0.57 / 3600) * cos(2 * self::degreesToRadians($L0));
    $term3 = (0.1 / 3600) * cos(2 * self::degreesToRadians($Lp));
    $term4 = (0.09 / 3600) * cos(2 * self::degreesToRadians($Omega));
    return $term1 + $term2 + $term3 - $term4;
  }
  public static function altitudeOfCelestialBody($observerLatitude, $declination, $localHourAngle)
  {
    $Phi = $observerLatitude;
    $delta = $declination;
    $H = $localHourAngle;

    $term1 = sin(self::degreesToRadians($Phi)) * sin(self::degreesToRadians($delta));
    $term2 =
      cos(self::degreesToRadians($Phi)) *
      cos(self::degreesToRadians($delta)) *
      cos(self::degreesToRadians($H));
    return self::radiansToDegrees(asin($term1 + $term2));
  }
  public static function approximateTransit($longitude, $siderealTime, $rightAscension)
  {
    $L = $longitude;
    $Theta0 = $siderealTime;
    $a2 = $rightAscension;

    $Lw = $L * -1;
    $m0 = self::normalizeToScale(($a2 + $Lw - $Theta0) / 360, 1);

    $expectedTransit = self::normalizeToScale((12.0 - $L / 15.0) / 24.0, 1);
    if ($m0 - $expectedTransit > 0.5) {
      return $m0 - 1.0;
    } elseif ($expectedTransit - $m0 > 0.5) {
      return $m0 + 1.0;
    } else {
      return $m0;
    }
  }
  public static function correctedTransit(
    $approximateTransit,
    $longitude,
    $siderealTime,
    $rightAscension,
    $previousRightAscension,
    $nextRightAscension,
  ) {
    $m0 = $approximateTransit;
    $L = $longitude;
    $Theta0 = $siderealTime;
    $a2 = $rightAscension;
    $a1 = $previousRightAscension;
    $a3 = $nextRightAscension;

    $Lw = $L * -1;
    $Theta = self::unwindAngle($Theta0 + 360.985647 * $m0);
    $a = self::unwindAngle(self::interpolateAngles($a2, $a1, $a3, $m0));
    $H = self::quadrantShiftAngle($Theta - $Lw - $a);
    $dm = $H / -360;
    return ($m0 + $dm) * 24;
  }
  public static function correctedHourAngle(
    $approximateTransit,
    $angle,
    $coordinates,
    $afterTransit,
    $siderealTime,
    $rightAscension,
    $previousRightAscension,
    $nextRightAscension,
    $declination,
    $previousDeclination,
    $nextDeclination,
  ) {
    $m0 = $approximateTransit;
    $h0 = $angle;
    $Theta0 = $siderealTime;
    $a2 = $rightAscension;
    $a1 = $previousRightAscension;
    $a3 = $nextRightAscension;
    $d2 = $declination;
    $d1 = $previousDeclination;
    $d3 = $nextDeclination;

    $Lw = $coordinates['longitude'] * -1;
    $term1 =
      sin(self::degreesToRadians($h0)) -
      sin(self::degreesToRadians($coordinates['latitude'])) * sin(self::degreesToRadians($d2));
    $term2 =
      cos(self::degreesToRadians($coordinates['latitude'])) * cos(self::degreesToRadians($d2));
    $H0 = self::radiansToDegrees(acos($term1 / $term2));
    $m = $afterTransit ? $m0 + $H0 / 360 : $m0 - $H0 / 360;
    $Theta = self::unwindAngle($Theta0 + 360.985647 * $m);
    $a = self::unwindAngle(self::interpolateAngles($a2, $a1, $a3, $m));
    $delta = self::interpolate($d2, $d1, $d3, $m);
    $H = $Theta - $Lw - $a;
    $h = self::altitudeOfCelestialBody($coordinates['latitude'], $delta, $H);
    $term3 = $h - $h0;
    $term4 =
      360 *
      cos(self::degreesToRadians($delta)) *
      cos(self::degreesToRadians($coordinates['latitude'])) *
      sin(self::degreesToRadians($H));
    $dm = $term3 / $term4;
    return ($m + $dm) * 24;
  }
  public static function interpolate($y2, $y1, $y3, $n)
  {
    $a = $y2 - $y1;
    $b = $y3 - $y2;
    $c = $b - $a;
    return $y2 + ($n / 2) * ($a + $b + $n * $c);
  }
  public static function interpolateAngles($y2, $y1, $y3, $n)
  {
    $a = self::unwindAngle($y2 - $y1);
    $b = self::unwindAngle($y3 - $y2);
    $c = $b - $a;
    return $y2 + ($n / 2) * ($a + $b + $n * $c);
  }
  public static function julianDay($year, $month, $day, $hours = 0)
  {
    $trunc = fn($x) => self::trunc($x);
    $Y = $trunc($month > 2 ? $year : $year - 1);
    $M = $trunc($month > 2 ? $month : $month + 12);
    $D = $day + $hours / 24;
    $A = $trunc($Y / 100);
    $B = $trunc(2 - $A + $trunc($A / 4));
    $i0 = $trunc(365.25 * ($Y + 4716));
    $i1 = $trunc(30.6001 * ($M + 1));
    return $i0 + $i1 + $D + $B - 1524.5;
  }
  public static function julianCentury($julianDay)
  {
    return ($julianDay - 2451545.0) / 36525;
  }
  private static function solarCoordinates($jd): array
  {
    $t = self::julianCentury($jd);
    $l = self::meanSolarLongitude($t);
    $moon = self::meanLunarLongitude($t);
    $node = self::ascendingLunarNodeLongitude($t);
    $lambda = self::degreesToRadians(self::apparentSolarLongitude($t, $l));
    $sidereal = self::meanSiderealTime($t);
    $psi = self::nutationInLongitude($t, $l, $moon, $node);
    $epsilon = self::nutationInObliquity($t, $l, $moon, $node);
    $e0 = self::meanObliquityOfTheEcliptic($t);
    $ea = self::degreesToRadians(self::apparentObliquityOfTheEcliptic($t, $e0));
    return [
      'declination' => self::radiansToDegrees(asin(sin($ea) * sin($lambda))),
      'rightAscension' => self::unwindAngle(
        self::radiansToDegrees(atan2(cos($ea) * sin($lambda), cos($lambda))),
      ),
      'apparentSiderealTime' => $sidereal + $psi * cos(self::degreesToRadians($e0 + $epsilon)),
    ];
  }
  private static function hourAngle($m, $angle, $c, $after, $s, $p, $n)
  {
    return self::correctedHourAngle(
      $m,
      $angle,
      $c,
      $after,
      $s['apparentSiderealTime'],
      $s['rightAscension'],
      $p['rightAscension'],
      $n['rightAscension'],
      $s['declination'],
      $p['declination'],
      $n['declination'],
    );
  }
  private static function solar($day, $s): array
  {
    $jd = self::julianDay(
      (int) substr($day, 0, 4),
      (int) substr($day, 5, 2),
      (int) substr($day, 8, 2),
    );
    $c = ['latitude' => (float) $s['lat'], 'longitude' => (float) $s['lng']];
    $current = self::solarCoordinates($jd);
    $previous = self::solarCoordinates($jd - 1);
    $next = self::solarCoordinates($jd + 1);
    $m = self::approximateTransit(
      $c['longitude'],
      $current['apparentSiderealTime'],
      $current['rightAscension'],
    );
    $base = strtotime($day . 'T00:00:00Z');
    $utc = function ($hours) use ($base) {
      if (!is_finite($hours)) {
        return NAN;
      }
      $h = floor($hours);
      $min = floor(($hours - $h) * 60);
      $sec = floor(($hours - ($h + $min / 60)) * 3600);
      return $base + $h * 3600 + $min * 60 + $sec;
    };
    $angle = fn($a, $after) => $utc(
      self::hourAngle($m, $a, $c, $after, $current, $previous, $next),
    );
    $transit = $utc(
      self::correctedTransit(
        $m,
        $c['longitude'],
        $current['apparentSiderealTime'],
        $current['rightAscension'],
        $previous['rightAscension'],
        $next['rightAscension'],
      ),
    );
    $shadow = $s['hanafi'] ?? true ? 2 : 1;
    $asr = $angle(
      self::radiansToDegrees(
        atan(
          1 /
            ($shadow + tan(self::degreesToRadians(abs($c['latitude'] - $current['declination'])))),
        ),
      ),
      true,
    );
    return [
      'transit' => $transit,
      'sunrise' => $angle(-50 / 60, false),
      'sunset' => $angle(-50 / 60, true),
      'asr' => $asr,
      'angle' => $angle,
    ];
  }
  private static function seasonal($lat, $day, $morning): float
  {
    $date = new DateTimeImmutable($day, new DateTimeZone('UTC'));
    $doy = (int) $date->format('z') + 1;
    $leap = (bool) $date->format('L');
    $days = $leap ? 366 : 365;
    $d = $lat >= 0 ? $doy + 10 : $doy - ($leap ? 173 : 172);
    if ($d >= $days) {
      $d -= $days;
    }
    if ($d < 0) {
      $d += $days;
    }
    $coeff = $morning ? [28.65, 19.44, 32.74, 48.1] : [25.6, 2.05, -9.21, 6.14];
    [$a, $b, $c, $e] = array_map(fn($n) => 75 + ($n / 55) * abs($lat), $coeff);
    if ($d < 91) {
      return $a + (($b - $a) / 91) * $d;
    }
    if ($d < 137) {
      return $b + (($c - $b) / 46) * ($d - 91);
    }
    if ($d < 183) {
      return $c + (($e - $c) / 46) * ($d - 137);
    }
    if ($d < 229) {
      return $e + (($c - $e) / 46) * ($d - 183);
    }
    if ($d < 275) {
      return $c + (($b - $c) / 46) * ($d - 229);
    }
    return $b + (($a - $b) / 91) * ($d - 275);
  }
  public static function starts(string $day, array $s): array
  {
    $cacheKey = $day . '|' . json_encode($s);
    if (isset(self::$cache[$cacheKey])) {
      return self::$cache[$cacheKey];
    }
    $angles = [
      'Karachi' => [18, 18, 0, 1, 0, 0],
      'MuslimWorldLeague' => [18, 17, 0, 1, 0, 0],
      'Egyptian' => [19.5, 17.5, 0, 1, 0, 0],
      'NorthAmerica' => [15, 15, 0, 1, 0, 0],
      'UmmAlQura' => [18.5, 0, 90, 0, 0, 0],
      'Dubai' => [18.2, 18.2, 0, 3, 3, 3],
      'MoonsightingCommittee' => [18, 18, 0, 5, 0, 3],
      'Singapore' => [20, 18, 0, 1, 0, 0],
    ];
    $method = $s['method'] ?? 'Karachi';
    [$fa, $ia, $interval, $duhrAdj, $asrAdj, $maghribAdj] = $angles[$method] ?? $angles['Karachi'];
    $today = self::solar($day, $s);
    $tomorrow = self::solar(gmdate('Y-m-d', strtotime($day . ' UTC') + 86400), $s);
    $night = $tomorrow['sunrise'] - $today['sunset'];
    $fajr = $today['angle'](-$fa, false);
    $isha = $interval > 0 ? $today['sunset'] + $interval * 60 : $today['angle'](-$ia, true);
    if ($method === 'MoonsightingCommittee') {
      if ($s['lat'] >= 55) {
        $fajr = $today['sunrise'] - $night / 7;
        $isha = $today['sunset'] + $night / 7;
      }
      $safeFajr = $today['sunrise'] + self::jsRound(self::seasonal($s['lat'], $day, true) * -60);
      $safeIsha = $today['sunset'] + self::jsRound(self::seasonal($s['lat'], $day, false) * 60);
    } else {
      $safeFajr = $today['sunrise'] - $night / 2;
      $safeIsha = $today['sunset'] + $night / 2;
    }
    if (!is_finite($fajr) || $safeFajr > $fajr) {
      $fajr = $safeFajr;
    }
    if ($interval <= 0 && (!is_finite($isha) || $safeIsha < $isha)) {
      $isha = $safeIsha;
    }
    $values = [$fajr, $today['transit'], $today['asr'], $today['sunset'], $isha];
    $adjust = [0, $duhrAdj, $asrAdj, $maghribAdj, 0];
    $out = [];
    foreach (['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as $i => $name) {
      $at = $values[$i] + $adjust[$i] * 60;
      if (!is_finite($at)) {
        throw new InvalidArgumentException('Prayer start unavailable at these coordinates');
      }
      $at = $method === 'Singapore' ? (floor($at / 60) + 1) * 60 : floor(($at + 30) / 60) * 60;
      $out[$name] = (int) ($at + ($s['adjustments'][$i] ?? 0) * 60);
    }
    if (count(self::$cache) > 2048) {
      self::$cache = [];
    }
    return self::$cache[$cacheKey] = $out;
  }
}
