#!/usr/bin/env node

/**
 * Oracle Setup — Creates a scratch Onshape document for validation
 *
 * This script:
 * 1. Creates a new document called "FeatureScript Oracle Scratch"
 * 2. Finds/creates a Feature Studio tab
 * 3. Writes the IDs to .oraclerc.json
 *
 * Usage:
 *   ONSHAPE_ACCESS_KEY="..." ONSHAPE_SECRET_KEY="..." node oracle/setup.js
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const BASE_URL = process.env.ONSHAPE_BASE_URL || 'https://cad.onshape.com';
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('❌ Set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY first.');
  process.exit(1);
}

const credentials = Buffer.from(`${ACCESS_KEY}:${SECRET_KEY}`).toString('base64');

async function api(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json;charset=UTF-8',
      'Authorization': `Basic ${credentials}`,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  if (!res.ok) {
    console.error(`❌ API ${method} ${path} → ${res.status}`);
    console.error(text);
    process.exit(1);
  }

  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('\n  🔧 Oracle Setup\n');

  // Step 1: Create a new document
  console.log('  ├─ Creating scratch document...');
  const doc = await api('POST', '/api/v6/documents', {
    name: 'FeatureScript Oracle Scratch',
    description: 'Auto-created by oracle/setup.js — used for FeatureScript validation feedback loop',
    isPublic: true,
  });

  const documentId = doc.id;
  const workspaceId = doc.defaultWorkspace?.id;

  if (!documentId || !workspaceId) {
    console.error('❌ Document creation returned unexpected shape:', JSON.stringify(doc, null, 2));
    process.exit(1);
  }

  console.log(`  │  Document: ${documentId}`);
  console.log(`  │  Workspace: ${workspaceId}`);

  // Step 2: List elements to find the default Part Studio
  console.log('  ├─ Finding Part Studio...');
  const elements = await api('GET', `/api/v6/documents/d/${documentId}/w/${workspaceId}/elements`);

  const partStudio = elements.find(e => e.type === 'PARTSTUDIO' || e.elementType === 'PARTSTUDIO');
  const partStudioId = partStudio?.id ?? '';

  if (partStudioId) {
    console.log(`  │  Part Studio: ${partStudioId}`);
  } else {
    console.log('  │  ⚠ No Part Studio found (non-critical — only needed for runtime validation)');
  }

  // Step 3: Create a Feature Studio tab
  console.log('  ├─ Creating Feature Studio...');
  const fsTab = await api('POST', `/api/v6/featurestudios/d/${documentId}/w/${workspaceId}`, {
    name: 'Oracle Scratch FS',
  });

  const featureStudioId = fsTab.id;

  if (!featureStudioId) {
    console.error('❌ Feature Studio creation returned unexpected shape:', JSON.stringify(fsTab, null, 2));
    process.exit(1);
  }

  console.log(`  │  Feature Studio: ${featureStudioId}`);

  // Step 4: Write .oraclerc.json
  const config = {
    baseUrl: BASE_URL,
    documentId,
    workspaceId,
    featureStudioId,
    partStudioId,
  };

  const configPath = resolve(PROJECT_ROOT, '.oraclerc.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`  ├─ Wrote ${configPath}`);

  // Step 5: Print the document URL
  const docUrl = `${BASE_URL}/documents/${documentId}/w/${workspaceId}`;
  console.log(`  │`);
  console.log(`  │  📄 Document URL:`);
  console.log(`  │  ${docUrl}`);
  console.log(`  │`);
  console.log(`  └─ Done! Run: node oracle/cli.js corpus examples\n`);
}

main().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
