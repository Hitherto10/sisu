import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronUp, ChevronDown, Type, Maximize, Minimize } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Slider } from './ui/slider';
import { ScrollArea } from './ui/scroll-area';

export default function TxtReader({ book, fileData, onBack, onProgressUpdate }) {
  const [fontSize, setFontSize] = useState(16);
  const [showControls, setShowControls] = useState(true);
  const [scrollPercent, setScrollPercent] = useState(0);
  const scrollRef = React.useRef(null);

  const text = useMemo(() => new TextDecoder().decode(fileData), [fileData]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) || 0;
    setScrollPercent(pct);
    onProgressUpdate(pct);
  }, [onProgressUpdate]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <motion.div
        initial={{ y: -60 }}
        animate={{ y: showControls ? 0 : -60 }}
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-background/90 backdrop-blur-md border-b"
      >
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="text-center flex-1 mx-4">
          <h2 className="text-sm font-serif font-bold line-clamp-1">{book.title}</h2>
          <p className="text-xs text-muted-foreground">{scrollPercent}% read</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setFontSize((s) => Math.min(28, s + 2))}>
            <Type className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>

      {/* Text content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto pt-16 pb-4 px-6"
        onScroll={handleScroll}
        onClick={() => setShowControls(!showControls)}
      >
        <div className="max-w-2xl mx-auto">
          <pre
            className="whitespace-pre-wrap font-sans-body leading-relaxed text-foreground"
            style={{ fontSize: `${fontSize}px` }}
          >
            {text}
          </pre>
        </div>
      </div>
    </div>
  );
}
