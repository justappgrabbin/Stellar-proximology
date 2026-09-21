import { spawn } from 'node:child_process';

export function createAutoLabProvider({
  python = 'python3',
  bridgePath,
  sourceRoot,
  stateRoot,
  manifest = null
} = {}) {
  if (!bridgePath || !sourceRoot || !stateRoot) {
    throw new TypeError('bridgePath, sourceRoot, and stateRoot are required');
  }

  const call = (action, input = {}) => new Promise((resolve, reject) => {
    const child = spawn(python, [bridgePath, sourceRoot, stateRoot], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Auto Lab bridge exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid Auto Lab bridge JSON: ${stdout}`));
      }
    });

    child.stdin.end(JSON.stringify({ action, input }));
  });

  const resolvedManifest = manifest || {
    id: 'auto-lab',
    name: 'Synthia System Auto Lab',
    kind: 'automaton',
    version: 'canonical-supplied',
    capabilities: [
      { name: 'lab.state' },
      { name: 'lab.project.create' },
      { name: 'lab.experiment.propose' },
      { name: 'lab.evidence.record' },
      { name: 'lab.cycle' },
      { name: 'lab.autopilot.set' }
    ],
    requirements: [],
    interfaces: { local: 'python-bridge' },
    events: { emits: ['lab:observation'], listens: ['stellar:*'] },
    lifecycle: { start: 'independent', stop: 'independent' },
    health: { type: 'function' },
    authority: {
      mode: 'allowlist',
      allow: [
        'lab.state',
        'lab.project.create',
        'lab.experiment.propose',
        'lab.evidence.record',
        'lab.cycle',
        'lab.autopilot.set'
      ],
      publicCapabilities: ['lab.state']
    },
    provenance: { archive: 'Synthia-System-Auto-Lab-CANONICAL.zip' }
  };

  return {
    manifest: resolvedManifest,
    runtime: {
      health: async () => call('health'),
      capabilities: {
        'lab.state': input => call('lab.state', input),
        'lab.project.create': input => call('lab.project.create', input),
        'lab.experiment.propose': input => call('lab.experiment.propose', input),
        'lab.evidence.record': input => call('lab.evidence.record', input),
        'lab.cycle': input => call('lab.cycle', input),
        'lab.autopilot.set': input => call('lab.autopilot.set', input)
      }
    }
  };
}

export default createAutoLabProvider;
