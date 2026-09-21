package com.synthia.autonomy;

import android.app.Activity;
import android.app.DownloadManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

public final class GitHubUpdateManager implements AutoCloseable {
    public static final String ACTION_INSTALL_STATUS =
            "com.synthia.autonomy.UPDATE_INSTALL_STATUS";

    private static final String SELF_REPOSITORY = "justappgrabbin/Stellar-proximology";
    private static final String SELF_APK_ASSET = "Stellar-Proximology.apk";
    private static final String SELF_MANIFEST_ASSET = "stellar-update.json";
    private static final Pattern REPOSITORY =
            Pattern.compile("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$");

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService pool = Executors.newSingleThreadExecutor();

    private volatile File downloadedSelfApk;
    private volatile JSONObject lastRelease;
    private volatile JSONObject lastManifest;
    private volatile String lastError;

    public GitHubUpdateManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public String statusJson() {
        try {
            JSONObject out = baseStatus();
            out.put("downloaded", downloadedSelfApk != null && downloadedSelfApk.isFile());
            out.put("downloadedPath", downloadedSelfApk == null
                    ? JSONObject.NULL : downloadedSelfApk.getAbsolutePath());
            out.put("lastError", lastError == null ? JSONObject.NULL : lastError);
            if (lastManifest != null) out.put("latest", lastManifest);
            return out.toString();
        } catch (Exception error) {
            return errorJson("status-failed:" + error.getMessage());
        }
    }

    public String checkSelfUpdate() {
        pool.execute(() -> {
            try {
                ReleaseBundle bundle = fetchSelfRelease();
                lastRelease = bundle.release;
                lastManifest = bundle.manifest;
                lastError = null;

                JSONObject detail = baseStatus();
                detail.put("type", "check");
                detail.put("latest", bundle.manifest);
                detail.put("release", releaseSummary(bundle.release));
                detail.put("updateAvailable",
                        bundle.manifest.getLong("versionCode") > currentVersionCode());
                dispatch("stellar-update", detail);
            } catch (Exception error) {
                emitError("check", error);
            }
        });
        return acceptedJson("check");
    }

    public String downloadSelfUpdate() {
        pool.execute(() -> {
            try {
                ReleaseBundle bundle = fetchSelfRelease();
                long latestCode = bundle.manifest.getLong("versionCode");
                long currentCode = currentVersionCode();
                if (latestCode <= currentCode) {
                    throw new IllegalStateException("no-newer-release");
                }

                String expectedPackage = bundle.manifest.getString("packageName");
                if (!activity.getPackageName().equals(expectedPackage)) {
                    throw new SecurityException("package-name-mismatch");
                }

                String expectedSha = bundle.manifest.getString("sha256")
                        .toLowerCase(Locale.ROOT);
                if (!expectedSha.matches("^[0-9a-f]{64}$")) {
                    throw new SecurityException("release-sha256-invalid");
                }

                String apkUrl = findAssetUrl(bundle.release, SELF_APK_ASSET);
                validateSelfAssetUrl(apkUrl, SELF_REPOSITORY);

                File updateDir = new File(activity.getFilesDir(), "updates");
                if (!updateDir.exists() && !updateDir.mkdirs()) {
                    throw new IllegalStateException("update-directory-create-failed");
                }

                File part = new File(updateDir, SELF_APK_ASSET + ".part");
                File target = new File(updateDir, SELF_APK_ASSET);
                downloadToFile(apkUrl, part);

                String actualSha = sha256(part);
                if (!expectedSha.equals(actualSha)) {
                    part.delete();
                    throw new SecurityException("apk-sha256-mismatch");
                }

                validateSelfApk(part, latestCode);

                if (target.exists() && !target.delete()) {
                    part.delete();
                    throw new IllegalStateException("old-update-delete-failed");
                }
                if (!part.renameTo(target)) {
                    part.delete();
                    throw new IllegalStateException("update-rename-failed");
                }

                downloadedSelfApk = target;
                lastRelease = bundle.release;
                lastManifest = bundle.manifest;
                lastError = null;

                JSONObject detail = baseStatus();
                detail.put("type", "downloaded");
                detail.put("latest", bundle.manifest);
                detail.put("sha256", actualSha);
                detail.put("bytes", target.length());
                detail.put("readyToInstall", true);
                dispatch("stellar-update", detail);
            } catch (Exception error) {
                emitError("download", error);
            }
        });
        return acceptedJson("download");
    }

