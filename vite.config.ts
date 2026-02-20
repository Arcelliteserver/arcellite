import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRoutes } from './server/routes/index';
import 'dotenv/config';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['cloud.arcelliteserver.com'],
      },
      plugins: [
        react(),
        {
          name: 'arcellite-api',
          async configureServer(server) {
            // Initialize database on server start
            const { initializeDatabase, isSetupNeeded, cleanupExpiredSessions } = await import('./server/db/connection.js');
            let dbInitialized = false;
            try {
              dbInitialized = await initializeDatabase();
            } catch (error: any) {
              console.error('[Server] Database initialization failed:', error?.message || error);
              console.error('[Server] The dev server will start, but API routes requiring the database will not work.');
              console.error('[Server] Run ./install.sh to set up PostgreSQL, or check your .env configuration.');
            }

            if (dbInitialized) {
              const setupNeeded = await isSetupNeeded();
              if (setupNeeded) {
                console.log('[Server] Initial setup required - no users found');
              } else {
                console.log('[Server] Database initialized with existing users');
                // Pre-populate the global storage path cache from DB so getBaseDir() works immediately
                try {
                  const authSvc = await import('./server/services/auth.service.js');
                  const storagePath = await authSvc.getActiveStoragePath();
                  (globalThis as any).__arcellite_storage_path = storagePath;
                  console.log(`[Server] Active storage path: ${storagePath}`);
                } catch (e) {
                  console.warn('[Server] Could not read storage path from DB, using env default');
                }
              }

              // Clean up expired sessions every hour
              setInterval(() => {
                cleanupExpiredSessions();
              }, 60 * 60 * 1000);
            }

            // ── Security Headers Middleware (must run first, before all routes) ──
            server.middlewares.use((_req, res, next) => {
              // Prevent MIME-type sniffing
              res.setHeader('X-Content-Type-Options', 'nosniff');
              // Block clickjacking via iframes
              res.setHeader('X-Frame-Options', 'DENY');
              // Disable XSS auditor (legacy; nosniff + CSP is the modern fix)
              res.setHeader('X-XSS-Protection', '0');
              // Only send referrer on same-origin requests
              res.setHeader('Referrer-Policy', 'same-origin');
              // Permissions Policy — disable unused browser features
              res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
              // HSTS — enforce HTTPS for 1 year (set only if behind HTTPS proxy)
              if (_req.headers['x-forwarded-proto'] === 'https') {
                res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
              }
              // Content Security Policy — restrict resource origins
              res.setHeader(
                'Content-Security-Policy',
                [
                  "default-src 'self'",
                  // Scripts: self + inline required for Vite HMR
                  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                  // Styles: self + inline (Tailwind/emotion inject inline styles)
                  "style-src 'self' 'unsafe-inline'",
                  // Images: self + blob (thumbnails) + data URIs (base64)
                  "img-src 'self' blob: data: https:",
                  // Media: self + blob (audio/video player)
                  "media-src 'self' blob:",
                  // Connections: self + ws (Vite HMR websocket)
                  "connect-src 'self' ws: wss:",
                  // Workers: self + blob (PDF.js workers)
                  "worker-src 'self' blob:",
                  // Fonts: self
                  "font-src 'self'",
                  // Frames: none
                  "frame-src 'none'",
                  // Object/embed: none
                  "object-src 'none'",
                  // Form targets: self only
                  "form-action 'self'",
                  // Base URI: self (prevent base-tag injection)
                  "base-uri 'self'",
                ].join('; '),
              );
              next();
            });

            server.middlewares.use(async (req, res, next) => {
              const url = req.url?.split('?')[0];
              const fullUrl = req.url ?? '';

              // ── Step 1: Identify the authenticated user (critical for per-user file isolation).
              //    This MUST run in its own try-catch, completely isolated from the security
              //    service below, so a security-service failure never leaves req.user unset
              //    and accidentally serves a family member the owner's files.
              if (fullUrl.startsWith('/api/')
                  && url !== '/api/auth/login' && url !== '/api/auth/register'
                  && url !== '/api/auth/invite-info' && url !== '/api/auth/accept-invite') {
                let token: string | undefined;
                const authHeader = req.headers.authorization;
                if (authHeader?.startsWith('Bearer ')) {
                  token = authHeader.substring(7);
                } else {
                  // Fallback: read session from cookie (browser-initiated audio/video/img requests)
                  const cookies = req.headers.cookie;
                  if (cookies) {
                    const match = cookies.match(/(?:^|;\s*)arcellite_session=([^;]+)/);
                    if (match) token = decodeURIComponent(match[1]);
                  }
                }
                if (token) {
                  try {
                    const authSvc = await import('./server/services/auth.service.js');
                    const user = await authSvc.validateSession(token);
                    if (user) {
                      (req as any).user = user;
                    }
                  } catch { /* never block request flow */ }
                }
              }

              // ── Step 2: Security Middleware: Traffic Masking & Strict Isolation ───
              if (fullUrl.startsWith('/api/')) {
                try {
                  const secService = await import('./server/services/security.service.js');

                  // Apply traffic masking headers if enabled
                  const maskingEnabled = await secService.isTrafficMaskingEnabled();
                  if (maskingEnabled) {
                    const headers = secService.getTrafficMaskingHeaders();
                    for (const [key, value] of Object.entries(headers)) {
                      res.setHeader(key, value);
                    }
                  }

                  // Strict Isolation: block non-authorized IPs
                  if (url !== '/api/auth/login' && url !== '/api/auth/register'
                      && url !== '/api/auth/invite-info' && url !== '/api/auth/accept-invite') {
                    const reqUser = (req as any).user;
                    if (reqUser) {
                      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                        || req.socket?.remoteAddress || '';
                      const allowed = await secService.isIpAllowed(reqUser.id, clientIp);
                      if (!allowed) {
                        res.statusCode = 403;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Access denied: IP not in allowlist (Strict Isolation)' }));
                        return;
                      }
                    }
                  }
                } catch { /* security middleware should never break normal flow */ }
              }

              // Auth routes
              if (url === '/api/auth/invite-info' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetInviteInfo(req, res);
                return;
              }
              if (url === '/api/auth/accept-invite' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleAcceptInvite(req, res);
                return;
              }
              if (url === '/api/auth/register' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleRegister(req, res);
                return;
              }
              if (url === '/api/auth/login' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleLogin(req, res);
                return;
              }
              if (url === '/api/auth/verify-email' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleVerifyEmail(req, res);
                return;
              }
              if (url === '/api/auth/resend-code' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleResendCode(req, res);
                return;
              }
              if (url === '/api/auth/me' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetCurrentUser(req, res);
                return;
              }
              if (url === '/api/auth/logout' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleLogout(req, res);
                return;
              }
              if (url === '/api/auth/profile' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleUpdateProfile(req, res);
                return;
              }
              if (url === '/api/auth/avatar' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleAvatarUpload(req, res);
                return;
              }
              if (url?.match(/^\/api\/auth\/avatar\/\d+/) && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleAvatarServe(req, res);
                return;
              }
              if (url === '/api/auth/complete-setup' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleCompleteSetup(req, res);
                return;
              }
              if (url === '/api/auth/sessions' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetSessions(req, res);
                return;
              }
              if (url?.startsWith('/api/auth/sessions/') && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleRevokeSession(req, res);
                return;
              }
              if (url === '/api/auth/account' && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleDeleteAccount(req, res);
                return;
              }
              if (url === '/api/auth/settings' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetSettings(req, res);
                return;
              }
              if (url === '/api/auth/settings' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleUpdateSettings(req, res);
                return;
              }
              if (url === '/api/auth/reset-settings' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleResetSettings(req, res);
                return;
              }

              // ── Notification routes ──
              if (url === '/api/notifications' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetNotifications(req, res);
                return;
              }
              if (url === '/api/notifications/read-all' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleMarkAllNotificationsRead(req, res);
                return;
              }
              if (url?.match(/^\/api\/notifications\/\d+\/read$/) && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleMarkNotificationRead(req, res);
                return;
              }
              if (url === '/api/notifications/clear-all' && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleClearAllNotifications(req, res);
                return;
              }

              // ── Storage request routes ──
              if (url === '/api/storage/request' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleStorageRequest(req, res);
                return;
              }
              if (url === '/api/storage/requests' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetStorageRequests(req, res);
                return;
              }
              if (url?.match(/^\/api\/storage\/requests\/\d+$/) && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleResolveStorageRequest(req, res);
                return;
              }
              if (url?.match(/^\/api\/storage\/requests\/\d+$/) && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleCancelStorageRequest(req, res);
                return;
              }
              if (url === '/api/storage/breakdown' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleStorageBreakdown(req, res);
                return;
              }
              if (url === '/api/auth/transfer-storage' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleTransferStorage(req, res);
                return;
              }
              if (url === '/api/auth/activity' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetActivityLog(req, res);
                return;
              }

              // Security Vault routes
              if (url === '/api/security/2fa/setup' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handle2FASetup(req, res);
                return;
              }
              if (url === '/api/security/2fa/verify' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handle2FAVerify(req, res);
                return;
              }
              if (url === '/api/security/2fa/disable' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handle2FADisable(req, res);
                return;
              }
              if (url === '/api/security/protocol-action' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleProtocolAction(req, res);
                return;
              }
              if (url === '/api/security/status' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleSecurityStatus(req, res);
                return;
              }
              if (url === '/api/security/ghost-folders' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleAddGhostFolder(req, res);
                return;
              }
              if (url === '/api/security/ghost-folders' && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleRemoveGhostFolder(req, res);
                return;
              }
              if (url === '/api/security/ip-allowlist' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleUpdateIpAllowlist(req, res);
                return;
              }

              // Domain / Cloudflare Tunnel routes
              if (url === '/api/domain/status' && req.method === 'GET') {
                const domainRoutes = await import('./server/routes/domain.routes.js');
                domainRoutes.handleDomainStatus(req, res);
                return;
              }
              if (url === '/api/domain/install-cloudflared' && req.method === 'POST') {
                const domainRoutes = await import('./server/routes/domain.routes.js');
                domainRoutes.handleInstallCloudflared(req, res);
                return;
              }
              if (url === '/api/domain/run-tunnel' && req.method === 'POST') {
                const domainRoutes = await import('./server/routes/domain.routes.js');
                domainRoutes.handleRunTunnel(req, res);
                return;
              }
              if (url === '/api/domain/stop-tunnel' && req.method === 'POST') {
                const domainRoutes = await import('./server/routes/domain.routes.js');
                domainRoutes.handleStopTunnel(req, res);
                return;
              }
              if (url === '/api/domain/save-domain' && req.method === 'PUT') {
                const domainRoutes = await import('./server/routes/domain.routes.js');
                domainRoutes.handleSaveDomain(req, res);
                return;
              }

              if (url?.startsWith('/api/files/recent') && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetRecentFiles(req, res);
                return;
              }
              if (url === '/api/files/track-recent' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleTrackRecentFile(req, res);
                return;
              }
              if (url === '/api/auth/setup-status' && req.method === 'GET') {
                const { isSetupNeeded } = await import('./server/db/connection.js');
                const setupNeeded = await isSetupNeeded();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ setupNeeded }));
                return;
              }
              if (url === '/api/auth/access-status' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleAccessStatus(req, res);
                return;
              }

              // Try organized route modules first
              if (handleApiRoutes(req, res, fullUrl)) {
                return;
              }

              next();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        cssCodeSplit: false,
      },
      publicDir: 'public',
    };
});
