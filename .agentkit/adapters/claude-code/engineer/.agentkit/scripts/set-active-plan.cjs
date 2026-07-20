#!/usr/bin/env node
/**
 * Update session state with new active plan
 *
 * Usage: node .agentkit/scripts/set-active-plan.cjs <plan-path>
 *
 * This script updates the session temp file with the new active plan path,
 * allowing subagents to receive the latest plan context via SubagentStart hook.
 *
 * The runtime-temporary session state is the source of truth for plan context
 * within a session. Environment variables are only the session-start snapshot.
 */

const path = require('path');
const { updateSessionState } = require('../hooks/lib/ck-config-utils.cjs');

const sessionId = process.env.CK_SESSION_ID;
const newPlan = process.argv[2];

if (!newPlan) {
  console.error('Error: Plan path required');
  console.log('Usage: node .agentkit/scripts/set-active-plan.cjs <plan-path>');
  console.log('Example: node .agentkit/scripts/set-active-plan.cjs plans/<timestamp>-feature-name');
  process.exit(1);
}

// Resolve to an absolute path to support brownfield/subdirectory workflows.
// When agent navigates away from session origin, relative paths become invalid
const absolutePlan = path.resolve(newPlan);

if (!sessionId) {
  console.warn('Warning: CK_SESSION_ID not set - session state will not persist');
  console.log(`Would set active plan to: ${absolutePlan}`);
  process.exit(0);
}

const success = updateSessionState(sessionId, (current) => ({
  ...current,
  activePlan: absolutePlan,
  timestamp: Date.now()
}));

if (success) {
  console.log(`Active plan set to: ${absolutePlan}`);
} else {
  console.error('Failed to update session state');
  process.exit(1);
}
