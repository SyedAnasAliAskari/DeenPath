<?php
declare(strict_types=1);
// Set this ONE absolute path after checking the actual cPanel Home Directory.
// This path must be outside every public document root.
$privateRoot =
  getenv('SALAHGUARD_PRIVATE_ROOT') ?: '/REPLACE_WITH_VERIFIED_CPANEL_HOME/mobile_apps/SalahGuard';
if (!is_file($privateRoot . '/src/bootstrap.php')) {
  http_response_code(503);
  header('Content-Type: application/json');
  echo '{"error":"Private backend is not configured"}';
  exit();
}
require $privateRoot . '/src/bootstrap.php';
