/**
 * AI Task Automation Routes
 * CRUD for automation rules + AI natural language parsing + execution logs
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { pool } from '../db/connection.js';
import * as authService from '../services/auth.service.js';
import {
  getUserPlan, resolveCapabilities, countUserRules,
  canUseTrigger, canUseAction, triggerGateMessage, actionGateMessage, ruleCountGateMessage,
} from '../services/plans.service.js';

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, error: string, status = 400) {
  sendJson(res, { error }, status);
}

async function getUser(req: IncomingMessage, res: ServerResponse) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401);
    return null;
  }
  const user = await authService.validateSession(authHeader.slice(7));
  if (!user) {
    sendError(res, 'Invalid or expired session', 401);
    return null;
  }
  return user;
}

// Friendly human-readable descriptions of trigger/action configs
function describeTrigger(type: string, config: any): string {
  switch (type) {
    case 'storage_threshold': return `Storage usage exceeds ${config.threshold ?? 90}%`;
    case 'cpu_threshold': return `CPU usage exceeds ${config.threshold ?? 80}%${config.duration_minutes ? ` for ${config.duration_minutes} min` : ''}`;
    case 'file_upload': {
      const types = config.file_types?.length ? config.file_types.join(', ') : 'any file';
      return `File uploaded (${types})`;
    }
    case 'scheduled': return `Scheduled: ${config.cron ?? '* * * * *'}`;
    case 'database_query': return `DB query on ${config.database_id ? `database (${config.database_id.slice(0, 8)}…)` : 'database'} returns rows`;
    default: return type;
  }
}

function describeAction(type: string, config: any): string {
  switch (type) {
    case 'email': return `Email to ${config.to ?? 'configured address'}`;
    case 'discord': return `Discord message to webhook`;
    case 'webhook': return `Webhook POST to ${config.url ?? 'configured URL'}`;
    case 'dashboard_alert': return `Dashboard alert: ${config.title ?? 'Notification'}`;
    default: return type;
  }
}

export async function handleTasksRoutes(req: IncomingMessage, res: ServerResponse, url: string): Promise<boolean> {
  const [pathname] = url.split('?');

  // ── List rules ─────────────────────────────────────────────────
  if (pathname === '/api/tasks/rules' && req.method === 'GET') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const result = await pool.query(
        `SELECT id, name, description, is_active, enforcement_status, trigger_type, trigger_config,
                action_type, action_config, last_triggered, created_at
         FROM automation_rules WHERE user_id = $1 ORDER BY created_at DESC`,
        [user.id]
      );
      const rules = result.rows.map((r) => ({
        ...r,
        trigger_description: describeTrigger(r.trigger_type, r.trigger_config),
        action_description: describeAction(r.action_type, r.action_config),
      }));
      sendJson(res, { ok: true, rules });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── Create rule ─────────────────────────────────────────────────
  if (pathname === '/api/tasks/rules' && req.method === 'POST') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const body = await parseBody(req);
      const { name, description, trigger_type, trigger_config, action_type, action_config, is_active } = body;
      if (!name || !trigger_type || !action_type) {
        sendError(res, 'name, trigger_type, and action_type are required');
        return true;
      }

      // ── Feature gating ──
      const planData = await getUserPlan(user.id);
      const caps = resolveCapabilities(planData.plan_type, planData.account_type, planData.billing_status);

      // 1. Rule count limit
      const ruleCount = await countUserRules(user.id);
      if (ruleCount >= caps.max_automation_rules) {
        sendJson(res, {
          ok: false, upgrade_required: true,
          error: ruleCountGateMessage(ruleCount, caps.max_automation_rules),
        }, 403);
        return true;
      }

      // 2. Trigger type allowed
      if (!canUseTrigger(trigger_type, caps)) {
        sendJson(res, {
          ok: false, upgrade_required: true,
          error: triggerGateMessage(trigger_type),
        }, 403);
        return true;
      }

      // 3. Action type allowed
      if (!canUseAction(action_type, caps)) {
        sendJson(res, {
          ok: false, upgrade_required: true,
          error: actionGateMessage(action_type),
        }, 403);
        return true;
      }

      const result = await pool.query(
        `INSERT INTO automation_rules (user_id, name, description, is_active, trigger_type, trigger_config, action_type, action_config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [user.id, name, description ?? null, is_active ?? false, trigger_type,
         JSON.stringify(trigger_config ?? {}), action_type, JSON.stringify(action_config ?? {})]
      );
      const rule = result.rows[0];
      sendJson(res, {
        ok: true, rule: {
          ...rule,
          trigger_description: describeTrigger(rule.trigger_type, rule.trigger_config),
          action_description: describeAction(rule.action_type, rule.action_config),
        }
      }, 201);
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── Update rule ─────────────────────────────────────────────────
  const ruleMatch = pathname.match(/^\/api\/tasks\/rules\/(\d+)$/);
  if (ruleMatch && req.method === 'PUT') {
    const user = await getUser(req, res);
    if (!user) return true;
    const ruleId = parseInt(ruleMatch[1], 10);
    try {
      const body = await parseBody(req);
      // Only update fields that are present in the body
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if ('name' in body) { fields.push(`name = $${idx++}`); values.push(body.name); }
      if ('description' in body) { fields.push(`description = $${idx++}`); values.push(body.description); }
      if ('is_active' in body) { fields.push(`is_active = $${idx++}`); values.push(body.is_active); }
      if ('trigger_type' in body) { fields.push(`trigger_type = $${idx++}`); values.push(body.trigger_type); }
      if ('trigger_config' in body) { fields.push(`trigger_config = $${idx++}`); values.push(JSON.stringify(body.trigger_config)); }
      if ('action_type' in body) { fields.push(`action_type = $${idx++}`); values.push(body.action_type); }
      if ('action_config' in body) { fields.push(`action_config = $${idx++}`); values.push(JSON.stringify(body.action_config)); }
      if (fields.length === 0) { sendError(res, 'No fields to update'); return true; }
      fields.push(`updated_at = NOW()`);
      values.push(user.id, ruleId);
      const result = await pool.query(
        `UPDATE automation_rules SET ${fields.join(', ')} WHERE user_id = $${idx++} AND id = $${idx} RETURNING *`,
        values
      );
      if (result.rowCount === 0) { sendError(res, 'Rule not found', 404); return true; }
      const rule = result.rows[0];
      sendJson(res, {
        ok: true, rule: {
          ...rule,
          trigger_description: describeTrigger(rule.trigger_type, rule.trigger_config),
          action_description: describeAction(rule.action_type, rule.action_config),
        }
      });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── Delete rule ─────────────────────────────────────────────────
  if (ruleMatch && req.method === 'DELETE') {
    const user = await getUser(req, res);
    if (!user) return true;
    const ruleId = parseInt(ruleMatch[1], 10);
    try {
      const result = await pool.query(
        `DELETE FROM automation_rules WHERE id = $1 AND user_id = $2`,
        [ruleId, user.id]
      );
      if (result.rowCount === 0) { sendError(res, 'Rule not found', 404); return true; }
      sendJson(res, { ok: true });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── AI Parse natural language → structured rule JSON ───────────
  if (pathname === '/api/tasks/parse' && req.method === 'POST') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const body = await parseBody(req);
      const { text, model } = body;
      if (!text?.trim()) { sendError(res, 'text is required'); return true; }

      const { chatWithAI, getConfiguredProviders } = await import('../ai.js');
      const providers = getConfiguredProviders();
      if (providers.length === 0) {
        sendError(res, 'No AI API key configured. Go to Settings → API Keys to add a key.');
        return true;
      }

      // Pick a model: use provided model, fall back to first configured provider's default
      const PROVIDER_DEFAULTS: Record<string, string> = {
        Google: 'gemini-2.5-flash',
        Anthropic: 'claude-haiku-4-5-20251001',
        OpenAI: 'gpt-4o-mini',
        DeepSeek: 'deepseek-chat',
        Ollama: 'llama3',
      };
      const selectedModel = model || PROVIDER_DEFAULTS[providers[0]] || 'deepseek-chat';

      // Build list of user's databases for context
      let dbContext = '';
      try {
        const { listDatabases } = await import('../databases.js');
        const dbs = listDatabases();
        if (dbs.length > 0) {
          dbContext = `\n\nUser's available databases (for database_query trigger):\n${dbs.map((d) => `- id: "${d.id}", name: "${d.displayName || d.name}", type: ${d.type}`).join('\n')}`;
        }
      } catch { /* non-fatal */ }

      const parsePrompt = `You are an automation rule parser. The user will describe an automation they want in plain English.
You MUST respond with ONLY a valid JSON object — no markdown, no explanation, no code fences.

The JSON must have exactly these fields:
{
  "name": "short human-readable rule name (max 60 chars)",
  "description": "one sentence describing what the rule does",
  "trigger_type": one of: "storage_threshold" | "cpu_threshold" | "file_upload" | "scheduled" | "database_query",
  "trigger_config": object with fields depending on trigger_type:
    - storage_threshold: { "threshold": <0-100 number> }
    - cpu_threshold: { "threshold": <0-100 number>, "duration_minutes": <number, optional> }
    - file_upload: { "file_types": [<array of extensions like "jpg","pdf">, empty array means any] }
    - scheduled: { "cron": "<standard 5-field cron expression>" }
    - database_query: { "database_id": "<id from the available databases list>", "query": "<SELECT SQL query — condition built into WHERE clause>", "debounce_minutes": <number, default 5> }
  "action_type": one of: "email" | "discord" | "webhook" | "dashboard_alert",
  "action_config": object with fields depending on action_type:
    - email: { "to": "<email>", "subject": "<subject>", "body": "<message body, use {{field_name}} to interpolate query result columns>" }
    - discord: { "webhook_url": "", "message": "<message to post, use {{field_name}} for query result columns>" }
    - webhook: { "url": "", "method": "POST", "body": "<JSON string payload>" }
    - dashboard_alert: { "title": "<title>", "message": "<message, use {{field_name}} for query result columns>", "severity": "info"|"warning"|"error" }

For database_query triggers: the rule fires whenever the query returns 1 or more rows. Build the condition directly into the SQL WHERE clause (e.g. WHERE quantity < reorder_threshold). Use {{column_name}} placeholders in action messages to include data from the first result row.
For email action_config.to: use empty string "" if the user didn't specify an email address.
For discord/webhook URLs: use empty string "" — the user will fill them in.
Interpret natural language time expressions into cron syntax (e.g. "every day at 9am" → "0 9 * * *", "every Monday" → "0 0 * * 1", "every hour" → "0 * * * *").
${dbContext}

User's automation request: "${text.trim()}"`;

      const result = await chatWithAI(
        [{ role: 'user', content: parsePrompt }],
        selectedModel,
        user.email
      );

      if (result.error) {
        sendError(res, result.error);
        return true;
      }

      // Strip markdown code fences if AI added them
      let jsonStr = result.content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        sendError(res, 'AI returned an invalid response. Please try rephrasing your request.');
        return true;
      }

      // Validate required fields
      const validTriggers = ['storage_threshold', 'cpu_threshold', 'file_upload', 'scheduled', 'database_query'];
      const validActions = ['email', 'discord', 'webhook', 'dashboard_alert'];
      if (!validTriggers.includes(parsed.trigger_type)) {
        sendError(res, `Unsupported trigger type: ${parsed.trigger_type}. Try describing a storage, CPU, file upload, or scheduled trigger.`);
        return true;
      }
      if (!validActions.includes(parsed.action_type)) {
        sendError(res, `Unsupported action type: ${parsed.action_type}. Try describing an email, Discord, webhook, or dashboard alert action.`);
        return true;
      }

      sendJson(res, {
        ok: true,
        rule: {
          ...parsed,
          trigger_config: parsed.trigger_config ?? {},
          action_config: parsed.action_config ?? {},
          trigger_description: describeTrigger(parsed.trigger_type, parsed.trigger_config ?? {}),
          action_description: describeAction(parsed.action_type, parsed.action_config ?? {}),
        }
      });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── Get execution logs ──────────────────────────────────────────
  if (pathname === '/api/tasks/logs' && req.method === 'GET') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const result = await pool.query(
        `SELECT l.id, l.rule_id, r.name AS rule_name, l.status, l.trigger_value,
                l.action_result, l.attempt_count, l.error_message, l.created_at
         FROM rule_execution_logs l
         LEFT JOIN automation_rules r ON r.id = l.rule_id
         WHERE l.user_id = $1 ORDER BY l.created_at DESC LIMIT 100`,
        [user.id]
      );
      sendJson(res, { ok: true, logs: result.rows });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── Clear execution logs ────────────────────────────────────────
  if (pathname === '/api/tasks/logs' && req.method === 'DELETE') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      await pool.query(`DELETE FROM rule_execution_logs WHERE user_id = $1`, [user.id]);
      sendJson(res, { ok: true });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── GET email config ─────────────────────────────────────────────
  if (pathname === '/api/tasks/email-config' && req.method === 'GET') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      // Load directly-added AI email accounts + active selection
      const prefRow = await pool.query(
        `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'email_accounts' LIMIT 1`,
        [user.id]
      );
      const stored = prefRow.rows[0]?.config || { accounts: [], activeId: null };

      // Discover email-capable accounts from Integration (myapps_state)
      const appsRow = await pool.query(
        `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' LIMIT 1`,
        [user.id]
      );
      const appsState = appsRow.rows[0]?.config || {};
      const integrationAccounts: Array<{ id: string; name: string; user: string; icon: string }> = [];
      if (appsState.gmail?.connected && appsState.gmail?.fields?.smtpUser) {
        integrationAccounts.push({
          id: 'integration:gmail',
          name: 'Gmail',
          user: appsState.gmail.fields.smtpUser,
          icon: 'gmail',
        });
      }

      sendJson(res, {
        ok: true,
        integrationAccounts,
        accounts: stored.accounts ?? [],
        activeId: stored.activeId ?? null,
        customFrom: stored.customFrom ?? '',
      });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── PUT email config ─────────────────────────────────────────────
  if (pathname === '/api/tasks/email-config' && req.method === 'PUT') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const body = await parseBody(req);
      const { accounts, activeId, customFrom } = body;
      // Ensure partial unique index exists (idempotent)
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_apps_user_email_accounts
         ON connected_apps (user_id, app_type) WHERE app_type = 'email_accounts'`
      ).catch(() => {});
      await pool.query(
        `INSERT INTO connected_apps (user_id, app_type, app_name, config)
         VALUES ($1, 'email_accounts', 'AI Email Accounts', $2)
         ON CONFLICT (user_id, app_type) WHERE app_type = 'email_accounts'
         DO UPDATE SET config = $2, updated_at = NOW()`,
        [user.id, JSON.stringify({ accounts: accounts ?? [], activeId: activeId ?? null, customFrom: customFrom ?? '' })]
      );
      sendJson(res, { ok: true });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  return false;
}
