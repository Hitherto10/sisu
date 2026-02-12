import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Compass, Loader2, BookOpen, ExternalLink, ChevronRight } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

const CATEGORIES = [
  { id: 'fiction', label: 'Fiction', query: 'subject:fiction' },
  { id: 'nonfiction', label: 'Non-Fiction', query: 'subject:nonfiction' },
  { id: 'science', label: 'Science', query: 'subject:science' },
  { id: 'history', label: 'History', query: 'subject:history' },
  { id: 'fantasy', label: 'Fantasy', query: 'subject:fantasy' },
  { id: 'mystery', label: 'Mystery', query: 'subject:mystery' },
];

export default function Discover() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState(null);

  const searchBooks = async (searchTerm, isCategory = false) => {
    if (!searchTerm) return;
    setLoading(true);
    setError(null);
    try {
      const formattedQuery = isCategory ? searchTerm : `title:${searchTerm}`;
      const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(formattedQuery)}&limit=15&fields=key,title,author_name,cover_i,first_publish_year,subject`);
      const data = await response.json();
      setResults(data.docs || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to fetch books. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load some initial "featured" books
    searchBooks('subject:classic', true);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSelectedCategory(null);
    searchBooks(query);
  };

  const handleCategoryClick = (cat) => {
    if (selectedCategory === cat.id) {
      setSelectedCategory(null);
      searchBooks('subject:classic', true);
    } else {
      setSelectedCategory(cat.id);
      searchBooks(cat.query, true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-safe px-6">
      <header className="pt-8 pb-6 text-left">
        <h1 className="text-3xl font-serif font-bold text-foreground">Discover</h1>
        <p className="text-sm text-muted-foreground mt-1">Explore new worlds and stories</p>
      </header>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search className="w-4 h-4" />
        </div>
        <Input
          type="search"
          placeholder="Search by title or author..."
          className="pl-10 h-12 bg-card border-border rounded-xl shadow-sm focus:ring-primary"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-6 -mx-6 px-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all border ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="text-sm">Searching the archives...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button variant="link" onClick={() => searchBooks(selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory).query : 'subject:classic', !!selectedCategory)}>
              Retry
            </Button>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 mb-8">
            {results.map((book, idx) => (
              <motion.div
                key={book.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-2xl p-4 border shadow-sm flex gap-4 group hover:border-primary/30 transition-colors"
              >
                <div className="w-20 h-28 rounded-lg overflow-hidden bg-secondary flex-shrink-0 shadow-sm">
                  {book.cover_i ? (
                    <img
                      src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="text-base font-serif font-bold truncate group-hover:text-primary transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {book.author_name?.[0] || 'Unknown Author'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {book.first_publish_year && (
                        <Badge variant="outline" className="text-[10px] font-medium py-0 h-5">
                          {book.first_publish_year}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <a
                      href={`https://openlibrary.org${book.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      Details <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Compass className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground">No books found. Try a different search!</p>
          </div>
        )}
      </div>
    </div>
  );
}
