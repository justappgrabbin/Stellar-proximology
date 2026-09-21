#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const validatorPath = path.join(
  ROOT,
  'systems',
  'installed',
  'stellar-comp-mcp',
  'Stellar-Comp-MCP-Computer-v0.1',
  'src',
  'core',
  'manifest.js'
);
const manifestsDir = path.join(ROOT, 'systems', 'manifests');

if (!fs.existsSync(validatorPath)) {
  console.error('Stellar Comp is not staged. Run the existing-system staging pass first.');
  console.error('Expected validator:', validatorPath);
  process.exit(2);
}

const { validateManifest } = await import(pathToFileURL(validatorPath).href);
const files = fs.readdirSync(manifestsDir).filter(name => name.endsWith('.stellar.json')).sort();

if (!files.length) {
  console.error('No Stellar manifests found.');
  process.exit(3);
}

let failures = 0;
for (const file of files) {
  const full = path.join(manifestsDir, file);
  const manifest = JSON.parse(fs.readFileSync(full, 'utf8'));
  const result = validateManifest(manifest);
  if (result.ok) {
    console.log('PASS', file, '->', manifest.id);
  } else {
    failures++;
    console.error('FAIL', file, '->', result.errors.join('; '));
  }
}

if (failures) process.exit(1);
console.log('Validated', files.length, 'observed-interface manifests with the existing Stellar Comp validator.');
