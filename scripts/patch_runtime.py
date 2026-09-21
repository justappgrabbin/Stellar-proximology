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
if 'import java.util.zip.ZipInputStream;' not in main:
    main = main.replace('import java.util.concurrent.Executors;\n', 'import java.util.concurrent.Executors;\nimport java.util.zip.ZipInputStream;\nimport java.util.zip.ZipEntry;\n', 1)
if 'private LocalLinuxRuntime linuxRuntime;' not in main:
    main = main.replace('private ValueCallback<Uri[]> fileCallback;\n', 'private ValueCallback<Uri[]> fileCallback;\n    private LocalLinuxRuntime linuxRuntime;\n    private StellarMcpServer mcpServer;\n', 1)
elif 'private StellarMcpServer mcpServer;' not in main:
    main = main.replace('private LocalLinuxRuntime linuxRuntime;\n', 'private LocalLinuxRuntime linuxRuntime;\n    private StellarMcpServer mcpServer;\n', 1)
if 'private GitHubUpdateManager updateManager;' not in main:
    main = main.replace('private StellarMcpServer mcpServer;\n', 'private StellarMcpServer mcpServer;\n    private GitHubUpdateManager updateManager;\n', 1)
if 'linuxRuntime = new LocalLinuxRuntime(this);' not in main:
    main = main.replace('webView = new WebView(this);', 'linuxRuntime = new LocalLinuxRuntime(this);\n        mcpServer = new StellarMcpServer(this, linuxRuntime);\n        mcpServer.start();\n\n        webView = new WebView(this);', 1)
elif 'mcpServer = new StellarMcpServer(this, linuxRuntime);' not in main:
    main = main.replace('linuxRuntime = new LocalLinuxRuntime(this);', 'linuxRuntime = new LocalLinuxRuntime(this);\n        mcpServer = new StellarMcpServer(this, linuxRuntime);\n        mcpServer.start();', 1)
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

main = replace_method(main, 'public String getStatus()', '''public String getStatus() {
            String mcp = mcpServer == null
                    ? "{\\\"ok\\\":false,\\\"complete\\\":true,\\\"error\\\":\\\"mcp-server-not-created\\\"}"
                    : mcpServer.statusJson();
            return "{\\\"ok\\\":true,\\\"complete\\\":true,\\\"androidWrapper\\\":true"
                    + ",\\\"embeddedLinux\\\":true"
                    + ",\\\"accessibilityConnected\\\":" + SynthiaAccessibilityService.isConnected()
                    + ",\\\"selfUpdate\\\":" + (updateManager != null)
                    + ",\\\"mcp\\\":" + mcp + "}";
        }''')

main = replace_method(main, 'public String runShell(String command)', '''public String runShell(String command) {
            final String source = command == null ? "" : command.trim();
            if (source.isEmpty()) return errorJson("shell-command-empty");
            return linuxRuntime.runCommand(source);
        }''')

bridge = '''
        @JavascriptInterface
        public String mcpStatus() {
            return mcpServer == null ? errorJson(\"mcp-server-not-created\") : mcpServer.statusJson();
        }

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
        public String unpackWorkspaceZip(String archivePath, String destinationDir) {
            try {
                File archive = workspaceFile(archivePath);
                if (!archive.isFile()) return errorJson("archive-not-found");
                File destination = workspaceFile(destinationDir);
                if (!destination.exists() && !destination.mkdirs()) {
                    return errorJson("archive-destination-create-failed");
                }
                String destinationRoot = destination.getCanonicalPath();
                int entries = 0;
                long totalBytes = 0L;
                final int maxEntries = 5000;
                final long maxBytes = 512L * 1024L * 1024L;
                byte[] buffer = new byte[32768];

                try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(new FileInputStream(archive)))) {
                    ZipEntry entry;
                    while ((entry = zip.getNextEntry()) != null) {
                        if (++entries > maxEntries) return errorJson("archive-entry-limit");
                        String name = entry.getName() == null ? "" : entry.getName().replace('\\', '/');
                        if (name.isEmpty() || name.startsWith("/") || name.contains("../")) {
                            return errorJson("archive-path-rejected");
                        }
                        File output = new File(destination, name);
                        String outputPath = output.getCanonicalPath();
                        if (!outputPath.equals(destinationRoot) && !outputPath.startsWith(destinationRoot + File.separator)) {
                            return errorJson("archive-path-escaped-sandbox");
                        }
                        if (entry.isDirectory()) {
                            if (!output.exists() && !output.mkdirs()) return errorJson("archive-directory-create-failed");
                            zip.closeEntry();
                            continue;
                        }
                        File parent = output.getParentFile();
                        if (parent != null && !parent.exists() && !parent.mkdirs()) {
                            return errorJson("archive-directory-create-failed");
                        }
                        try (FileOutputStream out = new FileOutputStream(output)) {
                            int count;
                            while ((count = zip.read(buffer)) >= 0) {
                                if (count == 0) continue;
                                totalBytes += count;
                                if (totalBytes > maxBytes) return errorJson("archive-size-limit");
                                out.write(buffer, 0, count);
                            }
                        }
                        zip.closeEntry();
                    }
                }
                return "{\"ok\":true,\"complete\":true,\"entries\":" + entries
                        + ",\"bytes\":" + totalBytes
                        + ",\"destination\":" + jsonQuote(destinationDir) + "}";
            } catch (Exception error) {
                return errorJson("archive-unpack-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String listWorkspaceFiles(String relativeDir) {
            try {
                File root = workspaceFile(relativeDir);
                if (!root.exists()) return errorJson("workspace-path-not-found");
                String rootPath = root.getCanonicalPath();
                StringBuilder out = new StringBuilder("{\"ok\":true,\"complete\":true,\"files\":[");
                java.util.ArrayDeque<File> queue = new java.util.ArrayDeque<>();
                queue.add(root);
                boolean first = true;
                int count = 0;
                while (!queue.isEmpty()) {
                    File current = queue.removeFirst();
                    File[] children = current.listFiles();
                    if (children == null) continue;
                    java.util.Arrays.sort(children, (a,b) -> a.getName().compareToIgnoreCase(b.getName()));
                    for (File child : children) {
                        if (child.isDirectory()) {
                            queue.addLast(child);
                            continue;
                        }
                        if (++count > 5000) return errorJson("workspace-list-limit");
                        String absolute = child.getCanonicalPath();
                        String relative = absolute.equals(rootPath) ? child.getName()
                                : absolute.substring(rootPath.length() + 1).replace(File.separatorChar, '/');
                        if (!first) out.append(',');
                        first = false;
                        out.append("{\"path\":").append(jsonQuote(relative))
                                .append(",\"bytes\":").append(child.length()).append('}');
                    }
                }
                return out.append("]}").toString();
            } catch (Exception error) {
                return errorJson("workspace-list-failed:" + error.getMessage());
            }
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
main = main.replace('if (assetServer != null) assetServer.close();', 'if (assetServer != null) assetServer.close();\n        if (mcpServer != null) mcpServer.close();\n        if (updateManager != null) updateManager.close();', 1)

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
if './adaptive-seed.mjs' not in index:
    if '</body>' not in index:
        raise RuntimeError("HTML body close missing")
    index = index.replace('</body>', '<script type="module" src="./adaptive-seed.mjs"></script>\n</body>', 1)
if './github-self-update.mjs' not in index:
    if '</body>' not in index:
        raise RuntimeError("HTML body close missing")
    index = index.replace('</body>', '<script type="module" src="./github-self-update.mjs"></script>\n</body>', 1)
index_path.write_text(index)

print("runtime patches applied")
