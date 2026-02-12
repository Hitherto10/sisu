import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ePub from 'epubjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Type, Maximize, Minimize } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const themes = {
    light: { bg: '#faf8f5', fg: '#2a2522', label: 'Light', secondary: '#ece7df' },
    sepia: { bg: '#f4ecd8', fg: '#5b4636', label: 'Sepia', secondary: '#e8ddc0' },
    dark: { bg: '#1a1d24', fg: '#d5cfc5', label: 'Dark', secondary: '#2a2f3a' },
};

// --- Metadata helpers ---
// Decode RFC2047 encoded strings like =?utf-8?B?...?=
function decodeRFC2047(str) {
    if (!str || typeof str !== 'string') return str;
    const m = str.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
    if (!m) return str;
    const [, charset, encoding, encoded] = m;
    try {
        if (encoding.toUpperCase() === 'B') {
            // base64 decode
            const binary = atob(encoded.replace(/\s/g, ''));
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            return new TextDecoder(charset || 'utf-8').decode(bytes);
        } else {
            // Q encoding
            return encoded.replace(/_/g, ' ').replace(/=([A-Fa-f0-9]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16)));
        }
    } catch (e) {
        return str;
    }
}

function cleanMetaString(s, fallback = '') {
    if (!s) return fallback;
    let out = String(s).replace(/\u0000/g, '').trim();
    out = out.replace(/[\r\n]+/g, ' ');
    // Replace underscores with spaces and collapse multiple spaces
    out = out.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    // Try RFC2047 decode
    out = decodeRFC2047(out);

    // If looks like a file path, extract basename
    if (/[\\/].+\.[a-zA-Z0-9]{1,6}$/.test(out)) {
        const parts = out.split(/[\\/]/);
        let name = parts[parts.length - 1];
        name = name.replace(/\.[^.]+$/, '');
        out = name;
    }

    // Remove trailing generator/vendor tags if present
    const dashParts = out.split(' - ');
    if (dashParts.length > 1) {
        const tail = dashParts.slice(1).join(' - ');
        if (/(Adobe|Acrobat|ebook|Kindle|EPUB|PDF|Generator|Calibre)/i.test(tail)) {
            out = dashParts[0];
        }
    }

    // Fallback if still gibberish
    const stripped = out.replace(/[^A-Za-z0-9\s,.'-]/g, '');
    if (stripped.length < 2 || /^untitled$/i.test(out)) return fallback || out;

    return out;
}

// Normalize author strings: handle "Last, First" -> "First Last", multiple authors separated by ; or and
function normalizeAuthor(raw) {
    if (!raw) return raw;
    let s = String(raw).trim();
    if (!s) return '';

    // Split multiple authors by common separators
    const parts = s.split(/;|\band\b|\n/).map(p => p.trim()).filter(Boolean);
    const normalizedParts = parts.map((part) => {
        // If in form "Last, First" swap
        const commaParts = part.split(',').map(p => p.trim()).filter(Boolean);
        if (commaParts.length === 2 && /^[A-Za-z\- ]+$/.test(commaParts[0]) && /^[A-Za-z\- ]+$/.test(commaParts[1])) {
            return `${commaParts[1]} ${commaParts[0]}`.trim();
        }
        // If looks like "First Last" already, return as-is
        return part;
    });

    // Join with comma for display if multiple
    return normalizedParts.join(', ');
}

function extractPdfMetaObject(meta) {
    // meta can contain .info and .metadata (XMP). Try multiple fields.
    const info = meta?.info || {};
    const metadata = meta?.metadata || null;

    let title = info?.Title || info?.title || metadata?.get ? (metadata.get('dc:title') || metadata.get('title')) : undefined;
    let author = info?.Author || info?.author || info?.Creator || metadata?.get ? (metadata.get('dc:creator') || metadata.get('creator')) : undefined;

    // metadata.get may return arrays or objects, normalize
    if (Array.isArray(title)) title = title[0];
    if (Array.isArray(author)) author = Array.isArray(author[0]) ? author[0].join(', ') : author[0];

    title = cleanMetaString(title);
    author = cleanMetaString(author);
    author = normalizeAuthor(author);

    return { title, author };
}

export default function UnifiedBookReader({ book, fileData, onBack, onProgressUpdate, scrollDirection = 'paginated', onMetaExtracted }) {
    const [showControls, setShowControls] = useState(true);
    const [theme, setTheme] = useState('light');
    const [fontSize, setFontSize] = useState(100);
    const [showSettings, setShowSettings] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);

    // EPUB specific state
    const viewerRef = useRef(null);
    const epubRef = useRef(null);
    const renditionRef = useRef(null);
    const [isEpubReady, setIsEpubReady] = useState(false);
    const [epubProgress, setEpubProgress] = useState({ page: 1, total: 0 });

    // PDF specific state
    const [numPdfPages, setNumPdfPages] = useState(0);
    const [currentPdfPage, setCurrentPdfPage] = useState(book.currentPageNumber || 1);
    const [pdfWidth, setPdfWidth] = useState(400);

    // TXT specific state
    const textContent = useMemo(() => {
        if (book.format === 'txt' && fileData) {
            return new TextDecoder().decode(fileData);
        }
        return '';
    }, [fileData, book.format]);
    const [txtProgress, setTxtProgress] = useState(book.progress || 0);
    const txtScrollRef = useRef(null);

    // Shared Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // --- EPUB Logic ---
    useEffect(() => {
        if (book.format !== 'epub' || !viewerRef.current || !fileData) return;

        const epub = ePub(fileData);
        epubRef.current = epub;

        epub.ready.then(() => {
            const rendition = epub.renderTo(viewerRef.current, {
                width: '100%',
                height: '100%',
                spread: 'none',
                flow: scrollDirection === 'scrolled' ? 'scrolled-doc' : 'paginated',
            });
            renditionRef.current = rendition;

            // Try to extract metadata from EPUB package
            try {
                const pkg = epub.package || epub.packaging || epub.loaded?.package || epub.loaded?.metadata || epub.metadata || null;
                let title = pkg?.metadata?.title || pkg?.metadata?.['dc:title'] || epub?.metadata?.title || epub?.metadata?.['dc:title'];
                let author = pkg?.metadata?.creator || pkg?.metadata?.author || pkg?.metadata?.['dc:creator'] || epub?.metadata?.creator || epub?.metadata?.author;

                // If author is array/object, normalize
                if (Array.isArray(author)) author = author.join(', ');
                title = cleanMetaString(title, book.title || '');
                author = cleanMetaString(author, book.author || '');
                author = normalizeAuthor(author);

                if (onMetaExtracted && (title || author)) {
                    onMetaExtracted({ title, author });
                }
            } catch (e) {
                // ignore metadata extraction errors
            }

            // Apply initial theme/font
            const t = themes[theme];
            rendition.themes.default({
                body: {
                    background: t.bg,
                    color: t.fg,
                    'font-family': "'DM Sans', sans-serif",
                    'line-height': '1.6',
                    'padding': '40px 20px !important'
                },
                'p, span, div': { 'font-size': `${fontSize}% !important` },
            });

            rendition.display(book.currentCfi || undefined).then(() => {
                setIsEpubReady(true);
            });

            epub.locations.generate(1024).then((locations) => {
                setEpubProgress(prev => ({ ...prev, total: locations.length }));
            });

            rendition.on('relocated', (location) => {
                if (location?.start) {
                    const cfi = location.start.cfi;
                    if (epub.locations?.length > 0) {
                        const page = epub.locations.locationFromCfi(cfi) || 1;
                        const total = epub.locations.length;
                        setEpubProgress({ page, total });
                        const progress = Math.round((page / total) * 100);
                        onProgressUpdate(progress, cfi, page, total);
                    }
                }
            });
        });

        return () => epub.destroy();
    }, [fileData, book.format, scrollDirection]);

    useEffect(() => {
        if (book.format === 'epub' && renditionRef.current && isEpubReady) {
            const t = themes[theme];
            renditionRef.current.themes.default({
                body: { background: t.bg, color: t.fg },
                'p, span, div': { 'font-size': `${fontSize}% !important` },
            });
        }
    }, [theme, fontSize, isEpubReady, book.format]);

    // --- PDF Logic ---
    useEffect(() => {
        if (book.format !== 'pdf' || !containerRef.current) return;
        const obs = new ResizeObserver((entries) => {
            if (entries[0]) {
                setPdfWidth(entries[0].contentRect.width);
            }
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, [book.format]);

    // Make a copy of the bytes and memoize the result to avoid detached ArrayBuffer errors
    const pdfData = useMemo(() => {
        if (book.format !== 'pdf' || !fileData) return null;
        const src = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
        // .slice() creates a copy with its own ArrayBuffer which pdf.js can safely send to a worker
        return src.slice();
    }, [fileData, book.format]);

    // Memoize the object passed to the Document component to avoid unnecessary reload warnings
    const memoPdfFile = useMemo(() => (pdfData ? { data: pdfData } : null), [pdfData]);

    const handlePdfPageChange = (page) => {
        const newPage = Math.max(1, Math.min(numPdfPages, page));
        setCurrentPdfPage(newPage);
        onProgressUpdate(newPage, numPdfPages);
    };

    // --- TXT Logic ---
    const handleTxtScroll = useCallback(() => {
        const el = txtScrollRef.current;
        if (!el) return;
        const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) || 0;
        setTxtProgress(pct);
        onProgressUpdate(pct);
    }, [onProgressUpdate]);

    // Render Helpers
    const currentStatus = () => {
        if (book.format === 'epub') return `Page ${epubProgress.page} of ${epubProgress.total}`;
        if (book.format === 'pdf') return `Page ${currentPdfPage} of ${numPdfPages}`;
        if (book.format === 'txt') return `${txtProgress}% read`;
        return '';
    };

    const handlePagePrev = () => {
        if (book.format === 'epub') renditionRef.current?.prev();
        if (book.format === 'pdf') handlePdfPageChange(currentPdfPage - 1);
    };

    const handlePageNext = () => {
        if (book.format === 'epub') renditionRef.current?.next();
        if (book.format === 'pdf') handlePdfPageChange(currentPdfPage + 1);
    };

    return (
        <div 
            ref={containerRef} 
            className="flex flex-col h-screen overflow-hidden" 
            style={{ background: themes[theme].bg, color: themes[theme].fg }}
        >
            {/* Top bar */}
            <motion.div
                initial={{ y: -60 }}
                animate={{ y: showControls ? 0 : -60 }}
                className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 backdrop-blur-md border-b"
                style={{ background: `${themes[theme].bg}ee`, borderColor: `${themes[theme].fg}15` }}
            >
                <Button variant="ghost" size="icon" onClick={onBack} style={{ color: themes[theme].fg }}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-center flex-1 mx-4">
                    <h2 className="text-sm font-serif font-bold line-clamp-1" style={{ color: themes[theme].fg }}>
                        {book.title}
                    </h2>
                    {/* Show author if available (cleaned via metadata extraction) */}
                    {book.author && (
                        <p className="text-xs" style={{ color: `${themes[theme].fg}88` }}>
                            {book.author}
                        </p>
                    )}
                    <p className="text-xs" style={{ color: `${themes[theme].fg}88` }}>
                        {currentStatus()}
                    </p>
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
            <AnimatePresence>
                {showSettings && showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-16 left-4 right-4 z-40 p-4 rounded-xl shadow-lg border"
                        style={{ background: themes[theme].bg, borderColor: `${themes[theme].fg}15` }}
                    >
                        <div className="mb-4">
                            <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-50">Theme</p>
                            <div className="flex gap-2">
                                {Object.keys(themes).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTheme(t)}
                                        className={`flex-1 py-3 rounded-lg text-xs font-medium border-2 transition-all ${theme === t ? 'border-primary' : 'border-transparent'}`}
                                        style={{ background: themes[t].secondary, color: themes[t].fg }}
                                    >
                                        {themes[t].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-50">Font Size: {fontSize}%</p>
                            <Slider value={[fontSize]} min={70} max={200} step={5} onValueChange={([v]) => setFontSize(v)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Area */}
            <div 
                className="flex-1 relative flex flex-col overflow-hidden" 
                onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
            >
                {book.format === 'epub' && (
                    <div ref={viewerRef} className="h-full w-full pt-16" />
                )}

                {book.format === 'pdf' && (
                    <div className="h-full w-full overflow-auto flex justify-center pt-16 pb-24">
                        {memoPdfFile && (
                            <Document
                                file={memoPdfFile}
                                onLoadSuccess={(pdf) => {
                                    // set number of pages
                                    setNumPdfPages(pdf.numPages || 0);
                                    // Extract metadata (title/author) and inform parent
                                    try {
                                        pdf.getMetadata?.().then((meta) => {
                                            const extracted = extractPdfMetaObject(meta || {});
                                            const title = extracted.title || book.title;
                                            const author = extracted.author || book.author;
                                            if (onMetaExtracted && (title || author)) {
                                                onMetaExtracted({ title, author });
                                            }
                                        }).catch(()=>{});
                                    } catch (e) {
                                        // ignore metadata errors
                                    }
                                }}
                                loading={<div className="mt-20">Loading PDF...</div>}
                            >
                                <Page 
                                    pageNumber={currentPdfPage} 
                                    width={Math.min(pdfWidth - 32, 800)}
                                    renderAnnotationLayer={false}
                                    renderTextLayer={true}
                                />
                            </Document>
                        )}
                    </div>
                )}

                {book.format === 'txt' && (
                    <div 
                        ref={txtScrollRef}
                        className="flex-1 overflow-auto pt-20 pb-20 px-6 sm:px-10"
                        onScroll={handleTxtScroll}
                    >
                        <div className="max-w-2xl mx-auto">
                            <pre 
                                className="whitespace-pre-wrap font-sans-body leading-relaxed"
                                style={{ fontSize: `${(fontSize / 100) * 16}px` }}
                            >
                                {textContent}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Invisible Swipe Zones for PDF/TXT in paginated mode */}
                {scrollDirection === 'paginated' && (book.format === 'pdf' || book.format === 'epub') && (
                    <>
                        <div 
                            className="absolute left-0 top-0 bottom-0 w-20 z-10" 
                            onClick={(e) => { e.stopPropagation(); handlePagePrev(); }}
                        />
                        <div 
                            className="absolute right-0 top-0 bottom-0 w-20 z-10" 
                            onClick={(e) => { e.stopPropagation(); handlePageNext(); }}
                        />
                    </>
                )}
            </div>

            {/* Bottom Controls */}
            {scrollDirection === 'paginated' && book.format !== 'txt' && (
                <motion.div
                    initial={{ y: 80 }}
                    animate={{ y: showControls ? 0 : 80 }}
                    className="absolute bottom-0 left-0 right-0 z-50 px-4 py-4 backdrop-blur-md border-t"
                    style={{ background: `${themes[theme].bg}ee`, borderColor: `${themes[theme].fg}15` }}
                >
                    <div className="flex items-center gap-4 max-w-lg mx-auto">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePagePrev(); }} disabled={book.format === 'pdf' && currentPdfPage <= 1}>
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex-1">
                            <Slider 
                                value={[book.format === 'pdf' ? currentPdfPage : epubProgress.page]} 
                                min={1} 
                                max={book.format === 'pdf' ? numPdfPages : epubProgress.total || 1} 
                                step={1} 
                                onValueChange={([v]) => {
                                    if (book.format === 'pdf') {
                                        handlePdfPageChange(v);
                                    } else if (renditionRef.current && epubRef.current) {
                                        renditionRef.current.display(epubRef.current.locations.cfiFromLocation(v));
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePageNext(); }} disabled={book.format === 'pdf' && currentPdfPage >= numPdfPages}>
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
