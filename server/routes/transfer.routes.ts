/**
 * Transfer Routes
 * API endpoints for transferring Arcellite data between devices via USB.
 *
 * POST /api/transfer/prepare   — Prepare transfer package on USB
 * GET  /api/transfer/status    — Get current transfer progress
 * GET  /api/transfer/detect    — Detect transfer data on connected USBs
 * POST /api/transfer/import    — Import transfer data from USB
 */

import type { IncomingMessage, ServerResponse } from 'http';
import {
  prepareTransferPackage,
  getTransferProgress,
  detectTransferOnDevice,
  importTransferData,
} from '../services/transfer.service.js';
import { getRemovableDevices } from '../storage.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function handleTransferRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  // ── Prepare transfer package ──────────────────────────────────────────────
  if (url === '/api/transfer/prepare' && req.method === 'POST') {
    (async () => {
      try {
        const body = JSON.parse(await readBody(req));
        const { mountpoint } = body;

        if (!mountpoint) {
          return json(res, 400, { error: 'mountpoint is required' });
        }

        // Start preparation (non-blocking response)
        json(res, 200, { started: true, message: 'Transfer preparation started' });

        // Run in background
        prepareTransferPackage(mountpoint).then((result) => {
          console.log('[Transfer] Prepare result:', result.success ? 'success' : result.error);
        });
      } catch (e) {
        json(res, 500, { error: 'Failed to start transfer: ' + (e as Error).message });
      }
    })();
    return true;
  }

  // ── Get transfer progress ─────────────────────────────────────────────────
  if (url === '/api/transfer/status' && req.method === 'GET') {
    const progress = getTransferProgress();
    json(res, 200, progress);
    return true;
  }

  // ── Detect transfer data on connected USBs ────────────────────────────────
  if (url === '/api/transfer/detect' && req.method === 'GET') {
    try {
      const devices = getRemovableDevices();
      const results: Array<{
        device: string;
        mountpoint: string;
        model: string;
        sizeHuman: string;
        manifest: ReturnType<typeof detectTransferOnDevice>;
      }> = [];

      for (const device of devices) {
        if (!device.mountpoint) continue;
        const manifest = detectTransferOnDevice(device.mountpoint);
        if (manifest) {
          results.push({
            device: device.name,
            mountpoint: device.mountpoint,
            model: device.model,
            sizeHuman: device.sizeHuman,
            manifest,
          });
        }
      }

      json(res, 200, { found: results.length > 0, devices: results });
    } catch (e) {
      json(res, 500, { error: 'Detection failed: ' + (e as Error).message });
    }
    return true;
  }

  // ── Import transfer data ──────────────────────────────────────────────────
  if (url === '/api/transfer/import' && req.method === 'POST') {
    (async () => {
      try {
        const body = JSON.parse(await readBody(req));
        const { mountpoint, password } = body;

        if (!mountpoint || !password) {
          return json(res, 400, { error: 'mountpoint and password are required' });
        }

        if (password.length < 8) {
          return json(res, 400, { error: 'Password must be at least 8 characters' });
        }

        // Start import (respond immediately, poll /status for progress)
        json(res, 200, { started: true, message: 'Import started' });

        importTransferData(mountpoint, password).then((result) => {
          console.log('[Transfer] Import result:', result.success ? 'success' : result.error);
        });
      } catch (e) {
        json(res, 500, { error: 'Failed to start import: ' + (e as Error).message });
      }
    })();
    return true;
  }

  return false;
}
