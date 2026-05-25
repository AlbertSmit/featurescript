#!/usr/bin/env node
/**
 * vscode-ext/build.js — Package the FeatureScript VS Code extension into a .vsix
 *
 * A .vsix is a zip file with this structure:
 *   [Content_Types].xml
 *   extension.vsixmanifest
 *   extension/
 *     package.json
 *     language-configuration.json
 *     syntaxes/featurescript.tmLanguage.json
 *     src/extension.js
 *     ../../lsp/src/  (LSP server files, referenced via relative path)
 *     ../../parser/src/ (parser files, referenced via relative path)
 *
 * This script creates a .vsix WITHOUT requiring `vsce` or any build tooling.
 * It copies all necessary files into a staging directory, writes the required
 * VSIX metadata files, and creates the zip.
 *
 * Usage:
 *   node vscode-ext/build.js
 *
 * Output:
 *   vscode-ext/featurescript-<version>.vsix
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Read extension manifest ──────────────────────────────────

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const { name, displayName, description, version, publisher, engines, categories, contributes } = pkg;
const vsCodeEngine = engines?.vscode ?? '^1.85.0';

console.log(`\n  📦 Building ${displayName} v${version}\n`);

// ── Staging directory ────────────────────────────────────────

const stageDir = join(__dirname, '.vsix-staging');
const extDir = join(stageDir, 'extension');

// Clean previous staging
execSync(`rm -rf ${stageDir}`);

// Create staging structure
mkdirSync(join(extDir, 'syntaxes'), { recursive: true });
mkdirSync(join(extDir, 'src'), { recursive: true });
mkdirSync(join(extDir, 'lsp', 'src'), { recursive: true });
mkdirSync(join(extDir, 'parser', 'src'), { recursive: true });
mkdirSync(join(extDir, 'linter', 'src'), { recursive: true });

// ── Copy extension files ─────────────────────────────────────

console.log('  ├─ Copying extension files...');

// Core extension files
cpSync(join(__dirname, 'language-configuration.json'), join(extDir, 'language-configuration.json'));
cpSync(join(__dirname, 'syntaxes', 'featurescript.tmLanguage.json'), join(extDir, 'syntaxes', 'featurescript.tmLanguage.json'));

// ── Copy parser, lsp, linter source ──────────────────────────

console.log('  ├─ Copying parser...');
for (const f of readdirSync(join(ROOT, 'parser', 'src'))) {
  cpSync(join(ROOT, 'parser', 'src', f), join(extDir, 'parser', 'src', f));
}
cpSync(join(ROOT, 'parser', 'package.json'), join(extDir, 'parser', 'package.json'));

console.log('  ├─ Copying LSP server...');
for (const f of readdirSync(join(ROOT, 'lsp', 'src'))) {
  cpSync(join(ROOT, 'lsp', 'src', f), join(extDir, 'lsp', 'src', f));
}
cpSync(join(ROOT, 'lsp', 'package.json'), join(extDir, 'lsp', 'package.json'));

console.log('  ├─ Copying linter...');
for (const f of readdirSync(join(ROOT, 'linter', 'src'))) {
  cpSync(join(ROOT, 'linter', 'src', f), join(extDir, 'linter', 'src', f));
}
if (existsSync(join(ROOT, 'linter', 'package.json'))) {
  cpSync(join(ROOT, 'linter', 'package.json'), join(extDir, 'linter', 'package.json'));
}

// ── Rewrite extension.js to use local paths ──────────────────

console.log('  ├─ Generating extension entry point...');

// The packaged extension needs paths relative to itself, not the dev layout.
// In the dev layout, the LSP server is at ../../lsp/src/server.js relative to src/.
// In the packaged layout, it's at ../lsp/src/server.js relative to src/.
const extensionSource = `const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const path = require('path');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join('lsp', 'src', 'server.js'));

  const serverOptions = {
    run:   { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'featurescript' }],
  };

  client = new LanguageClient('featurescript', 'FeatureScript', serverOptions, clientOptions);
  client.start();
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
`;

writeFileSync(join(extDir, 'src', 'extension.js'), extensionSource);

// ── Write packaged package.json ──────────────────────────────

console.log('  ├─ Writing package.json...');

const packagedPkg = {
  name,
  displayName,
  description,
  version,
  publisher,
  engines: { vscode: vsCodeEngine },
  categories,
  activationEvents: ['onLanguage:featurescript'],
  main: './src/extension.js',
  contributes,
  dependencies: pkg.dependencies ?? {},
};

writeFileSync(join(extDir, 'package.json'), JSON.stringify(packagedPkg, null, 2) + '\n');

// ── Install production dependencies ──────────────────────────

console.log('  ├─ Installing dependencies...');

// Only need vscode-languageclient — install it into the extension dir
try {
  execSync('pnpm install --prod --ignore-scripts 2>/dev/null || true', {
    cwd: extDir,
    stdio: 'pipe',
  });
} catch {
  console.log('  │  pnpm not in PATH, attempting fallback...');

  if (!existsSync(join(extDir, 'node_modules', 'vscode-languageclient'))) {
    console.log('  │  ⚠  vscode-languageclient not installed. Run:');
    console.log('  │     cd vscode-ext && pnpm install --prod');
    console.log('  │     Then re-run this script.');
  }
}

// ── Write VSIX metadata files ────────────────────────────────

console.log('  ├─ Writing VSIX metadata...');

// [Content_Types].xml — required by VSIX format
const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".xml" ContentType="application/xml"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>`;

writeFileSync(join(stageDir, '[Content_Types].xml'), contentTypes);

// extension.vsixmanifest
const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${name}" Version="${version}" Publisher="${publisher}"/>
    <DisplayName>${displayName}</DisplayName>
    <Description>${description}</Description>
    <Categories>${(categories || []).join(',')}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${vsCodeEngine}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value=""/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>`;

writeFileSync(join(stageDir, 'extension.vsixmanifest'), vsixManifest);

// ── Create zip ───────────────────────────────────────────────

console.log('  ├─ Creating .vsix archive...');

const outFile = join(__dirname, `featurescript-${version}.vsix`);

// Remove old vsix
try { execSync(`rm -f "${outFile}"`, { stdio: 'pipe' }); } catch {}

// Create zip from staging directory
execSync(`cd "${stageDir}" && zip -r -q "${outFile}" . -x ".*"`, { stdio: 'pipe' });

// ── Cleanup ──────────────────────────────────────────────────

execSync(`rm -rf "${stageDir}"`);

// ── Report ───────────────────────────────────────────────────

const stat = statSync(outFile);
const sizeKB = (stat.size / 1024).toFixed(1);

console.log('  └─ Done!\n');
console.log(`  📄 ${relative(ROOT, outFile)}  (${sizeKB} KB)\n`);
console.log('  Install with:');
console.log(`    code --install-extension ${relative(ROOT, outFile)}\n`);
