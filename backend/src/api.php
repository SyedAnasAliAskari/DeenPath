<?php
declare(strict_types=1);
require_once __DIR__ . '/RewardEngine.php';
require_once __DIR__ . '/GemLedger.php';
require_once __DIR__ . '/GemShop.php';
require_once __DIR__ . '/CardService.php';
require_once __DIR__ . '/GoogleIdentity.php';
require_once __DIR__ . '/GenerationQueue.php';
final class Api
{
  private string $uid = '';
  private array $session = [];
  public function __construct(private PDO $db, private array $config) {}
  private function q(string $sql, array $args = []): PDOStatement
  {
    $s = $this->db->prepare($sql);
    $s->execute($args);
    return $s;
  }
  private function json(mixed $data, int $code = 200): never
  {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit();
  }
  private function body(): array
  {
    $s = file_get_contents('php://input');
    if (strlen($s) > 1048576) {
      fail(413, 'JSON too large');
    }
    try {
      $b = json_decode($s ?: '{}', true, 32, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
      fail(400, 'Invalid JSON');
    }
    if (!is_array($b)) {
      fail(400, 'Expected JSON object');
    }
    return $b;
  }
  private function limit(string $action, int $max, int $seconds): void
  {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash('sha256', $action . '|' . $ip);
    $now = time();
    $this->q(
      'INSERT INTO rate_limits(bucket,hits,reset_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=IF(reset_at < ?,1,hits+1),reset_at=IF(reset_at < ?,VALUES(reset_at),reset_at)',
      [$key, $now + $seconds, $now, $now],
    );
    if (
      (int) $this->q('SELECT hits FROM rate_limits WHERE bucket=?', [$key])->fetchColumn() > $max
    ) {
      fail(429, 'Too many requests. Try later.');
    }
  }
  private function authenticate(): void
  {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer ([a-f0-9]{64})$/D', $h, $m)) {
      fail(401, 'Sign in required');
    }
    $hash = hash('sha256', $m[1]);
    $s = $this->q(
      'SELECT * FROM auth_sessions WHERE (token_hash=? OR (previous_hash=? AND previous_until>UTC_TIMESTAMP())) AND expires_at>UTC_TIMESTAMP()',
      [$hash, $hash],
    )->fetch();
    if (!$s) {
      fail(401, 'Session expired');
    }
    $this->session = $s;
    $this->uid = $s['user_id'];
  }
  private function newSession(string $uid): string
  {
    $t = bin2hex(random_bytes(32));
    $this->q(
      'INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))',
      [uuid(), $uid, hash('sha256', $t)],
    );
    return $t;
  }
  private function profile(): array
  {
    return $this->q(
      'SELECT id,name,email,dob,profile_file,verified_at,created_at FROM users WHERE id=?',
      [$this->uid],
    )->fetch();
  }
  public function run(): never
  {
    $route = trim((string) ($_GET['route'] ?? ($_SERVER['PATH_INFO'] ?? '')), '/');
    $method = $_SERVER['REQUEST_METHOD'];
    if ($route === 'v1/health' && $method === 'GET') {
      $this->json(['service' => 'DeenPath', 'version' => 1]);
    }
    if (str_starts_with($route, 'v1/auth/')) {
      $this->auth(substr($route, 8), $method);
    }
    if($route==='v1/google/config'&&$method==='GET'){$this->limit('google-config',60,60);$client=$this->config['google_web_client_id']??'';$this->json(['enabled'=>$client!==''&&is_file(dirname(__DIR__).'/vendor/autoload.php'),'clientId'=>$client]);}
    if(preg_match('~^v1/cards/details/([a-f0-9,-]+)$~D',$route,$detailMatch)&&$method==='GET'){
      $this->limit('card-details',90,60);$ids=explode(',',$detailMatch[1]);try{$this->json(['cards'=>(new CardService($this->db,$this->config['cards']??[]))->details($ids)]);}catch(InvalidArgumentException $e){fail(422,$e->getMessage());}
    }
    if ($route==='v1/cards/library'&&$method==='GET'){
      $this->limit('card-library',60,60);$publicCards=new CardService($this->db,array_merge($this->config['economy']??[],$this->config['cards']??[]));$this->json(['cards'=>$publicCards->catalog(),'states'=>$publicCards->availability()]);
    }
    if(preg_match('~^v1/cards/art/([a-f0-9-]{36})$~D',$route,$m)&&$method==='GET'){
      $this->limit('card-art',180,60);$art=(new CardService($this->db,$this->config['cards']??[]))->art($m[1]);if(!$art)fail(404,'Artwork unavailable');header('Content-Type: '.$art['mime']);header('Content-Length: '.filesize($art['path']));header('X-Content-Type-Options: nosniff');readfile($art['path']);exit;
    }
    $this->authenticate();
    $this->limit('api:' . $this->uid, 300, 60);
    if(str_starts_with($route,'v1/cards/')){
      $cards=new CardService($this->db,array_merge($this->config['economy']??[],$this->config['cards']??[]));
      try{
        if($route==='v1/cards/capabilities'&&$method==='GET')$this->json(['admin'=>in_array($this->uid,$this->config['cards']['adminUsers']??[],true)]);
        if($route==='v1/cards/collection'&&$method==='GET')$this->json(['copies'=>$cards->collection($this->uid),'hiddenCopyIds'=>$cards->hiddenCopies($this->uid)]);
        if($route==='v1/cards/packs'&&$method==='POST'){$this->limit('pack:'.$this->uid,20,60);$body=$this->body();if(!is_string($body['id']??null))fail(422,'Pack identifier required');$this->json($cards->pack($this->uid,$body['id'],isset($body['expectedCost'])&&is_int($body['expectedCost'])?$body['expectedCost']:null));}
        if($route==='v1/cards/import-pack'&&$method==='POST'){$this->limit('pack:'.$this->uid,20,60);$body=$this->body();if(!is_string($body['id']??null)||!is_array($body['cardIds']??null)||!is_array($body['copyIds']??null)||!is_int($body['expectedCost']??null))fail(422,'Invalid guest pack');$this->json($cards->importPack($this->uid,$body['id'],$body['cardIds'],$body['copyIds'],$body['expectedCost']));}
        if($route==='v1/cards/reveal'&&$method==='POST'){$body=$this->body();if(isset($body['copyIds'])&&is_array($body['copyIds']))$cards->revealMany($this->uid,$body['copyIds']);else{if(!is_string($body['copyId']??null))fail(422,'Card copy required');$cards->reveal($this->uid,$body['copyId']);}$this->json(['saved'=>true]);}
        if($route==='v1/cards/reports'&&$method==='POST'){$this->limit('card-report:'.$this->uid,20,3600);$body=$this->body();foreach(['cardId','reason','detail'] as $key)if(!is_string($body[$key]??null))fail(422,'Invalid card report');$this->json($cards->report($this->uid,$body['cardId'],$body['reason'],$body['detail']));}
        if(str_starts_with($route,'v1/cards/admin/')){
          if(!in_array($this->uid,$this->config['cards']['adminUsers']??[],true))fail(403,'Administrator access required');
          if(preg_match('~^v1/cards/admin/card/([a-f0-9-]{36})$~D',$route,$m)&&$method==='GET')$this->json($cards->adminCard($this->uid,$m[1]));
          if(preg_match('~^v1/cards/admin/art/([a-f0-9-]{36})$~D',$route,$m)&&$method==='GET'){$art=$cards->adminArt($this->uid,$m[1]);if(!$art)fail(404,'Artwork unavailable');header('Content-Type: '.$art['mime']);header('Content-Length: '.filesize($art['path']));readfile($art['path']);exit;}
          if($route==='v1/cards/admin/generate'&&$method==='POST'){$this->limit('card-generation:'.$this->uid,10,3600);$body=$this->body();$this->json((new GenerationQueue($this->db,$this->config['cards']??[]))->enqueue($body));}
          if($route==='v1/cards/admin/queue'&&$method==='GET')$this->json($cards->reviewQueue($this->uid));
          if(preg_match('~^v1/cards/admin/([a-f0-9-]{36})$~D',$route,$m)&&$method==='PATCH'){$body=$this->body();if(!is_string($body['action']??null))fail(422,'Review action required');if($body['action']==='regenerate')$this->limit('card-generation:'.$this->uid,10,3600);$this->json($cards->moderate($this->uid,$m[1],$body['action'],$body));}
        }
      }catch(InvalidArgumentException $e){fail(422,$e->getMessage());}
    }
    if ($route === 'v1/economy/purchase' && $method === 'POST') {
      $this->limit('economy:'.$this->uid,30,60);$b=$this->body();
      if(!is_string($b['id']??null)||!is_string($b['kind']??null)||!is_array($b['payload']??null))fail(422,'Invalid customization purchase');
      try{$this->json((new GemShop($this->db,$this->config['economy']??[]))->purchase($this->uid,$b['id'],$b['kind'],$b['payload'],isset($b['expectedCost'])&&is_int($b['expectedCost'])?$b['expectedCost']:null));}catch(InvalidArgumentException $e){fail(422,$e->getMessage());}
    }
    if ($route === 'v1/economy/reconcile' && $method === 'POST') {
      $this->json((new GemLedger($this->db,$this->config['economy']??[]))->reconcile($this->uid));
    }
    if ($route === 'v1/profile') {
      if ($method === 'GET') {
        $this->json($this->profile());
      }
      $b = $this->body();
      if ($method === 'PATCH') {
        $name = textField($b, 'name', 160);
        $dob = $b['dob'] ?? null ?: null;
        if ($dob && !validDay($dob)) {
          fail(422, 'Invalid birth date');
        }
        $current = $this->profile();
        $email = array_key_exists('email', $b) ? emailField($b) : $current['email'];
        if ($email !== $current['email']) {
          $this->confirmPassword($b);
          $this->db->beginTransaction();
          try {
            $this->q('UPDATE users SET name=?,dob=?,email=?,verified_at=NULL WHERE id=?', [
              $name,
              $dob,
              $email,
              $this->uid,
            ]);
            $this->q('DELETE FROM auth_sessions WHERE user_id=? AND id<>?', [
              $this->uid,
              $this->session['id'],
            ]);
            $this->db->commit();
          } catch (PDOException $e) {
            $this->db->rollBack();
            if ($e->getCode() === '23000') {
              fail(409, 'Unable to register this email');
            }
            throw $e;
          }
        } else {
          $this->q('UPDATE users SET name=?,dob=? WHERE id=?', [$name, $dob, $this->uid]);
        }
        $this->json($this->profile());
      }
      if ($method === 'DELETE') {
        $this->confirmPassword($b);
        $this->db->beginTransaction();
        $this->q('SELECT id FROM users WHERE id=? FOR UPDATE', [$this->uid]);
        $files = $this->q('SELECT disk_name FROM user_files WHERE user_id=?', [
          $this->uid,
        ])->fetchAll();
        foreach ($files as $f) {
          $path = $this->config['uploads'] . '/' . $f['disk_name'];
          if (is_file($path) && !unlink($path)) {
            fail(503, 'Private files could not be removed. Please retry account deletion.');
          }
        }
        $this->q('DELETE FROM users WHERE id=?', [$this->uid]);
        $this->db->commit();
        $this->json(['deleted' => true]);
      }
    }
    if ($route === 'v1/profile/password' && $method === 'POST') {
      $b = $this->body();
      $this->confirmPassword($b);
      $hash = password_hash(
        passwordField($b),
        defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT,
      );
      $this->db->beginTransaction();
      $this->q('UPDATE users SET password_hash=? WHERE id=?', [$hash, $this->uid]);
      $this->q('DELETE FROM auth_sessions WHERE user_id=?', [$this->uid]);
      $token = $this->newSession($this->uid);
      $this->db->commit();
      $this->json(['token' => $token]);
    }
    if ($route === 'v1/profile/export' && $method === 'GET') {
      $out = ['profile' => $this->profile()];
      foreach (
        array_merge(ENTITIES, ['streaks', 'freeze_transactions', 'garden_progress', 'user_files'])
        as $table
      ) {
        $out[$table] = $this->q("SELECT * FROM $table WHERE user_id=?", [$this->uid])->fetchAll();
      }
      foreach ($out['user_files'] as &$f) {
        unset($f['disk_name']);
      }
      $this->json($out);
    }
    if ($route === 'v1/sync/push' && $method === 'POST') {
      $b = $this->body();
      $ops = $b['operations'] ?? [];
      if (!is_array($ops) || count($ops) > 50) {
        fail(422, 'Up to 50 operations allowed');
      }
      $results = [];
      foreach ($ops as $op) {
        $results[] = $this->push($op);
      }
      $this->json(['results' => $results]);
    }
    if (preg_match('~^v1/sync/pull/(\d+)$~D', $route, $m) && $method === 'GET') {
      $rows = $this->q(
        'SELECT seq,entity,record_id AS id,version,data,deleted FROM sync_changes WHERE user_id=? AND seq>? ORDER BY seq LIMIT 201',
        [$this->uid, $m[1]],
      )->fetchAll();
      $more = count($rows) > 200;
      if ($more) {
        array_pop($rows);
      }
      $cursor = (int) $m[1];
      foreach ($rows as &$r) {
        $cursor = (int) $r['seq'];
        unset($r['seq']);
        $r['data'] = json_decode($r['data'], true);
        $r['deleted'] = (bool) $r['deleted'];
        $r['version'] = (int) $r['version'];
      }
      $this->json(['records' => $rows, 'cursor' => $cursor, 'more' => $more]);
    }
    if (
      in_array(
        $route,
        ['v1/sync/status', 'v1/streaks', 'v1/streaks/process', 'v1/streaks/ledger'],
        true,
      )
    ) {
      // Legacy Freeze Point balances remain readable; new progress earns Gems instead.
      $this->json([
        'bytes' => (int) $this->q('SELECT COALESCE(SUM(bytes),0) FROM user_files WHERE user_id=?', [
          $this->uid,
        ])->fetchColumn(),
        'quota' => $this->config['quota_bytes'],
        'wallet' => (int) $this->q('SELECT balance FROM freeze_wallets WHERE user_id=?', [
          $this->uid,
        ])->fetchColumn(),
        'streaks' => $this->q('SELECT * FROM streaks WHERE user_id=?', [$this->uid])->fetchAll(),
        'ledger' => $this->q(
          'SELECT * FROM freeze_transactions WHERE user_id=? ORDER BY day DESC',
          [$this->uid],
        )->fetchAll(),
      ]);
    }
    if ($route === 'v1/files' && $method === 'GET') {
      $this->json(
        $this->q('SELECT id,name,mime,bytes,created_at FROM user_files WHERE user_id=?', [
          $this->uid,
        ])->fetchAll(),
      );
    }
    if ($route === 'v1/files' && $method === 'POST') {
      $this->upload();
    }
    if (preg_match('~^v1/files/([a-f0-9-]{36})$~D', $route, $m)) {
      $this->file($m[1], $method);
    }
    // Typed CRUD shares the same ownership, validation, versions and idempotency as sync.
    if (preg_match('~^v1/(prayers|qaza|routines|completions|tasbih)(?:/(.+))?$~D', $route, $m)) {
      $table = [
        'prayers' => 'prayer_records',
        'qaza' => 'qaza_records',
        'routines' => 'routines',
        'completions' => 'routine_completions',
        'tasbih' => 'tasbih_progress',
      ][$m[1]];
      if ($method === 'GET') {
        $rows = $this->q(
          "SELECT id,data,version,deleted FROM $table WHERE user_id=? AND deleted=0",
          [$this->uid],
        )->fetchAll();
        foreach ($rows as &$r) {
          $r['data'] = json_decode($r['data'], true);
        }
        $this->json($rows);
      }
      if (in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        $b = $this->body();
        $this->json(
          $this->push([
            'id' => $b['operationId'] ?? '',
            'entity' => $table,
            'id_record' => $m[2] ?? ($b['id'] ?? ''),
            'data' => $b['data'] ?? [],
            'version' => $b['version'] ?? 0,
            'deleted' => $method === 'DELETE',
          ]),
        );
      }
    }
    fail(404, 'Endpoint not found');
  }
  private function confirmPassword(array $b): void
  {
    $hash = $this->q('SELECT password_hash FROM users WHERE id=?', [$this->uid])->fetchColumn();
    if (!password_verify($b['currentPassword'] ?? '', $hash)) {
      fail(403, 'Current password is incorrect');
    }
  }
  private function auth(string $route, string $method): void
  {
    if ($method !== 'POST') {
      fail(405, 'Use POST');
    }
    $this->limit('auth:' . $route, $route === 'register' ? 5 : 15, 900);
    $b = $this->body();
    if(in_array($route,['google/challenge','google','google/link'],true)){
      $aud=$this->config['google_web_client_id']??'';if($aud==='')fail(503,'Google sign-in is not configured yet');$google=new GoogleIdentity($this->db);
      if($route==='google/challenge')$this->json(['nonce'=>$google->challenge(),'clientId'=>$aud]);
      if(!is_string($b['idToken']??null)||!is_string($b['nonce']??null))fail(422,'Google identity and challenge required');
      if($route==='google/link')$this->authenticate();
      try{$claims=GoogleIdentity::claims($b['idToken'],$aud,$b['nonce']);$uid=$google->associate($claims,$b['nonce'],$route==='google/link'?$this->uid:null);}catch(InvalidArgumentException $e){fail(401,$e->getMessage());}
      if($route==='google/link')$this->json(['linked'=>true]);$this->uid=$uid;$this->json(['user'=>$this->profile(),'token'=>$this->newSession($uid)]);
    }
    if ($route === 'register') {
      $email = emailField($b);
      $name = textField($b, 'name', 160);
      $password = passwordField($b);
      $id = uuid();
      $this->db->beginTransaction();
      try {
        $this->q('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)', [
          $id,
          $name,
          $email,
          password_hash(
            $password,
            defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT,
          ),
        ]);
      } catch (PDOException $e) {
        $this->db->rollBack();
        if ($e->getCode() === '23000') {
          fail(409, 'Unable to register this email');
        }
        throw $e;
      }
      $this->q('INSERT INTO freeze_wallets(user_id,balance) VALUES(?,0)', [$id]);
      $token = $this->newSession($id);
      $this->db->commit();
      $this->uid = $id;
      $this->json(['user' => $this->profile(), 'token' => $token], 201);
    }
    if ($route === 'login') {
      $u = $this->q('SELECT * FROM users WHERE email=?', [emailField($b)])->fetch();
      $dummy = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
      if (!password_verify($b['password'] ?? '', $u['password_hash'] ?? $dummy) || !$u) {
        fail(401, 'Email or password is incorrect');
      }
      $this->uid = $u['id'];
      $this->json(['user' => $this->profile(), 'token' => $this->newSession($this->uid)]);
    }
    if ($route === 'reset/request') {
      $email = emailField($b);
      $u = $this->q('SELECT id FROM users WHERE email=?', [$email])->fetch();
      if ($u && $this->config['mail_enabled']) {
        $this->mailAction($u['id'], $email, 'reset');
      }
      $this->json([
        'message' => 'If the account exists and mail is configured, a code has been sent.',
      ]);
    }
    if (in_array($route, ['reset/confirm', 'verify/confirm'], true)) {
      $kind = $route === 'reset/confirm' ? 'reset' : 'verify';
      $code = textField($b, 'code', 100);
      $this->db->beginTransaction();
      $a = $this->q(
        'SELECT * FROM auth_actions WHERE token_hash=? AND kind=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE',
        [hash('sha256', $code), $kind],
      )->fetch();
      if (!$a) {
        $this->db->rollBack();
        fail(422, 'Invalid or expired code');
      }
      if ($kind === 'reset') {
        $this->q('UPDATE users SET password_hash=? WHERE id=?', [
          password_hash(
            passwordField($b),
            defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT,
          ),
          $a['user_id'],
        ]);
        $this->q('DELETE FROM auth_sessions WHERE user_id=?', [$a['user_id']]);
      } else {
        $this->q('UPDATE users SET verified_at=UTC_TIMESTAMP() WHERE id=?', [$a['user_id']]);
      }
      $this->q('DELETE FROM auth_actions WHERE user_id=? AND kind=?', [$a['user_id'], $kind]);
      $this->db->commit();
      $this->json(['ok' => true]);
    }
    $this->authenticate();
    if ($route === 'logout') {
      $this->q('DELETE FROM auth_sessions WHERE id=?', [$this->session['id']]);
      $this->json(['ok' => true]);
    }
    if ($route === 'refresh') {
      $t = bin2hex(random_bytes(32));
      $this->q(
        'UPDATE auth_sessions SET previous_hash=token_hash,previous_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 2 MINUTE),token_hash=?,expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY) WHERE id=?',
        [hash('sha256', $t), $this->session['id']],
      );
      $this->json(['token' => $t]);
    }
    if ($route === 'verify/request') {
      if (!$this->config['mail_enabled']) {
        fail(503, 'Mail delivery is not configured');
      }
      $p = $this->profile();
      $this->mailAction($this->uid, $p['email'], 'verify');
      $this->json(['ok' => true]);
    }
    fail(404, 'Authentication endpoint not found');
  }
  private function mailAction(string $uid, string $email, string $kind): void
  {
    $code = bin2hex(random_bytes(24));
    $this->q(
      'INSERT INTO auth_actions(id,user_id,kind,token_hash,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))',
      [uuid(), $uid, $kind, hash('sha256', $code)],
    );
    $from = $this->config['mail_from'];
    if (!filter_var($from, FILTER_VALIDATE_EMAIL)) {
      fail(503, 'Mail sender is not configured');
    }
    if (
      !mail(
        $email,
        'DeenPath ' . $kind . ' code',
        "Enter this code in DeenPath within 30 minutes:\n\n" . $code,
        ['From' => $from],
      )
    ) {
      fail(503, 'Mail delivery failed');
    }
  }
  private function push(array $op): array
  {
    $opid = $op['operationId'] ?? ($op['id'] ?? '');
    $entity = $op['entity'] ?? '';
    $id = $op['id_record'] ?? ($op['recordId'] ?? '');
    // Sync transport uses a separate operation UUID and record ID.
    if (isset($op['record'])) {
      $record = $op['record'];
      $entity = $record['entity'];
      $id = $record['id'];
      $op = array_merge($op, $record);
    }
    if (!preg_match('/^[a-f0-9-]{36}$/D', $opid)) {
      fail(422, 'Operation UUID required');
    }
    $data = $op['data'] ?? [];
    if (!is_array($data)) {
      fail(422, 'Invalid data');
    }
    validateRecord($entity, $id, $data);
    $this->db->beginTransaction();
    try {
      // Serialize all mutations for one account, including dedupe and rewards.
      $this->q('SELECT id FROM users WHERE id=? FOR UPDATE', [$this->uid]);
      $existing = $this->q('SELECT result FROM sync_operations WHERE user_id=? AND id=?', [
        $this->uid,
        $opid,
      ])->fetchColumn();
      if ($existing) {
        $this->db->commit();
        return json_decode($existing, true);
      }
      $old = $this->q("SELECT * FROM $entity WHERE user_id=? AND id=?", [$this->uid, $id])->fetch();
      $v = $old ? (int) $old['version'] : 0;
      if ($v !== (int) ($op['version'] ?? 0)) {
        $r = [
          'conflict' => true,
          'record' => $old
            ? [
              'id' => $id,
              'entity' => $entity,
              'version' => $v,
              'data' => json_decode($old['data'], true),
              'deleted' => (bool) $old['deleted'],
            ]
            : null,
        ];
        $this->db->commit();
        return $r;
      }
      $deleted = (bool) ($op['deleted'] ?? false);
      if (
        $entity === 'routines' &&
        (!$old || $old['deleted']) &&
        !$deleted &&
        (int) $this->q('SELECT COUNT(*) FROM routines WHERE user_id=? AND deleted=0', [
          $this->uid,
        ])->fetchColumn() >= 100
      ) {
        fail(422, 'Maximum 100 active routines per account');
      }
      if ($entity === 'routine_completions') {
        $routine = $this->q('SELECT data FROM routines WHERE user_id=? AND id=? AND deleted=0', [
          $this->uid,
          $data['routineId'],
        ])->fetchColumn();
        if (!$routine) {
          fail(422, 'Routine not found');
        }
        $routine = json_decode($routine, true);
        $at = new DateTimeImmutable($data['completedAt']);
        $local = $at->setTimezone(new DateTimeZone($routine['timezone']));
        $routine = RewardEngine::scheduleOn($routine, $local->format('Y-m-d'));
        $period = RewardEngine::period($routine, $local);
        if (
          $local->format('Y-m-d') < $routine['startDate'] ||
          ($routine['frequency'] === 'daily' && $period < $routine['startDate']) ||
          str_ends_with($period, ':unavailable') ||
          $period !== $data['period'] ||
          $at->getTimestamp() > time() + 300
        ) {
          fail(422, 'Completion is outside its period');
        }
      }
      if ($entity === 'routines' && $old) {
        $prior = json_decode($old['data'], true);
        if (($prior['resetPrayers'] ?? []) !== ($data['resetPrayers'] ?? [])) {
          fail(409, 'Create a new routine to change its reset prayers');
        }
        foreach (
          ['startDate', 'timezone', 'frequency', 'interval', 'deadline', 'resetSettings']
          as $key
        ) {
          if (
            $key === 'resetSettings'
              ? ($prior[$key] ?? null) != ($data[$key] ?? null)
              : ($prior[$key] ?? null) !== ($data[$key] ?? null)
          ) {
            fail(409, 'Create a new routine to change its calendar');
          }
        }
      }
      $v++;
      $json = json_encode($data, JSON_THROW_ON_ERROR);
      $this->q(
        "INSERT INTO $entity(user_id,id,data,version,deleted) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),version=VALUES(version),deleted=VALUES(deleted)",
        [$this->uid, $id, $json, $v, (int) $deleted],
      );
      $this->q(
        'INSERT INTO sync_changes(user_id,entity,record_id,version,data,deleted) VALUES(?,?,?,?,?,?)',
        [$this->uid, $entity, $id, $v, $json, (int) $deleted],
      );
      if ($deleted) {
        $this->q(
          'INSERT INTO sync_tombstones(user_id,entity,record_id,version) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version)',
          [$this->uid, $entity, $id, $v],
        );
      }
      if ($entity === 'routines') {
        $this->q(
          'INSERT INTO routine_schedules(user_id,routine_id,data) VALUES(?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',
          [$this->uid, $id, $json],
        );
      }
      $r = ['version' => $v];
      $this->q('INSERT INTO sync_operations(user_id,id,result) VALUES(?,?,?)', [
        $this->uid,
        $opid,
        json_encode($r),
      ]);
      $this->db->commit();
      return $r;
    } catch (Throwable $e) {
      if ($this->db->inTransaction()) {
        $this->db->rollBack();
      }
      throw $e;
    }
  }
  private function processRewards(): void
  {
    $this->db->beginTransaction();
    try {
      $this->q('SELECT id FROM users WHERE id=? FOR UPDATE', [$this->uid]);
      $routines = [];
      foreach (
        $this->q('SELECT id,data FROM routines WHERE user_id=? AND deleted=0 ORDER BY id', [
          $this->uid,
        ])->fetchAll()
        as $r
      ) {
        $routines[$r['id']] = json_decode($r['data'], true);
      }
      // Reuse the projection until history changes or a routine's local period advances.
      // This avoids replaying years of history every minute on shared hosting.
      $revision =
        $this->q(
          "SELECT seq FROM sync_changes WHERE user_id=? AND entity IN ('routines','routine_completions') ORDER BY seq DESC LIMIT 1",
          [$this->uid],
        )->fetchColumn() ?:
        0;
      $cutoffs = [];
      foreach ($routines as $rid => $routine) {
        $local = new DateTimeImmutable('now', new DateTimeZone($routine['timezone']));
        $cutoffs[$rid] = RewardEngine::period($routine, $local);
      }
      $projection = hash('sha256', $revision . '|' . json_encode($cutoffs));
      if (
        $this->q('SELECT projection_key FROM freeze_wallets WHERE user_id=?', [
          $this->uid,
        ])->fetchColumn() === $projection
      ) {
        $this->db->commit();
        return;
      }
      $completions = [];
      foreach (
        $this->q('SELECT id FROM routine_completions WHERE user_id=? AND deleted=0', [
          $this->uid,
        ])->fetchAll()
        as $r
      ) {
        $completions[$r['id']] = true;
      }
      $result = RewardEngine::replay(
        $this->uid,
        $routines,
        $completions,
        new DateTimeImmutable('now', new DateTimeZone('UTC')),
      );
      $this->q('DELETE FROM freeze_transactions WHERE user_id=?', [$this->uid]);
      $this->q('DELETE FROM streaks WHERE user_id=?', [$this->uid]);
      $this->q('DELETE FROM garden_progress WHERE user_id=?', [$this->uid]);
      foreach ($result['ledger'] as $r) {
        $this->q(
          'INSERT INTO freeze_transactions(id,user_id,routine_id,day,kind,delta,balance_after) VALUES(?,?,?,?,?,?,?)',
          [
            $r['id'],
            $this->uid,
            $r['routine_id'],
            $r['day'],
            $r['kind'],
            $r['delta'],
            $r['balance_after'],
          ],
        );
      }
      foreach ($result['streaks'] as $rid => $r) {
        $this->q(
          'INSERT INTO streaks(user_id,routine_id,current_streak,best_streak,success_run,last_day,last_period) VALUES(?,?,?,?,?,?,?)',
          [
            $this->uid,
            $rid,
            $r['current_streak'],
            $r['best_streak'],
            $r['success_run'],
            $r['last_day'],
            $r['last_period'],
          ],
        );
        $this->q('INSERT INTO garden_progress(user_id,routine_id,stage) VALUES(?,?,?)', [
          $this->uid,
          $rid,
          min(5, (int) floor($r['best_streak'] / 7)),
        ]);
      }
      $this->q('UPDATE freeze_wallets SET balance=?,projection_key=? WHERE user_id=?', [
        $result['wallet'],
        $projection,
        $this->uid,
      ]);
      $this->db->commit();
    } catch (Throwable $e) {
      $this->db->rollBack();
      throw $e;
    }
  }
  private function upload(): never
  {
    $this->limit('upload:' . $this->uid, 20, 3600);
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
      fail(422, 'Upload failed');
    }
    $size = filesize($f['tmp_name']);
    if ($size < 1 || $size > $this->config['max_file_bytes']) {
      fail(413, 'File exceeds limit');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!in_array($mime, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], true)) {
      fail(422, 'Only PDF, JPEG, PNG and WebP allowed');
    }
    if (
      $mime !== 'application/pdf' &&
      (!getimagesize($f['tmp_name']) ||
        getimagesize($f['tmp_name'])[0] * getimagesize($f['tmp_name'])[1] > 40000000)
    ) {
      fail(422, 'Invalid or oversized image');
    }
    $dir = $this->config['uploads'];
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) {
      fail(503, 'Storage unavailable');
    }
    $id = $_POST['id'] ?? uuid();
    if (!preg_match('/^[a-f0-9-]{36}$/D', $id)) {
      fail(422, 'Invalid upload ID');
    }
    $contentHash = hash_file('sha256', $f['tmp_name']);
    $disk = bin2hex(random_bytes(32));
    $name = preg_replace('/[\x00-\x1f\x7f]/', '', basename($f['name']));
    $name = substr($name, 0, 180);
    $this->db->beginTransaction();
    try {
      $this->q('SELECT id FROM users WHERE id=? FOR UPDATE', [$this->uid]);
      $existing = $this->q(
        'SELECT id,name,mime,bytes,content_hash FROM user_files WHERE id=? AND user_id=?',
        [$id, $this->uid],
      )->fetch();
      if ($existing) {
        if (!hash_equals($existing['content_hash'], $contentHash)) {
          fail(409, 'Upload ID was already used for different content');
        }
        unset($existing['content_hash']);
        if (($_POST['profile'] ?? '') === '1' && $mime !== 'application/pdf') {
          $this->q('UPDATE users SET profile_file=? WHERE id=?', [$id, $this->uid]);
        }
        $this->db->commit();
        $this->json($existing);
      }
      $used = (int) $this->q('SELECT COALESCE(SUM(bytes),0) FROM user_files WHERE user_id=?', [
        $this->uid,
      ])->fetchColumn();
      if ($used + $size > $this->config['quota_bytes']) {
        fail(413, 'Storage quota reached');
      }
      if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $disk)) {
        fail(503, 'Could not save file');
      }
      chmod($dir . '/' . $disk, 0600);
      $this->q(
        'INSERT INTO user_files(id,user_id,name,mime,bytes,content_hash,disk_name) VALUES(?,?,?,?,?,?,?)',
        [$id, $this->uid, $name, $mime, $size, $contentHash, $disk],
      );
      if (($_POST['profile'] ?? '') === '1') {
        if ($mime === 'application/pdf') {
          fail(422, 'Profile must be an image');
        }
        $this->q('UPDATE users SET profile_file=? WHERE id=?', [$id, $this->uid]);
      }
      $this->db->commit();
      $this->json(['id' => $id, 'name' => $name, 'mime' => $mime, 'bytes' => $size], 201);
    } catch (Throwable $e) {
      if ($this->db->inTransaction()) {
        $this->db->rollBack();
      }
      @unlink($dir . '/' . $disk);
      throw $e;
    }
  }
  private function file(string $id, string $method): never
  {
    $f = $this->q('SELECT * FROM user_files WHERE id=? AND user_id=?', [$id, $this->uid])->fetch();
    if (!$f) {
      fail(404, 'File not found');
    }
    $path = $this->config['uploads'] . '/' . $f['disk_name'];
    if ($method === 'DELETE') {
      $this->db->beginTransaction();
      $this->q('SELECT id FROM users WHERE id=? FOR UPDATE', [$this->uid]);
      if (is_file($path) && !unlink($path)) {
        fail(503, 'Could not remove the private file. Please retry.');
      }
      $this->q('UPDATE users SET profile_file=NULL WHERE id=? AND profile_file=?', [
        $this->uid,
        $id,
      ]);
      $this->q('DELETE FROM user_files WHERE id=? AND user_id=?', [$id, $this->uid]);
      $this->db->commit();
      $this->json(['deleted' => true]);
    }
    if ($method === 'GET') {
      if (!is_file($path)) {
        fail(404, 'File unavailable');
      }
      header('Content-Type: ' . $f['mime']);
      header('Content-Length: ' . $f['bytes']);
      header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($f['name']));
      readfile($path);
      exit();
    }
    fail(405, 'Unsupported method');
  }
}
