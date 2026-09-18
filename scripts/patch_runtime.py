#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_runtime.py <assembled-root>")
root = Path(sys.argv[1])

def must_replace(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"patch anchor missing: {label}")
    return text.replace(old, new, 1)

manifest_path = root / "AndroidManifest.xml"
manifest = manifest_path.read_text()
manifest = re.sub(r'\n\s*<uses-permission android:name="com\.termux\.permission\.RUN_COMMAND"\s*/>', '', manifest)
manifest = re.sub(r'\n\s*<queries>.*?</queries>', '', manifest, flags=re.S)
if 'android:extractNativeLibs=' not in manifest:
    manifest = must_replace(
        manifest,
        'android:allowBackup="false"',
        'android:allowBackup="false"\n        android:extractNativeLibs="true"',
        'extractNativeLibs',
    )
manifest_path.write_text(manifest)

main_path = root / "src/com/synthia/autonomy/MainActivity.java"
main = main_path.read_text()
if 'import android.util.Base64;' not in main:
    main = must_replace(main, 'import android.provider.Settings;\n', 'import android.provider.Settings;\nimport android.util.Base64;\n', 'Base64 import')
if 'private LocalLinuxRuntime linuxRuntime;' not in main:
    main = must_replace(main, 'private ValueCallback<Uri[]> fileCallback;\n', 'private ValueCallback<Uri[]> fileCallback;\n    private LocalLinuxRuntime linuxRuntime;\n', 'linux field')
if 'linuxRuntime = new LocalLinuxRuntime(this);' not in main:
    main = must_replace(main, 'webView = new WebView(this);', 'linuxRuntime = new LocalLinuxRuntime(this);\n\n        webView = new WebView(this);', 'linux init')

