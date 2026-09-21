export function createOpportunityConsentProvider({
  organism,
  manifest = null
} = {}) {
  if (!organism?.orchestrator || !organism?.consent || !organism?.deployment) {
    throw new TypeError('createOpportunityConsentProvider requires the existing opportunity/consent organism');
  }

  const capabilities = {
    'opportunity.needs.open': async input => {
      if (!organism.runtimeBridge) return [];
      return organism.runtimeBridge.getOpenNeeds(input || {});
    },
    'capability.resolve.external': async input =>
      organism.orchestrator.find(input?.need || input || {}),
    'opportunity.evaluate': async input =>
      organism.orchestrator.createOpportunity(input || {}),
    'opportunity.authority': async input =>
      organism.orchestrator.authorityFor(input || {}),
    'consent.collaboration.accept': async input =>
      organism.orchestrator.acceptCollaboration(
        input.opportunity,
        input.subjectId,
        input.scope || ['collaboration']
      ),
    'consent.install.approve': async input =>
      organism.orchestrator.approveInstall(
        input.opportunityId,
        input.subjectId,
        input.scope || ['local_runtime']
      ),
    'consent.verify': async input =>
      organism.consent.verify(input.token, input.options || {}),
    'consent.revoke': async input =>
      organism.consent.revoke(input.consentId),
    'deployment.authorized': async input =>
      organism.deployment.deploy(input.plan, input.installationConsentToken),
    'outcome.record': async input =>
      organism.orchestrator.recordOutcome(input.opportunity, input.payload || {}),
    'opportunity.history': async input =>
      organism.ledger.history(input.opportunityId),
    'opportunity.ledger.verify': async () =>
      organism.ledger.verify()
  };

  const names = Object.keys(capabilities);
  const resolvedManifest = manifest || {
    id: 'synthia-opportunity-consent',
    name: 'Synthia MCP Opportunity & Consent',
    kind: 'capability-membrane',
    version: '1.1.0',
    capabilities: names.map(name => ({ name })),
    requirements: [],
    interfaces: { local: 'runtime' },
    events: {
      emits: ['science.external-opportunity.recorded', 'external.outcome'],
      listens: []
    },
    lifecycle: { start: 'attached', stop: 'graceful' },
    health: { type: 'function' },
    authority: {
      mode: 'consent-gated',
      allow: names,
      publicCapabilities: ['opportunity.needs.open', 'capability.resolve.external']
    },
    provenance: {
      archive: 'Synthia-MCP-Opportunity-Consent-v1.0.zip',
      source: 'src/create-organism.js'
    }
  };

  return {
    manifest: resolvedManifest,
    runtime: {
      health: async () => ({
        ok: organism.ledger.verify(),
        source: 'existing-opportunity-consent-organism',
        runtimeBridge: Boolean(organism.runtimeBridge)
      }),
      capabilities
    }
  };
}

export default createOpportunityConsentProvider;
