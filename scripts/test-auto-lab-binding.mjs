#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAutoLabProvider } from '../integration/adapters/auto-lab-provider.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stateRoot = path.join(ROOT, 'systems', 'runtime', 'auto-lab-test');

fs.rmSync(stateRoot, { recursive: true, force: true });
fs.mkdirSync(stateRoot, { recursive: true });

const stellarCompPath = path.join(
  ROOT,
  'systems',
  'installed',
  'stellar-comp-mcp',
  'Stellar-Comp-MCP-Computer-v0.1',
  'src',
  'index.js'
);

const autoLabSource = path.join(
  ROOT,
  'systems',
  'installed',
  'auto-lab-canonical',
  'Synthia-System-Auto-Lab'
);

const bridgePath = path.join(
  ROOT,
  'integration',
  'adapters',
  'auto-lab-bridge.py'
);

const { StellarComp } = await import(pathToFileURL(stellarCompPath).href);

const computer = new StellarComp();
const provider = createAutoLabProvider({
  bridgePath,
  sourceRoot: autoLabSource,
  stateRoot
});

await computer.admit(provider.manifest, provider.runtime);

const project = await computer.invoke({
  requester: 'assembly-test',
  capability: 'lab.project.create',
  input: {
    title: 'Assembly bridge test',
    question: 'Can the existing Auto Lab be invoked through the existing Stellar Comp capability layer?'
  }
});

const experiment = await computer.invoke({
  requester: 'assembly-test',
  capability: 'lab.experiment.propose',
  input: { project_id: project.id }
});

const cycle = await computer.invoke({
  requester: 'assembly-test',
  capability: 'lab.cycle',
  input: {}
});

if (!project?.id) throw new Error('Auto Lab did not create a project');
if (!experiment?.id) throw new Error('Auto Lab did not create an experiment');
if (cycle?.action !== 'started') throw new Error('Auto Lab cycle did not start the queued experiment');

const snapshot = computer.snapshot();
if (!snapshot.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  binding: 'StellarComp -> AutoLab -> project -> experiment -> cycle',
  project: project.id,
  experiment: experiment.id,
  cycle,
  ledgerVerified: snapshot.ledgerVerified
}, null, 2));
