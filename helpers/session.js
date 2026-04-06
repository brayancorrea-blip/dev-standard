#!/usr/bin/env node
/**
 * Dev-Standard Session Manager
 * Handles session lifecycle: start, restore, end.
 * 0 external dependencies.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SESSION_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'current.json');

const commands = {
  start: () => {
    const sessionId = `session-${Date.now()}`;
    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      cwd: PROJECT_ROOT,
      context: {},
      metrics: { edits: 0, commands: 0, tasks: 0, errors: 0 },
    };
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`Session started: ${sessionId}`);
    return session;
  },

  restore: () => {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.restoredAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`Session restored: ${session.id}`);
    return session;
  },

  end: () => {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.endedAt = new Date().toISOString();
    session.duration = Date.now() - new Date(session.startedAt).getTime();
    const archivePath = path.join(SESSION_DIR, `${session.id}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(session, null, 2));
    fs.unlinkSync(SESSION_FILE);
    console.log(`Session ended: ${session.id} (${Math.round(session.duration / 1000 / 60)} min)`);
    return session;
  },

  status: () => {
    if (!fs.existsSync(SESSION_FILE)) { console.log('No active session'); return null; }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    const dur = Date.now() - new Date(session.startedAt).getTime();
    console.log(`Session: ${session.id} | ${Math.round(dur / 1000 / 60)} min | ${JSON.stringify(session.metrics)}`);
    return session;
  },

  update: (key, value) => {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.context[key] = value;
    session.updatedAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    return session;
  },

  get: (key) => {
    if (!fs.existsSync(SESSION_FILE)) return null;
    try {
      const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      return key ? (session.context || {})[key] : session.context;
    } catch { return null; }
  },

  metric: (name) => {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (session.metrics[name] !== undefined) {
      session.metrics[name]++;
      fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    }
    return session;
  },
};

// CLI
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  if (command && commands[command]) {
    commands[command](...args);
  } else {
    console.log('Usage: session.js <start|restore|end|status|update|metric> [args]');
  }
}

module.exports = commands;
