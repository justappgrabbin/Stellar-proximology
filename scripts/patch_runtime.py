#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_runtime.py <assembled-root>")
root = Path(sys.argv[1])

def replace_method(source, signature, replacement):
    start = source.find(signature)
    if start < 0:
        raise RuntimeError("method anchor missing: " + signature)
    brace = source.find("{", start)
    depth = 0
    i = brace
    in_string = False
    quote = ""
    escaped = False
    while i < len(source):
        ch = source[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                in_string = False
        else:
            if ch in ('"', "'"):
                in_string = True
                quote = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return source[:start] + replacement + source[i + 1:]
        i += 1
    raise RuntimeError("method did not close: " + signature)

manifest_path = root / "AndroidManifest.xml"
manifest = manifest_path.read_text()
manifest = re.sub(r'\n\s*<uses-permission android:name="com\.termux\.permission\.RUN_COMMAND"\s*/>', '', manifest)
manifest = re.sub(r'\n\s*<queries>.*?</queries>', '', manifest, flags=re.S)
if 'android.permission.REQUEST_INSTALL_PACKAGES' not in manifest:
    manifest = manifest.replace(
        '<uses-permission android:name="android.permission.INTERNET" />',
        '<uses-permission android:name="android.permission.INTERNET" />\n'
        '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />',
        1
    )
if 'android:launchMode="singleTop"' not in manifest:
    manifest = manifest.replace(
        'android:name="com.synthia.autonomy.MainActivity"\n            android:exported="true"',
        'android:name="com.synthia.autonomy.MainActivity"\n'
        '            android:exported="true"\n'
        '            android:launchMode="singleTop"',
        1
    )
if 'android:extractNativeLibs=' not in manifest:
    manifest = manifest.replace('android:allowBackup="false"', 'android:allowBackup="false"\n        android:extractNativeLibs="true"', 1)
manifest_path.write_text(manifest)

main_path = root / "src/com/synthia/autonomy/MainActivity.java"
main = main_path.read_text()
if 'import android.util.Base64;' not in main:
    main = main.replace('import android.provider.Settings;\n', 'import android.provider.Settings;\nimport android.util.Base64;\n', 1)
if 'private LocalLinuxRuntime linuxRuntime;' not in main:
    main = main.replace('private ValueCallback<Uri[]> fileCallback;\n', 'private ValueCallback<Uri[]> fileCallback;\n    private LocalLinuxRuntime linuxRuntime;\n', 1)
if 'private GitHubUpdateManager updateManager;' not in main:
    main = main.replace('private LocalLinuxRuntime linuxRuntime;\n', 'private LocalLinuxRuntime linuxRuntime;\n    private GitHubUpdateManager updateManager;\n', 1)
if 'linuxRuntime = new LocalLinuxRuntime(this);' not in main:
    main = main.replace('webView = new WebView(this);', 'linuxRuntime = new LocalLinuxRuntime(this);\n\n        webView = new WebView(this);', 1)
if 'updateManager = new GitHubUpdateManager(this, webView);' not in main:
    main = main.replace(
        'webView.setWebChromeClient(new SynthiaChromeClient());',
        'webView.setWebChromeClient(new SynthiaChromeClient());\n'
        '        updateManager = new GitHubUpdateManager(this, webView);',
        1
    )
if 'updateManager.handleInstallIntent(getIntent());' not in main:
    main = main.replace(
        'webView.loadUrl(assetServer.url("/index.html"));',
        'webView.loadUrl(assetServer.url("/index.html"));\n'
        '        updateManager.handleInstallIntent(getIntent());',
        1
    )

if 'protected void onNewIntent(Intent intent)' not in main:
    anchor = '    @Override\n    protected void onDestroy() {'
    if anchor not in main:
        raise RuntimeError("onDestroy anchor missing")
    main = main.replace(
        anchor,
        '    @Override\n'
        '    protected void onNewIntent(Intent intent) {\n'
        '        super.onNewIntent(intent);\n'
        '        setIntent(intent);\n'
        '        if (updateManager != null) updateManager.handleInstallIntent(intent);\n'
        '    }\n\n'
        + anchor,
        1
    )
if 'if (updateManager != null) updateManager.close();' not in main:
    main = main.replace(
        '    protected void onDestroy() {\n',
        '    protected void onDestroy() {\n'
        '        if (updateManager != null) updateManager.close();\n',
        1
    )

main = replace_method(main, 'public String getStatus()', '''public String getStatus() {
            return "{\\\"ok\\\":true,\\\"complete\\\":true,\\\"androidWrapper\\\":true"
                    + ",\\\"embeddedLinux\\\":true"
                    + ",\\\"accessibilityConnected\\\":" + SynthiaAccessibilityService.isConnected() + "}";
        }''')

main = replace_method(main, 'public String runShell(String command)', '''public String runShell(String command) {
            final String source = command == null ? "" : command.trim();
            if (source.isEmpty()) return errorJson("shell-command-empty");
            return linuxRuntime.runCommand(source);
        }''')

bridge = '''
        @JavascriptInterface
        public String updateStatus() {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.statusJson();
        }

        @JavascriptInterface
        public String updateCheck() {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.checkSelfUpdate();
        }

        @JavascriptInterface
        public String updateDownload() {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.downloadSelfUpdate();
        }

        @JavascriptInterface
        public String updateInstall() {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.installSelfUpdate();
        }

        @JavascriptInterface
        public String updateInstallPermission() {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.openInstallPermission();
        }

        @JavascriptInterface
        public String githubListApks(String repository) {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.listGitHubApks(repository);
        }

        @JavascriptInterface
        public String githubDownloadApk(String repository, String assetName) {
            return updateManager == null
                    ? errorJson("update-manager-unavailable")
                    : updateManager.downloadGitHubApk(repository, assetName);
        }

        @JavascriptInterface
        public String linuxPrepare() {
            return linuxRuntime.prepareJson();
        }

        @JavascriptInterface
        public String runWorkspaceFile(String relativePath) {
            return linuxRuntime.runWorkspaceFile(relativePath);
        }

        @JavascriptInterface
        public String writeWorkspaceBase64(String relativePath, String base64) {
            try {
                File file = workspaceFile(relativePath);
                File parent = file.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    return errorJson("workspace-directory-create-failed");
                }
                byte[] bytes = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT);
                try (FileOutputStream output = new FileOutputStream(file)) {
                    output.write(bytes);
                }
                return "{\\\"ok\\\":true,\\\"complete\\\":true,\\\"path\\\":" + jsonQuote(file.getAbsolutePath())
                        + ",\\\"bytes\\\":" + bytes.length + "}";
            } catch (Exception error) {
                return errorJson("workspace-binary-write-failed:" + error.getMessage());
            }
        }

'''
if 'public String linuxPrepare()' not in main:
    anchor = '        private File workspaceFile(String relativePath) throws IOException {'
    if anchor not in main:
        raise RuntimeError("workspaceFile anchor missing")
    main = main.replace(anchor, bridge + anchor, 1)
main_path.write_text(main)

index_path = root / "assets/web/index.html"
index = index_path.read_text()
index = re.sub(r'<title>.*?</title>', '<title>Stellar Proximology</title>', index, count=1, flags=re.S)
if 'Content-Security-Policy' not in index:
    csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' blob:; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; media-src \'self\' data: blob:; connect-src \'self\' http://127.0.0.1:*; frame-src \'self\' data: blob:; object-src \'none\'; base-uri \'self\'">\n'
    if '</head>' not in index:
        raise RuntimeError("HTML head close missing")
    index = index.replace('</head>', csp + '</head>', 1)
if './local-lab.mjs' not in index:
    if '</body>' not in index:
        raise RuntimeError("HTML body close missing")
    index = index.replace('</body>', '<script type="module" src="./local-lab.mjs"></script>\n</body>', 1)
if './github-self-update.mjs' not in index:
    if '</body>' not in index:
        raise RuntimeError("HTML body close missing")
    index = index.replace('</body>', '<script type="module" src="./github-self-update.mjs"></script>\n</body>', 1)
index_path.write_text(index)

print("runtime patches applied")
