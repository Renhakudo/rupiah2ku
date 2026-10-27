// Service Worker Web Share Target Level 2 Handler for RupiahKu PWA
// Intercepts shared receipt images from Android Share Sheet (Gallery, WhatsApp, Mobile Banking)

const SHARE_DB_NAME = 'rupiahku_share_target_db';
const SHARE_STORE_NAME = 'shared_files';
const SHARE_DB_VERSION = 1;

function openShareTargetDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSharedReceiptToDB(file, extra = {}) {
  const db = await openShareTargetDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SHARE_STORE_NAME);
    const data = {
      id: 'pending_receipt',
      file: file, // Store File/Blob directly via Structured Clone
      name: file.name || 'shared_receipt.jpg',
      type: file.type || 'image/jpeg',
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      title: extra.title || '',
      text: extra.text || '',
      url: extra.url || '',
      receivedAt: Date.now(),
    };
    const req = store.put(data);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Intercept POST requests to /share-target
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && (url.pathname === '/share-target' || url.pathname.endsWith('/share-target'))) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();

          // Candidates for image key sent by Android Web Share Target
          let file = null;
          const candidateKeys = ['receipt', 'file', 'image', 'files', 'media', 'document'];
          for (const key of candidateKeys) {
            const val = formData.get(key);
            if (val && typeof val === 'object' && typeof val.arrayBuffer === 'function') {
              file = val;
              break;
            }
          }

          // Fallback: search all formData entries for any file
          if (!file) {
            for (const [, val] of formData.entries()) {
              if (val && typeof val === 'object' && typeof val.arrayBuffer === 'function') {
                file = val;
                break;
              }
            }
          }

          const title = (formData.get('title') || '').toString();
          const text = (formData.get('text') || '').toString();
          const targetUrl = (formData.get('url') || '').toString();

          if (file) {
            await saveSharedReceiptToDB(file, { title, text, url: targetUrl });
          }

          // Broadcast to any open window clients
          try {
            const clients = await self.clients.matchAll({ type: 'window' });
            for (const client of clients) {
              client.postMessage({
                type: 'RUPIAHKU_SHARED_RECEIPT_PENDING',
                hasFile: !!file,
                timestamp: Date.now(),
              });
            }
          } catch (_) {
            // Non-critical if no active clients are available
          }

          // HTTP 303 forces the browser to issue a GET request to the main dashboard
          return Response.redirect('/?shared-target=1', 303);
        } catch (err) {
          console.error('[ServiceWorker] Error processing shared target file:', err);
          return Response.redirect('/?shared-target=error', 303);
        }
      })()
    );
  }
});
