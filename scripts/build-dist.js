const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const distRoot = path.join(root, "dist");
const entryPath = path.join(sourceRoot, "index.js");
const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const importPattern = /^import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+\.js)['"]\s*;?\s*$/gm;

function readText(filename) {
    return fs.readFileSync(filename, "utf8").replace(/\r\n/g, "\n").trim();
}

function writeTextIfChanged(filename, text) {
    const normalized = text.replace(/\r\n/g, "\n");

    if (fs.existsSync(filename) && readText(filename) === normalized.trim()) {
        return false;
    }

    fs.writeFileSync(filename, normalized, "utf8");
    return true;
}

function toSourcePath(filename) {
    return path.relative(sourceRoot, filename).replace(/\\/g, "/");
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMarkedBlock(text, marker, content, filename, style = "html") {
    const indent = style === "line" ? "    " : "";
    const start = style === "line"
        ? `${indent}// ${marker}:start`
        : `<!-- ${marker}:start -->`;
    const end = style === "line"
        ? `${indent}// ${marker}:end`
        : `<!-- ${marker}:end -->`;
    const pattern = new RegExp(
        `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
        "m"
    );

    if (!pattern.test(text)) {
        throw new Error(`Could not find ${marker} marker block in ${filename}.`);
    }

    return text.replace(pattern, () => `${start}\n${content}\n${end}`);
}

function syncVersionSource(repriseVersion) {
    const versionPath = path.join(sourceRoot, "version.js");
    const versionText = fs.readFileSync(versionPath, "utf8").replace(/\r\n/g, "\n");
    const nextVersionText = replaceMarkedBlock(
        versionText,
        "timeline-reprise-version",
        `    version: ${JSON.stringify(repriseVersion)},`,
        "src/version.js",
        "line"
    );

    return writeTextIfChanged(versionPath, nextVersionText);
}

function syncReadmeVersions(repriseVersion) {
    const readmePath = path.join(root, "README.md");
    let readme = fs.readFileSync(readmePath, "utf8").replace(/\r\n/g, "\n");

    readme = replaceMarkedBlock(
        readme,
        "timeline-reprise-version",
        `Version: \`v${repriseVersion}\``,
        "README.md"
    );
    readme = replaceMarkedBlock(
        readme,
        "timeline-reprise-install",
        [
            "```json",
            `"timeline-reprise": "github:DataChord-com-au/TimelineReprise#v${repriseVersion}"`,
            "```"
        ].join("\n"),
        "README.md"
    );

    return writeTextIfChanged(readmePath, readme);
}

function syncDocsVersions(repriseVersion) {
    const docsPath = path.join(root, "docs", "TimelineReprise.md");
    const docs = fs.readFileSync(docsPath, "utf8").replace(/\r\n/g, "\n");
    const nextDocs = replaceMarkedBlock(
        docs,
        "timeline-reprise-version",
        `Version: \`v${repriseVersion}\``,
        "docs/TimelineReprise.md"
    );

    return writeTextIfChanged(docsPath, nextDocs);
}

function resolveSourcePath(fromFile, specifier) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        throw new Error(`Only relative source imports are supported: ${specifier}`);
    }

    const filename = path.resolve(path.dirname(fromFile), specifier);
    const sourcePrefix = sourceRoot + path.sep;

    if (filename !== sourceRoot && !filename.startsWith(sourcePrefix)) {
        throw new Error(`Source path escapes src/: ${specifier}`);
    }
    if (!fs.existsSync(filename)) {
        throw new Error(`Distribution source does not exist: ${filename}`);
    }

    return {
        path: toSourcePath(filename),
        filename
    };
}

function readScriptEntries(entryText) {
    const entries = [];
    const seen = new Set();

    function visit(fromFile, sourceText) {
        for (const match of sourceText.matchAll(importPattern)) {
            const entry = resolveSourcePath(fromFile, match[1]);

            if (seen.has(entry.filename)) continue;

            seen.add(entry.filename);
            visit(entry.filename, readText(entry.filename));
            entries.push(entry);
        }
    }

    visit(entryPath, entryText);

    if (entries.length === 0) {
        throw new Error(`No JavaScript imports found in ${entryPath}`);
    }

    return entries;
}

function readBrowserExportNames(entryText) {
    const exportPattern = /^export\s*\{\s*([^}]+)\s*\}\s*;?\s*$/gm;
    const names = [];

    for (const match of entryText.matchAll(exportPattern)) {
        for (const part of match[1].split(",")) {
            const trimmed = part.trim();
            if (trimmed === "") continue;

            const alias = trimmed.match(/^(.*?)\s+as\s+(.*?)$/);
            names.push((alias ? alias[2] : trimmed).trim());
        }
    }

    return names;
}

