const bridge = globalThis.SynthiaAndroid;

if (bridge?.updateCheck) {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  const state = {
    latest: null,
    updateAvailable: false,
    readyToInstall: false,
    installPermissionRequired: false,
    githubApks: [],
    githubRepo: 'justappgrabbin/Stellar-proximology',
    message: 'Checking GitHub…'
  };

  const style = document.createElement('style');
  style.textContent = `
    .sp-update-launch{position:fixed;right:12px;top:12px;z-index:140;border:1px solid #4d375f;background:#17101f;color:#fff;border-radius:999px;padding:8px 11px;font:10px ui-monospace,monospace;cursor:pointer}
    .sp-update-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#6f7b86;margin-right:6px}
    .sp-update-dot.hot{background:#e9b84a;box-shadow:0 0 12px rgba(233,184,74,.8)}
    .sp-update-modal{position:fixed;inset:0;z-index:150;background:rgba(2,2,5,.78);display:none;align-items:center;justify-content:center;padding:16px}
    .sp-update-modal.open{display:flex}
    .sp-update-card{width:min(620px,96vw);max-height:88vh;overflow:auto;background:#120e18;border:1px solid #3e2d4c;border-radius:18px;padding:16px;color:#f5f0f7}
    .sp-update-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .sp-update-btn{border:1px solid #4b3759;background:#201628;color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}
    .sp-update-btn.primary{background:linear-gradient(135deg,#9a2f75,#6941b9);border-color:transparent}
    .sp-update-btn:disabled{opacity:.45;cursor:not-allowed}
    .sp-update-code{background:#09070c;border:1px solid #302438;border-radius:10px;padding:10px;font:10px ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
    .sp-update-apk{display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-top:1px solid #2d2134}
    .sp-update-input{flex:1;min-width:230px;background:#09070c;border:1px solid #3a2b45;color:#fff;border-radius:10px;padding:9px}
  `;
  document.head.append(style);

  const launch = document.createElement('button');
  launch.className = 'sp-update-launch';
  launch.innerHTML = '<span class="sp-update-dot"></span>UPDATE';
  document.body.append(launch);

  const modal = document.createElement('div');
  modal.className = 'sp-update-modal';
  modal.innerHTML = `
    <div class="sp-update-card">
      <div class="sp-update-row" style="justify-content:space-between">
        <div>
          <div style="font:10px ui-monospace,monospace;color:#e9b84a;letter-spacing:.12em">SELF-HOSTED UPDATE CHANNEL</div>
          <h3 style="margin:5px 0">GitHub updates</h3>
        </div>
        <button class="sp-update-btn" data-close>Close</button>
      </div>

      <p id="spUpdateMessage" style="color:#b6a7bf;font-size:12px"></p>
      <div id="spUpdateInfo" class="sp-update-code"></div>

      <div class="sp-update-row" style="margin-top:10px">
        <button class="sp-update-btn" data-check>Check GitHub</button>
        <button class="sp-update-btn" data-download>Download update APK</button>
        <button class="sp-update-btn primary" data-install>Install downloaded update</button>
        <button class="sp-update-btn" data-permission style="display:none">Allow app installs</button>
      </div>

      <hr style="border:0;border-top:1px solid #302438;margin:18px 0">
      <div style="font:10px ui-monospace,monospace;color:#e9b84a;letter-spacing:.12em">GITHUB APK DOWNLOADS</div>
      <p style="color:#b6a7bf;font-size:12px">Browse APK assets from a public GitHub repository and save them to Downloads. This does not silently install them.</p>
      <div class="sp-update-row">
        <input id="spGithubRepo" class="sp-update-input" value="justappgrabbin/Stellar-proximology" aria-label="GitHub owner/repository">
        <button class="sp-update-btn" data-list-apks>Find APKs</button>
      </div>
      <div id="spApkList" style="margin-top:10px"></div>
    </div>
  `;
  document.body.append(modal);

  const message = modal.querySelector('#spUpdateMessage');
  const info = modal.querySelector('#spUpdateInfo');
  const apkList = modal.querySelector('#spApkList');
  const repoInput = modal.querySelector('#spGithubRepo');
  const dot = launch.querySelector('.sp-update-dot');
  const installButton = modal.querySelector('[data-install]');
  const permissionButton = modal.querySelector('[data-permission]');

  const parse = value => {
    try { return typeof value === 'string' ? JSON.parse(value) : value; }
    catch { return { ok:false, error:String(value) }; }
  };

  const render = () => {
    dot.classList.toggle('hot', Boolean(state.updateAvailable));
    message.textContent = state.message;

    const latest = state.latest || {};
    info.textContent = [
      `Current: ${latest.currentVersionName ?? 'installed'} (${latest.currentVersionCode ?? '?'})`,
      `Latest: ${latest.versionName ?? '?'} (${latest.versionCode ?? '?'})`,
      `Commit: ${latest.commitSha ?? '?'}`,
      `SHA-256: ${latest.sha256 ?? '?'}`,
      `Update available: ${state.updateAvailable ? 'YES' : 'no'}`,
      `Ready to install: ${state.readyToInstall ? 'YES' : 'no'}`
    ].join('\n');

    installButton.disabled = !state.readyToInstall;
    permissionButton.style.display = state.installPermissionRequired ? '' : 'none';

    apkList.innerHTML = state.githubApks.length
      ? state.githubApks.map(row => `
          <div class="sp-update-apk">
            <div><strong>${esc(row.name)}</strong><div style="font-size:10px;color:#9f8daa">${Number(row.bytes || 0).toLocaleString()} bytes</div></div>
            <button class="sp-update-btn" data-apk="${esc(row.name)}">Download</button>
          </div>
        `).join('')
      : '<div style="font-size:11px;color:#8f8098">No APK list loaded.</div>';
  };

  launch.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelector('[data-close]').addEventListener('click', () => modal.classList.remove('open'));

  modal.querySelector('[data-check]').addEventListener('click', () => {
    state.message = 'Checking GitHub for a newer signed release…';
    render();
    bridge.updateCheck();
  });

  modal.querySelector('[data-download]').addEventListener('click', () => {
    state.message = 'Downloading and verifying the update APK…';
    render();
    bridge.updateDownload();
  });

  installButton.addEventListener('click', () => {
    const approved = globalThis.confirm(
      'Install the verified Stellar Proximology update? Android will show its own final installation approval screen.'
    );
    if (!approved) return;
    state.message = 'Handing the verified APK to Android for final approval…';
    render();
    const result = parse(bridge.updateInstall());
    if (result.permissionRequired) state.installPermissionRequired = true;
    render();
  });

  permissionButton.addEventListener('click', () => bridge.updateInstallPermission());

  modal.querySelector('[data-list-apks]').addEventListener('click', () => {
    state.githubRepo = repoInput.value.trim();
    state.message = 'Looking for APK assets on GitHub…';
    render();
    bridge.githubListApks(state.githubRepo);
  });

  apkList.addEventListener('click', event => {
    const button = event.target.closest('[data-apk]');
    if (!button) return;
    bridge.githubDownloadApk(state.githubRepo, button.dataset.apk);
  });

  window.addEventListener('stellar-update', event => {
    const detail = event.detail || {};

    if (detail.type === 'check') {
      state.latest = {
        ...(detail.latest || {}),
        currentVersionCode: detail.currentVersionCode,
        currentVersionName: detail.currentVersionName
      };
      state.updateAvailable = Boolean(detail.updateAvailable);
      state.message = state.updateAvailable
        ? 'A newer signed GitHub release is available.'
        : 'This installation is current.';
    } else if (detail.type === 'downloaded') {
      state.latest = {
        ...(detail.latest || {}),
        currentVersionCode: detail.currentVersionCode,
        currentVersionName: detail.currentVersionName
      };
      state.readyToInstall = Boolean(detail.readyToInstall);
      state.message = 'Update downloaded. SHA-256, package name, version code, and signing certificate verified.';
    } else if (detail.type === 'install-permission-required') {
      state.installPermissionRequired = true;
      state.message = 'Android needs permission to install app updates from Stellar Proximology.';
    } else if (detail.type === 'install-session-created') {
      state.message = 'Android installer session created. Waiting for your system approval.';
    } else if (detail.type === 'install-status') {
      if (detail.pendingUserApproval) state.message = 'Waiting for your Android installation approval.';
      else if (detail.installed) state.message = 'Update installed.';
      else state.message = 'Install did not complete: ' + (detail.message || detail.status);
    } else if (detail.type === 'error') {
      state.message = 'Update ' + (detail.phase || 'operation') + ' failed: ' + (detail.error || 'unknown error');
    }
    render();
  });

  window.addEventListener('stellar-github-apk', event => {
    const detail = event.detail || {};
    if (detail.type === 'list') {
      state.githubApks = Array.isArray(detail.apks) ? detail.apks : [];
      state.message = state.githubApks.length
        ? `Found ${state.githubApks.length} APK asset(s) in ${detail.repository}.`
        : `No APK assets found in the latest release of ${detail.repository}.`;
    } else if (detail.type === 'download-enqueued') {
      state.message = `Downloading ${detail.asset} to ${detail.destination}.`;
    } else if (detail.type === 'error') {
      state.message = 'GitHub APK ' + (detail.phase || 'operation') + ' failed: ' + (detail.error || 'unknown error');
    }
    render();
  });

  try {
    const initial = parse(bridge.updateStatus());
    if (initial?.ok) {
      state.latest = {
        ...(initial.latest || {}),
        currentVersionCode: initial.currentVersionCode,
        currentVersionName: initial.currentVersionName
      };
      state.readyToInstall = Boolean(initial.downloaded);
    }
  } catch {}

  render();

  // Automatic check only. Download and installation always require user action.
  setTimeout(() => {
    try { bridge.updateCheck(); } catch {}
  }, 2500);
}
