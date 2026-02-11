import { BookOpen } from 'lucide-react';

export default function Discover() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-safe px-6 text-center">
      <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h1 className="text-xl font-serif font-bold">Discover Books</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
        Browse and download free public domain books. Coming soon!
      </p>
    </div>
  );
}
