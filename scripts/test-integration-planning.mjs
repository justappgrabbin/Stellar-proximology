#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createLocalPlanningProvider } from '../integration/adapters/local-planning-provider.mjs';
import { createIntegrationPlanningGoal } from '../integration/flows/integration-planning-goal.mjs';

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

const computer = new StellarComp();
const unit = new SynthiaUnit({ profile: { id: 'integration-planning-test' } });
const ledger = new SuccessLedger();
const metabolism = new HumanSuccessMetabolism();

const planning = createLocalPlanningProvider({ unit, ledger, metabolism });
await computer.admit(planning.manifest, planning.runtime);

const goal = createIntegrationPlanningGoal({
  systems: [
    'Stellar Comp',
    'Synthia Unified',
    'Auto Lab',
    'Stellar Proximology'
  ]
});

const purpose = await computer.invoke({
  requester: 'integration-planning-test',
  capability: 'planning.purpose.define',
  input: {
    person_id: 'integration-planning-test',
    statement: goal.statement,
    indicators: goal.indicators,
    context: {
      domain: goal.domain,
      mode: goal.mode,
      systems: goal.systems,
      constraints: goal.constraints
    }
  }
});

const proposal = await computer.invoke({
  requester: 'integration-planning-test',
  capability: 'planning.proposal.create',
  input: {
    person_id: 'integration-planning-test',
    indicator_id: 'bindings',
    message: 'Connect one existing interface pair and verify the real state transition before adding another connection.',
    behaviors: [
      'inspect-existing-entrypoints',
      'select-existing-interface',
      'connect-one-path',
      'run-real-input',
      'observe-output-and-state',
      'record-verification'
    ],
    role: 'integration-planner'
  }
});

const research = await computer.invoke({
  requester: 'integration-planning-test',
  capability: 'planning.research.seed',
  input: {
    intent: 'inspect the existing systems and identify the smallest preservation-first integration path using interfaces that already exist'
  }
});

await computer.invoke({
  requester: 'integration-planning-test',
  capability: 'planning.progress.observe',
  input: {
    person_id: 'integration-planning-test',
    indicator_id: 'inventory',
    value: 1,
    context: { evidence: 'systems registered in assembly manifest' }
  }
});

await computer.invoke({
  requester: 'integration-planning-test',
  capability: 'planning.progress.observe',
  input: {
    person_id: 'integration-planning-test',
    indicator_id: 'interfaces',
    value: 1,
    context: { evidence: 'interface census present' }
  }
});

const summary = await computer.invoke({
  requester: 'integration-planning-test',
  capability: 'planning.summary',
  input: { person_id: 'integration-planning-test' }
});

const serialized = JSON.stringify({ goal, purpose, proposal, research, summary }).toLowerCase();

if (serialized.includes('human design') || serialized.includes('human-design')) {
  throw new Error('Integration planning test became Human Design-specific');
}

if (!proposal?.id) throw new Error('Integration proposal was not created');
if (!research?.route?.includes('research')) throw new Error('Existing research path was not reached');

const snapshot = computer.snapshot();
if (!snapshot.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  ok: true,
  mode: 'domain-neutral-integration-planning',
  purpose: goal.statement,
  systems: goal.systems,
  proposal: proposal.id,
  researchRoute: research.route,
  humanDesignDependency: false,
  ledgerVerified: snapshot.ledgerVerified
}, null, 2));
