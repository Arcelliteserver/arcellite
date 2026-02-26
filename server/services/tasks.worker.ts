/**
 * AI Task Automation Background Worker
 * Evaluates active automation rules every 30 seconds and executes triggered actions.
 */

import { EventEmitter } from 'events';
import { pool } from '../db/connection.js';
import nodemailer from 'nodemailer';

/** Emit this to trigger file-upload rules in real-time */
export const taskEvents = new EventEmitter();

// Track last-triggered times to debounce metric triggers (don't fire more than once per 5 min)
const lastFired = new Map<number, number>();
const DEBOUNCE_MS = 5 * 60 * 1000;

let workerStarted = false;

export async function startTasksWorker() {
  if (workerStarted) return;
  workerStarted = true;

  // Apply enforcement_status schema migration immediately so the worker can query it safely
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='enforcement_status') THEN
        ALTER TABLE automation_rules ADD COLUMN enforcement_status VARCHAR(50) DEFAULT 'active';
      END IF;
    END $$
  `).catch((e) => console.warn('[Tasks Worker] Schema migration skipped:', e.message));

  console.log('[Tasks Worker] Started — checking automation rules every 30s');

  // Metric + scheduled trigger check every 30 seconds
  setInterval(() => { checkMetricTriggers().catch((e) => console.error('[Tasks Worker] Error:', e.message)); }, 30_000);

  // Database query trigger check every 30 seconds
  setInterval(() => { checkDatabaseQueryTriggers().catch((e: Error) => console.error('[Tasks Worker] DB query error:', e.message)); }, 30_000);

  // File upload real-time hook
  taskEvents.on('file_uploaded', (data: { fileName: string; fileType: string; fileSizeBytes: number; fileUrl?: string; userId: number }) => {
    checkFileUploadTriggers(data).catch((e) => console.error('[Tasks Worker] File upload hook error:', e.message));
  });
}

// ── Cron helpers ──────────────────────────────────────────────────────────────

/** Check if a 5-field (or 6-field with seconds) cron expression is due now (minute precision) */
function isCronDue(cron: string): boolean {
  try {
    const parts = cron.trim().split(/\s+/);
    // Accept 6-field crons (with seconds as first field) — just drop the seconds
    if (parts.length === 6) parts.shift();
    if (parts.length !== 5) return false;
    const [minPart, hourPart, domPart, monPart, dowPart] = parts;
    const now = new Date();
    const matches = (part: string, value: number): boolean => {
      if (part === '*') return true;
      return part.split(',').some((seg) => {
        if (seg.includes('/')) {
          const [, step] = seg.split('/');
          return value % parseInt(step, 10) === 0;
        }
        if (seg.includes('-')) {
          const [lo, hi] = seg.split('-').map(Number);
          return value >= lo && value <= hi;
        }
        return parseInt(seg, 10) === value;
      });
    };
    return matches(minPart, now.getMinutes()) &&
           matches(hourPart, now.getHours()) &&
           matches(domPart, now.getDate()) &&
           matches(monPart, now.getMonth() + 1) &&
           matches(dowPart, now.getDay());
  } catch {
    return false;
  }
}

// ── Metric triggers ───────────────────────────────────────────────────────────

async function checkMetricTriggers() {
  let stats: { cpu: number; storage: number } | null = null;

  try {
    const { getSystemStats } = await import('../stats.js');
    const { getRootStorage } = await import('../storage.js');
    const sys = getSystemStats();
    const disk = getRootStorage();
    stats = {
      cpu: sys.cpu.loadPercent,
      storage: disk?.usedPercent ?? 0,
    };
  } catch {
    return; // Stats unavailable — skip this tick
  }

  const result = await pool.query(
    `SELECT * FROM automation_rules WHERE is_active = TRUE AND enforcement_status = 'active' AND trigger_type IN ('storage_threshold','cpu_threshold','scheduled')`
  );

  for (const rule of result.rows) {
    const now = Date.now();
    const last = lastFired.get(rule.id) ?? 0;
    if (now - last < DEBOUNCE_MS && rule.trigger_type !== 'scheduled') continue;

    const cfg = rule.trigger_config as any;
    let triggered = false;
    let triggerValue: any = {};

    const ts = new Date().toISOString();
    if (rule.trigger_type === 'storage_threshold') {
      const threshold = cfg.threshold ?? 90;
      if (stats.storage >= threshold) {
        triggered = true;
        triggerValue = { storage_percent: stats.storage, threshold, timestamp: ts };
      }
    } else if (rule.trigger_type === 'cpu_threshold') {
      const threshold = cfg.threshold ?? 80;
      if (stats.cpu >= threshold) {
        triggered = true;
        triggerValue = { cpu_percent: stats.cpu, threshold, timestamp: ts };
      }
    } else if (rule.trigger_type === 'scheduled') {
      if (isCronDue(cfg.cron ?? '')) {
        // For scheduled tasks, only fire once per minute — use a 60s debounce
        if (now - last < 60_000) continue;
        triggered = true;
        triggerValue = { scheduled_at: ts, timestamp: ts };
      }
    }

    if (triggered) {
      lastFired.set(rule.id, now);
      await executeAction(rule, triggerValue, rule.user_id);
    }
  }
}

// ── Database query triggers ───────────────────────────────────────────────────

async function checkDatabaseQueryTriggers() {
  const result = await pool.query(
    `SELECT * FROM automation_rules WHERE is_active = TRUE AND enforcement_status = 'active' AND trigger_type = 'database_query'`
  );

  for (const rule of result.rows) {
    const now = Date.now();
    const last = lastFired.get(rule.id) ?? 0;
    const cfg = rule.trigger_config as any;
    const debounceMs = ((cfg.debounce_minutes ?? 5) * 60 * 1000);
    if (now - last < debounceMs) continue;

    const { database_id, query } = cfg;
    if (!database_id || !query?.trim()) continue;

    try {
      const { executeQuery } = await import('../databases.js');
      const qResult = await executeQuery(database_id, query);
      if (qResult.rows.length > 0) {
        lastFired.set(rule.id, now);
        await executeAction(rule, {
          row_count: qResult.rows.length,
          rows: qResult.rows.slice(0, 10),
          timestamp: new Date().toISOString(),
          ...qResult.rows[0], // spread first row's fields as top-level keys for {{interpolation}}
        }, rule.user_id);
      }
    } catch (e) {
      console.error(`[Tasks Worker] DB query trigger rule ${rule.id} failed:`, (e as Error).message);
    }
  }
}

// ── File upload triggers ──────────────────────────────────────────────────────

async function checkFileUploadTriggers(data: { fileName: string; fileType: string; fileSizeBytes: number; fileUrl?: string; userId: number }) {
  const result = await pool.query(
    `SELECT * FROM automation_rules WHERE is_active = TRUE AND enforcement_status = 'active' AND trigger_type = 'file_upload' AND user_id = $1`,
    [data.userId]
  );

  for (const rule of result.rows) {
    const cfg = rule.trigger_config as any;
    const allowedTypes: string[] = cfg.file_types ?? [];
    const ext = data.fileName.includes('.') ? data.fileName.split('.').pop()?.toLowerCase() ?? '' : '';
    const typesMatch = allowedTypes.length === 0 || allowedTypes.includes(ext);
    const minSize = (cfg.min_size_mb ?? 0) * 1024 * 1024;
    const sizeMatch = data.fileSizeBytes >= minSize;

    if (typesMatch && sizeMatch) {
      const ts = new Date().toISOString();
      const triggerValue = {
        file_name: data.fileName,
        file_type: ext,
        file_size_bytes: data.fileSizeBytes,
        file_size_mb: (data.fileSizeBytes / 1024 / 1024).toFixed(2),
        upload_time: ts,
        file_url: data.fileUrl || '',
        timestamp: ts,
      };
      await executeAction(rule, triggerValue, data.userId);
    }
  }
}

// ── Action execution with retry ───────────────────────────────────────────────

async function executeAction(rule: any, triggerValue: any, userId: number) {
  let lastError = '';
  let attempt = 0;
  const MAX_ATTEMPTS = 3;
  const BACKOFF = [0, 2000, 4000]; // delays before each retry

  while (attempt < MAX_ATTEMPTS) {
    if (BACKOFF[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
    }
    attempt++;
    try {
      const result = await runAction(rule.action_type, rule.action_config, triggerValue, rule, userId);
      // Success — log it and update last_triggered
      await pool.query(
        `INSERT INTO rule_execution_logs (rule_id, user_id, status, trigger_value, action_result, attempt_count)
         VALUES ($1, $2, 'success', $3, $4, $5)`,
        [rule.id, userId, JSON.stringify(triggerValue), JSON.stringify(result), attempt]
      );
      await pool.query(`UPDATE automation_rules SET last_triggered = NOW() WHERE id = $1`, [rule.id]);
      return;
    } catch (e) {
      lastError = (e as Error).message;
    }
  }

  // All attempts failed — log failure
  await pool.query(
    `INSERT INTO rule_execution_logs (rule_id, user_id, status, trigger_value, attempt_count, error_message)
     VALUES ($1, $2, 'failed', $3, $4, $5)`,
    [rule.id, userId, JSON.stringify(triggerValue), attempt, lastError]
  );
  console.error(`[Tasks Worker] Rule "${rule.name}" (id=${rule.id}) failed after ${attempt} attempts: ${lastError}`);
}

async function runAction(actionType: string, actionConfig: any, triggerValue: any, rule: any, userId: number): Promise<any> {
  const cfg = actionConfig as any;

  if (actionType === 'email') {
    let to = cfg.to?.trim();
    // If no recipient configured in the rule, fall back to the rule owner's own email
    if (!to) {
      try {
        const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        to = userRow.rows[0]?.email?.trim() || '';
      } catch { /* ignore */ }
    }
    if (!to) throw new Error('Email action: no recipient configured — edit the rule and set a "To" email address');
    const { transporter, from } = await createEmailTransporter(userId);
    const subject = interpolate(cfg.subject || `Arcellite Alert: ${rule.name}`, triggerValue);
    const bodyText = interpolate(cfg.body || '', triggerValue);
    const plainText = bodyText || `Your automation rule "${rule.name}" was triggered.\n\nTrigger data:\n${
      Object.entries(triggerValue).filter(([k]) => k !== 'rows').map(([k, v]) => `  ${k}: ${v}`).join('\n')
    }`;
    await transporter.sendMail({
      from: cfg.from?.trim() || from,
      to,
      subject,
      text: plainText,
      html: buildHtmlEmail(rule, triggerValue, subject, bodyText),
    });
    return { sent_to: to };
  }

  if (actionType === 'discord') {
    const message = interpolate(cfg.message || `🔔 **${rule.name}** triggered\n${JSON.stringify(triggerValue)}`, triggerValue);

    // Prefer channel-based bot sending (Discord connected via My Apps → Integration)
    if (cfg.channel?.trim()) {
      const appsRow = await pool.query(
        `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' LIMIT 1`,
        [userId]
      );
      const apps = (appsRow.rows[0]?.config || {}) as Record<string, any>;
      const sendUrl = apps?.discord?.discordWebhooks?.sendUrl;
      if (!sendUrl) throw new Error('Discord action: Discord is not connected via My Apps — connect it in the Integration tab first');
      const r = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: cfg.channel.trim(), message }),
      });
      if (!r.ok) throw new Error(`Discord bot send returned ${r.status}`);
      return { channel: cfg.channel, status: r.status };
    }

    // Fallback: direct webhook URL
    const webhookUrl = cfg.webhook_url?.trim();
    if (!webhookUrl) throw new Error('Discord action: set a "channel" (requires Discord connected via My Apps) or provide a webhook_url');
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    if (!r.ok) throw new Error(`Discord webhook returned ${r.status}`);
    return { status: r.status };
  }

  if (actionType === 'webhook') {
    const webhookUrl = cfg.url?.trim();
    if (!webhookUrl) throw new Error('Webhook action: no URL configured');
    const method = cfg.method || 'POST';
    let body: string | undefined;
    if (cfg.body) {
      try { body = interpolate(cfg.body, triggerValue); } catch { body = cfg.body; }
    } else {
      body = JSON.stringify({ rule: rule.name, trigger: triggerValue, timestamp: new Date().toISOString() });
    }
    const r = await fetch(webhookUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? body : undefined,
    });
    if (!r.ok) throw new Error(`Webhook returned ${r.status}`);
    return { status: r.status };
  }

  if (actionType === 'dashboard_alert') {
    const title = interpolate(cfg.title || rule.name, triggerValue);
    const message = interpolate(cfg.message || `Rule "${rule.name}" triggered.`, triggerValue);
    const severity = cfg.severity || 'info';
    const typeMap: Record<string, string> = { info: 'info', warning: 'warning', error: 'error' };
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, category) VALUES ($1, $2, $3, $4, 'automation')`,
      [userId, title, message, typeMap[severity] || 'info']
    );
    return { notification_created: true };
  }

  throw new Error(`Unknown action type: ${actionType}`);
}

// ── HTML email builder ────────────────────────────────────────────────────────

const TRIGGER_EMAIL_COLOR: Record<string, string> = {
  storage_threshold: '#3B82F6',
  cpu_threshold:     '#F97316',
  file_upload:       '#8B5CF6',
  scheduled:         '#6366F1',
  database_query:    '#0D9488',
};

const TRIGGER_EMAIL_LABEL: Record<string, string> = {
  storage_threshold: 'Storage Threshold',
  cpu_threshold:     'CPU Threshold',
  file_upload:       'File Upload',
  scheduled:         'Scheduled',
  database_query:    'Database Query',
};

function buildHtmlEmail(rule: any, triggerValue: Record<string, any>, subject: string, customBody: string): string {
  const accentColor = TRIGGER_EMAIL_COLOR[rule.trigger_type] ?? '#5D5FEF';
  const triggerLabel = TRIGGER_EMAIL_LABEL[rule.trigger_type] ?? rule.trigger_type;
  const now = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  // Build trigger data rows (skip internal fields)
  const skipKeys = new Set(['rows', 'timestamp', 'row_count']);
  const dataEntries = Object.entries(triggerValue).filter(([k]) => !skipKeys.has(k));
  const triggerRows = dataEntries.map(([k, v]) => `
    <tr>
      <td style="padding:11px 20px;border-bottom:1px solid #2D2D35;font-size:12px;color:#9CA3AF;font-weight:500;text-transform:capitalize;white-space:nowrap;width:42%;">
        ${k.replace(/_/g, ' ')}
      </td>
      <td style="padding:11px 20px;border-bottom:1px solid #2D2D35;font-size:13px;color:#F1F5F9;font-weight:600;font-family:ui-monospace,'Cascadia Code',monospace;">
        ${typeof v === 'object' ? JSON.stringify(v) : String(v)}
      </td>
    </tr>`).join('');

  const triggerSection = triggerRows ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#1A1A24;border:1px solid #2D2D35;border-radius:12px;overflow:hidden;margin:0 0 24px;">
      <tr>
        <td colspan="2" style="padding:10px 20px;background:${accentColor}20;border-bottom:1px solid #2D2D35;">
          <span style="font-size:10px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.1em;">Trigger Data</span>
        </td>
      </tr>
      ${triggerRows}
    </table>` : '';

  // Custom body rendered as a callout block
  const escapedBody = customBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const customSection = escapedBody ? `
    <div style="background:#1A1A24;border-left:3px solid ${accentColor};border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 24px;">
      <p style="color:#CBD5E1;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;font-family:-apple-system,sans-serif;">${escapedBody}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0D14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">

  <!-- Preheader text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${rule.name} — ${triggerLabel} alert from Arcellite
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D0D14;padding:32px 16px 48px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

        <!-- ── View in browser ── -->
        <tr>
          <td align="right" style="padding:0 0 12px;font-size:12px;color:#6B7280;">
            <a href="#" style="color:#6B7280;text-decoration:underline;">View in browser</a>
          </td>
        </tr>

        <!-- ── Header card ── -->
        <tr>
          <td style="background:#18181B;border-radius:16px 16px 0 0;padding:0;overflow:hidden;">
            <!-- Rainbow gradient accent strip -->
            <div style="height:3px;background:linear-gradient(90deg,#5D5FEF,#8B5CF6,#EC4899,#F97316,#EAB308,#22C55E,#06B6D4,#5D5FEF);"></div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:28px 36px 0;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background:rgba(93,95,239,0.15);border:1px solid rgba(93,95,239,0.3);border-radius:10px;padding:8px 14px;">
                        <span style="font-size:16px;font-weight:900;color:#FFFFFF;letter-spacing:-0.3px;">⚡ Arcellite</span>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#6B7280;font-size:11px;margin:16px 0 28px;letter-spacing:0.8px;text-transform:uppercase;font-weight:600;">Automation Alert</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Main content ── -->
        <tr>
          <td style="background:#18181B;padding:0 36px 36px;">

            <!-- Trigger badge -->
            <span style="display:inline-block;background:${accentColor}18;color:${accentColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;padding:5px 14px;border-radius:100px;border:1px solid ${accentColor}35;margin:0 0 16px;">
              ${triggerLabel}
            </span>

            <!-- Rule name -->
            <h1 style="font-size:24px;font-weight:800;color:#F8FAFC;margin:0 0 8px;line-height:1.2;letter-spacing:-0.3px;">${rule.name}</h1>
            <p style="color:#6B7280;font-size:13px;margin:0 0 28px;line-height:1.6;">
              Triggered on <strong style="color:#9CA3AF;">${now}</strong>
            </p>

            ${triggerSection}
            ${customSection}

            <!-- View My Tasks button -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
              <tr>
                <td style="background:${accentColor};border-radius:10px;padding:0;">
                  <a href="https://www.arcellite.com" target="_blank"
                    style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                    Open Arcellite →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── Divider ── -->
        <tr>
          <td style="background:#18181B;padding:0 36px;">
            <div style="height:1px;background:#2D2D35;"></div>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#18181B;padding:24px 36px 32px;border-radius:0 0 16px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Left: brand -->
                <td>
                  <span style="font-size:14px;font-weight:800;color:#374151;">⚡ Arcellite</span>
                  <p style="color:#6B7280;font-size:11px;margin:6px 0 0;line-height:1.6;">
                    Infrastructure monitoring &amp; automation.<br>
                    <a href="https://www.arcellite.com" style="color:${accentColor};text-decoration:none;">www.arcellite.com</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;">
                  <p style="color:#4B5563;font-size:11px;margin:0;line-height:1.7;">
                    Rule: <em style="color:#6B7280;">${rule.name}</em>
                    &nbsp;·&nbsp;
                    You received this because an automation rule you created was triggered.
                    To stop these alerts, deactivate the rule in
                    <strong style="color:#6B7280;">My Tasks</strong>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>`;
}

