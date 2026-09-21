export function createSynthiaUnitProvider({ unit, manifest = null } = {}) {
  if (!unit || typeof unit.ask !== 'function') {
    throw new TypeError('createSynthiaUnitProvider requires an existing SynthiaUnit instance');
  }

  const resolvedManifest = manifest || {
    id: 'synthia-unified-runtime',
    name: 'Synthia Unified Runtime',
    kind: 'automaton',
    version: '0.9.6',
    capabilities: [
      { name: 'synthia.ask' },
      { name: 'synthia.autonomous-cycle' },
      { name: 'synthia.snapshot' },
      { name: 'synthia.organs.open' }
    ],
    requirements: [],
    interfaces: { local: 'runtime' },
    events: { emits: [], listens: [] },
    lifecycle: { start: 'independent', stop: 'independent' },
    health: { type: 'function' },
    authority: {
      mode: 'allowlist',
      allow: ['synthia.ask', 'synthia.autonomous-cycle', 'synthia.snapshot', 'synthia.organs.open'],
      publicCapabilities: ['synthia.ask']
    },
    provenance: { archive: 'Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip' }
  };

  const runtime = {
    health: async () => {
      const snapshot = typeof unit.snapshot === 'function' ? unit.snapshot() : null;
      return {
        ok: true,
        source: 'SynthiaUnit',
        cycles: snapshot?.cycles ?? null,
        organs: Array.isArray(snapshot?.organs) ? snapshot.organs.length : null
      };
    },
    capabilities: {
      'synthia.ask': async input => unit.ask(input?.intent ?? String(input ?? '')),
      'synthia.autonomous-cycle': async input => unit.autonomousCycle(input || {}),
      'synthia.snapshot': async () => unit.snapshot(),
      'synthia.organs.open': async input => unit.openOrgans(input?.ids || [])
    }
  };

  return { manifest: resolvedManifest, runtime };
}

export default createSynthiaUnitProvider;
