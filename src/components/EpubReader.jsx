import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Type, Maximize, Minimize } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

const themes = {
  light: { bg: '#faf7f2', fg: '#2a2420', label: 'Light' },
  sepia: { bg: '#f4ecd8', fg: '#5b4636', label: 'Sepia' },
  dark: { bg: '#1a1d24', fg: '#d5cfc5', label: 'Dark' },
};

export default function EpubReader({ book, fileData, onBack, onProgressUpdate }) {
  const viewerRef = useRef(null);
  const epubRef = useRef(null);
  const renditionRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const [theme, setTheme] = useState('light');
  const [fontSize, setFontSize] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(book.progress || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentCfi, setCurrentCfi] = useState(book.currentCfi || null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!viewerRef.current) return;

    const epub = ePub(fileData);
    epubRef.current = epub;

    const rendition = epub.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'paginated',
      allowScriptedContent: true, // Allow scripts in EPUB content
    });

    renditionRef.current = rendition;

    // Apply theme
    const t = themes[theme];
    rendition.themes.default({
      body: { background: t.bg, color: t.fg, 'font-family': "'DM Sans', sans-serif" },
      'p, span, div': { 'font-size': `${fontSize}% !important` },
    });

    // Display from saved position or start
    const startLocation = currentCfi || book.currentCfi;
    rendition.display(startLocation || undefined);

    // CRITICAL: Progress tracking listener
    rendition.on('relocated', (location) => {
      if (location?.start) {
        const cfi = location.start.cfi;
        const percentage = location.start.percentage || 0;
        const progressPercent = Math.round(percentage * 100);

        // Update local state
        setProgress(progressPercent);
        setCurrentCfi(cfi);

        // Update parent component and database
        onProgressUpdate(progressPercent, cfi);
      }
    });

    return () => {
      epub.destroy();
    };
  }, [fileData]);

  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    const t = themes[theme];
    r.themes.default({
      body: { background: t.bg, color: t.fg },
      'p, span, div': { 'font-size': `${fontSize}% !important` },
    });
  }, [theme, fontSize]);

  const prev = () => renditionRef.current?.prev();
  const next = () => renditionRef.current?.next();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
      <div ref={containerRef} className="flex flex-col h-screen" style={{ background: themes[theme].bg }}>
        {/* Top bar */}
        <motion.div
            initial={{ y: -60 }}
            animate={{ y: showControls ? 0 : -60 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 backdrop-blur-md border-b"
            style={{ background: `${themes[theme].bg}ee`, borderColor: `${themes[theme].fg}15` }}
        >
          <Button variant="ghost" size="icon" onClick={onBack} style={{ color: themes[theme].fg }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center flex-1 mx-4">
            <h2 className="text-sm font-serif font-bold line-clamp-1" style={{ color: themes[theme].fg }}>{book.title}</h2>
            <p className="text-xs" style={{ color: `${themes[theme].fg}88` }}>{progress}% complete</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} style={{ color: themes[theme].fg }}>
              <Type className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} style={{ color: themes[theme].fg }}>
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
        </motion.div>

        {/* Settings panel */}
        {showSettings && showControls && (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-16 left-4 right-4 z-20 p-4 rounded-xl shadow-lg"
                style={{ background: themes[theme].bg, border: `1px solid ${themes[theme].fg}15` }}
            >
              <div className="mb-3">
                <p className="text-xs font-medium mb-2" style={{ color: themes[theme].fg }}>Theme</p>
                <div className="flex gap-2">
                  {Object.keys(themes).map((t) => (
                      <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-colors ${theme === t ? 'border-primary' : 'border-transparent'}`}
                          style={{ background: themes[t].bg, color: themes[t].fg }}
                      >
                        {themes[t].label}
                      </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: themes[theme].fg }}>Font Size: {fontSize}%</p>
                <Slider value={[fontSize]} min={70} max={150} step={5} onValueChange={([v]) => setFontSize(v)} />
              </div>
            </motion.div>
        )}

        {/* Content */}
        <div
            className="flex-1 pt-16 pb-20"
            onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
        >
          <div ref={viewerRef} className="h-full w-full" />
        </div>

        {/* Bottom controls */}
        <motion.div
            initial={{ y: 80 }}
            animate={{ y: showControls ? 0 : 80 }}
            className="absolute bottom-0 left-0 right-0 z-10 px-4 py-4 backdrop-blur-md border-t"
            style={{ background: `${themes[theme].bg}ee`, borderColor: `${themes[theme].fg}15` }}
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={prev} style={{ color: themes[theme].fg }}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `${themes[theme].fg}20` }}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <Button variant="ghost" size="icon" onClick={next} style={{ color: themes[theme].fg }}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </div>
  );
}