// ── String interpolation ───────────────────────────────────────────────────────

/** Replace {{key}} placeholders in a string with values from triggerValue */
function interpolate(template: string, values: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return values[key] !== undefined ? String(values[key]) : `{{${key}}}`;
  });
}

/** Build nodemailer transporter.
 *  Priority: user's selected account → auto-detect connected Gmail → env vars (silent admin fallback) */
async function createEmailTransporter(userId: number): Promise<{ transporter: ReturnType<typeof nodemailer.createTransport>; from: string }> {
  const makeT = (host: string, port: number, user: string, pass: string, from: string, secure?: boolean) => ({
    transporter: nodemailer.createTransport({
      host, port,
      secure: secure !== undefined ? secure : port === 465,
      auth: { user, pass },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    }),
    from,
  });

  try {
    // Load user's preference + directly-added accounts
    const prefRow = await pool.query(
      `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'email_accounts' LIMIT 1`,
      [userId]
    );
    const pref = (prefRow.rows[0]?.config || {}) as { accounts?: any[]; activeId?: string; customFrom?: string };
    const customFrom = pref.customFrom?.trim() || '';

    // Load integration apps (Gmail etc.) from myapps_state
    const appsRow = await pool.query(
      `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' LIMIT 1`,
      [userId]
    );
    const apps = (appsRow.rows[0]?.config || {}) as Record<string, any>;

    if (pref.activeId) {
      if (pref.activeId.startsWith('integration:')) {
        // Integration account (e.g. 'integration:gmail')
        const key = pref.activeId.split(':')[1];
        const app = apps[key];
        if (app?.connected && app?.fields?.smtpUser && app?.fields?.smtpPass) {
          const f = app.fields;
          return makeT(f.smtpHost || 'smtp.gmail.com', parseInt(f.smtpPort || '587', 10), f.smtpUser, f.smtpPass, customFrom || f.smtpUser);
        }
      } else {
        // Directly-added account (UUID)
        const acc = pref.accounts?.find((a: any) => a.id === pref.activeId);
        if (acc?.host && acc?.user && acc?.pass) {
          return makeT(acc.host, acc.port || 587, acc.user, acc.pass, customFrom || acc.from || acc.user, acc.secure);
        }
      }
    }

    // No selection — auto-fallback to first connected Gmail
    if (apps.gmail?.connected && apps.gmail?.fields?.smtpUser && apps.gmail?.fields?.smtpPass) {
      const f = apps.gmail.fields;
      return makeT(f.smtpHost || 'smtp.gmail.com', parseInt(f.smtpPort || '587', 10), f.smtpUser, f.smtpPass, customFrom || f.smtpUser);
    }
  } catch { /* fall through */ }

  // Last resort: env vars (admin-only, not shown in UI)
  const host = process.env.AI_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.AI_SMTP_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.AI_SMTP_USER || process.env.SMTP_USER || '';
  const pass = process.env.AI_SMTP_PASSWORD || process.env.SMTP_PASSWORD || '';
  const from = process.env.AI_SMTP_FROM || process.env.SMTP_FROM || user || 'arcellite@localhost';
  return makeT(host, port, user, pass, from);
}
