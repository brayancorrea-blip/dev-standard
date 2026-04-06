#!/usr/bin/env node
/**
 * Dev-Standard Agent Router
 * Routes tasks to optimal agents based on patterns.
 * 0 external dependencies.
 */

const AGENT_CAPABILITIES = {
  // Core agents
  coder: ['code-generation', 'refactoring', 'debugging', 'implementation'],
  tester: ['unit-testing', 'integration-testing', 'coverage', 'test-generation'],
  reviewer: ['code-review', 'security-audit', 'quality-check', 'best-practices'],
  researcher: ['web-search', 'documentation', 'analysis', 'summarization'],
  planner: ['task-decomposition', 'estimation', 'prioritization', 'roadmap'],

  // Role agents (document-driven)
  'product-manager': ['requirements', 'prd', 'user-stories', 'acceptance-criteria'],
  architect: ['system-design', 'architecture', 'patterns', 'scalability', 'interfaces'],
  engineer: ['implementation', 'api', 'database', 'server', 'integration'],
  'qa-engineer': ['test-plan', 'test-strategy', 'regression', 'e2e-testing'],
  'tech-reviewer': ['code-review', 'performance', 'security', 'compliance'],

  // SPARC agents
  specification: ['requirements', 'prd', 'scope', 'constraints'],
  pseudocode: ['algorithm-design', 'logic', 'flow', 'data-structures'],
  architecture: ['contracts', 'interfaces', 'modules', 'dependencies'],
  refinement: ['tdd', 'red-green-refactor', 'optimization', 'edge-cases'],
  completion: ['review', 'documentation', 'release', 'deployment'],

  // Domain agents
  'backend-dev': ['api', 'database', 'server', 'authentication'],
  'frontend-dev': ['ui', 'react', 'css', 'components'],
  devops: ['ci-cd', 'docker', 'deployment', 'infrastructure'],
};

const TASK_PATTERNS = {
  // SPARC phases
  'spec|requirement|prd|user stor|acceptance': 'specification',
  'pseudocode|algorithm|logic flow|data structure': 'pseudocode',
  'architect|design system|interface|contract|module': 'architect',
  'tdd|red.green|refactor|test.first': 'refinement',
  'review|complete|release|deploy|merge': 'completion',

  // Core tasks
  'implement|create|build|add|write code|develop': 'coder',
  'test|spec|coverage|unit test|integration test': 'tester',
  'review|audit|check|validate|security': 'reviewer',
  'research|find|search|documentation|explore|investigate': 'researcher',
  'plan|decompose|estimate|prioritize|roadmap': 'planner',

  // Domain tasks
  'api|endpoint|server|backend|database|query': 'backend-dev',
  'ui|frontend|component|react|css|style|layout': 'frontend-dev',
  'deploy|docker|ci|cd|pipeline|infrastructure|k8s': 'devops',
};

function routeTask(task) {
  if (!task) return { agent: 'coder', confidence: 0.3, reason: 'No task provided' };
  const taskLower = task.toLowerCase();

  for (const [pattern, agent] of Object.entries(TASK_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(taskLower)) {
      return {
        agent,
        confidence: 0.8,
        reason: `Matched pattern: ${pattern}`,
      };
    }
  }

  return {
    agent: 'coder',
    confidence: 0.5,
    reason: 'Default routing - no specific pattern matched',
  };
}

// CLI
if (require.main === module) {
  const task = process.argv.slice(2).join(' ');
  if (task) {
    console.log(JSON.stringify(routeTask(task), null, 2));
  } else {
    console.log('Usage: router.js <task description>');
    console.log('\nAvailable agents:', Object.keys(AGENT_CAPABILITIES).join(', '));
  }
}

module.exports = { routeTask, AGENT_CAPABILITIES, TASK_PATTERNS };
