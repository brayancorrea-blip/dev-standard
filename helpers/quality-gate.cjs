#!/usr/bin/env node
/**
 * Dev-Standard Quality Gate
 * Enforces SPARC phase progression and TDD compliance.
 * 0 external dependencies.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Load dev-standard config
function loadConfig() {
  const configPath = path.join(PROJECT_ROOT, '.claude', 'dev-standard.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {
    gates: {
      specification: 'warn',
      pseudocode: 'warn',
      architecture: 'warn',
      refinement: 'warn',
      completion: 'block',
    },
    sourcePattern: 'src/**',
    testPattern: 'test/**',
  };
}

// Check which SPARC phase a feature is in based on existing documents
function checkPhase(prompt) {
  const config = loadConfig();
  if (!prompt) return null;

  // Extract feature name from prompt (simple heuristic)
  const featureMatch = prompt.match(/(?:implement|create|build|add|develop|feature)\s+["\']?([^"'\n]+)/i);
  if (!featureMatch) return null;

  const feature = featureMatch[1].trim().toLowerCase().replace(/\s+/g, '-').substring(0, 50);
  const docsRoot = PROJECT_ROOT;

  // Check document chain
  const hasPRD = fs.existsSync(path.join(docsRoot, 'docs', 'prd', `${feature}.md`))
    || fs.readdirSync(path.join(docsRoot, 'docs', 'prd')).length > 0
    || false;
  const hasArch = fs.existsSync(path.join(docsRoot, 'docs', 'architecture', `${feature}.md`));
  const hasReview = fs.existsSync(path.join(docsRoot, 'docs', 'review', `${feature}.md`));

  // Determine current phase
  let phase = 'specification';
  if (hasPRD) phase = 'pseudocode';
  if (hasArch) phase = 'refinement';
  if (hasReview) phase = 'completion';

  const gateLevel = config.gates[phase] || 'warn';
  if (gateLevel === 'off') return null;

  const phases = ['specification', 'pseudocode', 'architecture', 'refinement', 'completion'];
  const currentIdx = phases.indexOf(phase);
  const completed = currentIdx;
  const total = phases.length;

  let message = '';
  if (!hasPRD && gateLevel !== 'off') {
    message = `[QUALITY GATE] Feature "${feature}" has no PRD.\n`
      + `  Current phase: ${phase} (${completed}/${total} complete)\n`
      + `  Recommended: Create docs/prd/${feature}.md first\n`
      + `  Or use: /sparc:spec-pseudocode to generate requirements`;
    if (gateLevel === 'block') {
      message += '\n  [BLOCKED] Cannot proceed without PRD.';
    }
  }

  return message ? { phase, gateLevel, message, feature } : null;
}

// TDD enforcement: check if test file exists for a source file
function enforceTDD(filePath) {
  if (!filePath) return null;
  const config = loadConfig();
  const gateLevel = config.gates.refinement || 'warn';
  if (gateLevel === 'off') return null;

  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  // Skip if already a test file
  if (isTestFile(filePath)) return null;
  // Skip non-source files
  if (!isSourceFile(filePath)) return null;

  const testCandidates = getTestCandidates(filePath, base, ext, dir);

  for (const candidate of testCandidates) {
    if (fs.existsSync(candidate)) return null; // Test exists
  }

  const message = `[TDD] No test found for ${path.basename(filePath)}\n`
    + `  Expected one of:\n`
    + testCandidates.slice(0, 3).map(c => `    - ${path.relative(PROJECT_ROOT, c)}`).join('\n')
    + (gateLevel === 'block' ? '\n  [BLOCKED] Create test first (TDD: Red-Green-Refactor)' : '');

  return { message, gateLevel };
}

function isTestFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return name.includes('test') || name.includes('spec')
    || filePath.includes('__tests__') || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

function isSourceFile(filePath) {
  const sourceExts = ['.java', '.js', '.ts', '.tsx', '.jsx', '.go', '.py', '.rs', '.cs', '.rb', '.kt'];
  return sourceExts.includes(path.extname(filePath));
}

function getTestCandidates(filePath, base, ext, dir) {
  const candidates = [];

  // Java: src/main/java/X.java → src/test/java/XTest.java
  if (ext === '.java') {
    const testDir = dir.replace('/main/', '/test/');
    candidates.push(path.join(testDir, `${base}Test.java`));
    candidates.push(path.join(testDir, `${base}Tests.java`));
  }

  // TypeScript/JavaScript: X.ts → X.test.ts, X.spec.ts, __tests__/X.test.ts
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    candidates.push(path.join(dir, `${base}.test${ext}`));
    candidates.push(path.join(dir, `${base}.spec${ext}`));
    candidates.push(path.join(dir, '__tests__', `${base}.test${ext}`));
    // Also check .ts for .tsx files
    if (ext === '.tsx') {
      candidates.push(path.join(dir, `${base}.test.tsx`));
      candidates.push(path.join(dir, `${base}.test.ts`));
    }
  }

  // Go: X.go → X_test.go (same directory)
  if (ext === '.go') {
    candidates.push(path.join(dir, `${base}_test.go`));
  }

  // Python: X.py → tests/test_X.py, test_X.py
  if (ext === '.py') {
    candidates.push(path.join(dir, `test_${base}.py`));
    candidates.push(path.join(PROJECT_ROOT, 'tests', `test_${base}.py`));
    candidates.push(path.join(dir, '__tests__', `test_${base}.py`));
  }

  // Rust: src/X.rs → tests/X.rs
  if (ext === '.rs') {
    candidates.push(path.join(PROJECT_ROOT, 'tests', `${base}.rs`));
  }

  // C#: X.cs → XTests.cs
  if (ext === '.cs') {
    candidates.push(path.join(dir, `${base}Tests.cs`));
    const testDir = dir.replace(/([^/]+)$/, '$1.Tests');
    candidates.push(path.join(testDir, `${base}Tests.cs`));
  }

  return candidates;
}

// Get gates status summary
function getGatesStatus() {
  const config = loadConfig();
  const gates = config.gates || {};
  const parts = Object.entries(gates)
    .filter(([, v]) => v !== 'off')
    .map(([k, v]) => `${k}:${v}`)
    .join(' | ');
  return parts ? `[DEV-STANDARD] Gates: ${parts}` : null;
}

// CLI
if (require.main === module) {
  const [,, cmd, ...cliArgs] = process.argv;
  if (cmd === 'check') {
    const result = checkPhase(cliArgs.join(' '));
    if (result) console.log(result.message);
    else console.log('[OK] No quality gate issues');
  } else if (cmd === 'tdd') {
    const result = enforceTDD(cliArgs[0]);
    if (result) console.log(result.message);
    else console.log('[OK] Test file exists');
  } else if (cmd === 'status') {
    const status = getGatesStatus();
    console.log(status || '[OK] No gates configured');
  } else {
    console.log('Usage: quality-gate.cjs <check|tdd|status> [args]');
  }
}

module.exports = { checkPhase, enforceTDD, getGateAction: (phase) => loadConfig().gates[phase] || 'warn', getGatesStatus };
