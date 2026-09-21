package com.synthia.autonomy;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ResolveInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Local loopback MCP server for the Stellar computer.
 *
 * Implements the 2026-07-28 stateless MCP core for server/discover,
 * tools/list and tools/call. The tool implementations are the already-existing
 * Android accessibility hands, app launcher, workspace, and embedded Linux.
 *
 * The adaptive route is empirical, not decorative: success/failure counts are
 * persisted and used to order alternate mechanisms on later calls.
 */
public final class StellarMcpServer implements AutoCloseable {
    public static final String PROTOCOL_VERSION = "2026-07-28";
    public static final int PREFERRED_PORT = 8877;

    private final Context context;
    private final LocalLinuxRuntime linux;
    private final SharedPreferences metrics;
    private final ExecutorService pool = Executors.newCachedThreadPool();

    private volatile ServerSocket server;
    private volatile boolean running;
    private volatile String lastError;
    private volatile int port = -1;

    public StellarMcpServer(Context context, LocalLinuxRuntime linux) {
        this.context = context.getApplicationContext();
        this.linux = linux;
        this.metrics = this.context.getSharedPreferences("stellar-mcp-metrics", Context.MODE_PRIVATE);
    }

    public synchronized void start() {
        if (running) return;
        try {
            ServerSocket socket = new ServerSocket();
            socket.setReuseAddress(true);
            try {
                socket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), PREFERRED_PORT), 24);
            } catch (IOException occupied) {
                socket.close();
                socket = new ServerSocket(0, 24, InetAddress.getByName("127.0.0.1"));
            }
            server = socket;
            port = socket.getLocalPort();
            running = true;
            lastError = null;
            pool.execute(this::acceptLoop);
        } catch (Exception error) {
            running = false;
            lastError = "mcp-start-failed:" + safe(error);
        }
    }

    public String statusJson() {
        try {
            return new JSONObject()
                    .put("ok", running)
                    .put("complete", true)
                    .put("protocol", PROTOCOL_VERSION)
                    .put("transport", "streamable-http-json")
                    .put("host", "127.0.0.1")
                    .put("preferredPort", PREFERRED_PORT)
                    .put("port", port)
                    .put("url", port > 0 ? "http://127.0.0.1:" + port + "/mcp" : JSONObject.NULL)
                    .put("accessibilityConnected", SynthiaAccessibilityService.isConnected())
                    .put("lastError", lastError == null ? JSONObject.NULL : lastError)
                    .put("metrics", metricsJson())
                    .toString();
        } catch (Exception error) {
            return "{\"ok\":false,\"complete\":true,\"error\":\"mcp-status-json-failed\"}";
        }
    }

    private void acceptLoop() {
        while (running) {
            try {
                final Socket client = server.accept();
                pool.execute(() -> serve(client));
            } catch (IOException error) {
                if (running) lastError = "mcp-accept-failed:" + safe(error);
            }
        }
    }

    private void serve(Socket socket) {
        try (Socket client = socket;
             InputStream rawIn = new BufferedInputStream(client.getInputStream());
             OutputStream rawOut = new BufferedOutputStream(client.getOutputStream())) {

            String requestLine = readAsciiLine(rawIn);
            if (requestLine == null || requestLine.isEmpty()) return;
            String[] first = requestLine.split(" ");
            if (first.length < 2) {
                writeHttp(rawOut, 400, jsonRpcError(JSONObject.NULL, -32600, "Invalid Request", null));
                return;
            }

            String verb = first[0].toUpperCase(Locale.ROOT);
            String path = first[1].split("\\?", 2)[0];
            Map<String, String> headers = new HashMap<>();
            while (true) {
                String line = readAsciiLine(rawIn);
                if (line == null || line.isEmpty()) break;
                int colon = line.indexOf(':');
                if (colon > 0) {
                    headers.put(line.substring(0, colon).trim().toLowerCase(Locale.ROOT),
                            line.substring(colon + 1).trim());
                }
            }

            if ("OPTIONS".equals(verb)) {
                writeOptions(rawOut);
                return;
            }
            if (!"/mcp".equals(path)) {
                writeHttp(rawOut, 404, jsonRpcError(JSONObject.NULL, -32601, "Method not found", null));
                return;
            }
            if (!"POST".equals(verb)) {
                writeHttp(rawOut, 405, jsonRpcError(JSONObject.NULL, -32600, "POST required", null));
                return;
            }

            int length = parseInt(headers.get("content-length"), 0);
            if (length <= 0 || length > 2 * 1024 * 1024) {
                writeHttp(rawOut, 400, jsonRpcError(JSONObject.NULL, -32600, "Invalid Content-Length", null));
                return;
            }
            byte[] body = readExact(rawIn, length);
            JSONObject request;
            try {
                request = new JSONObject(new String(body, StandardCharsets.UTF_8));
            } catch (Exception parse) {
                writeHttp(rawOut, 400, jsonRpcError(JSONObject.NULL, -32700, "Parse error", null));
                return;
            }

            Dispatch response = dispatch(request, headers);
            writeHttp(rawOut, response.httpStatus, response.body);
        } catch (Exception error) {
            lastError = "mcp-request-failed:" + safe(error);
        }
    }

    private Dispatch dispatch(JSONObject request, Map<String, String> headers) {
        Object id = request.has("id") ? request.opt("id") : JSONObject.NULL;
        String method = request.optString("method", "");
        if (!"2.0".equals(request.optString("jsonrpc", "")) || method.isEmpty()) {
            return new Dispatch(400, jsonRpcError(id, -32600, "Invalid Request", null));
        }

        JSONObject params = request.optJSONObject("params");
        if (params == null) params = new JSONObject();
        JSONObject meta = params.optJSONObject("_meta");
        String bodyVersion = meta == null ? "" :
                meta.optString("io.modelcontextprotocol/protocolVersion", "");
        String headerVersion = value(headers, "mcp-protocol-version");
        String headerMethod = value(headers, "mcp-method");
        String headerName = value(headers, "mcp-name");

        if (!PROTOCOL_VERSION.equals(bodyVersion) || !PROTOCOL_VERSION.equals(headerVersion)) {
            JSONObject data = new JSONObject();
            put(data, "supported", new JSONArray().put(PROTOCOL_VERSION));
            put(data, "requested", !bodyVersion.isEmpty() ? bodyVersion : headerVersion);
            return new Dispatch(400, jsonRpcError(id, -32022, "Unsupported protocol version", data));
        }
        if (!method.equals(headerMethod)) {
            return new Dispatch(400, jsonRpcError(id, -32020, "Header mismatch: Mcp-Method", null));
        }
        if (meta == null || !meta.has("io.modelcontextprotocol/clientCapabilities")) {
            return new Dispatch(400, jsonRpcError(id, -32602, "Missing clientCapabilities metadata", null));
        }

        if ("tools/call".equals(method)) {
            String name = params.optString("name", "");
            if (name.isEmpty() || !name.equals(headerName)) {
                return new Dispatch(400, jsonRpcError(id, -32020, "Header mismatch: Mcp-Name", null));
            }
        } else if (!headerName.isEmpty()) {
            return new Dispatch(400, jsonRpcError(id, -32020, "Unexpected Mcp-Name", null));
        }

        try {
            if ("server/discover".equals(method)) {
                JSONObject result = baseResult()
                        .put("supportedVersions", new JSONArray().put(PROTOCOL_VERSION))
                        .put("capabilities", new JSONObject().put("tools", new JSONObject()))
                        .put("instructions",
                                "Stellar local computer control. Observe before acting. Prefer element refs over coordinates. " +
                                "Use computer.adapt when more than one mechanism can satisfy an operation.")
                        .put("ttlMs", 60000)
                        .put("cacheScope", "private");
                return new Dispatch(200, success(id, result));
            }

            if ("tools/list".equals(method)) {
                JSONObject result = baseResult()
                        .put("tools", toolCatalog())
                        .put("ttlMs", 30000)
                        .put("cacheScope", "private");
                return new Dispatch(200, success(id, result));
            }

            if ("tools/call".equals(method)) {
                String name = params.optString("name", "");
                JSONObject arguments = params.optJSONObject("arguments");
                if (arguments == null) arguments = new JSONObject();
                JSONObject raw = executeTool(name, arguments);
                boolean ok = raw.optBoolean("ok", false);
                record(name, ok);
                JSONObject result = baseResult()
                        .put("content", new JSONArray().put(new JSONObject()
                                .put("type", "text")
                                .put("text", raw.toString())))
                        .put("structuredContent", raw)
                        .put("isError", !ok);
                return new Dispatch(200, success(id, result));
            }

            return new Dispatch(404, jsonRpcError(id, -32601, "Method not found", null));
        } catch (Exception error) {
            JSONObject data = new JSONObject();
            put(data, "detail", safe(error));
            return new Dispatch(500, jsonRpcError(id, -32603, "Internal error", data));
        }
    }

    private JSONObject executeTool(String name, JSONObject args) {
        try {
            switch (name) {
                case "computer.status":
                    return parse(statusJson());
                case "computer.observe":
                    return parse(SynthiaAccessibilityService.elementsJson());
                case "computer.click_ref":
                    return parse(SynthiaAccessibilityService.clickRefJson(args.optString("ref", "")));
                case "computer.tap":
                    return parse(SynthiaAccessibilityService.tapJson(
                            requireInt(args, "x"), requireInt(args, "y")));
                case "computer.swipe":
                    return parse(SynthiaAccessibilityService.swipeJson(
                            requireInt(args, "x1"), requireInt(args, "y1"),
                            requireInt(args, "x2"), requireInt(args, "y2"),
                            args.optLong("durationMs", 350L)));
                case "computer.type":
                    return parse(SynthiaAccessibilityService.typeJson(requireString(args, "text")));
                case "computer.press":
                    return parse(SynthiaAccessibilityService.pressJson(requireString(args, "button")));
                case "computer.list_apps":
                    return listApps();
                case "computer.launch_app":
                    return launchApp(requireString(args, "packageName"));
                case "computer.metrics":
                    return new JSONObject().put("ok", true).put("complete", true).put("metrics", metricsJson());
                case "computer.adapt":
                    return adaptive(args);
                case "linux.status":
                    return parse(linux.statusJson());
                case "linux.prepare":
                    return parse(linux.prepareJson());
                case "linux.run":
                    return parse(linux.runCommand(requireString(args, "command")));
                case "linux.run_file":
                    return parse(linux.runWorkspaceFile(requireString(args, "path")));
                case "workspace.read":
                    return readWorkspace(requireString(args, "path"));
                case "workspace.write":
                    return writeWorkspace(requireString(args, "path"), args.optString("content", ""));
                default:
                    return fail("unknown-tool:" + name);
            }
        } catch (Exception error) {
            return fail("tool-failed:" + name + ":" + safe(error));
        }
    }

    private JSONObject adaptive(JSONObject args) {
        String operation = args.optString("operation", args.optString("intent", "observe"))
                .trim().toLowerCase(Locale.ROOT);
        JSONArray attempts = new JSONArray();

        if ("activate".equals(operation) || "click".equals(operation) || "select".equals(operation)) {
            List<String> candidates = new ArrayList<>();
            if (!args.optString("ref", "").isEmpty()) candidates.add("computer.click_ref");
            if (args.has("x") && args.has("y")) candidates.add("computer.tap");
            Collections.sort(candidates, new Comparator<String>() {
                @Override public int compare(String a, String b) {
                    return Double.compare(routeScore(b), routeScore(a));
                }
            });
            for (String candidate : candidates) {
                JSONObject result = executeTool(candidate, args);
                record(candidate, result.optBoolean("ok", false));
                attempts.put(new JSONObject()
                        .put("tool", candidate)
                        .put("score", routeScore(candidate))
                        .put("result", result));
                if (result.optBoolean("ok", false)) {
                    return new JSONObject()
                            .put("ok", true).put("complete", true)
                            .put("operation", operation)
                            .put("selectedRoute", candidate)
                            .put("attempts", attempts)
                            .put("adaptedFromHistory", true);
                }
            }
            return new JSONObject().put("ok", false).put("complete", true)
                    .put("operation", operation).put("attempts", attempts)
                    .put("error", candidates.isEmpty() ? "no-activation-route-supplied" : "all-activation-routes-failed");
        }

        String selected;
        if ("observe".equals(operation) || "inspect".equals(operation)) selected = "computer.observe";
        else if ("type".equals(operation) || "text".equals(operation)) selected = "computer.type";
        else if ("swipe".equals(operation)) selected = "computer.swipe";
        else if ("press".equals(operation) || "navigate".equals(operation)) selected = "computer.press";
        else if ("launch".equals(operation) || "open_app".equals(operation)) selected = "computer.launch_app";
        else if ("run".equals(operation) || "shell".equals(operation) || "execute".equals(operation)) selected = "linux.run";
        else if ("read".equals(operation)) selected = "workspace.read";
        else if ("write".equals(operation)) selected = "workspace.write";
        else return fail("adaptive-operation-unsupported:" + operation);

        JSONObject result = executeTool(selected, args);
        record(selected, result.optBoolean("ok", false));
        return new JSONObject()
                .put("ok", result.optBoolean("ok", false))
                .put("complete", true)
                .put("operation", operation)
                .put("selectedRoute", selected)
                .put("result", result)
                .put("adaptedFromHistory", false);
    }

    private double routeScore(String tool) {
        int success = metrics.getInt(tool + ".success", 0);
        int failure = metrics.getInt(tool + ".failure", 0);
        if (success + failure == 0) {
            if ("computer.click_ref".equals(tool)) return 0.65;
            if ("computer.tap".equals(tool)) return 0.45;
            return 0.50;
        }
        return (success + 1.0) / (success + failure + 2.0);
    }

    private void record(String tool, boolean ok) {
        if (tool == null || tool.isEmpty()) return;
        String key = tool + (ok ? ".success" : ".failure");
        metrics.edit()
                .putInt(key, metrics.getInt(key, 0) + 1)
                .putLong(tool + ".lastAt", System.currentTimeMillis())
                .apply();
    }

    private JSONObject metricsJson() {
        JSONObject out = new JSONObject();
        for (Map.Entry<String, ?> entry : metrics.getAll().entrySet()) {
            put(out, entry.getKey(), entry.getValue());
        }
        return out;
    }

    private JSONObject listApps() {
        try {
            Intent launcher = new Intent(Intent.ACTION_MAIN, null);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> rows = context.getPackageManager().queryIntentActivities(launcher, 0);
            JSONArray apps = new JSONArray();
            for (ResolveInfo row : rows) {
                if (row.activityInfo == null) continue;
                apps.put(new JSONObject()
                        .put("packageName", row.activityInfo.packageName)
                        .put("activity", row.activityInfo.name)
                        .put("label", String.valueOf(row.loadLabel(context.getPackageManager()))));
            }
            return new JSONObject().put("ok", true).put("complete", true).put("apps", apps);
        } catch (Exception error) {
            return fail("app-list-failed:" + safe(error));
        }
    }

    private JSONObject launchApp(String packageName) {
        try {
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(packageName);
            if (launch == null) return fail("package-not-launchable:" + packageName);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launch);
            return new JSONObject().put("ok", true).put("complete", true).put("packageName", packageName);
        } catch (Exception error) {
            return fail("app-launch-failed:" + safe(error));
        }
    }

    private JSONObject readWorkspace(String relativePath) {
        try {
            File file = workspaceFile(relativePath);
            if (!file.isFile()) return fail("workspace-file-not-found");
            try (FileInputStream input = new FileInputStream(file)) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) >= 0) {
                    if (count > 0) out.write(buffer, 0, count);
                    if (out.size() > 2 * 1024 * 1024) return fail("workspace-read-limit-exceeded");
                }
                return new JSONObject().put("ok", true).put("complete", true)
                        .put("path", relativePath)
                        .put("text", out.toString("UTF-8"));
            }
        } catch (Exception error) {
            return fail("workspace-read-failed:" + safe(error));
        }
    }

    private JSONObject writeWorkspace(String relativePath, String content) {
        try {
            File file = workspaceFile(relativePath);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                return fail("workspace-directory-create-failed");
            }
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            }
            return new JSONObject().put("ok", true).put("complete", true)
                    .put("path", relativePath).put("bytes", bytes.length);
        } catch (Exception error) {
            return fail("workspace-write-failed:" + safe(error));
        }
    }

    private File workspaceFile(String relativePath) throws IOException {
        String value = relativePath == null ? "" : relativePath.trim();
        if (value.isEmpty() || value.startsWith("/") || value.contains("..")) {
            throw new IOException("workspace-path-rejected");
        }
        File root = new File(context.getFilesDir(), "synthia-workspace");
        if (!root.exists() && !root.mkdirs()) throw new IOException("workspace-root-create-failed");
        File file = new File(root, value);
        String rootPath = root.getCanonicalPath();
        String filePath = file.getCanonicalPath();
        if (!filePath.equals(rootPath) && !filePath.startsWith(rootPath + File.separator)) {
            throw new IOException("workspace-path-escaped");
        }
        return file;
    }

    private JSONArray toolCatalog() {
        JSONArray tools = new JSONArray();
        tools.put(tool("computer.status", "Return MCP, accessibility and adaptive-route status.", objectSchema()));
        tools.put(tool("computer.observe", "Read the current Android accessibility tree and refresh stable element refs.", objectSchema()));
        tools.put(tool("computer.click_ref", "Click a previously observed element ref, walking to a clickable parent if necessary.",
                schema(new String[][]{{"ref","string"}}, new String[]{"ref"})));
        tools.put(tool("computer.tap", "Tap screen coordinates through the existing accessibility gesture hand.",
                schema(new String[][]{{"x","integer"},{"y","integer"}}, new String[]{"x","y"})));
        tools.put(tool("computer.swipe", "Swipe between screen coordinates.",
                schema(new String[][]{{"x1","integer"},{"y1","integer"},{"x2","integer"},{"y2","integer"},{"durationMs","integer"}},
                        new String[]{"x1","y1","x2","y2"})));
        tools.put(tool("computer.type", "Set text in the focused or first editable accessibility element.",
                schema(new String[][]{{"text","string"}}, new String[]{"text"})));
        tools.put(tool("computer.press", "Press an Android global action: back, home, recents, notifications, quick_settings, or power.",
                schema(new String[][]{{"button","string"}}, new String[]{"button"})));
        tools.put(tool("computer.list_apps", "List launchable installed applications.", objectSchema()));
        tools.put(tool("computer.launch_app", "Launch an installed application by package name.",
                schema(new String[][]{{"packageName","string"}}, new String[]{"packageName"})));
        tools.put(tool("computer.metrics", "Return persisted per-tool success/failure history used by adaptive routing.", objectSchema()));
        tools.put(tool("computer.adapt", "Choose and execute an available computer route for an operation. For activate/click it ranks ref-click and coordinate-tap from persisted outcomes and falls back when the preferred route fails.",
                adaptiveSchema()));
        tools.put(tool("linux.status", "Return embedded PRoot Linux chamber status.", objectSchema()));
        tools.put(tool("linux.prepare", "Prepare the embedded Linux rootfs if it has not been prepared yet.", objectSchema()));
        tools.put(tool("linux.run", "Run a shell command inside the embedded local Linux chamber and return exit status/stdout.",
                schema(new String[][]{{"command","string"}}, new String[]{"command"})));
        tools.put(tool("linux.run_file", "Execute a workspace file using the embedded Linux runtime's file-type routing.",
                schema(new String[][]{{"path","string"}}, new String[]{"path"})));
        tools.put(tool("workspace.read", "Read a UTF-8 file from Stellar's persistent local workspace.",
                schema(new String[][]{{"path","string"}}, new String[]{"path"})));
        tools.put(tool("workspace.write", "Write a UTF-8 file to Stellar's persistent local workspace.",
                schema(new String[][]{{"path","string"},{"content","string"}}, new String[]{"path","content"})));
        return tools;
    }

    private JSONObject adaptiveSchema() {
        JSONObject properties = new JSONObject();
        put(properties, "operation", new JSONObject().put("type", "string")
                .put("description", "observe, activate/click/select, type/text, swipe, press/navigate, launch/open_app, run/shell/execute, read, or write"));
        String[][] optional = {
                {"ref","string"},{"x","integer"},{"y","integer"},{"x1","integer"},{"y1","integer"},
                {"x2","integer"},{"y2","integer"},{"durationMs","integer"},{"text","string"},
                {"button","string"},{"packageName","string"},{"command","string"},{"path","string"},{"content","string"}
        };
        for (String[] item : optional) put(properties, item[0], new JSONObject().put("type", item[1]));
        return new JSONObject().put("type","object").put("properties",properties)
                .put("required", new JSONArray().put("operation")).put("additionalProperties", false);
    }

    private JSONObject schema(String[][] fields, String[] required) {
        JSONObject props = new JSONObject();
        for (String[] field : fields) put(props, field[0], new JSONObject().put("type", field[1]));
        JSONArray req = new JSONArray();
        for (String name : required) req.put(name);
        return new JSONObject().put("type","object").put("properties",props)
                .put("required", req).put("additionalProperties", false);
    }

    private JSONObject objectSchema() {
        return new JSONObject().put("type","object").put("properties",new JSONObject())
                .put("additionalProperties", false);
    }

    private JSONObject tool(String name, String description, JSONObject inputSchema) {
        return new JSONObject().put("name", name).put("description", description).put("inputSchema", inputSchema);
    }

    private JSONObject baseResult() {
        return new JSONObject()
                .put("resultType", "complete")
                .put("_meta", new JSONObject().put("io.modelcontextprotocol/serverInfo",
                        new JSONObject().put("name", "stellar-computer").put("version", "0.1.0")));
    }

    private JSONObject success(Object id, JSONObject result) {
        return new JSONObject().put("jsonrpc","2.0").put("id", id).put("result", result);
    }

    private JSONObject jsonRpcError(Object id, int code, String message, JSONObject data) {
        JSONObject error = new JSONObject().put("code", code).put("message", message);
        if (data != null) error.put("data", data);
        return new JSONObject().put("jsonrpc","2.0").put("id", id).put("error", error);
    }

    private static JSONObject parse(String text) {
        try { return new JSONObject(text == null ? "{}" : text); }
        catch (Exception error) { return fail("invalid-internal-json:" + safe(error)); }
    }

    private static JSONObject fail(String error) {
        return new JSONObject().put("ok", false).put("complete", true).put("error", error);
    }

    private static String requireString(JSONObject args, String key) {
        String value = args.optString(key, "");
        if (value.isEmpty()) throw new IllegalArgumentException("missing-" + key);
        return value;
    }

    private static int requireInt(JSONObject args, String key) {
        if (!args.has(key)) throw new IllegalArgumentException("missing-" + key);
        return args.optInt(key);
    }

    private static String value(Map<String,String> headers, String key) {
        String v = headers.get(key);
        return v == null ? "" : v.trim();
    }

    private static int parseInt(String value, int fallback) {
        try { return Integer.parseInt(value == null ? "" : value.trim()); }
        catch (Exception ignored) { return fallback; }
    }

    private static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value == null ? JSONObject.NULL : value); }
        catch (Exception ignored) {}
    }

    private static String safe(Throwable error) {
        if (error == null) return "unknown";
        String message = error.getMessage();
        return message == null || message.isEmpty() ? error.getClass().getSimpleName() : message;
    }

    private static String readAsciiLine(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int previous = -1;
        while (true) {
            int b = in.read();
            if (b < 0) {
                if (out.size() == 0) return null;
                break;
            }
            if (previous == '\r' && b == '\n') {
                byte[] bytes = out.toByteArray();
                int len = Math.max(0, bytes.length - 1);
                return new String(bytes, 0, len, StandardCharsets.US_ASCII);
            }
            out.write(b);
            previous = b;
            if (out.size() > 16384) throw new IOException("http-line-too-long");
        }
        return out.toString("US-ASCII");
    }

    private static byte[] readExact(InputStream in, int size) throws IOException {
        byte[] body = new byte[size];
        int offset = 0;
        while (offset < size) {
            int count = in.read(body, offset, size - offset);
            if (count < 0) throw new IOException("truncated-http-body");
            offset += count;
        }
        return body;
    }

    private static void writeOptions(OutputStream out) throws IOException {
        String headers = "HTTP/1.1 204 No Content\r\n"
                + "Access-Control-Allow-Origin: *\r\n"
                + "Access-Control-Allow-Methods: POST, OPTIONS\r\n"
                + "Access-Control-Allow-Headers: Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name\r\n"
                + "Connection: close\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.US_ASCII));
        out.flush();
    }

    private static void writeHttp(OutputStream out, int status, JSONObject json) throws IOException {
        byte[] body = json.toString().getBytes(StandardCharsets.UTF_8);
        String reason = status == 200 ? "OK" : status == 400 ? "Bad Request" :
                status == 404 ? "Not Found" : status == 405 ? "Method Not Allowed" : "Internal Server Error";
        String headers = "HTTP/1.1 " + status + " " + reason + "\r\n"
                + "Content-Type: application/json; charset=utf-8\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Access-Control-Allow-Origin: *\r\n"
                + "Connection: close\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    @Override public synchronized void close() {
        running = false;
        if (server != null) {
            try { server.close(); } catch (IOException ignored) {}
            server = null;
        }
        pool.shutdownNow();
    }

    private static final class Dispatch {
        final int httpStatus;
        final JSONObject body;
        Dispatch(int httpStatus, JSONObject body) {
            this.httpStatus = httpStatus;
            this.body = body;
        }
    }
}
