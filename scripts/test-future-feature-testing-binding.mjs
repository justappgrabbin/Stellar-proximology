#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFutureFeatureTestingProvider } from '../integration/adapters/future-feature-testing-provider.mjs';

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

const registryPath = path.join(
  ROOT,
  'systems',
  'installed',
  'synthia-v054-future-feature-testing',
  'Synthia-Integrated-Automata-v0.5.4',
  'src',
  'governance',
  'future-feature-testing-registry.mjs'
);

const [{ StellarComp }, registryModule] = await Promise.all([
  import(pathToFileURL(stellarCompPath).href),
  import(pathToFileURL(registryPath).href)
]);

const computer = new StellarComp();
const provider = createFutureFeatureTestingProvider({
  RegistryClass: registryModule.FutureFeatureTestingRegistry
});

await computer.admit(provider.manifest, provider.runtime);

const submission = await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.register',
  input: {
    ownerId: 'assembly-owner',
    name: 'Assembly test project',
    kind: 'project'
  }
});

let eligibility = await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.eligibility',
  input: {
    submissionId: submission.submissionId,
    purpose: { useTestResultsForFutureDevelopment: true }
  }
});

if (eligibility.eligible !== false || eligibility.reason !== 'future_testing_not_allowed') {
  throw new Error('New submission was not private by default');
}

await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.consent',
  input: {
    submissionId: submission.submissionId,
    ownerId: 'assembly-owner',
    consent: {
      futureTesting: true,
      crossSubmissionTesting: true,
      useTestResultsForFutureDevelopment: true,
      allowMechanismIncorporation: false,
      allowResultingFeatureForOtherUsers: false
    }
  }
});

eligibility = await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.eligibility',
  input: {
    submissionId: submission.submissionId,
    purpose: { useTestResultsForFutureDevelopment: true }
  }
});

if (!eligibility.eligible) throw new Error('Explicit consent did not make the requested test eligible');

const use = await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.record-use',
  input: {
    submissionIds: [submission.submissionId],
    purpose: {
      futureFeature: 'assembly-governance-test',
      useTestResultsForFutureDevelopment: true
    },
    testContext: { assembly: true }
  }
});

const snapshot = await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.snapshot',
  input: {}
});

const restored = new registryModule.FutureFeatureTestingRegistry({ restored: snapshot });
if (restored.snapshot().testUseLedger.length !== 1) {
  throw new Error('Snapshot/restore did not preserve test-use history');
}

await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.revoke',
  input: {
    submissionId: submission.submissionId,
    ownerId: 'assembly-owner',
    reason: 'assembly test complete'
  }
});

eligibility = await computer.invoke({
  requester: 'assembly-test',
  capability: 'governance.future-testing.eligibility',
  input: { submissionId: submission.submissionId, purpose: {} }
});

if (eligibility.eligible !== false || eligibility.reason !== 'future_testing_not_allowed') {
  throw new Error('Revocation did not block future use');
}

const assembly = computer.snapshot();
if (!assembly.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  ok: true,
  binding: 'StellarComp -> FutureFeatureTestingRegistry v0.5.4',
  submissionId: submission.submissionId,
  recordedUse: use.id,
  restoredUseCount: restored.snapshot().testUseLedger.length,
  postRevocationReason: eligibility.reason,
  ledgerVerified: assembly.ledgerVerified
}, null, 2));
