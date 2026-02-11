import { BarChart3 } from 'lucide-react';

export default function ProgressPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-safe px-6 text-center">
      <BarChart3 className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h1 className="text-xl font-serif font-bold">Reading Progress</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
        Track your reading stats, streaks, and goals. Coming soon!
      </p>
    </div>
  );
}
