/**
 * Transcription Cache Utility
 * Caches transcriptions to avoid sending duplicate audio to the API
 */

interface CachedTranscription {
  hash: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
}

const CACHE_KEY = 'transcription_cache_v1';
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Simple hash function for audio data
 * Uses first 1KB of audio to create a fingerprint
 */
async function hashAudioBlob(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer.slice(0, 1000)); // First 1KB
      let hash = 0;
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) - hash) + bytes[i];
        hash = hash & hash; // Convert to 32bit integer
      }
      resolve(`${hash.toString(36)}-${blob.size}`);
    };
    reader.onerror = () => resolve(`fallback-${blob.size}-${Date.now()}`);
    reader.readAsArrayBuffer(blob.slice(0, 1000));
  });
}

/**
 * Get cached transcription if exists and not expired
 */
export async function getCachedTranscription(blob: Blob): Promise<CachedTranscription | null> {
  try {
    const hash = await hashAudioBlob(blob);
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cache: CachedTranscription[] = JSON.parse(cached);
    const entry = cache.find(c => c.hash === hash);
    
    if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
      console.log('[TranscriptionCache] Cache hit for hash:', hash);
      return entry;
    }
    
    return null;
  } catch (error) {
    console.error('[TranscriptionCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Save transcription to cache
 */
export async function setCachedTranscription(
  blob: Blob,
  originalText: string,
  translatedText: string
): Promise<void> {
  try {
    const hash = await hashAudioBlob(blob);
    const cached = localStorage.getItem(CACHE_KEY);
    let cache: CachedTranscription[] = cached ? JSON.parse(cached) : [];

    // Check if already exists
    const existingIndex = cache.findIndex(c => c.hash === hash);
    if (existingIndex !== -1) {
      // Update existing
      cache[existingIndex] = { hash, originalText, translatedText, timestamp: Date.now() };
    } else {
      // Add new entry
      cache.push({ hash, originalText, translatedText, timestamp: Date.now() });
    }

    // Keep only last MAX_CACHE_SIZE entries
    if (cache.length > MAX_CACHE_SIZE) {
      cache = cache.slice(-MAX_CACHE_SIZE);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log('[TranscriptionCache] Saved hash:', hash);
  } catch (error) {
    console.error('[TranscriptionCache] Error saving to cache:', error);
  }
}

/**
 * Clear all cached transcriptions
 */
export function clearTranscriptionCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[TranscriptionCache] Cache cleared');
  } catch (error) {
    console.error('[TranscriptionCache] Error clearing cache:', error);
  }
}

/**
 * Clean up expired entries from cache
 */
export function cleanupExpiredCache(): void {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return;

    const cache: CachedTranscription[] = JSON.parse(cached);
    const now = Date.now();
    const validEntries = cache.filter(c => (now - c.timestamp) < CACHE_TTL);
    
    if (validEntries.length !== cache.length) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(validEntries));
      console.log('[TranscriptionCache] Cleaned up', cache.length - validEntries.length, 'expired entries');
    }
  } catch (error) {
    console.error('[TranscriptionCache] Error cleaning cache:', error);
  }
}
