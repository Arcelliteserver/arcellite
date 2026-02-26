import type { IncomingMessage, ServerResponse } from 'http';
import { handleFileRoutes } from './files.routes.js';
import { handleTrashRoutes } from './trash.routes.js';
import { handleDatabaseRoutes } from './databases.routes.js';
import { handleAnalyticsRoutes } from './analytics.routes.js';
import { handleAIRoutes } from './ai.routes.js';
import { handleExportRoutes } from './export.routes.js';
import { handleSupportRoutes } from './support.routes.js';
import { handleTransferRoutes } from './transfer.routes.js';
import { handleChatRoutes } from './chat.routes.js';
import { handleSystemRoutes } from './system.routes.js';
import { handleVaultRoutes } from './vault.routes.js';
import { handleAppsRoutes } from './apps.routes.js';
import { handleFamilyRoutes } from './family.routes.js';
import { handleShareRoutes } from './share.routes.js';
import { handleHealthRoutes } from './health.routes.js';
import { handleBackupRoutes } from './backup.routes.js';
import { handleUpdateRoutes } from './update.routes.js';
import { handleTasksRoutes } from './tasks.routes.js';
import { handleBillingRoutes } from './billing.routes.js';

/**
 * Central router that handles all API routes
 * Returns true if a route was handled, false otherwise
 */
export async function handleApiRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  // Health check — unauthenticated, first priority for uptime monitors
  if (await handleHealthRoutes(req, res, url)) return true;
  if (await handleBackupRoutes(req, res, url)) return true;
  if (await handleUpdateRoutes(req, res, url)) return true;
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
  if (handleSystemRoutes(req, res, url)) return true;
  if (handleVaultRoutes(req, res, url)) return true;
  if (handleAppsRoutes(req, res, url)) return true;
  if (handleFamilyRoutes(req, res, url)) return true;
  if (handleShareRoutes(req, res, url)) return true;
  if (await handleTasksRoutes(req, res, url)) return true;
  if (await handleBillingRoutes(req, res, url)) return true;
  // No route matched
  return false;
}
