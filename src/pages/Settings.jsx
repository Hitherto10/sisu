import { Settings as SettingsIcon, BookOpen, Trash2, Moon, Sun, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import { clearAllData } from '../lib/db';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
    const [scrollDirection, setScrollDirection] = useState('paginated');
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        // Load saved preference
        const saved = localStorage.getItem('reading-scroll-direction');
        if (saved) {
            setScrollDirection(saved);
        }
    }, []);

    const handleScrollDirectionChange = (direction) => {
        setScrollDirection(direction);
        localStorage.setItem('reading-scroll-direction', direction);
        toast({
            title: 'Setting saved',
            description: `Reading mode set to ${direction === 'paginated' ? 'horizontal (page flip)' : 'vertical (scroll)'}`,
        });
    };

    const handleClearData = async () => {
        if (confirm('Are you sure you want to clear all reading data? This will remove all books and progress. This action cannot be undone.')) {
            try {
                await clearAllData();
                toast({
                    title: 'Data cleared',
                    description: 'All your reading data has been removed.',
                });
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                toast({
                    title: 'Error',
                    description: 'Failed to clear data.',
                    variant: 'destructive',
                });
            }
        }
    };

    return (
        <div className="flex flex-col h-screen overflow-y-auto px-6 bg-brand-bg">
            {/* Header */}
            <header className="pt-8 pb-6 text-left">
                <div className="flex items-center gap-3 mb-1">
                    <SettingsIcon className="w-6 h-6 text-primary" />
                    <h1 className="text-3xl font-serif font-bold">Settings</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                    Customize your reading experience
                </p>
            </header>

            {/* Settings Sections */}
            <main className="flex-1 space-y-6 pb-32 text-left">
                {/* Theme & Appearance */}
                <section className="bg-card rounded-2xl p-6 border shadow-sm">
                    <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
                        Appearance
                    </h2>
                    <div className="flex p-1 bg-secondary/50 rounded-xl">
                        <button
                            onClick={() => setTheme('light')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                            }`}
                        >
                            Light
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                            }`}
                        >
                            Dark
                        </button>
                    </div>
                </section>

                {/* Reading Mode */}
                <section className="bg-card rounded-2xl p-6 border shadow-sm">
                    <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" />
                        Reading Mode
                    </h2>
                    
                    <div className="space-y-3">
                        <button
                            onClick={() => handleScrollDirectionChange('paginated')}
                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                scrollDirection === 'paginated'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                                    scrollDirection === 'paginated' ? 'border-primary' : 'border-muted-foreground'
                                }`}>
                                    {scrollDirection === 'paginated' && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm">Horizontal (Page Flip)</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Swipe left/right to turn pages like a physical book.
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => handleScrollDirectionChange('scrolled')}
                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                scrollDirection === 'scrolled'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                                    scrollDirection === 'scrolled' ? 'border-primary' : 'border-muted-foreground'
                                }`}>
                                    {scrollDirection === 'scrolled' && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm">Vertical (Continuous Scroll)</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Scroll up/down continuously like a web page.
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </section>

                {/* Data Management */}
                <section className="bg-card rounded-2xl p-6 border shadow-sm">
                    <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-destructive" />
                        Data & Privacy
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                        Manage your local storage and reading data.
                    </p>
                    <Button 
                        variant="destructive" 
                        className="w-full rounded-xl py-6 font-bold"
                        onClick={handleClearData}
                    >
                        Clear All Reading Data
                    </Button>
                </section>

                {/* About Section */}
                <section className="bg-card rounded-2xl p-6 border shadow-sm">
                    <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                        <Info className="w-5 h-5 text-primary" />
                        About Sisu
                    </h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-muted-foreground">Version</span>
                            <span className="font-medium text-foreground">1.0.0</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-muted-foreground">Supported Formats</span>
                            <span className="font-medium text-foreground">EPUB, PDF, TXT</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1 italic">
                            A mellow, cosy reading app built for the love of books.
                        </p>
                    </div>
                </section>

            </main>
        </div>
    );
}