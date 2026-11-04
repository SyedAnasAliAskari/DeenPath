<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: https://localhost');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit();
}
require __DIR__ . '/validation.php';
require __DIR__ . '/api.php';
try {
  $path = dirname(__DIR__) . '/config/production.php';
  if (!is_file($path)) {
    fail(503, 'Private configuration missing');
  }
  $config = require $path;
  $local = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
  if (($_SERVER['HTTPS'] ?? 'off') === 'off' && !($local && $config['allow_local_http'])) {
    fail(400, 'HTTPS is required');
  }
  if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $config['max_file_bytes'] + 1048576) {
    fail(413, 'Request too large');
  }
  $pdo = new PDO(
    'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
    $config['db_user'],
    $config['db_password'],
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_EMULATE_PREPARES => false,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ],
  );
  $pdo->exec("SET time_zone = '+00:00'");
  $app = new Api($pdo, $config);
  $app->run();
} catch (HttpError $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  http_response_code($e->status);
  echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  error_log('DeenPath: ' . $e->getMessage());
  http_response_code(500);
  echo '{"error":"Request failed. Please retry."}';
}
