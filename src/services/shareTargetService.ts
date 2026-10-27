/**
 * Web Share Target Service
 * Manages receipt images shared from Android system Share sheet (Gallery, WhatsApp, Mobile Banking)
 * Communicates with Service Worker via IndexedDB & postMessage
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const SHARE_DB_NAME = 'rupiahku_share_target_db';
const SHARE_STORE_NAME = 'shared_files';
const SHARE_DB_VERSION = 1;

export interface SharedReceiptData {
  file: File;
  name: string;
  type: string;
  size: number;
  title?: string;
  text?: string;
  url?: string;
  receivedAt: number;
}

/**
 * Open IndexedDB shared store
 */
export function openShareTargetDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB tidak didukung pada browser ini.'));
    }

    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves a shared file into IndexedDB (used by tests or manual share dispatch)
 */
export async function saveSharedReceipt(
  file: File | Blob,
  extra: { title?: string; text?: string; url?: string } = {}
): Promise<void> {
  const db = await openShareTargetDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SHARE_STORE_NAME);
    const data = {
      id: 'pending_receipt',
      file,
      name: file instanceof File ? file.name : 'shared_receipt.jpg',
      type: file.type || 'image/jpeg',
      size: file.size,
      lastModified: file instanceof File ? file.lastModified : Date.now(),
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

/**
 * Atomically retrieves and deletes the pending shared receipt from IndexedDB.
 * This guarantees zero duplicate processing on reloads or re-renders.
 */
export async function getAndClearPendingSharedReceipt(): Promise<SharedReceiptData | null> {
  try {
    const db = await openShareTargetDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SHARE_STORE_NAME);
      const req = store.get('pending_receipt');

      req.onsuccess = () => {
        const result = req.result;
        if (result && result.file) {
          // Immediately delete so it won't be processed again
          store.delete('pending_receipt');

          let finalFile: File;
          if (result.file instanceof File) {
            finalFile = result.file;
          } else if (result.file instanceof Blob) {
            finalFile = new File([result.file], result.name || 'shared_receipt.jpg', {
              type: result.type || result.file.type || 'image/jpeg',
              lastModified: result.lastModified || Date.now(),
            });
          } else {
            return resolve(null);
          }

          resolve({
            file: finalFile,
            name: result.name || finalFile.name,
            type: result.type || finalFile.type,
            size: result.size || finalFile.size,
            title: result.title,
            text: result.text,
            url: result.url,
            receivedAt: result.receivedAt || Date.now(),
          });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[ShareTargetService] Failed to read pending shared file from IndexedDB:', err);
    return null;
  }
}

/**
 * Validates the shared receipt file.
 * Ensures the file is a recognized image format and within 15MB size limit.
 */
export function validateSharedReceiptFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'File tidak ditemukan.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File gambar kosong atau rusak (0 byte).' };
  }

  // 15MB maximum
  const MAX_SIZE = 15 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Ukuran gambar terlalu besar. Maksimal 15MB.' };
  }

  // Check MIME type or extension
  const mime = file.type.toLowerCase();
  const validMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/bmp',
    'image/gif',
  ];

  const hasValidMime = validMimes.some((vm) => mime.includes(vm.split('/')[1]));
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'bmp'];
  const hasValidExt = ext ? validExtensions.includes(ext) : false;

  if (!hasValidMime && !hasValidExt && !mime.startsWith('image/')) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Mohon bagikan file gambar struk (JPG, PNG, atau WEBP).',
    };
  }

  return { valid: true };
}

/**
 * Removes share-target parameters from window URL cleanly without triggering page reload
 */
export function cleanShareTargetQueryParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('shared-target') || url.searchParams.has('share-target')) {
    url.searchParams.delete('shared-target');
    url.searchParams.delete('share-target');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }
}

/**
 * React Hook to detect and consume shared receipts from Android Share Sheet
 */
export function useShareTargetReceipt() {
  const [sharedReceipt, setSharedReceipt] = useState<SharedReceiptData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const isCheckingRef = useRef(false);

  const checkForPendingReceipt = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const data = await getAndClearPendingSharedReceipt();
      if (data && data.file) {
        // Clean URL query parameter
        cleanShareTargetQueryParam();

        // Validate file
        const validation = validateSharedReceiptFile(data.file);
        if (!validation.valid) {
          setValidationError(validation.error || 'Format gambar tidak valid.');
          setSharedReceipt(null);
        } else {
          setValidationError(null);
          setSharedReceipt(data);
        }
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // 1. Check immediately on mount (covers cold boot)
    checkForPendingReceipt();

    // 2. Listen to ServiceWorker postMessage (covers warm boot / app already open)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RUPIAHKU_SHARED_RECEIPT_PENDING') {
        checkForPendingReceipt();
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // 3. Check on window focus / visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForPendingReceipt();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkForPendingReceipt);

    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkForPendingReceipt);
    };
  }, [checkForPendingReceipt]);

  const clearSharedReceipt = useCallback(() => {
    setSharedReceipt(null);
    setValidationError(null);
  }, []);

  return {
    sharedReceipt,
    validationError,
    clearSharedReceipt,
    checkForPendingReceipt,
  };
}
