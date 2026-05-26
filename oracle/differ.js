/**
 * Diagnostic Differ
 *
 * Compares local parser/linter diagnostics against Onshape's ground-truth
 * compiler output and classifies each diagnostic into one of:
 *
 * - True Positive:  both agree on the error
 * - True Negative:  both agree it's clean
 * - False Positive: local reports error, Onshape says clean
 * - False Negative: Onshape reports error, local missed it
 */

/**
 * @typedef {Object} LocalDiagnostic
 * @property {number} line
 * @property {number} [column]
 * @property {'error'|'warning'} severity
 * @property {string} message
 * @property {'parse'|'lint'} source
 */

/**
 * @typedef {Object} DiffResult
 * @property {MatchedDiagnostic[]} truePositives
 * @property {import('./client.js').OracleDiagnostic[]} falseNegatives
 * @property {LocalDiagnostic[]} falsePositives
 * @property {{ local: LocalDiagnostic, oracle: import('./client.js').OracleDiagnostic }[]} mismatches
 * @property {number} accuracy - 0–1 ratio of correct classifications
 */

/**
 * @typedef {Object} MatchedDiagnostic
 * @property {LocalDiagnostic} local
 * @property {import('./client.js').OracleDiagnostic} oracle
 * @property {number} confidence - 0–1 match confidence
 */

const LINE_PROXIMITY_THRESHOLD = 3;
const MIN_SIMILARITY_SCORE = 0.3;

/**
 * Compare local diagnostics against oracle (Onshape) diagnostics.
 *
 * @param {LocalDiagnostic[]} localDiags
 * @param {import('./client.js').OracleDiagnostic[]} oracleDiags
 * @returns {DiffResult}
 */
export function compareDiagnostics(localDiags, oracleDiags) {
  const matched = new Set();
  const oracleMatched = new Set();

  /** @type {MatchedDiagnostic[]} */
  const truePositives = [];
  /** @type {{ local: LocalDiagnostic, oracle: import('./client.js').OracleDiagnostic }[]} */
  const mismatches = [];

  // Pass 1: Find matches between local and oracle diagnostics
  for (let i = 0; i < localDiags.length; i++) {
    const local = localDiags[i];
    let bestMatch = null;
    let bestScore = 0;

    for (let j = 0; j < oracleDiags.length; j++) {
      if (oracleMatched.has(j)) continue;

      const oracle = oracleDiags[j];
      const score = matchScore(local, oracle);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { index: j, oracle };
      }
    }

    if (bestMatch && bestScore >= MIN_SIMILARITY_SCORE) {
      matched.add(i);
      oracleMatched.add(bestMatch.index);
      truePositives.push({
        local,
        oracle: bestMatch.oracle,
        confidence: bestScore,
      });
    }
  }

  // Pass 2: Unmatched locals = false positives (we flagged, Onshape didn't)
  const falsePositives = localDiags.filter((_, i) => !matched.has(i));

  // Pass 3: Unmatched oracle = false negatives (Onshape flagged, we missed)
  const falseNegatives = oracleDiags.filter((_, i) => !oracleMatched.has(i));

  // Accuracy: correct / total unique diagnostics
  const totalUnique = truePositives.length + falsePositives.length + falseNegatives.length;
  const accuracy = totalUnique === 0 ? 1.0 : truePositives.length / totalUnique;

  return { truePositives, falseNegatives, falsePositives, mismatches, accuracy };
}

/**
 * Compute a match score between a local and oracle diagnostic.
 * Higher = better match. Range 0–1.
 *
 * Factors:
 * - Line proximity (40% weight)
 * - Severity match (20% weight)
 * - Message similarity (40% weight)
 *
 * @param {LocalDiagnostic} local
 * @param {import('./client.js').OracleDiagnostic} oracle
 * @returns {number}
 */
function matchScore(local, oracle) {
  // Line proximity: 1.0 if same line, decaying within threshold, 0 if beyond
  const lineDelta = Math.abs(local.line - oracle.line);
  const lineScore = lineDelta <= LINE_PROXIMITY_THRESHOLD
    ? 1.0 - (lineDelta / LINE_PROXIMITY_THRESHOLD) * 0.5
    : 0;

  // Severity: 1.0 if same, 0.5 if error↔warning, 0 otherwise
  const severityScore = local.severity === oracle.severity
    ? 1.0
    : (isErrorLike(local.severity) && isErrorLike(oracle.severity) ? 0.5 : 0);

  // Message similarity: keyword overlap
  const msgScore = messageSimilarity(local.message, oracle.message);

  return lineScore * 0.4 + severityScore * 0.2 + msgScore * 0.4;
}

/**
 * Compute keyword-based similarity between two diagnostic messages.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1
 */
function messageSimilarity(a, b) {
  const wordsA = extractKeywords(a);
  const wordsB = extractKeywords(b);

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // Jaccard similarity
  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap / union;
}

/**
 * Extract meaningful keywords from a diagnostic message.
 * Strips common noise words and normalizes.
 *
 * @param {string} message
 * @returns {Set<string>}
 */
function extractKeywords(message) {
  const noise = new Set([
    'a', 'an', 'the', 'is', 'was', 'at', 'in', 'of', 'to', 'for',
    'and', 'or', 'but', 'not', 'this', 'that', 'with', 'from',
    'expected', 'found', 'unexpected', 'line', 'column', 'error', 'warning',
  ]);

  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !noise.has(w));

  return new Set(words);
}

/** @param {string} severity */
function isErrorLike(severity) {
  return severity === 'error' || severity === 'warning';
}

/**
 * Generate a human-readable summary of a diff result.
 * @param {DiffResult} diff
 * @returns {string}
 */
export function formatDiffSummary(diff) {
  const lines = [];

  if (diff.truePositives.length) {
    lines.push(`  ✅ True positives: ${diff.truePositives.length}`);
    for (const tp of diff.truePositives) {
      lines.push(`     L${tp.local.line}: "${truncate(tp.local.message, 60)}" (${pct(tp.confidence)} match)`);
    }
  }

  if (diff.falsePositives.length) {
    lines.push(`  ⚡ False positives (local too strict): ${diff.falsePositives.length}`);
    for (const fp of diff.falsePositives) {
      lines.push(`     L${fp.line}: "${truncate(fp.message, 60)}"`);
    }
  }

  if (diff.falseNegatives.length) {
    lines.push(`  🔴 False negatives (missed by local): ${diff.falseNegatives.length}`);
    for (const fn of diff.falseNegatives) {
      lines.push(`     L${fn.line}: "${truncate(fn.message, 60)}"`);
    }
  }

  if (!lines.length) {
    lines.push('  ✅ Both agree: no issues');
  }

  lines.push(`  📊 Accuracy: ${pct(diff.accuracy)}`);
  return lines.join('\n');
}

/** @param {string} s @param {number} n */
function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/** @param {number} n */
function pct(n) {
  return `${(n * 100).toFixed(0)}%`;
}
