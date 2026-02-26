import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertTriangle, Loader2, CreditCard,
  Zap, Users, Shield, Webhook, Building2, Lock,
  ExternalLink, ArrowRight, Star,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlanData {
  plan_type: 'free' | 'startup' | 'growth';
  account_type: 'personal' | 'organization';
  billing_status: 'none' | 'active' | 'past_due' | 'canceled';
  plan_activated_at: string | null;
}

interface Capabilities {
  max_users: number;
  max_automation_rules: number;
  team_management: boolean;
  webhook_support: boolean;
  audit_logs: boolean;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers ?? {}) },
  });
}

// ── Pricing config ────────────────────────────────────────────────────────────

const WEBSITE_URL = 'https://www.arcellite.com';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    badge: 'Community',
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: 'For individuals and experimentation.',
    cta: 'Get Started Free',
    ctaStyle: 'outline' as const,
    ctaHref: null, // current plan / no action
    highlight: false,
    features: [
      'Local deployment',
      'Core platform features',
      'Unlimited users (self-managed)',
      'Community support',
      'Manual backups',
    ],
  },
  {
    id: 'startup',
    name: 'Startup',
    badge: null,
    monthlyPrice: 99,
    yearlyPrice: 82, // $99 * 10 / 12 ≈ $82/mo
    founderNote: 'Founder price — lock in $99/month for your first 12 months. After 12 months, pricing reverts to standard $199/month.',
    standardPrice: 199,
    tagline: 'Best for: Seed-stage startups & internal tools',
    cta: 'Apply for Founder Access',
    ctaStyle: 'primary' as const,
    ctaHref: `${WEBSITE_URL}/pricing`,
    highlight: false,
    features: [
      'Everything in Free',
      'Production deployment support',
      'Automated backups',
      'Advanced role-based access control',
      'Audit logs',
      'Basic SSO (Google / Microsoft)',
      'Email priority support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    badge: 'Most Popular',
    monthlyPrice: 299,
    yearlyPrice: 249, // $299 * 10 / 12 ≈ $249/mo
    founderNote: 'Limited Founder Pricing — valid for first 12 months. Renews at standard $499/month after year one.',
    standardPrice: 499,
    tagline: 'Best for: Scaling SaaS & multi-team companies',
    cta: 'Scale With Confidence',
    ctaStyle: 'highlight' as const,
    ctaHref: `${WEBSITE_URL}/pricing`,
    highlight: true,
    features: [
      'Everything in Startup',
      'Multi-server clustering',
      'High availability',
      'Advanced SSO (LDAP / SAML / AD)',
      'SLA-backed support',
      'Performance optimization tools',
      'Limited deployment consulting hours',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    badge: null,
    monthlyPrice: null, // starting at $15k/year
    yearlyPrice: null,
    tagline: 'Best for: Large organizations & regulated industries',
    cta: 'Talk to Sales',
    ctaStyle: 'dark' as const,
    ctaHref: `${WEBSITE_URL}/contact`,
    highlight: false,
    features: [
      'Everything in Growth',
      'Dedicated support channel',
      'Architecture & security review',
      'Custom integrations',
      'Compliance assistance',
      'Deployment engineering support',
      'Priority roadmap influence',
    ],
  },
];

// ── Main component ─────────────────────────────────────────────────────────────

interface PlanBillingViewProps {
  showToast?: (msg: string, type?: string) => void;
}

const PlanBillingView: React.FC<PlanBillingViewProps> = ({ showToast }) => {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    apiFetch('/api/billing/plan')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPlanData(data.plan);
          setCaps(data.capabilities);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Check if we just returned from a billing redirect
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      apiFetch('/api/billing/verify-session', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setPlanData(data.plan);
            setCaps(data.capabilities);
            showToast?.('Plan activated! Welcome to your new plan.', 'success');
          }
        })
        .catch(() => {});
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    );
  }

  const currentPlan = planData?.plan_type ?? 'free';
  const isPastDue = planData?.billing_status === 'past_due';
  const isCanceled = planData?.billing_status === 'canceled';

  return (
    <div className="py-2">
      {/* Header */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">Plan & Billing</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your account plan and billing</p>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isPastDue && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[14px] font-bold text-amber-800">Payment past due</p>
            <p className="text-[13px] text-amber-700 mt-0.5">
              Your subscription payment failed. Organization features are temporarily limited.
              Some automation rules may be paused.
            </p>
            <a
              href={`${WEBSITE_URL}/billing`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[13px] font-bold text-amber-700 hover:text-amber-900"
            >
              Update payment method <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
      {isCanceled && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-bold text-gray-700">Subscription canceled</p>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Your plan has been canceled. Your data is intact — locked features will re-activate when you upgrade again.
            </p>
          </div>
        </div>
      )}

      {/* Current plan summary card */}
      <div className="mb-8 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              currentPlan !== 'free' ? 'bg-[#5D5FEF]/10' : 'bg-gray-100'
            }`}>
              {currentPlan === 'free' ? <Zap className="w-6 h-6 text-gray-400" /> : <Building2 className="w-6 h-6 text-[#5D5FEF]" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[15px] font-bold text-gray-900 capitalize">
                  {currentPlan === 'free' ? 'Free — Community' : `${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan`}
                </p>
                {planData?.billing_status === 'active' && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-md">Active</span>
                )}
                {isPastDue && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-md">Past Due</span>
                )}
                {isCanceled && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] font-bold rounded-md">Canceled</span>
                )}
              </div>
              <p className="text-[13px] text-gray-500 mt-0.5">
                {currentPlan === 'free' ? 'Personal — for individuals and self-hosters' : 'Organization mode enabled'}
              </p>
            </div>
          </div>
          {currentPlan === 'free' && (
            <a
              href={`${WEBSITE_URL}/pricing`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-[#5D5FEF] text-white text-[13px] font-semibold rounded-xl hover:bg-[#4D4FCF] transition-all shadow-sm shadow-[#5D5FEF]/20"
            >
              <Building2 className="w-4 h-4" />
              Upgrade Plan
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Usage capabilities */}
        {caps && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
            {[
              { label: 'Max Users', value: caps.max_users === 1 ? '1 user' : `${caps.max_users} users`, icon: Users, ok: true },
              { label: 'Automation Rules', value: `Up to ${caps.max_automation_rules}`, icon: Zap, ok: true },
              { label: 'Webhooks', value: caps.webhook_support ? 'Included' : 'Not available', icon: Webhook, ok: caps.webhook_support },
              { label: 'Audit Logs', value: caps.audit_logs ? 'Included' : 'Not available', icon: Shield, ok: caps.audit_logs },
            ].map(({ label, value, icon: Icon, ok }) => (
              <div key={label} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${ok ? 'text-gray-400' : 'text-gray-300'}`} />
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className={`text-[13px] font-bold mt-0.5 ${ok ? 'text-gray-900' : 'text-gray-400'}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing cycle toggle */}
      <div className="flex flex-col items-center mb-8">
        <p className="text-[13px] text-gray-500 mb-3">Choose how you'd like to be billed. Yearly plans save you 2 months.</p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              billingCycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Yearly
            <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">SAVE 2 MO</span>
          </button>
        </div>
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all ${
                plan.highlight
                  ? 'border-[#5D5FEF] shadow-lg shadow-[#5D5FEF]/10'
                  : isCurrent
                    ? 'border-[#5D5FEF]/50'
                    : 'border-gray-200'
              } bg-white`}
            >
              {/* Top accent for highlighted plan */}
              {plan.highlight && (
                <div className="h-1 bg-gradient-to-r from-[#5D5FEF] to-[#818CF8]" />
              )}

              {/* Badge */}
              {(plan.badge || isCurrent) && (
                <div className="px-5 pt-4 pb-0 flex items-center gap-2">
                  {plan.badge && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      plan.badge === 'Most Popular'
                        ? 'bg-[#5D5FEF] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {plan.badge === 'Most Popular' && <Star className="w-3 h-3" />}
                      {plan.badge}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Current
                    </span>
                  )}
                </div>
              )}

              <div className="p-5 flex-1 flex flex-col">
                {/* Name */}
                <h3 className="text-[17px] font-black text-gray-900">{plan.name}</h3>
                <p className="text-[12px] text-gray-500 mt-0.5 mb-4">{plan.tagline}</p>

                {/* Pricing */}
                <div className="mb-5">
                  {plan.monthlyPrice === null ? (
                    // Enterprise
                    <div>
                      <p className="text-[13px] text-gray-500">Starting at</p>
                      <p className="text-[28px] font-black text-gray-900 leading-tight">$15,000</p>
                      <p className="text-[12px] text-gray-500">/ year · Typically $15K–$60K depending on deployment size</p>
                    </div>
                  ) : plan.monthlyPrice === 0 ? (
                    // Free
                    <div>
                      <p className="text-[32px] font-black text-gray-900 leading-tight">$0</p>
                      <p className="text-[12px] text-gray-500">Forever free</p>
                    </div>
                  ) : (
                    // Paid plans
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[32px] font-black text-gray-900 leading-tight">
                          ${billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
                        </span>
                        <span className="text-[13px] text-gray-500">
                          /mo{billingCycle === 'yearly' ? ' billed yearly' : ''}
                        </span>
                      </div>
                      {plan.standardPrice && (
                        <p className="text-[12px] text-gray-400 mt-0.5">
                          Standard price: <span className="line-through">${plan.standardPrice}/mo</span>
                        </p>
                      )}
                      {plan.founderNote && (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-[11px] text-amber-700 leading-relaxed">{plan.founderNote}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[12px] text-gray-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                {isCurrent ? (
                  <div className="w-full py-2.5 bg-gray-100 text-gray-400 text-[13px] font-bold rounded-xl text-center cursor-default">
                    Current Plan
                  </div>
                ) : plan.ctaHref ? (
                  <a
                    href={plan.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] ${
                      plan.ctaStyle === 'highlight'
                        ? 'bg-[#5D5FEF] text-white hover:bg-[#4D4FCF] shadow-sm shadow-[#5D5FEF]/20'
                        : plan.ctaStyle === 'dark'
                          ? 'bg-gray-900 text-white hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <div className="w-full py-2.5 bg-gray-50 text-gray-400 text-[13px] font-bold rounded-xl text-center border border-gray-200">
                    {plan.cta}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="text-center pb-4">
        <p className="text-[12px] text-gray-400">
          All plans protect your data on downgrade — no deletion, just feature limits.{' '}
          <a href={`${WEBSITE_URL}/pricing`} target="_blank" rel="noopener noreferrer" className="text-[#5D5FEF] font-semibold hover:underline">
            See full comparison on our website
          </a>
        </p>
      </div>
    </div>
  );
};

export default PlanBillingView;
