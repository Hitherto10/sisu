// Book format constants
export const BOOK_FORMATS = {
  PDF: 'pdf',
  EPUB: 'epub',
  TXT: 'txt'
};

// Book status constants
export const BOOK_STATUS = {
  WANT_TO_READ: 'want-to-read',
  READING: 'reading',
  FINISHED: 'finished'
};

// JSDoc type definitions for reference
/**
 * @typedef {'pdf' | 'epub' | 'txt'} BookFormat
 * @typedef {'want-to-read' | 'reading' | 'finished'} BookStatus
 * 
 * @typedef {Object} Book
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {BookFormat} format
 * @property {string} [coverUrl]
 * @property {number} fileSize
 * @property {number} addedAt
 * @property {number} [lastReadAt]
 * @property {BookStatus} status
 * @property {number} progress - 0-100
 * @property {number} [currentPage]
 * @property {number} [totalPages]
 * @property {number} [rating] - 1-5
 * @property {string[]} tags
 * @property {string[]} notes
 * 
 * @typedef {Object} BookFile
 * @property {string} id
 * @property {ArrayBuffer} data
 * 
 * @typedef {Object} ReadingSession
 * @property {string} id
 * @property {string} bookId
 * @property {number} startedAt
 * @property {number} endedAt
 * @property {number} pagesRead
 * 
 * @typedef {Object} ReadingGoal
 * @property {number} dailyPages
 * @property {number} weeklyBooks
 * @property {number} currentStreak
 * @property {number} longestStreak
 * @property {string} lastReadDate - YYYY-MM-DD
 */
