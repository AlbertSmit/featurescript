#!/usr/bin/env node

/**
 * Debug script v2 — focuses on finding where Onshape puts compilation notices.
 * Tries multiple endpoints and logs only the diagnostic-relevant fields.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '.oraclerc.json'), 'utf-8'));
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE = config.baseUrl || 'https://cad.onshape.com';
const credentials = Buffer.from(`${ACCESS_KEY}:${SECRET_KEY}`).toString('base64');
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json;charset=UTF-8',
  'Authorization': `Basic ${credentials}`,
};

const file = process.argv[2] || 'examples/shoe-sole-blank.fs';
const source = readFileSync(resolve(file), 'utf-8');
const { documentId: did, workspaceId: wid, featureStudioId: eid, partStudioId: psid } = config;

async function tryEndpoint(label, method, path, body) {
  console.log(`\n── ${label} ──`);
  try {
    const opts = { method, headers: { ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    console.log(`  Status: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const t = await res.text();
      console.log(`  Error: ${t.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    // Print keys and any notice/error/warning fields
    console.log(`  Keys: ${Object.keys(data).join(', ')}`);
    
    // Search recursively for anything that looks like notices
    const found = findDiagnosticFields(data);
    if (found.length) {
      console.log(`  📍 Found diagnostic-like fields:`);
      for (const { path, value } of found) {
        console.log(`     ${path}: ${JSON.stringify(value).slice(0, 300)}`);
      }
    } else {
      console.log(`  (no diagnostic fields found)`);
    }
    return data;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

function findDiagnosticFields(obj, prefix = '', results = []) {
  if (!obj || typeof obj !== 'object') return results;
  
  const diagnosticKeys = [
    'notices', 'errors', 'warnings', 'diagnostics', 'messages',
    'compileErrors', 'parseErrors', 'buildErrors', 'failures',
    'featureStatus', 'status', 'noticeMessage', 'errorMessage',
    'compilationError', 'sourceError', 'analysisResult',
  ];
  
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (diagnosticKeys.includes(key) && value != null) {
      results.push({ path, value });
    }
    
    // Don't recurse into 'contents' (it's just the source code string)
    if (key === 'contents' && typeof value === 'string') continue;
    
    if (Array.isArray(value)) {
      value.forEach((item, i) => findDiagnosticFields(item, `${path}[${i}]`, results));
    } else if (typeof value === 'object' && value !== null) {
      findDiagnosticFields(value, path, results);
    }
  }
  return results;
}

console.log(`\n📄 File: ${file} (${source.length} chars)`);
console.log(`   Doc: ${did} | WS: ${wid} | FS: ${eid} | PS: ${psid}`);

// 1. POST to update contents
const pushData = await tryEndpoint(
  '1. POST updateFeatureStudioContents',
  'POST', `/api/v6/featurestudios/d/${did}/w/${wid}/e/${eid}`,
  { contents: source }
);

// Wait for compilation
console.log('\n⏳ Waiting 3s for compilation...');
await new Promise(r => setTimeout(r, 3000));

// 2. GET feature studio contents
await tryEndpoint(
  '2. GET featurestudio contents',
  'GET', `/api/v6/featurestudios/d/${did}/w/${wid}/e/${eid}`
);

// 3. Try to get the feature specs (what features are defined in this FS)
// This is likely the endpoint that shows compilation notices
for (const suffix of ['/specs', '/references', '/features']) {
  await tryEndpoint(
    `3. GET featurestudio${suffix}`,
    'GET', `/api/v6/featurestudios/d/${did}/w/${wid}/e/${eid}${suffix}`
  );
}

// 4. If we have a Part Studio, try getting features from there
if (psid) {
  await tryEndpoint(
    '4. GET partstudio features',
    'GET', `/api/v6/partstudios/d/${did}/w/${wid}/e/${psid}/features`
  );
}

// 5. Try the v9 (latest) API too
await tryEndpoint(
  '5. POST updateFeatureStudio (v9)',
  'POST', `/api/v9/featurestudios/d/${did}/w/${wid}/e/${eid}`,
  { contents: source }
);

// 6. Also try fetching the Feature Studio with query params
await tryEndpoint(
  '6. GET featurestudio with params',
  'GET', `/api/v6/featurestudios/d/${did}/w/${wid}/e/${eid}?includeNotices=true`
);

console.log('\n✅ Done\n');
