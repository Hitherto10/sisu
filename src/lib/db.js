import { openDB } from 'idb';

const DB_NAME = 'sisu-db';
const DB_VERSION = 2; // Incremented for cover storage

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('bookId', 'bookId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        // New store for cover images
        if (!db.objectStoreNames.contains('covers')) {
          db.createObjectStore('covers', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Books
export async function getAllBooks() {
  const db = await getDB();
  return db.getAll('books');
}

export async function getBook(id) {
  const db = await getDB();
  return db.get('books', id);
}

export async function saveBook(book) {
  const db = await getDB();
  await db.put('books', book);
}

export async function deleteBook(id) {
  const db = await getDB();

  // Get the book to revoke any object URLs
  const book = await db.get('books', id);
  if (book?.coverUrl && book.coverUrl.startsWith('blob:')) {
    URL.revokeObjectURL(book.coverUrl);
  }

  // Delete from all stores
  await db.delete('books', id);
  await db.delete('files', id);
  await db.delete('covers', id);

  // Delete all sessions for this book
  const tx = db.transaction('sessions', 'readwrite');
  const index = tx.store.index('bookId');
  const sessions = await index.getAllKeys(id);
  await Promise.all(sessions.map(sessionId => db.delete('sessions', sessionId)));
  await tx.done;
}

// Files
export async function saveBookFile(file) {
  const db = await getDB();
  await db.put('files', file);
}

export async function getBookFile(id) {
  const db = await getDB();
  return db.get('files', id);
}

// Covers
export async function saveCover(cover) {
  const db = await getDB();
  await db.put('covers', cover);
}

export async function getCover(id) {
  const db = await getDB();
  return db.get('covers', id);
}

// Sessions
export async function saveSession(session) {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSessionsByBook(bookId) {
  const db = await getDB();
  return db.getAllFromIndex('sessions', 'bookId', bookId);
}

// Settings / Goals
export async function getReadingGoal() {
  const db = await getDB();
  const goal = await db.get('settings', 'reading-goal');
  return goal?.value ?? {
    dailyPages: 20,
    weeklyBooks: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastReadDate: '',
  };
}

export async function saveReadingGoal(goal) {
  const db = await getDB();
  await db.put('settings', { key: 'reading-goal', value: goal });
}