    public String installSelfUpdate() {
        if (downloadedSelfApk == null || !downloadedSelfApk.isFile()) {
            return errorJson("no-verified-update-downloaded");
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            JSONObject detail = new JSONObject();
            try {
                detail.put("type", "install-permission-required");
                detail.put("permissionRequired", true);
            } catch (Exception ignored) {}
            dispatch("stellar-update", detail);
            openInstallPermission();
            return "{\"ok\":false,\"complete\":true,\"permissionRequired\":true}";
        }

        pool.execute(() -> {
            try {
                installWithSystemApproval(downloadedSelfApk);
            } catch (Exception error) {
                emitError("install", error);
            }
        });
        return acceptedJson("install");
    }

    public String openInstallPermission() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return "{\"ok\":true,\"complete\":true,\"notRequired\":true}";
            }
            activity.runOnUiThread(() -> {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName())
                );
                activity.startActivity(intent);
            });
            return "{\"ok\":true,\"complete\":false,\"settingsOpened\":true}";
        } catch (Exception error) {
            return errorJson("install-permission-settings-failed:" + error.getMessage());
        }
    }

    public String listGitHubApks(String repository) {
        final String repo;
        try {
            repo = normalizeRepository(repository);
        } catch (Exception error) {
            return errorJson(error.getMessage());
        }

        pool.execute(() -> {
            try {
                JSONObject release = fetchLatestRelease(repo);
                JSONArray rows = release.optJSONArray("assets");
                JSONArray apks = new JSONArray();
                if (rows != null) {
                    for (int i = 0; i < rows.length(); i++) {
                        JSONObject asset = rows.optJSONObject(i);
                        if (asset == null) continue;
                        String name = asset.optString("name", "");
                        if (!name.toLowerCase(Locale.ROOT).endsWith(".apk")) continue;
                        JSONObject row = new JSONObject();
                        row.put("name", name);
                        row.put("bytes", asset.optLong("size", 0L));
                        row.put("downloadCount", asset.optLong("download_count", 0L));
                        apks.put(row);
                    }
                }
                JSONObject detail = new JSONObject();
                detail.put("type", "list");
                detail.put("repository", repo);
                detail.put("tag", release.optString("tag_name", ""));
                detail.put("apks", apks);
                dispatch("stellar-github-apk", detail);
            } catch (Exception error) {
                emitGitHubApkError(repo, "list", error);
            }
        });
        return acceptedJson("github-apk-list");
    }

    public String downloadGitHubApk(String repository, String assetName) {
        final String repo;
        final String asset;
        try {
            repo = normalizeRepository(repository);
            asset = assetName == null ? "" : assetName.trim();
            if (!asset.toLowerCase(Locale.ROOT).endsWith(".apk")) {
                throw new IllegalArgumentException("asset-must-be-apk");
            }
            if (asset.contains("/") || asset.contains("\\") || asset.contains("..")) {
                throw new IllegalArgumentException("asset-name-rejected");
            }
        } catch (Exception error) {
            return errorJson(error.getMessage());
        }

        pool.execute(() -> {
            try {
                JSONObject release = fetchLatestRelease(repo);
                String url = findAssetUrl(release, asset);
                validateSelfAssetUrl(url, repo);

                DownloadManager manager =
                        (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager == null) throw new IllegalStateException("download-manager-unavailable");

                String publicName = repo.replace('/', '_') + "-" + asset;
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                        .setTitle(asset)
                        .setDescription("GitHub APK from " + repo)
                        .setMimeType("application/vnd.android.package-archive")
                        .setNotificationVisibility(
                                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(
                                Environment.DIRECTORY_DOWNLOADS,
                                publicName
                        );

                long id = manager.enqueue(request);
                JSONObject detail = new JSONObject();
                detail.put("type", "download-enqueued");
                detail.put("repository", repo);
                detail.put("asset", asset);
                detail.put("downloadId", id);
                detail.put("destination", "Downloads/" + publicName);
                dispatch("stellar-github-apk", detail);
            } catch (Exception error) {
                emitGitHubApkError(repo, "download", error);
            }
        });
        return acceptedJson("github-apk-download");
    }

    public void handleInstallIntent(Intent intent) {
        if (intent == null || !ACTION_INSTALL_STATUS.equals(intent.getAction())) return;

        int status = intent.getIntExtra(
                PackageInstaller.EXTRA_STATUS,
                PackageInstaller.STATUS_FAILURE
        );

        try {
            JSONObject detail = new JSONObject();
            detail.put("type", "install-status");
            detail.put("status", status);
            detail.put("message",
                    intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));

            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                detail.put("pendingUserApproval", true);
                dispatch("stellar-update", detail);

                Intent confirmIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirmIntent != null) {
                    activity.runOnUiThread(() -> activity.startActivity(confirmIntent));
                }
                return;
            }

            if (status == PackageInstaller.STATUS_SUCCESS) {
                detail.put("installed", true);
                dispatch("stellar-update", detail);
                return;
            }

            detail.put("installed", false);
            dispatch("stellar-update", detail);
        } catch (Exception error) {
            emitError("install-status", error);
        }
    }

    private void installWithSystemApproval(File apk) throws Exception {
        validateSelfApk(apk, lastManifest == null
                ? currentVersionCode()
                : lastManifest.getLong("versionCode"));

        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(
                        PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) {
            params.setRequireUserAction(
                    PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        }

        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);

        try (
                InputStream input = new BufferedInputStream(new FileInputStream(apk));
                OutputStream output = session.openWrite("stellar-update.apk", 0, apk.length())
        ) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) output.write(buffer, 0, count);
            }
            session.fsync(output);
        }

        Intent status = new Intent(activity, MainActivity.class)
                .setAction(ACTION_INSTALL_STATUS)
                .setData(Uri.parse("synthia-update://session/" + sessionId));

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;

        PendingIntent pending = PendingIntent.getActivity(
                activity,
                sessionId,
                status,
                flags
        );

        JSONObject detail = new JSONObject();
        detail.put("type", "install-session-created");
        detail.put("sessionId", sessionId);
        detail.put("pendingUserApproval", true);
        dispatch("stellar-update", detail);

        session.commit(pending.getIntentSender());
        session.close();
    }

    private ReleaseBundle fetchSelfRelease() throws Exception {
        JSONObject release = fetchLatestRelease(SELF_REPOSITORY);
        String manifestUrl = findAssetUrl(release, SELF_MANIFEST_ASSET);
        validateSelfAssetUrl(manifestUrl, SELF_REPOSITORY);
        JSONObject updateManifest = new JSONObject(readText(manifestUrl));

        if (!SELF_REPOSITORY.equals(updateManifest.optString("repository"))) {
            throw new SecurityException("update-repository-mismatch");
        }
        if (!activity.getPackageName().equals(updateManifest.optString("packageName"))) {
            throw new SecurityException("update-package-mismatch");
        }
        if (!SELF_APK_ASSET.equals(updateManifest.optString("apkAsset"))) {
            throw new SecurityException("update-apk-asset-mismatch");
        }

        return new ReleaseBundle(release, updateManifest);
    }

    private JSONObject fetchLatestRelease(String repository) throws Exception {
        String repo = normalizeRepository(repository);
        String url = "https://api.github.com/repos/" + repo + "/releases/latest";
        return new JSONObject(readText(url));
    }

    private String readText(String value) throws Exception {
        HttpURLConnection connection = open(value);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
        )) {
            StringBuilder out = new StringBuilder();
            char[] buffer = new char[8192];
            int count;
            while ((count = reader.read(buffer)) >= 0) {
                if (count > 0) out.append(buffer, 0, count);
            }
            return out.toString();
        } finally {
            connection.disconnect();
        }
    }

    private void downloadToFile(String value, File target) throws Exception {
        HttpURLConnection connection = open(value);
        try (
                InputStream input = new BufferedInputStream(connection.getInputStream());
                FileOutputStream output = new FileOutputStream(target)
        ) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) output.write(buffer, 0, count);
            }
            output.getFD().sync();
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection open(String value) throws Exception {
        URL url = new URL(value);
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new SecurityException("https-required");
        }

        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "Stellar-Proximology-SelfUpdater");
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IllegalStateException("http-" + status);
        }
        return connection;
    }

    private String findAssetUrl(JSONObject release, String name) throws Exception {
        JSONArray assets = release.optJSONArray("assets");
        if (assets == null) throw new IllegalStateException("release-assets-missing");
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.optJSONObject(i);
            if (asset != null && name.equals(asset.optString("name"))) {
                String url = asset.optString("browser_download_url", "");
                if (url.isEmpty()) throw new IllegalStateException("asset-url-missing:" + name);
                return url;
            }
        }
        throw new IllegalStateException("release-asset-missing:" + name);
    }

    private void validateSelfAssetUrl(String value, String repository) throws Exception {
        URL url = new URL(value);
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new SecurityException("https-required");
        }
        if (!"github.com".equalsIgnoreCase(url.getHost())) {
            throw new SecurityException("release-host-rejected");
        }
        String prefix = "/" + repository + "/releases/download/";
        if (!url.getPath().startsWith(prefix)) {
            throw new SecurityException("release-path-rejected");
        }
    }

    private String normalizeRepository(String repository) {
        String value = repository == null ? "" : repository.trim();
        if (!REPOSITORY.matcher(value).matches()) {
            throw new IllegalArgumentException("repository-must-be-owner-slash-name");
        }
        return value;
    }

    private void validateSelfApk(File apk, long expectedVersionCode) throws Exception {
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;

        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null) throw new SecurityException("apk-package-info-unreadable");
        if (!activity.getPackageName().equals(archive.packageName)) {
            throw new SecurityException("apk-package-name-mismatch");
        }

        long archiveCode = versionCode(archive);
        if (archiveCode != expectedVersionCode) {
            throw new SecurityException("apk-version-code-mismatch");
        }
        if (archiveCode <= currentVersionCode()) {
            throw new SecurityException("apk-is-not-newer");
        }

        PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flags);
        if (!signatureDigests(installed).equals(signatureDigests(archive))) {
            throw new SecurityException("signing-certificate-mismatch");
        }
    }

    private Set<String> signatureDigests(PackageInfo info) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) {
                throw new SecurityException("signing-info-missing");
            }
            signatures = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
        } else {
            signatures = info.signatures;
        }

        Set<String> out = new HashSet<>();
        if (signatures == null) return out;
        for (Signature signature : signatures) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            out.add(hex(digest.digest(signature.toByteArray())));
        }
        return out;
    }

    private long currentVersionCode() throws Exception {
        PackageInfo current = activity.getPackageManager()
                .getPackageInfo(activity.getPackageName(), 0);
        return versionCode(current);
    }

    private String currentVersionName() throws Exception {
        PackageInfo current = activity.getPackageManager()
                .getPackageInfo(activity.getPackageName(), 0);
        return current.versionName == null ? "" : current.versionName;
    }

    private long versionCode(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return info.getLongVersionCode();
        }
        return info.versionCode;
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) digest.update(buffer, 0, count);
            }
        }
        return hex(digest.digest());
    }

    private String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return out.toString();
    }

    private JSONObject baseStatus() throws Exception {
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("complete", true);
        out.put("selfHosted", true);
        out.put("repository", SELF_REPOSITORY);
        out.put("packageName", activity.getPackageName());
        out.put("currentVersionCode", currentVersionCode());
        out.put("currentVersionName", currentVersionName());
        out.put("canRequestPackageInstalls",
                Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                        || activity.getPackageManager().canRequestPackageInstalls());
        return out;
    }

    private JSONObject releaseSummary(JSONObject release) throws Exception {
        JSONObject out = new JSONObject();
        out.put("tag", release.optString("tag_name", ""));
        out.put("name", release.optString("name", ""));
        out.put("body", release.optString("body", ""));
        out.put("publishedAt", release.optString("published_at", ""));
        out.put("htmlUrl", release.optString("html_url", ""));
        return out;
    }

    private void emitError(String phase, Exception error) {
        lastError = error.getMessage();
        try {
            JSONObject detail = baseStatus();
            detail.put("type", "error");
            detail.put("phase", phase);
            detail.put("error", String.valueOf(error.getMessage()));
            dispatch("stellar-update", detail);
        } catch (Exception ignored) {}
    }

    private void emitGitHubApkError(String repository, String phase, Exception error) {
        try {
            JSONObject detail = new JSONObject();
            detail.put("type", "error");
            detail.put("repository", repository);
            detail.put("phase", phase);
            detail.put("error", String.valueOf(error.getMessage()));
            dispatch("stellar-github-apk", detail);
        } catch (Exception ignored) {}
    }

    private void dispatch(String event, JSONObject detail) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent("
                + JSONObject.quote(event)
                + ",{detail:" + detail.toString() + "}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private String acceptedJson(String action) {
        return "{\"ok\":true,\"accepted\":true,\"complete\":false,\"action\":"
                + JSONObject.quote(action) + "}";
    }

    private String errorJson(String error) {
        return "{\"ok\":false,\"complete\":true,\"error\":"
                + JSONObject.quote(error == null ? "" : error) + "}";
    }

    @Override
    public void close() {
        pool.shutdownNow();
    }

    private static final class ReleaseBundle {
        final JSONObject release;
        final JSONObject manifest;

        ReleaseBundle(JSONObject release, JSONObject manifest) {
            this.release = release;
            this.manifest = manifest;
        }
    }
}
