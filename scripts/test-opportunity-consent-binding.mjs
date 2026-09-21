#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOpportunityConsentProvider } from '../integration/adapters/opportunity-consent-provider.mjs';

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

const opportunityPath = path.join(
  ROOT,
  'systems',
  'installed',
  'mcp-opportunity-consent',
  'Synthia-MCP-Opportunity-Consent',
  'src',
  'index.js'
);

const [{ StellarComp }, opportunityModule] = await Promise.all([
  import(pathToFileURL(stellarCompPath).href),
  import(pathToFileURL(opportunityPath).href)
]);

const runtime = {
  intent: {
    getDemands: () => [{
      id: 'need-pricing',
      type: 'pricing',
      description: 'Need pricing research',
      urgency: 0.8,
      requiredCapabilities: ['pricing']
    }]
  },
  agent: {
    getAspiration: () => ({ getTopGaps: () => [] }),
    getScience: () => ({
      formulateQuestion: question => ({ id: 'science-q1', question }),
      recordExperiment: () => ({ ok: true })
    })
  }
};

const provisioned = [];
const organism = opportunityModule.createExternalRelationshipOrganism({
  runtime,
  localResolver: { resolve: async () => ({ satisfied: false, candidates: [] }) },
  organismResolver: { resolve: async () => ({ satisfied: false, candidates: [] }) },
  networkResolver: {
    resolve: async need => ({
      satisfied: false,
      candidates: need.requiredCapabilities?.includes('pricing')
        ? [{ id: 'pricing-helper', capabilities: ['pricing'] }]
        : []
    })
  },
  mcpResolver: { resolve: async () => ({ satisfied: false, candidates: [] }) },
  humanResolver: { resolve: async () => ({ satisfied: false, candidates: [] }) },
  provisioner: {
    deploy: async plan => {
      provisioned.push(plan);
      return { ok: true, runtimeId: 'local-runtime-1' };
    }
  },
  allowedPackages: ['com.example.allowed'],
  consentSecret: 'assembly-test-secret'
});

const computer = new StellarComp();
const provider = createOpportunityConsentProvider({ organism });
await computer.admit(provider.manifest, provider.runtime);

const needs = await computer.invoke({
  requester: 'assembly-test',
  capability: 'opportunity.needs.open',
  input: { owner: 'assembly-test' }
});

const resolution = await computer.invoke({
  requester: 'assembly-test',
  capability: 'capability.resolve.external',
  input: { need: needs[0] }
});

if (resolution.layer !== 'network') {
  throw new Error('Capability cascade did not stop at the first useful existing layer');
}

const opportunity = await computer.invoke({
  requester: 'assembly-test',
  capability: 'opportunity.evaluate',
  input: {
    need: needs[0],
    candidate: {
      id: 'pricing-helper',
      capabilityFit: 0.9,
      networkValue: 0.8
    },
    reciprocalValue: {
      predictedMutualBenefit: 0.8
    },
    confidence: 0.9
  }
});

const installConsent = await computer.invoke({
  requester: 'assembly-test',
  capability: 'consent.install.approve',
  input: {
    opportunityId: opportunity.opportunityId,
    subjectId: 'device-owner',
    scope: ['local_runtime']
  }
});

const verified = await computer.invoke({
  requester: 'assembly-test',
  capability: 'consent.verify',
  input: {
    token: installConsent.token,
    options: {
      kind: 'installation',
      requiredScopes: ['local_runtime']
    }
  }
});

if (!verified.valid) throw new Error('Installation consent token did not verify');

const deployment = await computer.invoke({
  requester: 'assembly-test',
  capability: 'deployment.authorized',
  input: {
    plan: {
      opportunityId: opportunity.opportunityId,
      deviceOwnerId: 'device-owner',
      packageId: 'com.example.allowed',
      requiredScopes: ['local_runtime']
    },
    installationConsentToken: installConsent.token
  }
});

if (!deployment.ok || provisioned.length !== 1) {
  throw new Error('Authorized provisioner was not reached');
}

const membraneLedger = await computer.invoke({
  requester: 'assembly-test',
  capability: 'opportunity.ledger.verify',
  input: {}
});

if (!membraneLedger) throw new Error('Opportunity ledger failed verification');

const stellarSnapshot = computer.snapshot();
if (!stellarSnapshot.ledgerVerified) throw new Error('Stellar Comp ledger failed verification');

console.log(JSON.stringify({
  ok: true,
  openNeed: needs[0].needId,
  resolvedAt: resolution.layer,
  opportunityId: opportunity.opportunityId,
  installationConsentValid: verified.valid,
  deploymentRuntimeId: deployment.runtimeId,
  opportunityLedgerVerified: membraneLedger,
  stellarLedgerVerified: stellarSnapshot.ledgerVerified
}, null, 2));
