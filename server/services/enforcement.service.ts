/**
 * Downgrade Enforcement Service
 *
 * Enforces plan limits after billing changes (downgrade, cancellation, payment failure).
 *
 * CORE PRINCIPLE: Never delete data on downgrade.
 * Instead, disable access to features that exceed the new plan limits.
 * All enforcement is idempotent — safe to call multiple times.
 */

import { pool } from '../db/connection.js';
import { getUserPlan, resolveCapabilities } from './plans.service.js';

export type EnforcementStatus = 'active' | 'disabled_due_to_plan' | 'disabled_due_to_billing';

/**
 * Enforce plan limits for a user. Call this after any billing status change.
 * Idempotent — running multiple times produces the same result.
 */
export async function enforcePlanLimits(userId: number): Promise<void> {
  try {
    const planData = await getUserPlan(userId);
    const caps = resolveCapabilities(
      planData.plan_type,
      planData.account_type,
      planData.billing_status,
    );

    await enforceAutomationRules(userId, caps.max_automation_rules);
    await enforceUserStatus(userId, caps.is_active);
  } catch (e) {
    console.error(`[Enforcement] Failed to enforce limits for user ${userId}:`, (e as Error).message);
  }
}

/**
 * Enforce automation rule count.
 * Keeps the oldest N rules active; disables the rest without deleting them.
 * On upgrade, previously-disabled rules are re-enabled (enforcement_status → 'active').
 */
async function enforceAutomationRules(userId: number, maxRules: number): Promise<void> {
  // Fetch all rules ordered oldest-first (keep oldest on downgrade)
  const result = await pool.query(
    `SELECT id, enforcement_status FROM automation_rules WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );
  const rules: { id: number; enforcement_status: string }[] = result.rows;

  const toKeep = rules.slice(0, maxRules);
  const toDisable = rules.slice(maxRules);

  // Re-enable rules within the new limit that were previously enforcement-disabled
  if (toKeep.length > 0) {
    const toReactivate = toKeep
      .filter((r) => r.enforcement_status === 'disabled_due_to_plan')
      .map((r) => r.id);
    if (toReactivate.length > 0) {
      await pool.query(
        `UPDATE automation_rules
         SET enforcement_status = 'active', updated_at = NOW()
         WHERE id = ANY($1)`,
        [toReactivate],
      );
    }
  }

  // Disable rules that exceed the new plan limit
  if (toDisable.length > 0) {
    const toEnforce = toDisable
      .filter((r) => r.enforcement_status !== 'disabled_due_to_plan')
      .map((r) => r.id);
    if (toEnforce.length > 0) {
      await pool.query(
        `UPDATE automation_rules
         SET enforcement_status = 'disabled_due_to_plan', is_active = FALSE, updated_at = NOW()
         WHERE id = ANY($1)`,
        [toEnforce],
      );
    }
  }
}

/**
 * Enforce user account active status based on billing.
 * On past_due/canceled plans, marks user as inactive; restores on recovery.
 */
async function enforceUserStatus(userId: number, isActive: boolean): Promise<void> {
  if (isActive) {
    // Restore user — clear billing enforcement
    await pool.query(
      `UPDATE users
       SET is_active = TRUE,
           enforcement_status = CASE
             WHEN enforcement_status = 'disabled_due_to_billing' THEN 'active'
             ELSE enforcement_status
           END,
           updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  } else {
    // Mark as billing-restricted (does not delete or fully deactivate)
    await pool.query(
      `UPDATE users
       SET enforcement_status = 'disabled_due_to_billing', updated_at = NOW()
       WHERE id = $1 AND enforcement_status = 'active'`,
      [userId],
    );
  }
}
