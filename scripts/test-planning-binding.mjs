#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLocalPlanningProvider } from '../integration/adapters/local-planning-provider.mjs';

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

const unit = new SynthiaUnit({ profile: { id: 'planning-test' } });
const ledger = new SuccessLedger();
const metabolism = new HumanSuccessMetabolism();
const computer = new StellarComp();

const provider = createLocalPlanningProvider({ unit, ledger, metabolism });
await computer.admit(provider.manifest, provider.runtime);

const purpose = await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.purpose.define',
  input: {
    person_id: 'planning-test',
    statement: 'Launch a self-hosted software service that produces useful paid work',
    indicators: [
      { id: 'revenue', name: 'Revenue', direction: 'increase' },
      { id: 'users', name: 'Paying users', direction: 'increase' }
    ]
  }
});

await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.progress.observe',
  input: { person_id: 'planning-test', indicator_id: 'revenue', value: 0 }
});

const progress = await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.progress.observe',
  input: { person_id: 'planning-test', indicator_id: 'revenue', value: 25 }
});

const proposal = await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.proposal.create',
  input: {
    person_id: 'planning-test',
    indicator_id: 'revenue',
    message: 'Test one paid offer with one reachable customer segment.',
    behaviors: ['define-offer', 'identify-segment', 'run-test']
  }
});

await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.success.observe',
  input: {
    person_id: 'planning-test',
    dimension: 'movement',
    value: 0.4,
    context: { kind: 'baseline' }
  }
});

const success = await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.success.observe',
  input: {
    person_id: 'planning-test',
    dimension: 'movement',
    value: 0.6,
    context: { kind: 'followup' },
    strategy_ids: [proposal.id]
  }
});

const research = await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.research.seed',
  input: {
    intent: 'research the smallest testable path to launch this software service and find evidence'
  }
});

const browser = await computer.invoke({
  requester: 'planning-test',
  capability: 'planning.browser.workflow',
  input: {
    intent: 'open a website and research pricing for comparable software services'
  }
});

if (purpose?.statement?.length < 1) throw new Error('Purpose definition failed');
if (progress?.direction !== 'toward') throw new Error('Progress tracker did not detect movement');
if (!proposal?.id) throw new Error('Planning proposal was not created');
if (!research?.route?.includes('research')) throw new Error('Research planner was not reached');
if (!browser?.outputs?.[0]?.out?.plan?.steps?.length) throw new Error('Browser task planner returned no steps');

const snapshot = computer.snapshot();
if (!snapshot.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  ok: true,
  purpose: purpose.statement,
  progress: progress.direction,
  proposal: proposal.id,
  successScore: success.fitness?.score,
  researchRoute: research.route,
  browserPlan: browser.outputs[0].out.plan,
  ledgerVerified: snapshot.ledgerVerified
}, null, 2));
