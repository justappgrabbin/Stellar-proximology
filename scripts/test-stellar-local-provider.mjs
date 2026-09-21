#!/usr/bin/env node
import http from 'node:http';
import { createStellarProximologyProvider } from '../integration/adapters/stellar-proximology-local-provider.mjs';

const seen = [];
const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ method: req.method, url: req.url, body });
    res.setHeader('content-type', 'application/json');

    if (req.url === '/api/health') {
      res.end(JSON.stringify({ status: 'ok', service: 'Stellar Proximology' }));
      return;
    }
    if (req.url === '/api/projects' && req.method === 'POST') {
      res.end(JSON.stringify({ id: 'local-project-1' }));
      return;
    }
    if (req.url === '/api/projects/local-project-1') {
      res.end(JSON.stringify({ id: 'local-project-1', title: 'Local self-hosted project' }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ detail: 'not found' }));
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

try {
  const provider = createStellarProximologyProvider({ baseUrl: `http://127.0.0.1:${port}` });
  const health = await provider.runtime.health();
  const created = await provider.runtime.capabilities['stellar.project.create']({
    creator_id: 'local-user',
    title: 'Local self-hosted project',
    description: 'Transport contract test',
    category: 'assembly',
    project_type: 'product'
  });
  const project = await provider.runtime.capabilities['stellar.project.get']({ project_id: created.id });

  if (health?.status !== 'ok') throw new Error('health contract failed');
  if (created?.id !== 'local-project-1') throw new Error('create contract failed');
  if (project?.id !== 'local-project-1') throw new Error('get contract failed');

  console.log(JSON.stringify({
    ok: true,
    binding: 'Stellar Comp compatible provider -> localhost Stellar Proximology HTTP contract',
    seen
  }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