function readStylesheetEntries(entryText) {
    const match = entryText.match(
        /export\s+const\s+stylesheets\s*=\s*(\[[\s\S]*?\])\s*;/m
    );

    if (!match) {
        throw new Error(`No stylesheets export found in ${entryPath}`);
    }

    const stylesheets = JSON.parse(match[1]);

    if (!Array.isArray(stylesheets) || stylesheets.length === 0) {
        throw new Error("The stylesheets export must be a non-empty array");
    }

    return stylesheets.map(specifier => {
        if (typeof specifier !== "string" || !specifier.endsWith(".css")) {
            throw new Error(`Invalid stylesheet source: ${specifier}`);
        }

        return resolveSourcePath(entryPath, specifier);
    });
}

function toBrowserScript(source) {
    return source
        .replace(importPattern, "")
        .replace(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm, "class $1")
        .replace(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm, "const $1")
        .replace(/^export\s+function\s+([A-Za-z_$][\w$]*)/gm, "function $1")
        .replace(/^export\s*\{\s*[^}]+\s*\}\s*;?\s*$/gm, "")
        .trim();
}

function browserExportBlock(names) {
    if (names.length === 0) return "";

    return [
        "(function () {",
        "    const root = typeof window !== \"undefined\" ? window : globalThis;",
        "    if (!root.Timeline) return;",
        ...names.map(name => `    root.Timeline.${name} = ${name};`),
        "}());"
    ].join("\n");
}

function combineText(entries) {
    return [
        makeBanner(),
        ...entries.map(entry => `/* ${entry.path} */\n${readText(entry.filename)}`)
    ].join("\n\n") + "\n";
}

function combineScripts(entries, browserExports = []) {
    const parts = [
        makeBanner(),
        ...entries.map(entry =>
            `/* ${entry.path} */\n${toBrowserScript(readText(entry.filename))}`
        )
    ];
    const exportBlock = browserExportBlock(browserExports);

    if (exportBlock !== "") parts.push(exportBlock);

    return [
        ...parts
    ].join("\n\n") + "\n";
}

function copyCssAssets(cssEntries) {
    const copiedTargets = new Map();
    const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

    for (const entry of cssEntries) {
        const css = readText(entry.filename);

        for (const match of css.matchAll(urlPattern)) {
            const assetPath = match[2];
            if (/^(?:[a-z]+:|\/|#)/i.test(assetPath)) continue;

            const source = path.resolve(path.dirname(entry.filename), assetPath);
            const target = path.resolve(distRoot, assetPath);
            const distPrefix = distRoot + path.sep;

            if (!target.startsWith(distPrefix)) {
                throw new Error(`CSS asset escapes dist/: ${assetPath}`);
            }
            if (!fs.existsSync(source)) {
                throw new Error(`CSS asset does not exist: ${source}`);
            }

            const previousSource = copiedTargets.get(target);
            if (previousSource != null) {
                if (!fs.readFileSync(previousSource).equals(fs.readFileSync(source))) {
                    throw new Error(`Conflicting CSS assets target ${target}`);
                }
                continue;
            }

            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(source, target);
            copiedTargets.set(target, source);
        }
    }

    return copiedTargets.size;
}

function makeBanner() {
    return `/*! Timeline Reprise v${packageJson.version} | Generated by npm run build */`;
}

const versionSourceChanged = syncVersionSource(packageJson.version);
const readmeChanged = syncReadmeVersions(packageJson.version);
const docsChanged = syncDocsVersions(packageJson.version);
const entryText = readText(entryPath);
const scriptEntries = readScriptEntries(entryText);
const browserExports = readBrowserExportNames(entryText);
const cssEntries = readStylesheetEntries(entryText);
const js = combineScripts(scriptEntries, browserExports);
const css = combineText(cssEntries);

new vm.Script(js, { filename: "dist/timeline-reprise.js" });

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });
fs.writeFileSync(path.join(distRoot, "timeline-reprise.js"), js, "utf8");
fs.writeFileSync(path.join(distRoot, "timeline-reprise.css"), css, "utf8");

const assetCount = copyCssAssets(cssEntries);

console.log(
    `Built dist/timeline-reprise.js, dist/timeline-reprise.css, and ${assetCount} media assets.`
);
if (versionSourceChanged) console.log("Updated src/version.js.");
if (readmeChanged) console.log("Updated README.md versions.");
if (docsChanged) console.log("Updated docs/TimelineReprise.md version.");
