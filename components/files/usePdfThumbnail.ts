/**
 * Hook to generate PDF first-page thumbnails using PDF.js.
 * Uses an in-memory cache + IndexedDB to avoid re-rendering on every mount.
 */
import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Point PDF.js to its worker (Vite resolves this from node_modules)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── In-memory LRU cache ────────────────────────────────────────
const memCache = new Map<string, string>(); // url → dataURL
const MAX_MEM_CACHE = 80;

function memSet(key: string, value: string) {
  if (memCache.size >= MAX_MEM_CACHE) {
    // evict oldest entry
    const first = memCache.keys().next().value;
    if (first) memCache.delete(first);
  }
  memCache.set(key, value);
}

// ─── IndexedDB persistence ──────────────────────────────────────
const DB_NAME = 'arcellite_thumbnails';
const STORE = 'pdf_thumbs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | undefined> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
  } catch {
    // Silently fail — thumbnail caching is optional
  }
}

// ─── Thumbnail rendering queue (serialize to avoid GPU/memory spikes) ───
let renderQueue: (() => Promise<void>)[] = [];
let activeRenders = 0;
const MAX_CONCURRENT = 2;

function enqueueRender(fn: () => Promise<void>) {
  renderQueue.push(fn);
  drainQueue();
}

function drainQueue() {
  while (activeRenders < MAX_CONCURRENT && renderQueue.length > 0) {
    const job = renderQueue.shift()!;
    activeRenders++;
    job().finally(() => {
      activeRenders--;
      drainQueue();
    });
  }
}

// ─── The hook ───────────────────────────────────────────────────
export function usePdfThumbnail(fileUrl: string | undefined, enabled: boolean): string | null {
  const [thumb, setThumb] = useState<string | null>(
    fileUrl && memCache.has(fileUrl) ? memCache.get(fileUrl)! : null,
  );

  useEffect(() => {
    if (!enabled || !fileUrl) return;

    // Already in memory
    if (memCache.has(fileUrl)) {
      setThumb(memCache.get(fileUrl)!);
      return;
    }

    let cancelled = false;

    const run = async () => {
      // Check IndexedDB
      const cached = await idbGet(fileUrl);
      if (cached) {
        memSet(fileUrl, cached);
        if (!cancelled) setThumb(cached);
        return;
      }

      // Generate thumbnail
      await new Promise<void>((resolve) => {
        enqueueRender(async () => {
          try {
            const pdf = await pdfjsLib.getDocument({ url: fileUrl, disableAutoFetch: true, disableStream: true }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            // Scale to ~300px wide for crisp thumbnails
            const targetWidth = 300;
            const scale = targetWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            const ctx = canvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

            const dataUrl = canvas.toDataURL('image/webp', 0.75);
            memSet(fileUrl, dataUrl);
            await idbSet(fileUrl, dataUrl);
            if (!cancelled) setThumb(dataUrl);

            // Cleanup
            page.cleanup();
            pdf.destroy();
          } catch (e) {
            // Silent — thumbnail generation is best-effort
          }
          resolve();
        });
      });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, enabled]);

  return thumb;
}
