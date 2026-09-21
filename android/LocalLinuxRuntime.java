package com.synthia.autonomy;

import android.content.Context;
import android.content.res.AssetManager;
import android.os.Build;
import android.system.Os;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Local Linux execution chamber backed by the PRoot + rootfs assets already
 * present in Stellar Proximology. No remote backend is involved.
 */
public final class LocalLinuxRuntime {
    private static final String TAG = "StellarLinux";
    private final Context context;
    private final File runtimeDir;
    private final File rootfsDir;
    private final File workspaceDir;
    private final File readyMarker;

    public LocalLinuxRuntime(Context context) {
        this.context = context.getApplicationContext();
        this.runtimeDir = new File(context.getFilesDir(), "stellar-linux");
        this.rootfsDir = new File(runtimeDir, "rootfs");
        this.workspaceDir = new File(context.getFilesDir(), "synthia-workspace");
        this.readyMarker = new File(runtimeDir, ".ready");
    }

    public synchronized String statusJson() {
        return "{\"ok\":true,\"complete\":true,\"embeddedLinux\":true"
                + ",\"prepared\":" + readyMarker.isFile()
                + ",\"abi\":" + quote(primaryAbi())
                + ",\"rootfs\":" + quote(rootfsDir.getAbsolutePath())
                + ",\"workspace\":" + quote(workspaceDir.getAbsolutePath())
                + "}";
    }

    public synchronized String prepareJson() {
        try {
            ensurePrepared();
            return statusJson();
        } catch (Exception error) {
            return errorJson("linux-prepare-failed:" + safe(error));
        }
    }

    public String runCommand(String command) {
        String source = command == null ? "" : command.trim();
        if (source.isEmpty()) return errorJson("linux-command-empty");
        try {
            ensurePrepared();
            return execute(source, 30000);
        } catch (Exception error) {
            return errorJson("linux-execution-failed:" + safe(error));
        }
    }

