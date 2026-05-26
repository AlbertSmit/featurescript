/**
 * Oracle configuration loader.
 *
 * Resolution order:
 * 1. Environment variables (ONSHAPE_ACCESS_KEY, ONSHAPE_SECRET_KEY, ONSHAPE_DOCUMENT_ID, etc.)
 * 2. .oraclerc.json in the project root
 * 3. Defaults (Onshape production base URL)
 *
 * API keys are NEVER stored in config files — only document/element IDs.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const CONFIG_FILENAME = '.oraclerc.json';

/** @typedef {{ accessKey: string, secretKey: string, baseUrl: string, documentId: string, workspaceId: string, featureStudioId: string, partStudioId: string }} OracleConfig */

/**
 * Load oracle configuration from env + config file.
 * @returns {OracleConfig}
 */
export function loadConfig() {
  const fileConfig = loadFileConfig();

  const config = {
    accessKey: env('ONSHAPE_ACCESS_KEY', ''),
    secretKey: env('ONSHAPE_SECRET_KEY', ''),
    baseUrl: env('ONSHAPE_BASE_URL', fileConfig.baseUrl ?? 'https://cad.onshape.com'),
    documentId: env('ONSHAPE_DOCUMENT_ID', fileConfig.documentId ?? ''),
    workspaceId: env('ONSHAPE_WORKSPACE_ID', fileConfig.workspaceId ?? ''),
    featureStudioId: env('ONSHAPE_FEATURE_STUDIO_ID', fileConfig.featureStudioId ?? ''),
    partStudioId: env('ONSHAPE_PART_STUDIO_ID', fileConfig.partStudioId ?? ''),
  };

  return config;
}

/**
 * Validate that all required config values are present.
 * @param {OracleConfig} config
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateConfig(config) {
  const required = ['accessKey', 'secretKey', 'documentId', 'workspaceId', 'featureStudioId'];
  const missing = required.filter(key => !config[key]);
  return { valid: missing.length === 0, missing };
}

/**
 * @returns {Partial<OracleConfig>}
 */
function loadFileConfig() {
  const configPath = resolve(PROJECT_ROOT, CONFIG_FILENAME);
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function env(key, fallback) {
  return process.env[key] ?? fallback;
}
