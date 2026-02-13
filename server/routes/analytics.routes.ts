import type { IncomingMessage, ServerResponse } from 'http';

export function handleAnalyticsRoutes(req: IncomingMessage, res: ServerResponse, url: string) {
  // Get analytics data
  if (url === '/api/analytics' && req.method === 'GET') {
    import('../analytics.ts').then(({ getAnalyticsData }) => {
      try {
        const data = getAnalyticsData();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
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
