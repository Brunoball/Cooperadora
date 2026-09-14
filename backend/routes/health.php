<?php
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
  'ok' => true,
  'test_mode' => getenv('COOP_TEST_MODE') === '1',
  'db' => getenv('COOP_DB_NAME') ?: null,
], JSON_UNESCAPED_UNICODE);
