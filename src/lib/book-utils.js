/**
 * Detect book format from file extension
 * @param {File} file
 * @returns {string | null}
 */
export function detectFormat(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();

  // Supported by epub.js
  if (ext === 'epub') return 'epub';
  if (ext === 'mobi') return 'epub'; // epub.js can handle MOBI
  if (ext === 'azw' || ext === 'azw3') return 'epub'; // Kindle formats

  // PDFs (handled separately)
  if (ext === 'pdf') return 'pdf';

  // Text files
  if (ext === 'txt' || ext === 'text') return 'txt';

  // Comic book formats (CBZ/CBR are ZIP/RAR with images)
  if (ext === 'cbz' || ext === 'cbr') return 'comic';

  return null;
}

/**
 * Get human-readable format name
 * @param {string} format
 * @returns {string}
 */
export function getFormatLabel(format) {
  const labels = {
    'epub': 'EPUB',
    'pdf': 'PDF',
    'txt': 'TXT',
    'comic': 'Comic',
  };
  return labels[format] || format.toUpperCase();
}

/**
 * Generate unique ID from file buffer (SHA-256)
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export async function generateFileHash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate unique ID (fallback)
 * @returns {string}
 */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * Format bytes to human readable string
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format timestamp to date string
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get progress bar color based on completion
 * @param {number} progress
 * @returns {string}
 */
export function getProgressColor(progress) {
  if (progress >= 80) return 'hsl(var(--accent))';
  if (progress >= 40) return 'hsl(var(--warm-gold))';
  return 'hsl(var(--primary))';
}