def replace_method(source, signature, replacement):
    start = source.find(signature)
    if start < 0:
        raise RuntimeError(f"method anchor missing: {signature}")
    brace = source.find('{', start)
    if brace < 0:
        raise RuntimeError(f"method brace missing: {signature}")
    depth = 0
    i = brace
    in_string = False
    quote = ''
    escaped = False
    while i < len(source):
        ch = source[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                in_string = False
        else:
            if ch in ('"', "'"):
                in_string = True
                quote = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return source[:start] + replacement + source[i+1:]
        i += 1
    raise RuntimeError(f"method did not close: {signature}")

main = replace_method(
    main,
    'public String getStatus()',
    '''public String getStatus() {
            return "{\\"ok\\":true,\\"complete\\":true,\\"androidWrapper\\":true"
                    + ",\\"embeddedLinux\\":true"
                    + ",\\"accessibilityConnected\\":" + SynthiaAccessibilityService.isConnected() + "}";
        }'''
)

main = replace_method(
    main,
    'public String runShell(String command)',
    '''public String runShell(String command) {
            final String source = command == null ? "" : command.trim();
            if (source.isEmpty()) return errorJson("shell-command-empty");
            return linuxRuntime.runCommand(source);
        }'''
)

bridge_methods = r'''
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
                return "{\\"ok\\":true,\\"complete\\":true,\\"path\\":" + jsonQuote(file.getAbsolutePath())
                        + ",\\"bytes\\":" + bytes.length + "}";
            } catch (Exception error) {
                return errorJson("workspace-binary-write-failed:" + error.getMessage());
            }
        }

'''
if 'public String linuxPrepare()' not in main:
    anchor = '        private File workspaceFile(String relativePath) throws IOException {'
    if anchor not in main:
        raise RuntimeError('workspaceFile anchor missing')
    main = main.replace(anchor, bridge_methods + anchor, 1)
main_path.write_text(main)

index_path = root / "assets/web/index.html"
index = index_path.read_text()
if 'Content-Security-Policy' not in index:
    csp = '''  <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:*; frame-src 'self' data: blob:; object-src 'none'; base-uri 'self'" />\n'''
    index = must_replace(index, '  <meta name="theme-color" content="#08070b" />\n', '  <meta name="theme-color" content="#08070b" />\n' + csp, 'CSP')
if './local-lab.mjs' not in index:
    index = must_replace(index, '  <script type="module" src="./stellar.mjs"></script>\n', '  <script type="module" src="./stellar.mjs"></script>\n  <script type="module" src="./local-lab.mjs"></script>\n', 'local lab module')
index_path.write_text(index)

stellar_path = root / "assets/web/stellar.mjs"
stellar = stellar_path.read_text()
stellar = stellar.replace("cynthia:'Cynthia'", "cynthia:'Interface'")
stellar = stellar.replace("const status=synthiaReady?'Cynthia online':`Cynthia ${synthiaError?'error':'starting'}`;",
                          "const status=synthiaReady?'Runtime online':`Runtime ${synthiaError?'error':'starting'}`;")
stellar = stellar.replace("participant:{id:'local-user',name:'You',purpose:'',preferredView:'now',birth:null}",
                          "participant:{id:'local-residence',name:'ADDRESS \u00b7 UNRESOLVED',purpose:'',preferredView:'now',birth:null}")
stellar = stellar.replace('<label>Name</label><input id="setupName"', '<label>Ontological address</label><input id="setupName"')
stellar = stellar.replace('<label>Name</label><input id="contactName" class="input" placeholder="Person or organization" />',
                          '<label>Ontological address</label><input id="contactName" class="input" placeholder="Planetary \u00b7 Dimension \u00b7 Gate \u00b7 Line \u00b7 Color \u00b7 Tone \u00b7 Base \u00b7 DMS \u00b7 Zodiac \u00b7 House" />')
stellar = stellar.replace('Add a person with an explicit ability/need', 'Add an ontological address with an explicit ability/need')
stellar = stellar.replace('<h2>People & possibilities</h2>', '<h2>Addresses & possibilities</h2>')
stellar = stellar.replace('<h2>Cynthia</h2><p class="muted">This panel calls the existing SynthiaUnit runtime. If that runtime throws, the error is shown instead of a canned answer.</p>',
                          '<h2>Interface</h2><p class="muted">This panel calls the existing local state-space runtime. If that runtime throws, the error is shown instead of a canned answer.</p>')
stellar = stellar.replace('placeholder="Talk to Cynthia about your actual situation..."', 'placeholder="Enter a state, task, observation, or question..."')
stellar = stellar.replace("<b>${synthiaReady?'SynthiaUnit':'offline'}</b>", "<b>${synthiaReady?'local runtime':'offline'}</b>")
stellar = stellar.replace('Open preserved Synthia shell', 'Open preserved runtime shell')
stellar = stellar.replace("||'You';db.participant.purpose", "||'ADDRESS \u00b7 UNRESOLVED';db.participant.purpose")

helper = r'''
function formatOntologicalAddress(c={}){
  const degree=(c.degree&&typeof c.degree==='object')
    ? [c.degree.band,c.degree.subdivision].filter(v=>v!==undefined&&v!==null).join(':')
    : (c.degree??'?');
  const arc=c.arcAxis?.arcUnit??c.arcsecond??c.arc??'?';
  return [
    `P${c.planetary??'?'}`,
    `D${c.dimension??'?'}`,
    `G${c.gate??'?'}`,
    `L${c.line??'?'}`,
    `C${c.color??'?'}`,
    `T${c.tone??'?'}`,
    `B${c.base??'?'}`,
    `${degree}\u00b0${c.minute??'?'}\u2032${c.second??'?'}\u2033`,
    `A${arc}`,
    `Z${c.zodiac??'?'}`,
    `H${c.house??'?'}`
  ].join(' \u00b7 ');
}
'''
if 'function formatOntologicalAddress' not in stellar:
    stellar = must_replace(stellar, "const now=()=>new Date().toISOString();\n", "const now=()=>new Date().toISOString();\n" + helper, 'address formatter')

old_chart = "chartResult=synthia.calculateBirthChart({name:db.participant.name,timestamp:ts,location:{latitude:lat,longitude:lon}});db.participant.birth={timestamp:ts,latitude:lat,longitude:lon};emit('CHART_CALCULATED'"
new_chart = "chartResult=synthia.calculateBirthChart({name:db.participant.name,timestamp:ts,location:{latitude:lat,longitude:lon}});db.participant.birth={timestamp:ts,latitude:lat,longitude:lon};const primaryCoordinate=chartResult?.canonical?.coordinates?.[0];if(primaryCoordinate)db.participant.name=formatOntologicalAddress(primaryCoordinate);emit('CHART_CALCULATED'"
if old_chart in stellar:
    stellar = stellar.replace(old_chart, new_chart, 1)
else:
    raise RuntimeError('chart address anchor missing')
stellar_path.write_text(stellar)

css_path = root / "assets/web/stellar.css"
css = css_path.read_text()
if '.toolchips' not in css:
    css += "\n.toolchips{display:flex;gap:6px;flex-wrap:wrap}.chip{padding:5px 8px;border:1px solid var(--line);border-radius:999px;font-size:9px;color:var(--muted);background:#0d0a11}\n"
css_path.write_text(css)

print("runtime patches applied")
