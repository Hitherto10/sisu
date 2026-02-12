import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Flame, BookCheck, Clock, TrendingUp } from 'lucide-react';
import { getReadingGoal, getAllBooks } from '../lib/db';
import { Progress } from '../components/ui/progress';

export default function ProgressPage() {
  const [stats, setStats] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col min-h-screen pb-safe px-6">
      <header className="pt-8 pb-6 text-left">
        <h1 className="text-3xl font-serif font-bold text-foreground">Your Progress</h1>
        <p className="text-sm text-muted-foreground mt-1">Keep the momentum going!</p>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card p-5 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm"
        >
          <div className="p-3 bg-orange-100 rounded-full mb-3">
            <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
          </div>
          <span className="text-2xl font-bold">{stats.currentStreak}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Day Streak</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card p-5 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm"
        >
          <div className="p-3 bg-green-100 rounded-full mb-3">
            <BookCheck className="w-6 h-6 text-green-500" />
          </div>
          <span className="text-2xl font-bold">{stats.totalBooksCompleted || finishedBooks.length}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Finished</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card p-5 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm"
        >
          <div className="p-3 bg-blue-100 rounded-full mb-3">
            <Clock className="w-6 h-6 text-blue-500" />
          </div>
          <span className="text-2xl font-bold">{stats.totalMinutesRead || 0}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Mins Read</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card p-5 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm"
        >
          <div className="p-3 bg-purple-100 rounded-full mb-3">
            <TrendingUp className="w-6 h-6 text-purple-500" />
          </div>
          <span className="text-2xl font-bold">{stats.longestStreak}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Best Streak</span>
        </motion.div>
      </div>

      {/* Daily Goal */}
      <section className="bg-card rounded-2xl p-6 border mb-8 shadow-sm text-left">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-lg font-serif font-bold">Daily Reading Goal</h2>
            <p className="text-xs text-muted-foreground">Progress towards your daily target</p>
          </div>
          <span className="text-sm font-bold text-primary">{Math.min(100, Math.round(((stats.totalMinutesRead % stats.dailyPages) / stats.dailyPages) * 100))}%</span>
        </div>
        <Progress value={Math.min(100, Math.round(((stats.totalMinutesRead % stats.dailyPages) / stats.dailyPages) * 100))} className="h-3" />
        <p className="text-[11px] mt-3 text-muted-foreground text-center">
            You're doing great! Just a few more pages to reach your goal.
        </p>
      </section>

      {/* Currently Reading */}
      <section className="text-left">
        <h2 className="text-lg font-serif font-bold mb-4">In Progress</h2>
        {inProgressBooks.length > 0 ? (
          <div className="space-y-4">
            {inProgressBooks.map(book => (
              <div key={book.id} className="bg-card rounded-xl p-4 border flex items-center gap-4 shadow-sm">
                <div className="w-12 h-16 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold truncate">{book.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${book.progress}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">{book.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-secondary/20 rounded-2xl border border-dashed">
            <p className="text-sm text-muted-foreground">No books in progress. Start reading!</p>
          </div>
        )}
      </section>
    </div>
  );
}
