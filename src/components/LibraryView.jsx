import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Upload, Search, Star, Plus, BookMarked, Trash2, MoreVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { formatDate, formatFileSize, getProgressColor } from '../lib/book-utils';

const statusLabels = {
  'reading': 'Reading',
  'want-to-read': 'Want to Read',
  'finished': 'Finished',
};

const BookCard = ({ book, onClick, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);

  const isComingSoon = ['mobi', 'cbr'].includes(book.format?.toLowerCase());

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setShowMenu(true);
    }, 500); // Long press duration
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setShowMenu(true);
  };

  return (
      <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          whileHover={!isComingSoon ? { y: -4 } : {}}
          whileTap={!isComingSoon ? { scale: 0.97 } : {}}
          className={`group relative ${isComingSoon ? 'cursor-default' : 'cursor-pointer'}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
      >
        <div
            className={`relative aspect-2/3 rounded-xs overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 bg-secondary ${isComingSoon ? 'opacity-70 grayscale-[0.5]' : ''}`}
            onClick={(e) => {
              if (!showMenu && !isComingSoon) onClick();
            }}
        >
          {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-linear-to-br from-primary/10 to-transparent">
                <BookOpen className="w-10 h-10 text-primary/40 mb-3" />
                <span className="text-xs font-medium text-muted-foreground text-center line-clamp-3 px-2">{book.title}</span>
              </div>
          )}

          {/* Coming Soon Badge Overlay */}
          {isComingSoon && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
               <div className="bg-primary px-3 py-1 rounded-full shadow-lg">
                 <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-wider">Coming Soon</span>
               </div>
            </div>
          )}

          {/* Progress overlay */}
          {!isComingSoon && book.status === 'reading' && book.progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-3">
                <div className="w-full h-1.5 rounded-full bg-white/30 overflow-hidden">
                  <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${book.progress}%`, backgroundColor: getProgressColor(book.progress) }}
                  />
                </div>
                <span className="text-[10px] text-white/80 mt-1 block">{book.progress}%</span>
              </div>
          )}


          {/* Menu button (visible on hover or when menu is shown) */}
          <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className={`absolute top-2 left-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center transition-opacity ${
                  showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Delete menu */}
          {showMenu && (
              <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10"
                  onClick={(e) => e.stopPropagation()}
              >
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(book.id);
                    }}
                    className="rounded-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                    className="rounded-full"
                >
                  Cancel
                </Button>
              </motion.div>
          )}
        </div>

        <div className="mt-2 px-1">
          <h3 className="font-serif text-sm font-bold leading-tight line-clamp-1">{book.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{book.author || 'Unknown Author'}</p>
          {book.rating && (
              <div className="flex items-center gap-0.5 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                        key={i}
                        className={`w-3 h-3 ${i < book.rating ? 'fill-star text-star' : 'text-muted-foreground/30'}`}
                    />
                ))}
              </div>
          )}
        </div>
      </motion.div>
  );
};

export default function LibraryView({ books, onSelectBook, onUpload, onDrop, onDeleteBook }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [dragOver, setDragOver] = useState(false);

  const filtered = books
      .filter((b) => {
        if (filter !== 'all' && b.status !== filter) return false;
        if (search) {
          const q = search.toLowerCase();
          return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => (b.lastReadAt ?? b.addedAt) - (a.lastReadAt ?? a.addedAt));

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
      (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) onDrop(e.dataTransfer.files);
      },
      [onDrop],
  );

  const stats = {
    total: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    finished: books.filter((b) => b.status === 'finished').length,
  };

  const filters = [
    { key: 'all', label: 'All Books' },
    { key: 'reading', label: 'Reading' },
    { key: 'want-to-read', label: 'Want to Read' },
    { key: 'finished', label: 'Finished' },
  ];

  return (
      <div
          className="flex flex-col min-h-full pb-safe"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {dragOver && (
              <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-3xl m-4"
              >
                <div className="text-center">
                  <Upload className="w-16 h-16 text-primary mx-auto mb-4" />
                  <p className="text-xl font-serif font-bold text-primary">Drop your book here</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF, EPUB, or TXT</p>
                </div>
              </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="px-5 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-serif font-bold">My Library</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {stats.total} books · {stats.reading} reading · {stats.finished} finished
              </p>
            </div>
            <Button size="icon" onClick={onUpload} className="rounded-full shadow-md">
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search books..."
                className="pl-10 bg-secondary border-none rounded-xl"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
                <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        filter === f.key
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                >
                  {f.label}
                </button>
            ))}
          </div>
        </header>

        {/* Book grid */}
        <main className="flex-1 px-5">
          {filtered.length === 0 ? (
              <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
              >
                <BookMarked className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-lg font-serif font-bold text-muted-foreground">
                  {books.length === 0 ? 'Your library is empty' : 'No books match your search'}
                </h2>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-[250px]">
                  {books.length === 0
                      ? 'Upload a PDF, EPUB, or TXT file to start reading'
                      : 'Try a different search term or filter'}
                </p>
                {books.length === 0 && (
                    <Button onClick={onUpload} className="mt-4 rounded-full" size="lg">
                      <Upload className="w-4 h-4 mr-2" />
                      Add Your First Book
                    </Button>
                )}
              </motion.div>
          ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                <AnimatePresence>
                  {filtered.map((book) => (
                      <BookCard
                          key={book.id}
                          book={book}
                          onClick={() => onSelectBook(book)}
                          onDelete={onDeleteBook}
                      />
                  ))}
                </AnimatePresence>
              </div>
          )}
        </main>
      </div>
  );
}