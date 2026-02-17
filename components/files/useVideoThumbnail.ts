import { useState, useEffect } from 'react';

/**
 * Cache for video thumbnails (persistent across renders).
 * Key: video URL, Value: data URL of thumbnail image.
 */
const thumbnailCache = new Map<string, string>();

/**
 * Generates a thumbnail from a video URL by loading the first frame
 * into a hidden video element and drawing it to a canvas.
 * Works on mobile browsers where <video preload="metadata"> won't render.
 */
export function useVideoThumbnail(videoUrl: string | undefined, enabled = true): string | null {
  const [thumbnail, setThumbnail] = useState<string | null>(() => {
    if (!videoUrl) return null;
    return thumbnailCache.get(videoUrl) ?? null;
  });

  useEffect(() => {
    if (!videoUrl || !enabled) return;

    // Already cached
    if (thumbnailCache.has(videoUrl)) {
      setThumbnail(thumbnailCache.get(videoUrl)!);
      return;
    }

    let cancelled = false;
    const video = document.createElement('video');
    // Don't set crossOrigin — videos are same-origin, and setting it
    // causes CORS failures in PWA/TWA mode where the server doesn't
    // return Access-Control-Allow-Origin headers.
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    };

    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        // Use a reasonable thumbnail size (not full resolution)
        const maxDim = 320;
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w === 0 || h === 0) return;

        if (w > h) {
          if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        } else {
          if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        if (!cancelled && dataUrl && dataUrl.length > 100) {
          thumbnailCache.set(videoUrl, dataUrl);
          setThumbnail(dataUrl);
        }
      } catch {
        // Canvas tainted or other error — ignore
      }
      cleanup();
    };

    const onSeeked = () => {
      // Small delay to ensure frame is rendered
      setTimeout(() => {
        if (!cancelled) captureFrame();
      }, 100);
    };

    const onLoaded = () => {
      // Seek to 1 second or 10% of duration for a better thumbnail
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    const onError = () => {
      if (!cancelled) cleanup();
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });

    video.src = videoUrl;

    // Timeout: if thumbnail not generated in 8s, give up
    const timeout = setTimeout(() => {
      if (!cancelled && !thumbnailCache.has(videoUrl)) {
        cleanup();
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cleanup();
    };
  }, [videoUrl, enabled]);

  return thumbnail;
}
