#!/usr/bin/env node
/**
 * Auto Memory Bridge Hook
 *
 * Bridges ruflo memory system with Claude Code session lifecycle.
 * Called by settings.json SessionStart/SessionEnd/Stop hooks.
 *
 * Usage:
 *   node auto-memory-hook.mjs import   # SessionStart: import memory
 *   node auto-memory-hook.mjs sync     # SessionEnd/Stop: sync insights
 *   node auto-memory-hook.mjs status   # Show bridge status
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const DATA_DIR = join(PROJECT_ROOT, '.claude-flow', 'data');
const STORE_PATH = join(DATA_DIR, 'auto-memory-store.json');

const CYAN = '\x1b[0;36m';
const GREEN = '\x1b[0;32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const log = (msg) => console.log(`${CYAN}[AutoMemory] ${msg}${RESET}`);
const success = (msg) => console.log(`${GREEN}[AutoMemory] ${msg}${RESET}`);
const dim = (msg) => console.log(`  ${DIM}${msg}${RESET}`);

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ============================================================================
// Simple JSON File Backend (0 external dependencies)
// ============================================================================

class JsonFileBackend {
  constructor(filePath) {
    this.filePath = filePath;
    this.entries = new Map();
  }

  async initialize() {
    if (existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        if (Array.isArray(data)) {
          for (const entry of data) this.entries.set(entry.id, entry);
        }
      } catch { /* start fresh */ }
    }
  }

  async shutdown() { this._persist(); }
  async store(entry) { this.entries.set(entry.id, entry); this._persist(); }
  async get(id) { return this.entries.get(id) ?? null; }

  async query(opts) {
    let results = [...this.entries.values()];
    if (opts?.namespace) results = results.filter(e => e.namespace === opts.namespace);
    if (opts?.type) results = results.filter(e => e.type === opts.type);
    if (opts?.limit) results = results.slice(0, opts.limit);
    return results;
  }

  async count() { return this.entries.size; }

  _persist() {
    try {
      writeFileSync(this.filePath, JSON.stringify([...this.entries.values()], null, 2), 'utf-8');
    } catch { /* best effort */ }
  }
}

// ============================================================================
// Try to load ruflo memory package (optional - graceful degradation)
// ============================================================================

async function loadMemoryPackage() {
  // Strategy 1: createRequire for CJS-style resolution
  try {
    const { createRequire } = await import('module');
    const require = createRequire(join(PROJECT_ROOT, 'package.json'));
    return require('@claude-flow/memory');
  } catch { /* fall through */ }

  // Strategy 2: ESM import
  try {
    return await import('@claude-flow/memory');
  } catch { /* fall through */ }

  // Strategy 3: Walk up looking for @claude-flow/memory
  let searchDir = PROJECT_ROOT;
  const { parse } = await import('path');
  while (searchDir !== parse(searchDir).root) {
    const candidate = join(searchDir, 'node_modules', '@claude-flow', 'memory', 'dist', 'index.js');
    if (existsSync(candidate)) {
      try { return await import(`file://${candidate}`); } catch { /* fall through */ }
    }
    searchDir = dirname(searchDir);
  }

  return null;
}

// ============================================================================
// Commands
// ============================================================================

async function doImport() {
  log('Importing memory...');

  const backend = new JsonFileBackend(STORE_PATH);
  await backend.initialize();

  const memPkg = await loadMemoryPackage();
  if (memPkg?.AutoMemoryBridge) {
    try {
      const bridge = new memPkg.AutoMemoryBridge(backend, {
        workingDir: PROJECT_ROOT,
        syncMode: 'on-session-end',
      });
      const result = await bridge.importFromAutoMemory();
      success(`Imported ${result.imported} entries (${result.skipped} skipped)`);
    } catch (err) {
      dim(`Bridge import skipped: ${err.message}`);
    }
  } else {
    // Fallback: just ensure backend is initialized
    const count = await backend.count();
    success(`Memory loaded: ${count} entries (JSON backend)`);
  }

  await backend.shutdown();
}

async function doSync() {
  log('Syncing insights...');

  const backend = new JsonFileBackend(STORE_PATH);
  await backend.initialize();

  const entryCount = await backend.count();
  if (entryCount === 0) {
    dim('No entries to sync');
    await backend.shutdown();
    return;
  }

  const memPkg = await loadMemoryPackage();
  if (memPkg?.AutoMemoryBridge) {
    try {
      const bridge = new memPkg.AutoMemoryBridge(backend, {
        workingDir: PROJECT_ROOT,
        syncMode: 'on-session-end',
      });
      const syncResult = await bridge.syncToAutoMemory();
      success(`Synced ${syncResult.synced} entries`);
      if (bridge.curateIndex) await bridge.curateIndex();
      if (bridge.destroy) bridge.destroy();
    } catch (err) {
      dim(`Bridge sync skipped: ${err.message}`);
    }
  } else {
    success(`${entryCount} entries persisted (JSON backend)`);
  }

  await backend.shutdown();
}

async function doStatus() {
  const memPkg = await loadMemoryPackage();

  console.log('\n=== Auto Memory Bridge Status ===\n');
  console.log(`  Package:  ${memPkg ? 'Available' : 'Not found (using JSON fallback)'}`);
  console.log(`  Store:    ${existsSync(STORE_PATH) ? STORE_PATH : 'Not initialized'}`);

  if (existsSync(STORE_PATH)) {
    try {
      const data = JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
      console.log(`  Entries:  ${Array.isArray(data) ? data.length : 0}`);
    } catch { /* ignore */ }
  }
  console.log('');
}

// ============================================================================
// Main
// ============================================================================

const command = process.argv[2] || 'status';

process.on('unhandledRejection', () => {});

try {
  switch (command) {
    case 'import': await doImport(); break;
    case 'sync': await doSync(); break;
    case 'status': await doStatus(); break;
    default:
      console.log('Usage: auto-memory-hook.mjs <import|sync|status>');
      break;
  }
} catch (err) {
  try { dim(`Error (non-critical): ${err.message}`); } catch (_) {}
}
process.exit(0);
