export function createStellarProximologyProvider({
  baseUrl = 'http://127.0.0.1:8000',
  fetchImpl = globalThis.fetch,
  manifest = null
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('createStellarProximologyProvider requires fetch');
  }

  const request = async (method, pathname, body = undefined) => {
    const response = await fetchImpl(new URL(pathname, baseUrl), {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      const error = new Error(`Stellar Proximology HTTP ${response.status}: ${text}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };

  const resolvedManifest = manifest || {
    id: 'stellar-proximology',
    name: 'Stellar Proximology',
    kind: 'social-project-environment',
    version: 'supplied',
    capabilities: [
      { name: 'stellar.health' },
      { name: 'stellar.project.create' },
      { name: 'stellar.project.get' },
      { name: 'stellar.project.list' },
      { name: 'stellar.project.update' },
      { name: 'stellar.project.status' },
      { name: 'stellar.mission.today' },
      { name: 'stellar.autoling.analyze' },
      { name: 'stellar.diseminer.analyze' },
      { name: 'stellar.synthesist.verify' },
      { name: 'stellar.outcome.report' },
      { name: 'stellar.market.stats' }
    ],
    requirements: [],
    interfaces: {
      http: `${baseUrl.replace(/\/$/, '')}/api`,
      localOnly: true
    },
    events: { emits: [], listens: [] },
    lifecycle: { start: 'independent', stop: 'independent' },
    health: { type: 'http', endpoint: '/api/health' },
    authority: {
      mode: 'application-owned',
      allow: [
        'stellar.health',
        'stellar.project.create',
        'stellar.project.get',
        'stellar.project.list',
        'stellar.project.update',
        'stellar.project.status',
        'stellar.mission.today',
        'stellar.autoling.analyze',
        'stellar.diseminer.analyze',
        'stellar.synthesist.verify',
        'stellar.outcome.report',
        'stellar.market.stats'
      ],
      publicCapabilities: ['stellar.health']
    },
    provenance: {
      archive: 'stellar-proximology.zip',
      ephemeris: 'stellar-proximology-ephemeris.zip'
    }
  };

  const capabilities = {
    'stellar.health': async () => request('GET', '/api/health'),
    'stellar.project.create': async input => request('POST', '/api/projects', input),
    'stellar.project.get': async input => request('GET', `/api/projects/${encodeURIComponent(input.project_id)}`),
    'stellar.project.list': async input => {
      const params = new URLSearchParams();
      for (const key of ['category', 'project_type', 'status', 'limit']) {
        if (input?.[key] !== undefined && input[key] !== null) params.set(key, String(input[key]));
      }
      const suffix = params.size ? `?${params.toString()}` : '';
      return request('GET', `/api/projects${suffix}`);
    },
    'stellar.project.update': async input => request(
      'POST',
      `/api/projects/${encodeURIComponent(input.project_id)}/update`,
      { user_id: input.user_id, body: input.body }
    ),
    'stellar.project.status': async input => request(
      'PATCH',
      `/api/projects/${encodeURIComponent(input.project_id)}/status`,
      { creator_id: input.creator_id, status: input.status }
    ),
    'stellar.mission.today': async input => request(
      'GET',
      `/api/mission/today/${encodeURIComponent(input.user_id)}`
    ),
    'stellar.autoling.analyze': async input => request('POST', '/api/autoling/analyze', { text: input.text }),
    'stellar.diseminer.analyze': async input => request('POST', '/api/diseminer/analyze', input),
    'stellar.synthesist.verify': async input => request('POST', '/api/synthesist/verify', input),
    'stellar.outcome.report': async input => request('POST', '/api/outcomes/report', input),
    'stellar.market.stats': async () => request('GET', '/api/market/stats')
  };

  return {
    manifest: resolvedManifest,
    runtime: {
      health: capabilities['stellar.health'],
      capabilities
    }
  };
}

export default createStellarProximologyProvider;
