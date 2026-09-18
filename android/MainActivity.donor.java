package com.synthia.autonomy;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.widget.Toast;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int TERMUX_PERMISSION_REQUEST = 4102;
    private static final String TERMUX_PERMISSION = "com.termux.permission.RUN_COMMAND";
    private static final String TERMUX_PACKAGE = "com.termux";
    private static final String TERMUX_SERVICE = "com.termux.app.RunCommandService";

    private WebView webView;
    private LocalAssetServer assetServer;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        try {
            assetServer = new LocalAssetServer();
            assetServer.start();
        } catch (IOException error) {
            throw new IllegalStateException("Could not start Synthia local asset server.", error);
        }

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);

        webView.setWebViewClient(new SynthiaWebViewClient());
        webView.setWebChromeClient(new SynthiaChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "SynthiaAndroid");

        setContentView(webView);
        webView.loadUrl(assetServer.url("/index.html"));
    }

    @Override
    protected void onDestroy() {
        if (assetServer != null) assetServer.close();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private final class SynthiaWebViewClient extends WebViewClient {
        private boolean handle(Uri uri) {
            if (uri == null) return true;
            String value = uri.toString();
            if (assetServer != null && value.startsWith(assetServer.url("/"))) return false;

            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if ("http".equals(scheme) || "https".equals(scheme)) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {}
            }
            // Never navigate the privileged WebView away from Synthia localhost.
            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handle(request == null ? null : request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            try { return handle(Uri.parse(url)); }
            catch (Exception error) { return true; }
        }
    }

    private final class SynthiaChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams params
        ) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            startActivityForResult(intent, FILE_CHOOSER_REQUEST);
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }

        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            result = new Uri[]{data.getData()};
        }

        if (fileCallback != null) {
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    private boolean hasTermuxPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(TERMUX_PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestTermuxPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !hasTermuxPermission()) {
            requestPermissions(new String[]{TERMUX_PERMISSION}, TERMUX_PERMISSION_REQUEST);
        }
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public String getStatus() {
            return "{\"ok\":true,\"complete\":true,\"androidWrapper\":true"
                    + ",\"termuxPermission\":" + hasTermuxPermission()
                    + ",\"accessibilityConnected\":" + SynthiaAccessibilityService.isConnected() + "}";
        }

        @JavascriptInterface
        public String notify(String text) {
            final String message = text == null ? "" : text;
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
            return okJson();
        }

        @JavascriptInterface
        public String openUrl(String url) {
            final String value = url == null ? "" : url.trim();
            if (value.isEmpty()) return errorJson("url-empty");
            try {
                runOnUiThread(() -> {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(value))); }
                    catch (Exception ignored) {}
                });
                return okJson();
            } catch (Exception error) {
                return errorJson("url-open-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String shareText(String text) {
            final String value = text == null ? "" : text;
            try {
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("text/plain");
                    intent.putExtra(Intent.EXTRA_TEXT, value);
                    startActivity(Intent.createChooser(intent, "Share from Synthia"));
                });
                return okJson();
            } catch (Exception error) {
                return errorJson("share-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String writeWorkspaceText(String relativePath, String text) {
            try {
                File file = workspaceFile(relativePath);
                File parent = file.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    return errorJson("workspace-directory-create-failed");
                }
                try (FileOutputStream output = new FileOutputStream(file)) {
                    output.write((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
                }
                return "{\"ok\":true,\"complete\":true,\"path\":" + jsonQuote(file.getAbsolutePath()) + "}";
            } catch (Exception error) {
                return errorJson("workspace-write-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String readWorkspaceText(String relativePath) {
            try {
                File file = workspaceFile(relativePath);
                if (!file.isFile()) return errorJson("workspace-file-not-found");
                try (FileInputStream input = new FileInputStream(file)) {
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    int count;
                    while ((count = input.read(chunk)) >= 0) {
                        if (count > 0) buffer.write(chunk, 0, count);
                    }
                    return "{\"ok\":true,\"complete\":true,\"text\":"
                            + jsonQuote(buffer.toString("UTF-8")) + "}";
                }
            } catch (Exception error) {
                return errorJson("workspace-read-failed:" + error.getMessage());
            }
        }

        private File workspaceFile(String relativePath) throws IOException {
            String value = relativePath == null ? "" : relativePath.trim();
            if (value.isEmpty()) throw new IOException("Workspace path is empty.");
            if (value.startsWith("/") || value.contains("..")) throw new IOException("Workspace path rejected.");

            File root = new File(getFilesDir(), "synthia-workspace");
            File file = new File(root, value);
            String rootPath = root.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            if (!filePath.equals(rootPath) && !filePath.startsWith(rootPath + File.separator)) {
                throw new IOException("Workspace path escaped sandbox.");
            }
            return file;
        }

        // ---- Direct local Mobile MCP-derived faculties ----
        @JavascriptInterface
        public String mobileStatus() { return SynthiaAccessibilityService.statusJson(); }

        @JavascriptInterface
        public String openAccessibilitySettings() {
            try {
                runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
                return okJson();
            } catch (Exception error) {
                return errorJson("accessibility-settings-open-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String mobileElements() { return SynthiaAccessibilityService.elementsJson(); }

        @JavascriptInterface
        public String mobileClickRef(String ref) { return SynthiaAccessibilityService.clickRefJson(ref); }

        @JavascriptInterface
        public String mobileTap(int x, int y) { return SynthiaAccessibilityService.tapJson(x, y); }

        @JavascriptInterface
        public String mobileSwipe(int x1, int y1, int x2, int y2, long durationMs) {
            return SynthiaAccessibilityService.swipeJson(x1, y1, x2, y2, durationMs);
        }

        @JavascriptInterface
        public String mobilePress(String button) { return SynthiaAccessibilityService.pressJson(button); }

        @JavascriptInterface
        public String mobileType(String text) { return SynthiaAccessibilityService.typeJson(text); }

        @JavascriptInterface
        public String mobileListApps() {
            try {
                Intent launcher = new Intent(Intent.ACTION_MAIN, null);
                launcher.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> rows = getPackageManager().queryIntentActivities(launcher, 0);
                StringBuilder out = new StringBuilder("{\"ok\":true,\"complete\":true,\"apps\":[");
                boolean first = true;
                for (ResolveInfo row : rows) {
                    if (row.activityInfo == null) continue;
                    if (!first) out.append(',');
                    first = false;
                    CharSequence label = row.loadLabel(getPackageManager());
                    out.append("{\"packageName\":").append(jsonQuote(row.activityInfo.packageName))
                            .append(",\"activity\":").append(jsonQuote(row.activityInfo.name))
                            .append(",\"label\":").append(jsonQuote(label == null ? "" : label.toString()))
                            .append('}');
                }
                return out.append("]}").toString();
            } catch (Exception error) {
                return errorJson("app-list-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String mobileLaunchApp(String packageName) {
            String value = packageName == null ? "" : packageName.trim();
            if (value.isEmpty()) return errorJson("package-name-empty");
            try {
                Intent launch = getPackageManager().getLaunchIntentForPackage(value);
                if (launch == null) return errorJson("package-not-launchable");
                runOnUiThread(() -> startActivity(launch));
                return okJson();
            } catch (Exception error) {
                return errorJson("app-launch-failed:" + error.getMessage());
            }
        }

        @JavascriptInterface
        public String runShell(String command) {
            final String source = command == null ? "" : command.trim();
            if (source.isEmpty()) return errorJson("shell-command-empty");

            if (!hasTermuxPermission()) {
                runOnUiThread(MainActivity.this::requestTermuxPermission);
                return errorJson("termux-permission-required");
            }

            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent();
                    intent.setClassName(TERMUX_PACKAGE, TERMUX_SERVICE);
                    intent.setAction("com.termux.RUN_COMMAND");
                    intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
                    intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"-lc", source});
                    intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
                    intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
                    intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0");
                    startService(intent);
                } catch (Exception error) {
                    webView.post(() -> webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('synthia-shell-error',{detail:"
                                    + jsString(String.valueOf(error.getMessage())) + "}));", null));
                }
            });

            // This is truthful: the bridge accepted the request but does not own
            // Termux stdout/stderr/exit status, so completion is explicitly false.
            return "{\"ok\":true,\"accepted\":true,\"complete\":false,\"evidence\":\"intent-dispatched\"}";
        }
    }

    private static String okJson() { return "{\"ok\":true,\"complete\":true}"; }

    private static String errorJson(String error) {
        return "{\"ok\":false,\"complete\":true,\"error\":" + jsonQuote(error) + "}";
    }

    private static String jsonQuote(String value) {
        String v = value == null ? "" : value;
        return "\"" + v
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                .replace("\t", "\\t") + "\"";
    }

    private static String jsString(String value) {
        return "'" + value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                + "'";
    }

    private final class LocalAssetServer implements AutoCloseable {
        private final ExecutorService pool = Executors.newCachedThreadPool();
        private final ServerSocket server;
        private volatile boolean running = true;

        LocalAssetServer() throws IOException {
            server = new ServerSocket(
                    0,
                    16,
                    InetAddress.getByName("127.0.0.1")
            );
        }

        void start() {
            pool.execute(() -> {
                while (running) {
                    try {
                        Socket socket = server.accept();
                        pool.execute(() -> serve(socket));
                    } catch (IOException error) {
                        if (running) error.printStackTrace();
                    }
                }
            });
        }

        String url(String path) {
            return "http://127.0.0.1:" + server.getLocalPort() + path;
        }

        private void serve(Socket socket) {
            try (
                    Socket client = socket;
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII)
                    );
                    OutputStream raw = new BufferedOutputStream(client.getOutputStream())
            ) {
                String first = reader.readLine();
                if (first == null || first.isEmpty()) return;

                String[] pieces = first.split(" ");
                if (pieces.length < 2 || !"GET".equals(pieces[0])) {
                    write(raw, 405, "text/plain; charset=utf-8", "GET only".getBytes(StandardCharsets.UTF_8));
                    return;
                }

                String requested = pieces[1].split("\\?", 2)[0];
                String decoded = URLDecoder.decode(requested, "UTF-8");

                if (decoded.contains("..")) {
                    write(raw, 403, "text/plain; charset=utf-8", "Forbidden".getBytes(StandardCharsets.UTF_8));
                    return;
                }

                if (decoded.equals("/") || decoded.isEmpty()) decoded = "/index.html";
                String assetPath = "web" + decoded;

                try (InputStream input = new BufferedInputStream(getAssets().open(assetPath))) {
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] chunk = new byte[64 * 1024];
                    int count;
                    while ((count = input.read(chunk)) >= 0) {
                        if (count > 0) buffer.write(chunk, 0, count);
                    }
                    write(raw, 200, mime(assetPath), buffer.toByteArray());
                } catch (FileNotFoundException missing) {
                    write(raw, 404, "text/plain; charset=utf-8", "Not found".getBytes(StandardCharsets.UTF_8));
                }
            } catch (Exception ignored) {
                // Browser retries transient socket failures.
            }
        }

        private void write(OutputStream out, int status, String type, byte[] body) throws IOException {
            String reason = status == 200 ? "OK"
                    : status == 403 ? "Forbidden"
                    : status == 404 ? "Not Found"
                    : "Method Not Allowed";

            String headers = "HTTP/1.1 " + status + " " + reason + "\r\n"
                    + "Content-Type: " + type + "\r\n"
                    + "Content-Length: " + body.length + "\r\n"
                    + "Cache-Control: no-store\r\n"
                    + "Access-Control-Allow-Origin: *\r\n"
                    + "Connection: close\r\n\r\n";

            out.write(headers.getBytes(StandardCharsets.US_ASCII));
            out.write(body);
            out.flush();
        }

        private String mime(String path) {
            String value = path.toLowerCase(Locale.US);
            if (value.endsWith(".html")) return "text/html; charset=utf-8";
            if (value.endsWith(".mjs") || value.endsWith(".js")) return "text/javascript; charset=utf-8";
            if (value.endsWith(".css")) return "text/css; charset=utf-8";
            if (value.endsWith(".json")) return "application/json; charset=utf-8";
            if (value.endsWith(".svg")) return "image/svg+xml";
            if (value.endsWith(".png")) return "image/png";
            if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
            if (value.endsWith(".webp")) return "image/webp";
            if (value.endsWith(".wasm")) return "application/wasm";
            return "application/octet-stream";
        }

        @Override
        public void close() {
            running = false;
            try { server.close(); } catch (IOException ignored) {}
            pool.shutdownNow();
        }
    }
}
