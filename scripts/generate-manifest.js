#!/usr/bin/env node
/**
 * Walks a build output directory and writes a manifest.json listing every
 * file's content hash. Used by the iOS hot-update client to diff a remote
 * build against the version currently installed on-device.
 *
 * Usage: node scripts/generate-manifest.js <distDir> [--build-id=<id>] [--min-native-build=<n>] [--disabled]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, base, out);
    } else {
      out.push(path.relative(base, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

function hashFile(absPath) {
  const buf = fs.readFileSync(absPath);
  return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
}

function parseArgs(argv) {
  const [distDir, ...rest] = argv;
  const opts = { buildId: process.env.BUILD_ID || '', minNativeBuild: 1, disabled: false };
  for (const arg of rest) {
    if (arg.startsWith('--build-id=')) opts.buildId = arg.slice('--build-id='.length);
    else if (arg.startsWith('--min-native-build=')) opts.minNativeBuild = Number(arg.slice('--min-native-build='.length));
    else if (arg === '--disabled') opts.disabled = true;
  }
  return { distDir, opts };
}

function main() {
  const { distDir, opts } = parseArgs(process.argv.slice(2));
  if (!distDir) {
    console.error('Usage: node scripts/generate-manifest.js <distDir> [--build-id=<id>] [--min-native-build=<n>]');
    process.exit(1);
  }
  const absDistDir = path.resolve(distDir);
  if (!fs.existsSync(absDistDir)) {
    console.error(`dist dir not found: ${absDistDir}`);
    process.exit(1);
  }

  const relFiles = walk(absDistDir, absDistDir, []).filter(f => f !== 'manifest.json');
  const files = relFiles
    .map(rel => {
      const abs = path.join(absDistDir, rel);
      const stat = fs.statSync(abs);
      return { path: rel, hash: hashFile(abs), size: stat.size };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const buildId = opts.buildId || crypto.createHash('sha256').update(files.map(f => f.hash).join(',')).digest('hex').slice(0, 12);

  const manifest = {
    buildId,
    generatedAt: new Date().toISOString(),
    minNativeBuild: opts.minNativeBuild,
    disabled: opts.disabled,
    files,
  };

  fs.writeFileSync(path.join(absDistDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`manifest.json written: ${files.length} files, buildId=${buildId}`);
}

main();
