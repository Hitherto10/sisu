import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LibraryView from '../components/LibraryView';
import AutoHidingHeader from '../components/AutoHidingHeader';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { getAllBooks, saveBook, saveBookFile, deleteBook, saveCover, getCover } from '../lib/db';
import { toast } from '../hooks/use-toast';
import { useFileReader } from '../hooks/useFileReader';

export default function Library() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Theme state: read from localStorage (preferred) with fallback to OS preference
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored) return stored;
    } catch (e) {
      // ignore
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { readFile } = useFileReader();

  // Keep theme in sync with localStorage and system preference changes
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'theme') {
        setTheme(e.newValue || 'light');
      }
    };
    window.addEventListener('storage', onStorage);

    let mql;
    const mqListener = (ev) => setTheme(ev.matches ? 'dark' : 'light');
    if (window.matchMedia) {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      try {
        if (mql.addEventListener) mql.addEventListener('change', mqListener);
        else mql.addListener(mqListener);
      } catch (e) {
        // some browsers may throw; ignore
      }
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (mql) {
        try {
          if (mql.removeEventListener) mql.removeEventListener('change', mqListener);
          else mql.removeListener(mqListener);
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    const allBooks = await getAllBooks();

    // Load covers from IndexedDB
    const booksWithCovers = await Promise.all(
      allBooks.map(async (book) => {
        if (!book.coverUrl || book.coverUrl.startsWith('blob:')) {
          // Try to get from cover store
          const coverData = await getCover(book.id);
          if (coverData?.dataUrl) {
            return { ...book, coverUrl: coverData.dataUrl };
          }
        }
        return book;
      })
    );

    setBooks(booksWithCovers);
    setLoading(false);
  };

  const processFiles = useCallback(
    async (files) => {
      for (const file of Array.from(files)) {
        // Show initial loading toast
        const loadingToast = toast({
          title: 'Processing book...',
          description: `Analyzing "${file.name}"`,
        });

        try {
          const result = await readFile(file);
          const { id, data, ...bookData } = result;

          const book = {
            ...bookData,
            id,
            status: 'want-to-read',
            progress: 0,
            currentPage: bookData.format === 'pdf' ? 1 : undefined,
            currentCfi: bookData.format === 'epub' ? null : undefined,
            currentPageNumber: 0,
            totalPageNumber: 0,
            tags: [],
            notes: [],
          };

          // Save to database
          await saveBookFile({ id, data });
          await saveBook(book);

          // Save cover separately for faster loading
          if (book.coverUrl && book.coverUrl.startsWith('data:')) {
            await saveCover({ id, dataUrl: book.coverUrl });
          }

          setBooks((prev) => {
            // Avoid duplicates if same file uploaded again
            const exists = prev.some(b => b.id === id);
            if (exists) return prev;
            return [book, ...prev];
          });

          loadingToast.dismiss?.();
          toast({
            title: 'Book added!',
            description: `"${book.title}" is ready to read`
          });
        } catch (error) {
          console.error('Error processing book:', error);
          loadingToast.dismiss?.();
          toast({
            title: 'Error processing book',
            description: error.message || 'Failed to parse file',
            variant: 'destructive',
          });
        }
      }
    },
    [readFile],
  );

  const handleUpload = () => fileInputRef.current?.click();

  const handleSelectBook = (book) => {
    navigate(`/read/${book.id}`);
  };

  const handleDeleteBook = async (bookId) => {
    if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      toast({
        title: 'Book deleted',
        description: 'The book has been removed from your library',
      });
    } catch (error) {
      console.error('Error deleting book:', error);
      toast({
        title: 'Error deleting book',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner text="Loading library..." />
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-background text-foreground">
      <AutoHidingHeader className="bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center m-auto gap-2">
          {/* Use light logo when theme is dark, and regular logo when theme is light */}
          <img
            className={`w-23`}
            alt="Sisu logo"
            src={theme === 'dark' ? '/sisu-logo-light.png' : '/sisu-logo.png'}
          />
        </div>
      </AutoHidingHeader>

      <div className="pt-16">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.epub,.mobi,.azw,.azw3,.txt,.text,.cbz,.cbr"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <LibraryView
          books={books}
          onSelectBook={handleSelectBook}
          onUpload={handleUpload}
          onDrop={processFiles}
          onDeleteBook={handleDeleteBook}
        />
      </div>
    </div>
  );
}