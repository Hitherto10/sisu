import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBook, getBookFile, saveBook } from '../lib/db';
import PdfReader from '../components/PdfReader';
import EpubReader from '../components/EpubReader';
import TxtReader from '../components/TxtReader';

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);

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
        progress: Math.round((page / total) * 100),
        lastReadAt: Date.now(),
      };

      saveBook(updated);
      return updated;
    });
  }, []);



  const handleEpubProgress = useCallback(
    (progress) => {
      if (!book) return;
      const updated = { ...book, progress, lastReadAt: Date.now() };
      if (progress >= 95) updated.status = 'finished';
      setBook(updated);
      saveBook(updated);
    },
    [book],
  );

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

  if (!book || !fileData) return null;

  switch (book.format) {
    case 'pdf':
      return <PdfReader book={book} fileData={fileData} onBack={handleBack} onProgressUpdate={handlePdfProgress} />;
    case 'epub':
      return <EpubReader book={book} fileData={fileData} onBack={handleBack} onProgressUpdate={handleEpubProgress} />;
    case 'txt':
      return <TxtReader book={book} fileData={fileData} onBack={handleBack} onProgressUpdate={handleEpubProgress} />;
    default:
      return null;
  }
}
