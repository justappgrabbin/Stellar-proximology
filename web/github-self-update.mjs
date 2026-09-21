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
    flowActive: false,
    phase: 'idle',
    githubApks: [],
    githubRepo: 'justappgrabbin/Stellar-proximology',
    message: 'One tap checks, downloads, verifies, and hands the update to Android.'
  };

  const style = document.createElement('style');
  style.textContent = `
    .sp-update-launch{position:fixed;right:12px;top:12px;z-index:140;border:1px solid #4d375f;background:#17101f;color:#fff;border-radius:999px;padding:9px 12px;font:10px ui-monospace,monospace;cursor:pointer}
    .sp-update-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#6f7b86;margin-right:6px}
    .sp-update-dot.hot{background:#e9b84a;box-shadow:0 0 12px rgba(233,184,74,.8)}
    .sp-update-modal{position:fixed;inset:0;z-index:150;background:rgba(2,2,5,.82);display:none;align-items:center;justify-content:center;padding:16px}
    .sp-update-modal.open{display:flex}
    .sp-update-card{width:min(560px,96vw);max-height:90vh;overflow:auto;background:#120e18;border:1px solid #3e2d4c;border-radius:20px;padding:18px;color:#f5f0f7}
    .sp-update-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .sp-update-btn{border:1px solid #4b3759;background:#201628;color:#fff;border-radius:11px;padding:9px 12px;cursor:pointer}
    .sp-update-btn:disabled{opacity:.5;cursor:not-allowed}
    .sp-update-one{width:100%;min-height:58px;border:0;border-radius:16px;padding:14px 18px;background:linear-gradient(135deg,#b63785,#7044be);color:white;font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 28px rgba(112,68,190,.28)}
    .sp-update-one:disabled{opacity:.55;cursor:wait}
    .sp-update-status{margin:12px 0;padding:12px;background:#09070c;border:1px solid #302438;border-radius:12px;font:12px system-ui,sans-serif;color:#c8b9d0;line-height:1.45}
    .sp-update-progress{height:5px;background:#241a2b;border-radius:999px;overflow:hidden;margin:10px 0}.sp-update-progress>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b63785,#e9b84a);transition:width .25s ease}
    .sp-update-code{background:#09070c;border:1px solid #302438;border-radius:10px;padding:10px;font:10px ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
    .sp-update-apk{display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-top:1px solid #2d2134}
    .sp-update-input{flex:1;min-width:220px;background:#09070c;border:1px solid #3a2b45;color:#fff;border-radius:10px;padding:9px}
    .sp-update-advanced{margin-top:14px;color:#a995b4;font-size:11px}.sp-update-advanced summary{cursor:pointer}
  `;
  document.head.append(style);

  const launch = document.createElement('button');
  launch.className = 'sp-update-launch';
  launch.innerHTML = '<span class="sp-update-dot"></span>INSTALL / UPDATE';
  document.body.append(launch);

  const modal = document.createElement('div');
  modal.className = 'sp-update-modal';
  modal.innerHTML = `
    <div class="sp-update-card">
      <div class="sp-update-row" style="justify-content:space-between">
        <div>
          <div style="font:10px ui-monospace,monospace;color:#e9b84a;letter-spacing:.12em">STELLAR INSTALLER</div>
          <h3 style="margin:5px 0">One-button install / update</h3>
        </div>
        <button class="sp-update-btn" data-close>Close</button>
      </div>

      <p style="color:#b6a7bf;font-size:12px;margin-bottom:8px">
        Tap once. Stellar handles checking, downloading, identity checks, and verification.
        Android will show the final system Install/Update confirmation.
      </p>

      <button class="sp-update-one" data-one-button>INSTALL / UPDATE STELLAR</button>
      <div class="sp-update-progress"><i id="spUpdateProgress"></i></div>
      <div id="spUpdateMessage" class="sp-update-status"></div>

      <details class="sp-update-advanced">
        <summary>Advanced details</summary>
        <div id="spUpdateInfo" class="sp-update-code" style="margin-top:8px"></div>
        <hr style="border:0;border-top:1px solid #302438;margin:14px 0">
        <div style="font:10px ui-monospace,monospace;color:#e9b84a;letter-spacing:.12em">OTHER GITHUB APK DOWNLOADS</div>
        <p>Optional developer tool. Downloads only, never silently installs.</p>
        <div class="sp-update-row">
          <input id="spGithubRepo" class="sp-update-input" value="justappgrabbin/Stellar-proximology" aria-label="GitHub owner/repository">
          <button class="sp-update-btn" data-list-apks>Find APKs</button>
        </div>
        <div id="spApkList" style="margin-top:10px"></div>
      </details>
    </div>
  `;
  document.body.append(modal);

  const message = modal.querySelector('#spUpdateMessage');
  const info = modal.querySelector('#spUpdateInfo');
  const progress = modal.querySelector('#spUpdateProgress');
  const primary = modal.querySelector('[data-one-button]');
  const apkList = modal.querySelector('#spApkList');
  const repoInput = modal.querySelector('#spGithubRepo');
  const dot = launch.querySelector('.sp-update-dot');

  const parse = value => {
    try { return typeof value === 'string' ? JSON.parse(value) : value; }
    catch { return { ok:false, error:String(value) }; }
  };

  const phaseProgress = () => ({
    idle: 0,
    checking: 20,
    downloading: 55,
    verified: 78,
    permission: 84,
    installing: 92,
    installed: 100,
    error: 0
  }[state.phase] ?? 0);

  const primaryLabel = () => {
    if (state.phase === 'checking') return 'CHECKING…';
    if (state.phase === 'downloading') return 'DOWNLOADING + VERIFYING…';
    if (state.phase === 'verified') return 'OPENING ANDROID INSTALLER…';
    if (state.phase === 'permission') return 'ALLOW INSTALLS & CONTINUE';
    if (state.phase === 'installing') return 'WAITING FOR ANDROID…';
    if (state.phase === 'installed') return 'INSTALLED';
    if (state.readyToInstall) return 'INSTALL VERIFIED UPDATE';
    return 'INSTALL / UPDATE STELLAR';
  };

  const render = () => {
    dot.classList.toggle('hot', Boolean(state.updateAvailable));
    message.textContent = state.message;
    primary.textContent = primaryLabel();
    primary.disabled = ['checking','downloading','verified','installing'].includes(state.phase);
    progress.style.width = phaseProgress() + '%';

    const latest = state.latest || {};
    info.textContent = [
      `Phase: ${state.phase}`,
      `Current: ${latest.currentVersionName ?? 'installed'} (${latest.currentVersionCode ?? '?'})`,
      `Latest: ${latest.versionName ?? '?'} (${latest.versionCode ?? '?'})`,
      `Commit: ${latest.commitSha ?? '?'}`,
      `SHA-256: ${latest.sha256 ?? '?'}`,
      `Update available: ${state.updateAvailable ? 'YES' : 'no'}`,
      `Verified APK ready: ${state.readyToInstall ? 'YES' : 'no'}`
    ].join('\n');

    apkList.innerHTML = state.githubApks.length
      ? state.githubApks.map(row => `
          <div class="sp-update-apk">
            <div><strong>${esc(row.name)}</strong><div style="font-size:10px;color:#9f8daa">${Number(row.bytes || 0).toLocaleString()} bytes</div></div>
            <button class="sp-update-btn" data-apk="${esc(row.name)}">Download</button>
          </div>
        `).join('')
      : '<div style="font-size:11px;color:#8f8098">No APK list loaded.</div>';
  };

  function startInstallStep() {
    state.phase = 'verified';
    state.message = 'Verified. Opening Android’s installer…';
    render();
    const result = parse(bridge.updateInstall());
    if (result.permissionRequired) {
      state.installPermissionRequired = true;
      state.phase = 'permission';
      state.message = 'Android needs one-time permission for Stellar to install its own updates. The settings screen is opening now.';
      render();
      return;
    }
    state.phase = 'installing';
    state.message = 'Waiting for Android’s final Install/Update confirmation.';
    render();
  }

  function startOneButtonFlow() {
    state.flowActive = true;

    if (state.installPermissionRequired) {
      state.phase = 'permission';
      state.message = 'Opening Android’s one-time “Allow from this source” setting. Turn it on, then return to Stellar.';
      render();
      bridge.updateInstallPermission();
      return;
    }

    if (state.readyToInstall) {
      startInstallStep();
      return;
    }

    state.phase = 'checking';
    state.message = 'Checking for the newest signed Stellar release…';
    render();
    bridge.updateCheck();
  }

  launch.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelector('[data-close]').addEventListener('click', () => modal.classList.remove('open'));
  primary.addEventListener('click', startOneButtonFlow);

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

  window.addEventListener('focus', () => {
    if (!state.flowActive || !state.installPermissionRequired) return;
    state.installPermissionRequired = false;
    state.phase = 'installing';
    state.message = 'Permission screen closed. Continuing the verified install…';
    render();
    setTimeout(startInstallStep, 250);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!state.flowActive || !state.installPermissionRequired) return;
    state.installPermissionRequired = false;
    state.phase = 'installing';
    state.message = 'Continuing the verified install…';
    render();
    setTimeout(startInstallStep, 250);
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

      if (!state.updateAvailable) {
        state.flowActive = false;
        state.phase = 'installed';
        state.message = 'Stellar is already current. Nothing else to install.';
      } else if (state.flowActive) {
        state.phase = 'downloading';
        state.message = 'Update found. Downloading and verifying it now…';
        render();
        bridge.updateDownload();
        return;
      } else {
        state.phase = 'idle';
        state.message = 'A newer signed Stellar update is available. Tap the button when you want it.';
      }
    } else if (detail.type === 'downloaded') {
      state.latest = {
        ...(detail.latest || {}),
        currentVersionCode: detail.currentVersionCode,
        currentVersionName: detail.currentVersionName
      };
      state.readyToInstall = Boolean(detail.readyToInstall);
      state.message = 'Download verified: checksum, package, version, and signing certificate all match.';
      state.phase = 'verified';
      render();
      if (state.flowActive && state.readyToInstall) {
        setTimeout(startInstallStep, 200);
        return;
      }
    } else if (detail.type === 'install-permission-required') {
      state.installPermissionRequired = true;
      state.phase = 'permission';
      state.message = 'One Android permission is needed. Allow Stellar to install updates, then return here.';
    } else if (detail.type === 'install-session-created') {
      state.phase = 'installing';
      state.message = 'Android installer is ready. Tap Android’s Install/Update confirmation.';
    } else if (detail.type === 'install-status') {
      if (detail.pendingUserApproval) {
        state.phase = 'installing';
        state.message = 'Waiting for Android’s Install/Update confirmation.';
      } else if (detail.installed) {
        state.flowActive = false;
        state.phase = 'installed';
        state.message = 'Stellar updated successfully.';
      } else {
        state.flowActive = false;
        state.phase = 'error';
        state.message = 'Android did not complete the install: ' + (detail.message || detail.status);
      }
    } else if (detail.type === 'error') {
      state.flowActive = false;
      state.phase = 'error';
      state.message = 'Installer stopped safely: ' + (detail.error || 'unknown error');
    }
    render();
  });

  window.addEventListener('stellar-github-apk', event => {
    const detail = event.detail || {};
    if (detail.type === 'list') {
      state.githubApks = Array.isArray(detail.apks) ? detail.apks : [];
    } else if (detail.type === 'error') {
      state.message = 'GitHub APK tool failed: ' + (detail.error || 'unknown error');
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

  // Background check only. One-button flow does not begin until the user taps.
  setTimeout(() => {
    try { bridge.updateCheck(); } catch {}
  }, 2500);
}
