/**
 * Billing & Plan Routes
 * Handles plan info, Stripe checkout session creation, Stripe webhooks,
 * and post-payment plan activation.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import * as authService from '../services/auth.service.js';
import {
  getUserPlan, activatePlan, setPlanStatus, resolveCapabilities,
  PLAN_FEATURES, type PlanType,
} from '../services/plans.service.js';
import { enforcePlanLimits } from '../services/enforcement.service.js';
import { pool } from '../db/connection.js';

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

/** Read raw body bytes (needed for Stripe webhook signature verification) */
function rawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
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
  if (!authHeader.startsWith('Bearer ')) { sendError(res, 'Authentication required', 401); return null; }
  const user = await authService.validateSession(authHeader.slice(7));
  if (!user) { sendError(res, 'Invalid or expired session', 401); return null; }
  return user;
}

// ── Price ID map (set STRIPE_PRICE_STARTUP and STRIPE_PRICE_GROWTH in .env) ──
function getStripePriceId(planType: PlanType): string | null {
  if (planType === 'startup') return process.env.STRIPE_PRICE_STARTUP || null;
  if (planType === 'growth') return process.env.STRIPE_PRICE_GROWTH || null;
  return null;
}

export async function handleBillingRoutes(req: IncomingMessage, res: ServerResponse, url: string): Promise<boolean> {
  const [pathname] = url.split('?');

  // ── GET /api/billing/plan — current plan info + capabilities ──────────────
  if (pathname === '/api/billing/plan' && req.method === 'GET') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const planData = await getUserPlan(user.id);
      const caps = resolveCapabilities(planData.plan_type, planData.account_type, planData.billing_status);
      sendJson(res, { ok: true, plan: planData, capabilities: caps, features: PLAN_FEATURES });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── POST /api/billing/create-checkout — create Stripe Checkout Session ────
  if (pathname === '/api/billing/create-checkout' && req.method === 'POST') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const body = await parseBody(req);
      const { plan_type } = body as { plan_type: PlanType };

      if (!plan_type || plan_type === 'free') {
        sendError(res, 'Invalid plan type for checkout'); return true;
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        // No Stripe configured — return a special flag so frontend shows contact-us UI
        sendJson(res, { ok: false, no_stripe: true, message: 'Stripe is not configured on this server.' });
        return true;
      }

      const priceId = getStripePriceId(plan_type);
      if (!priceId) {
        sendJson(res, { ok: false, no_stripe: true, message: `No Stripe price configured for the ${plan_type} plan. Set STRIPE_PRICE_${plan_type.toUpperCase()} in .env.` });
        return true;
      }

      const planData = await getUserPlan(user.id);
      const publicUrl = process.env.ARCELLITE_PUBLIC_URL || 'http://localhost:3000';

      // Dynamic import of stripe to avoid hard dep if key not set
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });

      // Reuse existing customer if we have one
      let customerId = planData.stripe_customer_id ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
          metadata: { arcellite_user_id: String(user.id) },
        });
        customerId = customer.id;
        // Persist customer ID early
        await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [customerId, user.id]);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${publicUrl}/billing-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl}/?canceled=1`,
        metadata: {
          arcellite_user_id: String(user.id),
          plan_type,
          upgrade_from: planData.plan_type,
        },
        subscription_data: {
          metadata: { arcellite_user_id: String(user.id), plan_type },
        },
      });

      sendJson(res, { ok: true, checkout_url: session.url });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── POST /api/billing/verify-session — poll after Stripe redirect ─────────
  if (pathname === '/api/billing/verify-session' && req.method === 'POST') {
    const user = await getUser(req, res);
    if (!user) return true;
    try {
      const body = await parseBody(req);
      const { session_id } = body;
      if (!session_id) { sendError(res, 'session_id required'); return true; }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) { sendError(res, 'Stripe not configured', 500); return true; }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        sendError(res, 'Payment not yet complete', 402); return true;
      }

      const planType = (session.metadata?.plan_type as PlanType) || 'startup';
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      await activatePlan(user.id, planType, session.customer as string, subscriptionId);

      const planData = await getUserPlan(user.id);
      const caps = resolveCapabilities(planData.plan_type, planData.account_type, planData.billing_status);

      // Log the upgrade
      await pool.query(
        `INSERT INTO activity_log (user_id, action, details, resource_type)
         VALUES ($1, 'plan_upgraded', $2, 'billing')`,
        [user.id, `Upgraded to ${planType} plan`]
      );

      sendJson(res, { ok: true, plan: planData, capabilities: caps });
    } catch (e) {
      sendError(res, (e as Error).message, 500);
    }
    return true;
  }

  // ── POST /api/billing/webhook — Stripe webhook (raw body, no auth header) ──
  if (pathname === '/api/billing/webhook' && req.method === 'POST') {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { sendJson(res, { received: true }); return true; }

    try {
      const bodyBuffer = await rawBody(req);
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });

      let event: any;
      if (webhookSecret) {
        const sig = req.headers['stripe-signature'] as string;
        event = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
      } else {
        event = JSON.parse(bodyBuffer.toString('utf8'));
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = parseInt(session.metadata?.arcellite_user_id, 10);
          const planType = (session.metadata?.plan_type as PlanType) || 'startup';
          if (userId) {
            const subId = typeof session.subscription === 'string'
              ? session.subscription : session.subscription?.id;
            await activatePlan(userId, planType, session.customer, subId);
          }
          break;
        }
        case 'invoice.payment_failed':
        case 'customer.subscription.past_due': {
          const obj = event.data.object;
          const customerId = obj.customer;
          if (customerId) {
            const r = await pool.query(`SELECT id FROM users WHERE stripe_customer_id = $1`, [customerId]);
            if (r.rows[0]) {
              await setPlanStatus(r.rows[0].id, 'past_due');
              await enforcePlanLimits(r.rows[0].id);
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = sub.customer;
          if (customerId) {
            const r = await pool.query(`SELECT id FROM users WHERE stripe_customer_id = $1`, [customerId]);
            if (r.rows[0]) {
              await setPlanStatus(r.rows[0].id, 'canceled');
              await enforcePlanLimits(r.rows[0].id);
            }
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          if (sub.status === 'active') {
            const customerId = sub.customer;
            if (customerId) {
              const r = await pool.query(`SELECT id FROM users WHERE stripe_customer_id = $1`, [customerId]);
              if (r.rows[0]) {
                await setPlanStatus(r.rows[0].id, 'active');
                await enforcePlanLimits(r.rows[0].id);
              }
            }
          }
          break;
        }
      }

      sendJson(res, { received: true });
    } catch (e) {
      sendError(res, `Webhook error: ${(e as Error).message}`, 400);
    }
    return true;
  }

  return false;
}
