import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LibraryView from '../components/LibraryView';
import { getAllBooks, saveBook, saveBookFile } from '../lib/db';
import { detectFormat, generateId } from '../lib/book-utils';
import { toast } from '../hooks/use-toast';

export default function Library() {
  const [books, setBooks] = useState([]);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAllBooks().then(setBooks);
  }, []);

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

        const book = {
          id,
          title,
          author: '',
          format,
          fileSize: file.size,
          addedAt: Date.now(),
          status: 'want-to-read',
          progress: 0,
          tags: [],
          notes: [],
        };

        await saveBookFile({ id, data });
        await saveBook(book);
        setBooks((prev) => [book, ...prev]);

        toast({ title: 'Book added!', description: `"${title}" is ready to read` });
      }
    },
    [],
  );

  const handleUpload = () => fileInputRef.current?.click();

  const handleSelectBook = (book) => {
    navigate(`/read/${book.id}`);
  };

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
      />
    </>
  );
}
