export function createFutureFeatureTestingProvider({
  RegistryClass,
  registry = null,
  restored = null,
  manifest = null
} = {}) {
  if (!registry && typeof RegistryClass !== 'function') {
    throw new TypeError('createFutureFeatureTestingProvider requires the existing FutureFeatureTestingRegistry class or instance');
  }

  const instance = registry || new RegistryClass({ restored });

  const capabilities = {
    'governance.future-testing.register': async input => instance.registerSubmission(input || {}),
    'governance.future-testing.consent': async input => instance.setConsent(
      input.submissionId,
      input.ownerId,
      input.consent || {},
      { reason: input.reason ?? null }
    ),
    'governance.future-testing.revoke': async input => instance.revoke(
      input.submissionId,
      input.ownerId,
      input.reason ?? null
    ),
    'governance.future-testing.eligibility': async input => instance.eligibility(
      input.submissionIds ?? [input.submissionId],
      input.purpose || {}
    ),
    'governance.future-testing.record-use': async input => instance.recordTestUse(input || {}),
    'governance.future-testing.snapshot': async () => instance.snapshot(),
    'governance.future-testing.restore': async input => instance.restore(input?.snapshot || input)
  };

  const capabilityNames = Object.keys(capabilities);
  const resolvedManifest = manifest || {
    id: 'future-feature-testing-consent',
    name: 'Future Feature Testing Consent',
    kind: 'governance',
    version: '0.5.4',
    capabilities: capabilityNames.map(name => ({ name })),
    requirements: [],
    interfaces: { local: 'runtime' },
    events: { emits: ['governance:future-feature-testing'], listens: [] },
    lifecycle: { start: 'attached', stop: 'graceful' },
    health: { type: 'function' },
    authority: {
      mode: 'owner-controlled-per-submission',
      allow: capabilityNames,
      publicCapabilities: ['governance.future-testing.snapshot']
    },
    provenance: {
      archive: 'Synthia-v0.5.4-FUTURE-FEATURE-TESTING-FINAL-CHECKPOINT.zip',
      module: 'src/governance/future-feature-testing-registry.mjs'
    }
  };

  return {
    manifest: resolvedManifest,
    runtime: {
      health: async () => ({
        ok: true,
        defaultPrivate: instance.snapshot().defaultPrivate,
        submissions: instance.list().length
      }),
      capabilities
    },
    registry: instance
  };
}

export default createFutureFeatureTestingProvider;
