// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered successfully:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      });

    // Listen for service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New service worker activated');
      // Optionally reload the page to get the new version
      // window.location.reload();
    });
  });
}

// Handle beforeinstallprompt for custom install button
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('[PWA] Install prompt available');
  // Prevent the default browser install prompt
  e.preventDefault();
  // Store the event for later use
  deferredPrompt = e;
  
  // Show custom install button (you can trigger this from your UI)
  // Example: showInstallButton();
});

// Function to trigger install (call this from your UI)
window.installPWA = async () => {
  if (!deferredPrompt) {
    return;
  }
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for user response
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] User choice:', outcome);
  
  // Clear the deferred prompt
  deferredPrompt = null;
};

// Handle app installed event
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed successfully');
  deferredPrompt = null;
});

