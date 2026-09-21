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
const unit = new SynthiaUnit({ profile: { id: 'business-test' } });
const computer = new StellarComp();
const provider = createSynthiaUnitProvider({ unit });

await computer.admit(provider.manifest, provider.runtime);

const need = await computer.invoke({
  requester: 'business-test',
  capability: 'business.need.signal',
  input: {
    title: 'Find a local way to sell a software service',
    capabilities: ['market-research', 'pricing', 'project-planning']
  }
});

const opportunity = await computer.invoke({
  requester: 'business-test',
  capability: 'business.opportunity.post',
  input: {
    title: 'Local software launch',
    capabilities: ['pricing', 'project-planning']
  }
});

const matches = await computer.invoke({
  requester: 'business-test',
  capability: 'business.match',
  input: {
    profile: {
      neededCapabilities: ['pricing', 'project-planning']
    }
  }
});

const snapshot = await computer.invoke({
  requester: 'business-test',
  capability: 'business.snapshot',
  input: {}
});

if (!need?.id || !opportunity?.id) throw new Error('Existing EconomyOrgan did not persist business state');
if (!Array.isArray(matches) || matches.length < 1) throw new Error('Existing EconomyOrgan did not return matches');
if (!Array.isArray(snapshot?.needs) || snapshot.needs.length !== 1) throw new Error('Need state not present');
if (!Array.isArray(snapshot?.opportunities) || snapshot.opportunities.length !== 1) throw new Error('Opportunity state not present');

const state = computer.snapshot();
if (!state.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  ok: true,
  binding: 'StellarComp -> SynthiaUnit -> existing EconomyOrgan',
  need: need.id,
  opportunity: opportunity.id,
  topMatchScore: matches[0]?.score,
  ledgerVerified: state.ledgerVerified
}, null, 2));