    public String runWorkspaceFile(String relativePath) {
        try {
            ensurePrepared();
            File file = workspaceFile(relativePath);
            if (!file.isFile()) return errorJson("workspace-file-not-found");
            String rel = relativePath.replace('\\', '/');
            String q = shellQuote("/workspace/" + rel);
            String lower = rel.toLowerCase(Locale.ROOT);
            String command;
            if (lower.endsWith(".sh")) {
                command = "/bin/sh " + q;
            } else if (lower.endsWith(".py") || lower.endsWith(".pyw")) {
                command = "command -v python3 >/dev/null 2>&1 && python3 " + q
                        + " || { echo '__STELLAR_RUNTIME_MISSING__:python3' >&2; exit 127; }";
            } else if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
                command = "command -v node >/dev/null 2>&1 && node " + q
                        + " || { echo '__STELLAR_RUNTIME_MISSING__:node' >&2; exit 127; }";
            } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".json")
                    || lower.endsWith(".csv") || lower.endsWith(".xml")
                    || lower.endsWith(".yaml") || lower.endsWith(".yml")) {
                command = "cat " + q;
            } else {
                command = "chmod 700 " + q + " 2>/dev/null || true; " + q;
            }
            return execute(command, 30000);
        } catch (Exception error) {
            return errorJson("workspace-execution-failed:" + safe(error));
        }
    }

    private synchronized void ensurePrepared() throws Exception {
        if (readyMarker.isFile()) return;
        if (!runtimeDir.exists() && !runtimeDir.mkdirs()) {
            throw new IOException("Could not create runtime directory");
        }
        if (!workspaceDir.exists() && !workspaceDir.mkdirs()) {
            throw new IOException("Could not create workspace directory");
        }
        if (!rootfsDir.exists() && !rootfsDir.mkdirs()) {
            throw new IOException("Could not create rootfs directory");
        }

        String asset = isArm64()
                ? "web/runtime/rootfs-arm64.tar"
                : "web/runtime/rootfs-arm.tar";
        try (InputStream raw = new BufferedInputStream(context.getAssets().open(asset))) {
            extractTar(raw, rootfsDir);
        }

        try (FileOutputStream out = new FileOutputStream(readyMarker)) {
            out.write(("abi=" + primaryAbi()).getBytes(StandardCharsets.UTF_8));
        }
    }

    private String execute(String command, long timeoutMs) throws Exception {
        File proot = new File(context.getApplicationInfo().nativeLibraryDir, "libproot.so");
        if (!proot.isFile()) {
            return errorJson("embedded-proot-not-extracted");
        }

        List<String> args = new ArrayList<>();
        args.add(proot.getAbsolutePath());
        args.add("-0");
        args.add("-r");
        args.add(rootfsDir.getAbsolutePath());
        args.add("-b");
        args.add(workspaceDir.getAbsolutePath() + ":/workspace");
        args.add("-b");
        args.add(context.getCacheDir().getAbsolutePath() + ":/tmp");
        args.add("-b");
        args.add("/dev");
        args.add("-w");
        args.add("/workspace");
        args.add("/bin/sh");
        args.add("-lc");
        args.add(command);

        ProcessBuilder builder = new ProcessBuilder(args);
        builder.redirectErrorStream(true);
        builder.environment().put("HOME", "/root");
        builder.environment().put("USER", "root");
        builder.environment().put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
        builder.environment().put("PROOT_NO_SECCOMP", "1");
        builder.environment().put("PROOT_TMP_DIR", "/tmp");
        builder.environment().put("TMPDIR", "/tmp");

        Process process = builder.start();
        ByteArrayOutputStream capture = new ByteArrayOutputStream();
        Thread reader = new Thread(() -> {
            try (InputStream in = process.getInputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = in.read(buffer)) >= 0) {
                    if (count > 0) capture.write(buffer, 0, count);
                    if (capture.size() > 2 * 1024 * 1024) break;
                }
            } catch (Exception ignored) {}
        }, "stellar-linux-capture");
        reader.start();

        boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
        if (!finished) process.destroyForcibly();
        reader.join(1500);

        int exit = finished ? process.exitValue() : 124;
        String output = capture.toString("UTF-8");
        return "{\"ok\":" + (finished && exit == 0)
                + ",\"complete\":true"
                + ",\"engine\":\"embedded-proot-linux\""
                + ",\"exitCode\":" + exit
                + ",\"timedOut\":" + (!finished)
                + ",\"stdout\":" + quote(output)
                + "}";
    }

    private File workspaceFile(String relativePath) throws IOException {
        String value = relativePath == null ? "" : relativePath.trim();
        if (value.isEmpty() || value.startsWith("/") || value.contains("..")) {
            throw new IOException("Workspace path rejected");
        }
        File file = new File(workspaceDir, value);
        String root = workspaceDir.getCanonicalPath();
        String child = file.getCanonicalPath();
        if (!child.startsWith(root + File.separator)) throw new IOException("Workspace path escaped");
        return file;
    }

    private void extractTar(InputStream input, File destination) throws Exception {
        byte[] header = new byte[512];
        while (true) {
            int read = readFully(input, header);
            if (read == 0) break;
            if (read != 512) throw new IOException("Truncated tar header");
            if (isZeroBlock(header)) break;

            String name = readString(header, 0, 100);
            String prefix = readString(header, 345, 155);
            if (!prefix.isEmpty()) name = prefix + "/" + name;
            long size = parseOctal(header, 124, 12);
            int mode = (int) parseOctal(header, 100, 8);
            byte type = header[156];
            String linkName = readString(header, 157, 100);

            String clean = name.replace('\\', '/');
            while (clean.startsWith("./")) clean = clean.substring(2);
            if (clean.isEmpty() || clean.startsWith("/") || clean.contains("../")) {
                skipFully(input, size);
                skipPadding(input, size);
                continue;
            }

            File out = new File(destination, clean);
            String root = destination.getCanonicalPath();
            String child = out.getCanonicalPath();
            if (!child.equals(root) && !child.startsWith(root + File.separator)) {
                throw new IOException("Tar path escaped rootfs: " + clean);
            }

            if (type == '5') {
                if (!out.exists() && !out.mkdirs()) throw new IOException("mkdir failed: " + clean);
                applyMode(out, mode);
            } else if (type == '2') {
                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();
                try {
                    if (out.exists()) out.delete();
                    Os.symlink(linkName, out.getAbsolutePath());
                } catch (Exception error) {
                    Log.w(TAG, "symlink skipped: " + clean, error);
                }
            } else if (type == '1') {
                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();
                File target = new File(destination, linkName);
                try {
                    if (out.exists()) out.delete();
                    Os.link(target.getAbsolutePath(), out.getAbsolutePath());
                } catch (Exception error) {
                    Log.w(TAG, "hardlink skipped: " + clean, error);
                }
            } else if (type == 0 || type == '0') {
                File parent = out.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                try (FileOutputStream output = new FileOutputStream(out)) {
                    copyExact(input, output, size);
                }
                applyMode(out, mode);
                skipPadding(input, size);
                continue;
            } else {
                skipFully(input, size);
            }
            skipPadding(input, size);
        }
    }

    private static void applyMode(File file, int mode) {
        try { Os.chmod(file.getAbsolutePath(), mode == 0 ? 0755 : mode); }
        catch (Exception ignored) {}
    }

    private static int readFully(InputStream in, byte[] buffer) throws IOException {
        int off = 0;
        while (off < buffer.length) {
            int n = in.read(buffer, off, buffer.length - off);
            if (n < 0) break;
            off += n;
        }
        return off;
    }

    private static void copyExact(InputStream in, FileOutputStream out, long size) throws IOException {
        byte[] buffer = new byte[8192];
        long left = size;
        while (left > 0) {
            int n = in.read(buffer, 0, (int)Math.min(buffer.length, left));
            if (n < 0) throw new IOException("Unexpected EOF in tar");
            out.write(buffer, 0, n);
            left -= n;
        }
    }

    private static void skipFully(InputStream in, long size) throws IOException {
        long left = size;
        while (left > 0) {
            long n = in.skip(left);
            if (n <= 0) {
                if (in.read() < 0) throw new IOException("Unexpected EOF while skipping tar");
                n = 1;
            }
            left -= n;
        }
    }

    private static void skipPadding(InputStream in, long size) throws IOException {
        long pad = (512 - (size % 512)) % 512;
        skipFully(in, pad);
    }

    private static boolean isZeroBlock(byte[] block) {
        for (byte b : block) if (b != 0) return false;
        return true;
    }

    private static String readString(byte[] data, int offset, int length) {
        int end = offset;
        int max = offset + length;
        while (end < max && data[end] != 0) end++;
        return new String(data, offset, end - offset, StandardCharsets.UTF_8).trim();
    }

    private static long parseOctal(byte[] data, int offset, int length) {
        String value = readString(data, offset, length).replace("\u0000", "").trim();
        if (value.isEmpty()) return 0;
        try { return Long.parseLong(value, 8); }
        catch (Exception ignored) { return 0; }
    }

    private boolean isArm64() {
        return primaryAbi().contains("arm64");
    }

    private String primaryAbi() {
        if (Build.SUPPORTED_ABIS != null && Build.SUPPORTED_ABIS.length > 0) {
            return Build.SUPPORTED_ABIS[0];
        }
        return Build.CPU_ABI == null ? "unknown" : Build.CPU_ABI;
    }

    private static String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private static String quote(String value) {
        String v = value == null ? "" : value;
        return "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t") + "\"";
    }

    private static String errorJson(String message) {
        return "{\"ok\":false,\"complete\":true,\"error\":" + quote(message) + "}";
    }

    private static String safe(Exception error) {
        String m = error.getMessage();
        return m == null || m.trim().isEmpty() ? error.getClass().getSimpleName() : m;
    }
}
