import type { IncomingMessage, ServerResponse } from 'http';
import { handleFileRoutes } from './files.routes';
import { handleTrashRoutes } from './trash.routes';
import { handleDatabaseRoutes } from './databases.routes';
import { handleAnalyticsRoutes } from './analytics.routes';
import { handleAIRoutes } from './ai.routes';
import { handleExportRoutes } from './export.routes';
import { handleSupportRoutes } from './support.routes';
import { handleTransferRoutes } from './transfer.routes';
import { handleChatRoutes } from './chat.routes';

/**
 * Central router that handles all API routes
 * Returns true if a route was handled, false otherwise
 */
export function handleApiRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): boolean {
  // Try each route handler in order
  if (handleFileRoutes(req, res, url)) return true;
  if (handleTrashRoutes(req, res, url)) return true;
  if (handleDatabaseRoutes(req, res, url)) return true;
  if (handleAnalyticsRoutes(req, res, url)) return true;
  if (handleAIRoutes(req, res, url)) return true;
  if (handleChatRoutes(req, res, url)) return true;
  if (handleExportRoutes(req, res, url)) return true;
  if (handleSupportRoutes(req, res, url)) return true;
  if (handleTransferRoutes(req, res, url)) return true;

  // No route matched
  return false;
}
