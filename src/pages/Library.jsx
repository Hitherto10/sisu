import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LibraryView from '../components/LibraryView';
import { getAllBooks, saveBook, saveBookFile, deleteBook, saveCover, getCover } from '../lib/db';
import { detectFormat, generateId } from '../lib/book-utils';
import { getCoverArt } from '../lib/cover-utils';
import { toast } from '../hooks/use-toast';

export default function Library() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

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
          const format = detectFormat(file);
          if (!format) {
            toast({
              title: 'Unsupported format',
              description: `${file.name} is not a supported format (PDF, EPUB, TXT)`,
              variant: 'destructive',
            });
            continue;
          }

          const id = generateId();
          const data = await file.arrayBuffer();
          const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

          // Show loading toast
          const loadingToast = toast({
            title: 'Processing book...',
            description: `Extracting cover for "${title}"`,
          });

          try {
            // Clone the buffer for cover extraction (prevents detachment)
            const coverData = data.slice(0);

            // Extract or generate cover
            const coverUrl = await getCoverArt({
              format,
              fileData: coverData,
              title,
              coverUrl: null, // No online URL for local uploads
            });

            const book = {
              id,
              title,
              author: '',
              format,
              coverUrl,
              fileSize: file.size,
              addedAt: Date.now(),
              status: 'want-to-read',
              progress: 0,
              currentPage: format === 'pdf' ? 1 : undefined,
              currentCfi: format === 'epub' ? null : undefined,
              tags: [],
              notes: [],
            };

            // Save to database
            await saveBookFile({ id, data });
            await saveBook(book);

            // Save cover separately for faster loading
            if (coverUrl && coverUrl.startsWith('data:')) {
              await saveCover({ id, dataUrl: coverUrl });
            }

            setBooks((prev) => [book, ...prev]);

            loadingToast.dismiss?.();
            toast({
              title: 'Book added!',
              description: `"${title}" is ready to read`
            });
          } catch (error) {
            console.error('Error processing book:', error);
            loadingToast.dismiss?.();
            toast({
              title: 'Error processing book',
              description: error.message,
              variant: 'destructive',
            });
          }
        }
      },
      [],
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
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading library...</p>
          </div>
        </div>
    );
  }

  return (
      <>
        <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,.txt,.text"
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
      </>
  );
}