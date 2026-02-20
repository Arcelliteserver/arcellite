import type { IncomingMessage, ServerResponse } from 'http';

export function handleVaultRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const path = url.split('?')[0];

  // ── Vault usage analytics ──
  if (path === '/api/vault/analytics') {
    import('../analytics.js').then(({ getVaultAnalytics }) => {
      try {
        const analytics = getVaultAnalytics();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(analytics));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Vault audit report (downloadable JSON) ──
  if (path === '/api/vault/audit') {
    import('../analytics.js').then(({ generateAuditReport }) => {
      try {
        const report = generateAuditReport();
        const timestamp = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="vault-audit-${timestamp}.json"`);
        res.end(report);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  return false;
}
