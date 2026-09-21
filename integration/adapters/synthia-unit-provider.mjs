export function createSynthiaUnitProvider({ unit, manifest = null } = {}) {
  if (!unit || typeof unit.ask !== 'function') {
    throw new TypeError('createSynthiaUnitProvider requires an existing SynthiaUnit instance');
  }

  const hasEconomy = unit.economy &&
    typeof unit.economy.snapshot === 'function' &&
    typeof unit.economy.signalNeed === 'function' &&
    typeof unit.economy.postOpportunity === 'function' &&
    typeof unit.economy.give === 'function' &&
    typeof unit.economy.match === 'function';

  const capabilityNames = [
    'synthia.ask',
    'synthia.autonomous-cycle',
    'synthia.snapshot',
    'synthia.organs.open',
    ...(hasEconomy ? [
      'business.snapshot',
      'business.need.signal',
      'business.opportunity.post',
      'business.gift.record',
      'business.match'
    ] : [])
  ];

  const resolvedManifest = manifest || {
    id: 'synthia-unified-runtime',
    name: 'Synthia Unified Runtime',
    kind: 'automaton',
    version: '0.9.6',
    capabilities: capabilityNames.map(name => ({ name })),
    requirements: [],
    interfaces: { local: 'runtime' },
    events: { emits: [], listens: [] },
    lifecycle: { start: 'independent', stop: 'independent' },
    health: { type: 'function' },
    authority: {
      mode: 'allowlist',
      allow: capabilityNames,
      publicCapabilities: ['synthia.ask']
    },
    provenance: { archive: 'Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip' }
  };

  const capabilities = {
    'synthia.ask': async input => unit.ask(
      input?.intent ?? String(input ?? ''),
      input?.options || {}
    ),
    'synthia.autonomous-cycle': async input => unit.autonomousCycle(input || {}),
    'synthia.snapshot': async () => unit.snapshot(),
    'synthia.organs.open': async input => unit.openOrgans(input?.ids || [])
  };

  if (hasEconomy) {
    capabilities['business.snapshot'] = async () => unit.economy.snapshot();
    capabilities['business.need.signal'] = async input => unit.economy.signalNeed(input || {});
    capabilities['business.opportunity.post'] = async input => unit.economy.postOpportunity(input || {});
    capabilities['business.gift.record'] = async input => unit.economy.give(input || {});
    capabilities['business.match'] = async input => unit.economy.match(input?.profile || input || {});
  }

  const runtime = {
    health: async () => {
      const snapshot = typeof unit.snapshot === 'function' ? unit.snapshot() : null;
      return {
        ok: true,
        source: 'SynthiaUnit',
        cycles: snapshot?.cycles ?? null,
        organs: Array.isArray(snapshot?.organs) ? snapshot.organs.length : null,
        economy: hasEconomy
      };
    },
    capabilities
  };

  return { manifest: resolvedManifest, runtime };
}

export default createSynthiaUnitProvider;
