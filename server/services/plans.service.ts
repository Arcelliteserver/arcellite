/**
 * Plan Feature Definitions — single source of truth for what each plan allows.
 * All feature checks across the app must go through this module.
 */

// ── Plan definitions ──────────────────────────────────────────────────────────

export type PlanType = 'free' | 'startup' | 'growth';
export type AccountType = 'personal' | 'organization';
export type BillingStatus = 'none' | 'active' | 'past_due' | 'canceled';

export interface PlanFeatures {
  max_users: number;
  max_automation_rules: number;
  allowed_connectors: string[] | 'all';
  allowed_triggers: string[] | 'all';
  allowed_actions: string[] | 'all';
  team_management: boolean;
  webhook_support: boolean;
  audit_logs: boolean;
  /** Human-readable plan label */
  label: string;
  /** Monthly price in USD cents (0 = free) */
  price_cents: number;
}

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: {
    label: 'Personal (Free)',
    price_cents: 0,
    max_users: 1,
    max_automation_rules: 3,
    allowed_connectors: ['email'],
    allowed_triggers: ['storage_threshold', 'scheduled'],
    allowed_actions: ['email', 'dashboard_alert'],
    team_management: false,
    webhook_support: false,
    audit_logs: false,
  },
  startup: {
    label: 'Startup',
    price_cents: 1900,  // $19/mo
    max_users: 5,
    max_automation_rules: 50,
    allowed_connectors: ['email', 'discord', 'webhook', 'gmail'],
    allowed_triggers: ['storage_threshold', 'cpu_threshold', 'file_upload', 'scheduled', 'database_query'],
    allowed_actions: ['email', 'discord', 'webhook', 'dashboard_alert'],
    team_management: true,
    webhook_support: true,
    audit_logs: true,
  },
  growth: {
    label: 'Growth',
    price_cents: 4900,  // $49/mo
    max_users: 20,
    max_automation_rules: 500,
    allowed_connectors: 'all',
    allowed_triggers: 'all',
    allowed_actions: 'all',
    team_management: true,
    webhook_support: true,
    audit_logs: true,
  },
};

// ── Resolved capabilities ─────────────────────────────────────────────────────

export interface AccountCapabilities extends PlanFeatures {
  plan_type: PlanType;
  account_type: AccountType;
  billing_status: BillingStatus;
  /** Account is usable (active billing or free plan) */
  is_active: boolean;
  /** Automation features are currently accessible */
  automation_enabled: boolean;
}

export function resolveCapabilities(
  planType: PlanType,
  accountType: AccountType,
  billingStatus: BillingStatus,
): AccountCapabilities {
  // Treat unknown plan types as free
  const plan = PLAN_FEATURES[planType] ?? PLAN_FEATURES.free;
  const is_active = planType === 'free' || billingStatus === 'active';
  // On past_due, keep org type but restrict to free-plan feature set
  const effectivePlan = (billingStatus === 'past_due' || billingStatus === 'canceled')
    ? PLAN_FEATURES.free
    : plan;

  return {
    ...effectivePlan,
    plan_type: planType,
    account_type: accountType,
    billing_status: billingStatus,
    is_active,
    automation_enabled: is_active,
  };
}

// ── Validators ────────────────────────────────────────────────────────────────

export function canUseTrigger(triggerType: string, caps: AccountCapabilities): boolean {
  if (caps.allowed_triggers === 'all') return true;
  return caps.allowed_triggers.includes(triggerType);
}

export function canUseAction(actionType: string, caps: AccountCapabilities): boolean {
  if (caps.allowed_actions === 'all') return true;
  return caps.allowed_actions.includes(actionType);
}

export function triggerGateMessage(triggerType: string): string {
  const labels: Record<string, string> = {
    cpu_threshold: 'CPU threshold triggers',
    file_upload: 'File upload triggers',
    database_query: 'Database query triggers',
  };
  const label = labels[triggerType] || `The "${triggerType}" trigger`;
  return `${label} require the Startup or Growth plan. Enable Organization Mode in Settings → Plan & Billing.`;
}

export function actionGateMessage(actionType: string): string {
  const labels: Record<string, string> = {
    discord: 'Discord actions',
    webhook: 'Webhook actions',
  };
  const label = labels[actionType] || `The "${actionType}" action`;
  return `${label} require the Startup or Growth plan. Enable Organization Mode in Settings → Plan & Billing.`;
}

export function ruleCountGateMessage(current: number, max: number): string {
  return `You have reached your automation rule limit (${current}/${max}). Upgrade to the Startup plan to create up to 50 rules.`;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

import { pool } from '../db/connection.js';

/** Fetch a user's plan details from the DB */
export async function getUserPlan(userId: number): Promise<{
  plan_type: PlanType;
  account_type: AccountType;
  billing_status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_activated_at: Date | null;
}> {
  const result = await pool.query(
    `SELECT plan_type, account_type, billing_status,
            stripe_customer_id, stripe_subscription_id, plan_activated_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    return { plan_type: 'free', account_type: 'personal', billing_status: 'none',
             stripe_customer_id: null, stripe_subscription_id: null, plan_activated_at: null };
  }
  return {
    plan_type: (row.plan_type as PlanType) || 'free',
    account_type: (row.account_type as AccountType) || 'personal',
    billing_status: (row.billing_status as BillingStatus) || 'none',
    stripe_customer_id: row.stripe_customer_id ?? null,
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    plan_activated_at: row.plan_activated_at ?? null,
  };
}

/** Activate or upgrade a user's plan (called after successful Stripe payment) */
export async function activatePlan(
  userId: number,
  planType: PlanType,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET account_type = 'organization',
         plan_type = $2,
         billing_status = 'active',
         stripe_customer_id = COALESCE($3, stripe_customer_id),
         stripe_subscription_id = COALESCE($4, stripe_subscription_id),
         plan_activated_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId, planType, stripeCustomerId ?? null, stripeSubscriptionId ?? null]
  );
}

/** Handle subscription cancellation/past_due */
export async function setPlanStatus(
  userId: number,
  billingStatus: 'active' | 'past_due' | 'canceled',
): Promise<void> {
  await pool.query(
    `UPDATE users SET billing_status = $2, updated_at = NOW() WHERE id = $1`,
    [userId, billingStatus]
  );
}

/** Count active automation rules for a user */
export async function countUserRules(userId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM automation_rules WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
