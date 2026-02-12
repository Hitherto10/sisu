import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBook, getBookFile, saveBook, updateReadingStats, getReadingGoal, saveReadingGoal } from '../lib/db';
import UnifiedBookReader from "../components/UnifiedBookReader.jsx";

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrollDirection, setScrollDirection] = useState('paginated');

  useEffect(() => {
    // Load scroll direction preference
    const saved = localStorage.getItem('reading-scroll-direction');
    if (saved) {
      setScrollDirection(saved);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([getBook(id), getBookFile(id)]).then(([b, f]) => {
      if (!b || !f) {
        navigate('/');
        return;
      }
      // Mark as reading
      b.status = 'reading';
      b.lastReadAt = Date.now();
      saveBook(b);
      setBook(b);
      setFileData(f.data);
      setLoading(false);
    });
  }, [id, navigate]);

  const handleBack = () => navigate('/');

  const handlePdfProgress = useCallback((page, total) => {
    setBook((prevBook) => {
      if (!prevBook || prevBook.currentPage === page) return prevBook;

      const updated = {
        ...prevBook,
        currentPage: page,
        totalPages: total,
        currentPageNumber: page,
        totalPageNumber: total,
        progress: Math.round((page / total) * 100),
        lastReadAt: Date.now(),
      };

      saveBook(updated);
      updateReadingStats(1);
      return updated;
    });
  }, []);

  const handleEbookProgress = useCallback((progress, cfi, page, total) => {
    setBook((prevBook) => {
      if (!prevBook) return prevBook;

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

      saveBook(updated);
      updateReadingStats(1);
      return updated;
    });
  }, []);

  const handleTxtProgress = useCallback((progress) => {
    setBook((prevBook) => {
      if (!prevBook || prevBook.progress === progress) return prevBook;

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

      saveBook(updated);
      updateReadingStats(1);
      return updated;
    });
  }, []);

  // New: handle metadata extracted from PDF viewer (title/author)
  const handleMetaExtracted = useCallback((meta) => {
    if (!meta) return;
    setBook((prevBook) => {
      if (!prevBook) return prevBook;
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
        saveBook(updated);
        return updated;
      }
      return prevBook;
    });
  }, []);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading book...</p>
          </div>
        </div>
    );
  }

  return (
      <UnifiedBookReader
          book={book}
          fileData={fileData}
          onBack={handleBack}
          onProgressUpdate={book.format === 'pdf' ? handlePdfProgress : (book.format === 'txt' ? handleTxtProgress : handleEbookProgress)}
          scrollDirection={scrollDirection}
          onMetaExtracted={handleMetaExtracted}
      />
  );
}