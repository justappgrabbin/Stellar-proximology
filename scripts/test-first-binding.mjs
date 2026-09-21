#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSynthiaUnitProvider } from '../integration/adapters/synthia-unit-provider.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const stellarCompPath = path.join(
  ROOT,
  'systems',
  'installed',
  'stellar-comp-mcp',
  'Stellar-Comp-MCP-Computer-v0.1',
  'src',
  'index.js'
);

const synthiaUnitPath = path.join(
  ROOT,
  'systems',
  'installed',
  'synthia-unified-linux',
  'core',
  'SynthiaUnit.mjs'
);

const [{ StellarComp }, synthiaModule] = await Promise.all([
  import(pathToFileURL(stellarCompPath).href),
  import(pathToFileURL(synthiaUnitPath).href)
]);

const SynthiaUnit = synthiaModule.default || synthiaModule.SynthiaUnit;
const unit = new SynthiaUnit({ profile: { id: 'assembly-test' } });
const computer = new StellarComp();
const provider = createSynthiaUnitProvider({ unit });

await computer.admit(provider.manifest, provider.runtime);

const output = await computer.invoke({
  requester: 'assembly-test',
  capability: 'synthia.ask',
  input: { intent: 'research a testable question about local system behavior' }
});

if (!output?.ok) throw new Error('Synthia ask did not return ok');
if (!output.route?.includes('research')) throw new Error('Existing Synthia research organ was not reached');

const snapshot = computer.snapshot();
if (!snapshot.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  binding: 'StellarComp -> SynthiaUnit -> research',
  ok: true,
  route: output.route,
  ledgerVerified: snapshot.ledgerVerified
}, null, 2));
