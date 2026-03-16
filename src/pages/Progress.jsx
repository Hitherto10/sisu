import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getReadingGoal, getAllBooks } from '../lib/db';

const FlameIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C12 2 7 8 7 13a5 5 0 0010 0c0-5-5-11-5-11z" fill="currentColor" opacity="0.2"/>
      <path d="M12 2c0 0-5 6-5 11a5 5 0 0010 0C17 8 12 2 12 2z"/>
      <path d="M12 12c0 0-2 2-2 4a2 2 0 004 0c0-2-2-4-2-4z" fill="currentColor"/>
    </svg>
);

const MedalIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="14" r="6"/>
      <path d="M9 3h6l2 4H7L9 3z"/>
      <path d="M12 10v4M10 14h4" strokeWidth="1.2"/>
    </svg>
);

const HourglassIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2h14M5 22h14"/>
      <path d="M6 2v4l6 6-6 6v4M18 2v4l-6 6 6 6v4"/>
      <path d="M9 12h6" strokeWidth="1.2"/>
    </svg>
);

const TrophyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8v10a4 4 0 01-8 0V2z"/>
      <path d="M8 7H4a2 2 0 000 4h4M16 7h4a2 2 0 010 4h-4"/>
      <path d="M12 16v4M9 20h6"/>
    </svg>
);

const ClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3"/>
    </svg>
);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ProgressPage() {
  const [stats, setStats] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);

  const weeklyData = [12, 28, 30, 18, 8, 45, 32];

  useEffect(() => {
    async function loadData() {
      const [goal, allBooks] = await Promise.all([
        getReadingGoal(),
        getAllBooks()
      ]);
      setStats(goal);
      setBooks(allBooks);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return null;

  const inProgressBooks = books.filter(b => b.status === 'reading');
  const finishedBooks = books.filter(b => b.status === 'finished');
  const maxPages = Math.max(...weeklyData, 1);

  const currentlyReading = [
    ...inProgressBooks,
    ...books.filter(b => b.status === 'want-to-read').slice(0, Math.max(0, 3 - inProgressBooks.length))
  ].slice(0, 3);

  return (
      <div className="flex flex-col h-screen overflow-y-auto pb-safe bg-background">
        <header className="px-6 pt-10 pb-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">Your Progress</h1>
        </header>

        <div className="flex-1 px-5 space-y-5 pb-28">

          {/* Top Stats */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl p-5 bg-secondary"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 bg-primary/10 text-primary">
                <FlameIcon />
              </div>
              <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-primary">
                {stats.currentStreak}
              </span>
                <span className="text-sm text-muted-foreground font-medium">day streak</span>
              </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl p-5 bg-secondary"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 bg-primary/10 text-primary">
                <MedalIcon />
              </div>
              <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-primary">
                {stats.totalBooksCompleted || finishedBooks.length}
              </span>
                <span className="text-sm text-muted-foreground font-medium">books finished</span>
              </div>
            </motion.div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl p-4 flex items-center gap-3 bg-secondary"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                <HourglassIcon />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground leading-none">{stats.totalMinutesRead || 0}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">mins read</div>
              </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl p-4 flex items-center gap-3 bg-secondary"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                <TrophyIcon />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground leading-none">{stats.longestStreak}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">best streak</div>
              </div>
            </motion.div>
          </div>

          {/* Weekly Activity Bar Chart */}
          <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl p-5 bg-card border border-border"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-bold text-base text-foreground">Weekly Activity</h2>
              <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-secondary text-muted-foreground border border-border">
              This Week
            </span>
            </div>

            <div className="relative">
              <div className="flex items-end gap-2 h-28 px-1">
                {weeklyData.map((pages, i) => {
                  const heightPct = (pages / maxPages) * 100;
                  const isHighlighted = tooltip === i;

                  return (
                      <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer relative"
                          onMouseEnter={() => setTooltip(i)}
                          onMouseLeave={() => setTooltip(null)}
                          onTouchStart={() => setTooltip(tooltip === i ? null : i)}
                      >
                        {/* Tooltip */}
                        {isHighlighted && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                              <div className="bg-foreground text-background text-[10px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap shadow-lg">
                                {DAYS[i]}<br />
                                <span className="font-normal opacity-80">pages : {pages}</span>
                              </div>
                            </div>
                        )}

                        {/* Bar */}
                        <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: 'easeOut' }}
                            className={`w-full rounded-lg transition-colors duration-150 ${
                                isHighlighted
                                    ? 'bg-primary/70'
                                    : pages > 0
                                        ? 'bg-primary'
                                        : 'bg-muted'
                            }`}
                            style={{
                              height: `${Math.max(heightPct, 6)}%`,
                              minHeight: '6px',
                              transformOrigin: 'bottom',
                            }}
                        />
                      </div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="flex gap-2 mt-2 px-1">
                {DAYS.map((day, i) => (
                    <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">
                      {day}
                    </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Currently Reading */}
          <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
          >
            <h2 className="font-serif font-bold text-lg mb-3 px-1 text-foreground">Currently Reading</h2>

            {currentlyReading.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-secondary/40">
                  <p className="text-sm text-muted-foreground">No books in progress yet.<br />Start reading to track your progress!</p>
                </div>
            ) : (
                <div className="space-y-3">
                  {currentlyReading.map((book, idx) => (
                      <motion.div
                          key={book.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + idx * 0.07 }}
                          className="rounded-2xl p-4 flex items-center gap-4 bg-secondary"
                      >
                        {/* Cover or placeholder */}
                        <div className="w-11 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-sm bg-muted">
                          {book.coverUrl ? (
                              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <ClockIcon />
                              </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold truncate leading-tight text-foreground">{book.title}</p>
                            <span className={`text-xs font-bold flex-shrink-0 ${book.progress > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {book.progress}%
                      </span>
                          </div>

                          {/* Progress bar */}
                          <div className="h-1 rounded-full overflow-hidden bg-muted">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${book.progress}%` }}
                                transition={{ delay: 0.5 + idx * 0.1, duration: 0.6, ease: 'easeOut' }}
                                className="h-full rounded-full bg-primary"
                            />
                          </div>
                        </div>
                      </motion.div>
                  ))}
                </div>
            )}
          </motion.div>

        </div>
      </div>
  );
}