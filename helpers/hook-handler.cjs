#!/usr/bin/env node
/**
 * Dev-Standard Hook Handler (Cross-Platform)
 * Central dispatcher for all Claude Code hook events.
 * 0 external dependencies - Node.js built-ins only.
 *
 * Commands:
 *   route           - Route task to optimal agent + check quality gate
 *   pre-bash        - Validate command safety
 *   pre-edit        - TDD check: test exists before source?
 *   post-edit       - Record edit metrics
 *   post-bash       - Record command execution
 *   session-restore - Restore session + detect project
 *   session-end     - Persist session + consolidate
 *   pre-task        - Record task start
 *   post-task       - Record task completion
 *   status          - Report agent status
 *   notify          - Handle notifications
 *   compact-manual  - Pre-compact persistence
 *   compact-auto    - Auto-compact persistence
 */

const path = require('path');
const fs = require('fs');

const helpersDir = __dirname;

// Safe require - suppress console during module loading
function safeRequire(modulePath) {
  try {
    if (fs.existsSync(modulePath)) {
      const origLog = console.log;
      const origError = console.error;
      console.log = () => {};
      console.error = () => {};
      try {
        return require(modulePath);
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    }
  } catch (e) { /* silently fail */ }
  return null;
}

const router = safeRequire(path.join(helpersDir, 'router.js'));
const session = safeRequire(path.join(helpersDir, 'session.js'));
const memory = safeRequire(path.join(helpersDir, 'memory.js'));
const qualityGate = safeRequire(path.join(helpersDir, 'quality-gate.cjs'));
const projectDetector = safeRequire(path.join(helpersDir, 'project-detector.cjs'));

const [,, command, ...args] = process.argv;

// Read stdin with timeout (Claude Code sends hook data as JSON)
async function readStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(data);
    }, 500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
    process.stdin.resume();
  });
}

async function main() {
  let stdinData = '';
  try { stdinData = await readStdin(); } catch (e) { /* ignore */ }

  let hookInput = {};
  if (stdinData.trim()) {
    try { hookInput = JSON.parse(stdinData); } catch (e) { /* ignore */ }
  }

  const prompt = hookInput.prompt || hookInput.command || hookInput.toolInput
    || process.env.PROMPT || process.env.TOOL_INPUT_command || args.join(' ') || '';

  const handlers = {
    'route': () => {
      // Check quality gate (SPARC phase) before routing
      if (qualityGate && qualityGate.checkPhase) {
        try {
          const gateResult = qualityGate.checkPhase(prompt);
          if (gateResult && gateResult.message) {
            console.log(gateResult.message);
          }
        } catch (e) { /* non-fatal */ }
      }

      // Route task to optimal agent
      if (router && router.routeTask) {
        const result = router.routeTask(prompt);
        console.log(`[INFO] Task routed to: ${result.agent} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
        console.log(`[INFO] Reason: ${result.reason}`);
      }
    },

    'pre-bash': () => {
      const cmd = (hookInput.command || prompt).toLowerCase();
      const dangerous = ['rm -rf /', 'format c:', 'del /s /q c:\\', ':(){:|:&};:'];
      for (const d of dangerous) {
        if (cmd.includes(d)) {
          console.error(`[BLOCKED] Dangerous command detected: ${d}`);
          process.exit(1);
        }
      }
    },

    'pre-edit': () => {
      // TDD enforcement: check if test exists before editing source
      if (qualityGate && qualityGate.enforceTDD) {
        const filePath = hookInput.file_path
          || (hookInput.toolInput && hookInput.toolInput.file_path)
          || process.env.TOOL_INPUT_file_path || args[0] || '';
        if (filePath) {
          try {
            const result = qualityGate.enforceTDD(filePath);
            if (result && result.message) {
              console.log(result.message);
            }
          } catch (e) { /* non-fatal */ }
        }
      }
    },

    'post-edit': () => {
      if (session && session.metric) {
        try { session.metric('edits'); } catch (e) { /* no active session */ }
      }
    },

    'post-bash': () => {
      if (session && session.metric) {
        try { session.metric('commands'); } catch (e) { /* no active session */ }
      }
    },

    'session-restore': () => {
      // Detect project type on session start
      if (projectDetector && projectDetector.detect) {
        try {
          const detected = projectDetector.detect();
          if (detected && detected.projectType !== 'unknown') {
            console.log(`[DEV-STANDARD] Project: ${detected.projectType}${detected.framework ? ' (' + detected.framework + ')' : ''}`);
            console.log(`[DEV-STANDARD] Test: ${detected.testCommand} | Build: ${detected.buildCommand}`);
          }
        } catch (e) { /* non-fatal */ }
      }

      // Restore session
      if (session) {
        const existing = session.restore && session.restore();
        if (!existing) {
          session.start && session.start();
        }
      }

      // Show active quality gates
      if (qualityGate && qualityGate.getGatesStatus) {
        try {
          const status = qualityGate.getGatesStatus();
          if (status) console.log(status);
        } catch (e) { /* non-fatal */ }
      }
    },

    'session-end': () => {
      if (session && session.end) {
        session.end();
      }
    },

    'pre-task': () => {
      if (session && session.metric) {
        try { session.metric('tasks'); } catch (e) { /* no active session */ }
      }
      if (router && router.routeTask && prompt) {
        const result = router.routeTask(prompt);
        console.log(`[INFO] Task routed to: ${result.agent} (confidence: ${result.confidence})`);
      }
    },

    'post-task': () => {
      console.log('[OK] Task completed');
    },

    'status': () => {
      console.log('[OK] Agent active');
    },

    'notify': () => {
      // Handle notifications silently
    },

    'compact-manual': () => {
      if (session && session.end) session.end();
      console.log('[OK] Context persisted before compact');
    },

    'compact-auto': () => {
      if (session && session.end) session.end();
    },
  };

  if (command && handlers[command]) {
    try {
      handlers[command]();
    } catch (e) {
      console.log(`[WARN] Hook ${command} error: ${e.message}`);
    }
  } else if (command) {
    console.log(`[OK] Hook: ${command}`);
  } else {
    console.log('Usage: hook-handler.cjs <route|pre-bash|pre-edit|post-edit|session-restore|session-end|status>');
  }
}

// Hooks must ALWAYS exit 0
process.exitCode = 0;
main().catch((e) => {
  try { console.log(`[WARN] Hook handler error: ${e.message}`); } catch (_) {}
}).finally(() => {
  process.exit(0);
});
