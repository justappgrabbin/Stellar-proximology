export function createLocalPlanningProvider({
  unit,
  ledger,
  metabolism,
  manifest = null
} = {}) {
  if (!unit || typeof unit.ask !== 'function') {
    throw new TypeError('createLocalPlanningProvider requires an existing SynthiaUnit');
  }
  if (!ledger || typeof ledger.define !== 'function' || typeof ledger.observe !== 'function') {
    throw new TypeError('createLocalPlanningProvider requires the existing SuccessLedger');
  }
  if (!metabolism || typeof metabolism.ensurePerson !== 'function' || typeof metabolism.observe !== 'function') {
    throw new TypeError('createLocalPlanningProvider requires the existing HumanSuccessMetabolism');
  }

  const capabilityNames = [
    'planning.purpose.define',
    'planning.progress.observe',
    'planning.proposal.create',
    'planning.summary',
    'planning.success.observe',
    'planning.success.state',
    'planning.research.seed',
    'planning.browser.workflow'
  ];

  const resolvedManifest = manifest || {
    id: 'local-planning',
    name: 'Local Planning / Success Layer',
    kind: 'planning',
    version: 'existing-parts',
    capabilities: capabilityNames.map(name => ({ name })),
    requirements: [],
    interfaces: { local: 'runtime' },
    events: { emits: [], listens: [] },
    lifecycle: { start: 'attached', stop: 'graceful' },
    health: { type: 'function' },
    authority: {
      mode: 'allowlist',
      allow: capabilityNames,
      publicCapabilities: ['planning.summary']
    },
    provenance: {
      successLedger: 'Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip/vendor/ato-core/src/success.mjs',
      humanSuccess: 'StellarCPU-Rough-v0.1.0.zip/packages/human-success/human-success-metabolism.mjs',
      research: 'Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip/organs/ResearchOrgan.js',
      browserPlanning: 'Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip/organs/BrowserPlanningOrgan.js'
    }
  };

  const capabilities = {
    'planning.purpose.define': async input => {
      const purpose = ledger.define(input.person_id, {
        statement: input.statement,
        indicators: input.indicators || [],
        address: input.address || null
      });
      metabolism.ensurePerson(input.person_id, { statement: input.statement });
      return purpose;
    },
    'planning.progress.observe': async input => ledger.observe(
      input.person_id,
      input.indicator_id,
      Number(input.value),
      {
        context: input.context || null,
        address: input.address || null,
        source: input.source || 'person'
      }
    ),
    'planning.proposal.create': async input => ledger.propose(
      input.person_id,
      input.indicator_id,
      {
        message: input.message,
        behaviors: input.behaviors || [],
        role: input.role || 'companion',
        address: input.address || null
      }
    ),
    'planning.summary': async input => ledger.summary(input.person_id),
    'planning.success.observe': async input => metabolism.observe(
      input.person_id,
      input.dimension,
      Number(input.value),
      {
        source: input.source || 'person',
        context: input.context || null,
        strategyIds: input.strategy_ids || []
      }
    ),
    'planning.success.state': async input => metabolism.state(input.person_id),
    'planning.research.seed': async input => unit.ask(
      input.intent,
      { ...(input.options || {}), organ: 'research' }
    ),
    'planning.browser.workflow': async input => unit.ask(
      input.intent,
      { ...(input.options || {}), organ: 'browser-planner' }
    )
  };

  return {
    manifest: resolvedManifest,
    runtime: {
      health: async () => ({
        ok: true,
        source: 'existing-local-planning-parts',
        purposeCount: ledger.people?.size ?? null
      }),
      capabilities
    }
  };
}

export default createLocalPlanningProvider;
