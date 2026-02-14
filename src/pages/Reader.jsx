import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBook, getBookFile, saveBook, updateReadingStats, getReadingGoal, saveReadingGoal } from '../lib/db';
import UnifiedBookReader from "../components/UnifiedBookReader.jsx";
import { LoadingSpinner } from "../components/ui/loading-spinner";

// Global memory cache for book files (persists across component unmounts)
const fileCache = new Map();
const CACHE_SIZE_LIMIT = 3; // Keep last 3 books in memory

// Helper to safely clone ArrayBuffer for caching
function cloneArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(0);
  }
  return buffer;
}

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrollDirection, setScrollDirection] = useState('paginated');

  // Use refs to prevent unnecessary re-renders from callback dependencies
  const bookRef = useRef(null);
  const savePendingRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Keep bookRef in sync with book state
  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  useEffect(() => {
    // Load scroll direction preference
    const saved = localStorage.getItem('reading-scroll-direction');
    if (saved) {
      setScrollDirection(saved);
    }
  }, []);

  useEffect(() => {
    if (!id) return;

    const loadBook = async () => {
      // Check memory cache first
      const cachedFile = fileCache.get(id);

      if (cachedFile) {
        // Fast path: book is cached
        const b = await getBook(id);
        if (!b) {
          navigate('/');
          return;
        }

        b.status = 'reading';
        b.lastReadAt = Date.now();
        saveBook(b);
        setBook(b);
        // Clone the cached data to prevent ArrayBuffer detachment issues
        setFileData(cloneArrayBuffer(cachedFile));
        setLoading(false);
      } else {
        // Slow path: need to fetch from IndexedDB
        const [b, f] = await Promise.all([getBook(id), getBookFile(id)]);

        if (!b || !f) {
          navigate('/');
          return;
        }

        // Clone before caching to preserve original for this render
        const clonedData = cloneArrayBuffer(f.data);
        fileCache.set(id, clonedData);

        // Limit cache size
        if (fileCache.size > CACHE_SIZE_LIMIT) {
          const firstKey = fileCache.keys().next().value;
          fileCache.delete(firstKey);
        }

        b.status = 'reading';
        b.lastReadAt = Date.now();
        saveBook(b);
        setBook(b);
        // Use the original data for this render
        setFileData(f.data);
        setLoading(false);
      }
    };

    loadBook();
  }, [id, navigate]);

  const handleBack = useCallback(() => navigate('/'), [navigate]);

  // Batched save function to prevent excessive DB writes
  const scheduleSave = useCallback((updated) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    savePendingRef.current = true;

    // Debounce saves to max 1 per 2 seconds
    saveTimerRef.current = setTimeout(() => {
      if (savePendingRef.current && bookRef.current) {
        saveBook(bookRef.current);
        savePendingRef.current = false;
      }
    }, 2000);
  }, []);

  // Flush any pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (savePendingRef.current && bookRef.current) {
        saveBook(bookRef.current);
      }
    };
  }, []);

  const handlePdfProgress = useCallback((page, total) => {
    const prevBook = bookRef.current;
    if (!prevBook || prevBook.currentPage === page) return;

    const updated = {
      ...prevBook,
      currentPage: page,
      totalPages: total,
      currentPageNumber: page,
      totalPageNumber: total,
      progress: Math.round((page / total) * 100),
      lastReadAt: Date.now(),
    };

    setBook(updated);
    scheduleSave(updated);
    updateReadingStats(1);
  }, [scheduleSave]);

  const handleEbookProgress = useCallback((progress, cfi, page, total) => {
    const prevBook = bookRef.current;
    if (!prevBook) return;

    const updated = {
      ...prevBook,
      progress,
      currentCfi: cfi,
      currentPageNumber: page,
      totalPageNumber: total,
      lastReadAt: Date.now(),
    };

    // Mark as finished if progress >= 95%
    if (progress >= 95 && prevBook.status !== 'finished') {
      updated.status = 'finished';
      getReadingGoal().then(goal => {
        saveReadingGoal({
          ...goal,
          totalBooksCompleted: (goal.totalBooksCompleted || 0) + 1
        });
      });
    }

    setBook(updated);
    scheduleSave(updated);
    updateReadingStats(1);
  }, [scheduleSave]);

  const handleTxtProgress = useCallback((progress) => {
    const prevBook = bookRef.current;
    if (!prevBook || prevBook.progress === progress) return;

    const updated = {
      ...prevBook,
      progress,
      lastReadAt: Date.now(),
    };

    if (progress >= 95 && prevBook.status !== 'finished') {
      updated.status = 'finished';
      getReadingGoal().then(goal => {
        saveReadingGoal({
          ...goal,
          totalBooksCompleted: (goal.totalBooksCompleted || 0) + 1
        });
      });
    }

    setBook(updated);
    scheduleSave(updated);
    updateReadingStats(1);
  }, [scheduleSave]);

  // New: handle metadata extracted from PDF viewer (title/author)
  const handleMetaExtracted = useCallback((meta) => {
    if (!meta) return;

    const prevBook = bookRef.current;
    if (!prevBook) return;

    let changed = false;
    const updated = { ...prevBook };

    if (meta.title && (!updated.title || updated.title === '' || updated.title === prevBook.filename)) {
      updated.title = meta.title;
      changed = true;
    }
    if (meta.author && (!updated.author || updated.author === '')) {
      updated.author = meta.author;
      changed = true;
    }

    if (changed) {
      setBook(updated);
      saveBook(updated); // Save immediately for metadata
    }
  }, []);

  // Memoize the progress handler to prevent UnifiedBookReader re-renders
  const progressHandler = useMemo(() => {
    return book?.format === 'pdf'
        ? handlePdfProgress
        : (book?.format === 'txt' ? handleTxtProgress : handleEbookProgress);
  }, [book?.format, handlePdfProgress, handleTxtProgress, handleEbookProgress]);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
          <LoadingSpinner text="Loading book..." />
        </div>
    );
  }

  return (
      <UnifiedBookReader
          book={book}
          fileData={fileData}
          onBack={handleBack}
          onProgressUpdate={progressHandler}
          scrollDirection={scrollDirection}
          onMetaExtracted={handleMetaExtracted}
      />
  );
}