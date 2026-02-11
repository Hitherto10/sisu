/**
 * Detect book format from file extension
 * @param {File} file
 * @returns {string | null}
 */
export function detectFormat(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'epub') return 'epub';
  if (ext === 'txt' || ext === 'text') return 'txt';
  return null;
}

/**
 * Generate unique ID
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
