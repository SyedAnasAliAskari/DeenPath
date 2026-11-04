<?php
$failed = false;
$files = new RecursiveIteratorIterator(new RecursiveCallbackFilterIterator(new RecursiveDirectoryIterator(__DIR__ . '/../backend', FilesystemIterator::SKIP_DOTS),static fn($entry)=>!$entry->isDir()||!in_array($entry->getFilename(),['vendor','storage'],true)));
foreach ($files as $f) {
  if ($f->isFile() && $f->getExtension() === 'php') {
    passthru(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($f->getPathname()), $code);
    $failed = $failed || $code !== 0;
  }
}
exit($failed ? 1 : 0);
