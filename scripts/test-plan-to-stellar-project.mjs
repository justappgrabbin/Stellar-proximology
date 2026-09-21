#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createLocalPlanningProvider } from '../integration/adapters/local-planning-provider.mjs';
import { createStellarProximologyProvider } from '../integration/adapters/stellar-proximology-local-provider.mjs';
import { promotePlanToStellarProject } from '../integration/flows/promote-plan-to-stellar-project.mjs';

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
const successPath = path.join(
  ROOT,
  'systems',
  'installed',
  'synthia-unified-linux',
  'vendor',
  'ato-core',
  'src',
  'success.mjs'
);
const humanSuccessPath = path.join(
  ROOT,
  'systems',
  'installed',
  'stellar-cpu',
  'StellarCPU-Rough-v0.1.0',
  'packages',
  'human-success',
  'human-success-metabolism.mjs'
);

const [{ StellarComp }, synthiaModule, successModule, humanSuccessModule] = await Promise.all([
  import(pathToFileURL(stellarCompPath).href),
  import(pathToFileURL(synthiaUnitPath).href),
  import(pathToFileURL(successPath).href),
  import(pathToFileURL(humanSuccessPath).href)
]);

const SynthiaUnit = synthiaModule.default || synthiaModule.SynthiaUnit;
const { SuccessLedger } = successModule;
const { HumanSuccessMetabolism } = humanSuccessModule;

let storedProject = null;
const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => raw += chunk);
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');

    if (req.method === 'GET' && req.url === '/api/health') {
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/projects') {
      const body = raw ? JSON.parse(raw) : {};
      storedProject = { id: 'stellar-project-1', ...body };
      res.end(JSON.stringify(storedProject));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/projects/stellar-project-1') {
      if (!storedProject) {
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: 'not found' }));
        return;
      }
      res.end(JSON.stringify(storedProject));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ detail: 'not found' }));
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

try {
  const computer = new StellarComp();
  const unit = new SynthiaUnit({ profile: { id: 'plan-project-test' } });
  const ledger = new SuccessLedger();
  const metabolism = new HumanSuccessMetabolism();

  const planning = createLocalPlanningProvider({ unit, ledger, metabolism });
  const stellar = createStellarProximologyProvider({
    baseUrl: `http://127.0.0.1:${port}`
  });

  await computer.admit(planning.manifest, planning.runtime);
  await computer.admit(stellar.manifest, stellar.runtime);

  await computer.invoke({
    requester: 'plan-project-test',
    capability: 'planning.purpose.define',
    input: {
      person_id: 'plan-project-test',
      statement: 'Launch a self-hosted paid software service',
      indicators: [
        { id: 'offer', name: 'Offer defined', direction: 'increase' },
        { id: 'customers', name: 'Paying customers', direction: 'increase' }
      ]
    }
  });

  const promoted = await promotePlanToStellarProject({
    computer,
    person_id: 'plan-project-test',
    creator_id: 'plan-project-test',
    category: 'business',
    project_type: 'product'
  });

  const readBack = await computer.invoke({
    requester: 'plan-project-test',
    capability: 'stellar.project.get',
    input: { project_id: promoted.stellarProject.id }
  });

  if (!promoted?.stellarProject?.id) throw new Error('No Stellar project was created');
  if (readBack?.id !== promoted.stellarProject.id) throw new Error('Created project could not be read back');
  if (!String(readBack?.title || '').toLowerCase().includes('self-hosted')) {
    throw new Error('Purpose statement did not carry into the Stellar project');
  }

  const snapshot = computer.snapshot();
  if (!snapshot.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

  console.log(JSON.stringify({
    ok: true,
    binding: 'planning.summary -> stellar.project.create -> stellar.project.get',
    project: readBack,
    ledgerVerified: snapshot.ledgerVerified
  }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
