import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ePub from 'epubjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Type, Maximize, Minimize } from 'lucide-react';

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from './ui/button';
import { LoadingSpinner } from './ui/loading-spinner';
import { Slider } from './ui/slider';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const themes = {
    light: { bg: '#faf8f5', fg: '#2a2522', label: 'Light', secondary: '#ece7df' },
    sepia: { bg: '#f4ecd8', fg: '#5b4636', label: 'Sepia', secondary: '#e8ddc0' },
    dark: { bg: '#1a1d24', fg: '#d5cfc5', label: 'Dark', secondary: '#2a2f3a' },
};

// Metadata helpers
function decodeRFC2047(str) {
    if (!str || typeof str !== 'string') return str;
    const m = str.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
    if (!m) return str;
    const [, charset, encoding, encoded] = m;
    try {
        if (encoding.toUpperCase() === 'B') {
            const binary = atob(encoded.replace(/\s/g, ''));
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            return new TextDecoder(charset || 'utf-8').decode(bytes);
        } else {
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
    out = out.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    out = decodeRFC2047(out);

    if (/[\\/].+\.[a-zA-Z0-9]{1,6}$/.test(out)) {
        const parts = out.split(/[\\/]/);
        let name = parts[parts.length - 1];
        name = name.replace(/\.[^.]+$/, '');
        out = name;
    }

    const dashParts = out.split(' - ');
    if (dashParts.length > 1) {
        const tail = dashParts.slice(1).join(' - ');
        if (/(Adobe|Acrobat|ebook|Kindle|EPUB|PDF|Generator|Calibre)/i.test(tail)) {
            out = dashParts[0];
        }
    }

    const stripped = out.replace(/[^A-Za-z0-9\s,.'-]/g, '');
    if (stripped.length < 2 || /^untitled$/i.test(out)) return fallback || out;

    return out;
}

function normalizeAuthor(raw) {
    if (!raw) return raw;
    let s = String(raw).trim();
    if (!s) return '';

    const parts = s.split(/;|\band\b|\n/).map(p => p.trim()).filter(Boolean);
    const normalizedParts = parts.map((part) => {
        const commaParts = part.split(',').map(p => p.trim()).filter(Boolean);
        if (commaParts.length === 2 && /^[A-Za-z\- ]+$/.test(commaParts[0]) && /^[A-Za-z\- ]+$/.test(commaParts[1])) {
            return `${commaParts[1]} ${commaParts[0]}`.trim();
        }
        return part;
    });

    return normalizedParts.join(', ');
}

function extractPdfMetaObject(meta) {
    const info = meta?.info || {};
    const metadata = meta?.metadata || null;

    let title = info?.Title || info?.title || metadata?.get ? (metadata.get('dc:title') || metadata.get('title')) : undefined;
    let author = info?.Author || info?.author || info?.Creator || metadata?.get ? (metadata.get('dc:creator') || metadata.get('creator')) : undefined;

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
    const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });

    // TXT specific state
    const textContent = useMemo(() => {
        if (book.format === 'txt' && fileData) {
            return new TextDecoder().decode(fileData);
        }
        return '';
    }, [fileData, book.format]);
    const [txtProgress, setTxtProgress] = useState(book.progress || 0);
    const txtScrollRef = useRef(null);

    // Calculate optimal dimensions based on viewport
    useEffect(() => {
        const updateDimensions = () => {
            if (!containerRef.current) return;

            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;

            // Reserve space for controls (top: 60px, bottom: 80px in paginated mode)
            const availableHeight = containerHeight - (scrollDirection === 'paginated' ? 140 : 60);
            const availableWidth = containerWidth;

            // Calculate optimal width maintaining readable line length
            // Optimal line length: 60-80 characters ≈ 600-700px at base font size
            const maxReadableWidth = Math.min(700, availableWidth - 48); // 24px padding on each side

            setPdfDimensions({
                width: maxReadableWidth,
                height: availableHeight
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [scrollDirection]);

    // Restore PDF scroll position
    useEffect(() => {
        if (book.format === 'pdf' && scrollDirection === 'scrolled' && numPdfPages > 0) {
            const container = document.getElementById('pdf-scroll-container');
            if (container) {
                // If we have an exact page, scroll to it
                // We estimate the position based on page number
                if (book.currentPage > 1) {
                    const scrollRatio = (book.currentPage - 1) / numPdfPages;
                    // Small timeout to ensure content is rendered
                    setTimeout(() => {
                        container.scrollTop = container.scrollHeight * scrollRatio;
                    }, 100);
                }
            }
        }
    }, [book.format, scrollDirection, numPdfPages, book.currentPage]);

    // Fullscreen toggle
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
    // --- EPUB Logic ---
    useEffect(() => {
        if (book.format !== 'epub' || !viewerRef.current || !fileData) return;

        const epub = ePub(fileData);
        epubRef.current = epub;

        epub.ready.then(() => {
            const containerWidth = viewerRef.current.clientWidth;
            const containerHeight = viewerRef.current.clientHeight;

            // Calculate optimal reading width (capped at 700px for readability)
            const readableWidth = Math.min(700, containerWidth - 48);

            // Use full available height for better content flow
            const availableHeight = containerHeight;

            const rendition = epub.renderTo(viewerRef.current, {
                width: readableWidth,
                height: availableHeight,
                spread: 'none',
                flow: scrollDirection === 'scrolled' ? 'scrolled-doc' : 'paginated',
                snap: false,
                allowScriptedContent: true,
                ignoreClass: 'annotator-hl',
                manager: scrollDirection === 'scrolled' ? 'continuous' : 'default',
            });
            renditionRef.current = rendition;

            // Try to extract metadata
            try {
                const pkg = epub.package || epub.packaging || epub.loaded?.package || epub.loaded?.metadata || epub.metadata || null;
                let title = pkg?.metadata?.title || pkg?.metadata?.['dc:title'] || epub?.metadata?.title || epub?.metadata?.['dc:title'];
                let author = pkg?.metadata?.creator || pkg?.metadata?.author || pkg?.metadata?.['dc:creator'] || epub?.metadata?.creator || epub?.metadata?.author;

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

            // Apply theme with better typography
            const t = themes[theme];
            rendition.themes.default({
                '*': {
                    'box-sizing': 'border-box !important',
                },
                'body': {
                    background: `${t.bg} !important`,
                    color: `${t.fg} !important`,
                    'font-family': "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    'line-height': '1.7',
                    'padding': '40px 24px !important',
                    'max-width': '100%',
                    'margin': '0 auto',
                    'overflow': 'visible !important',
                },
                'p': {
                    'font-size': `${fontSize}% !important`,
                    'margin-bottom': '1em',
                    'text-align': 'justify',
                    'hyphens': 'auto'
                },
                'h1, h2, h3, h4, h5, h6': {
                    'font-family': "'Libre Baskerville', serif",
                    'margin-top': '1.5em',
                    'margin-bottom': '0.75em',
                    'line-height': '1.3'
                },
                'img': {
                    'max-width': '100%',
                    'height': 'auto',
                    'display': 'block',
                    'margin': '1em auto'
                }
            });

            rendition.display(book.currentCfi || undefined).then(() => {
                setIsEpubReady(true);
            });

            // Generate locations for the entire book
            epub.locations.generate(1600).then((locations) => {
                console.log(`✅ Generated ${locations.length} locations for EPUB`);
                setEpubProgress(prev => ({ ...prev, total: locations.length }));
            }).catch(err => {
                console.error('Failed to generate locations:', err);
            });

            const handleRelocated = (location) => {
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
            };

            rendition.on('relocated', handleRelocated);

            // Capture scroll events in scrolled mode to ensure we track progress accurately
            // 'scroll' events do not bubble, so we must use capture: true on the container
            // to catch scroll events from the inner view
            let scrollCleanup = null;
            if (scrollDirection === 'scrolled') {
                const container = viewerRef.current;

                const handleScroll = debounce(() => {
                    // Manually check location on scroll
                    try {
                        const location = rendition.currentLocation();
                        if (location && location.start) {
                            handleRelocated(location);
                        }
                    } catch (e) {
                        // Ignore errors during scroll checking
                    }
                }, 150);

                if (container) {
                    container.addEventListener('scroll', handleScroll, { capture: true });
                    scrollCleanup = () => {
                        container.removeEventListener('scroll', handleScroll, { capture: true });
                    };
                }
            }

            // Add error handler
            rendition.on('error', (err) => {
                console.error('EPUB rendering error:', err);
            });

            // Handle keyboard navigation
            const handleKeyDown = (e) => {
                if (book.format !== 'epub' || !renditionRef.current) return;
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    renditionRef.current.prev();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    renditionRef.current.next();
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                if (scrollCleanup) scrollCleanup();
            };
        });

        return () => {
            if (epubRef.current) {
                epubRef.current.destroy();
            }
        };
    }, [fileData, book.format, scrollDirection]);

    useEffect(() => {
        if (book.format === 'epub' && renditionRef.current && isEpubReady) {
            const t = themes[theme];
            renditionRef.current.themes.default({
                body: { background: t.bg, color: t.fg },
                'p': { 'font-size': `${fontSize}% !important` },
            });
        }
    }, [theme, fontSize, isEpubReady, book.format]);

    // --- PDF Logic ---
    const pdfData = useMemo(() => {
        if (book.format !== 'pdf' || !fileData) return null;
        const src = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
        return src.slice();
    }, [fileData, book.format]);

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
        if (book.format === 'epub' && renditionRef.current) {
            renditionRef.current.prev().catch(err => {
                console.warn('Cannot go to previous page:', err);
            });
        }
        if (book.format === 'pdf') handlePdfPageChange(currentPdfPage - 1);
    };

    const handlePageNext = () => {
        if (book.format === 'epub' && renditionRef.current) {
            renditionRef.current.next().catch(err => {
                console.warn('Cannot go to next page:', err);
            });
        }
        if (book.format === 'pdf') handlePdfPageChange(currentPdfPage + 1);
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col h-screen w-screen overflow-hidden fixed inset-0"
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
                        className="absolute top-16 left-4 right-4 z-40 p-4 rounded-xl shadow-lg border max-w-md mx-auto"
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
                className="flex-1 relative flex flex-col items-center justify-center overflow-hidden pt-16 pb-20"
                onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
            >
                {book.format === 'epub' && (
                    <div
                        ref={viewerRef}
                        className="w-full h-full"
                        style={{
                            maxWidth: '700px',
                            margin: '0 auto',
                            overflow: 'visible',
                            position: 'relative'
                        }}
                    >
                        {!isEpubReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                                <LoadingSpinner text="Loading book..." />
                            </div>
                        )}
                    </div>
                )}

                {book.format === 'pdf' && memoPdfFile && (
                    scrollDirection === 'scrolled' ? (
                        // Scrolled mode - render all pages
                        <div
                            id="pdf-scroll-container"
                            className="w-full h-full overflow-y-auto overflow-x-hidden pb-20"
                            onScroll={(e) => {
                                const el = e.target;
                                if (el) {
                                    const scrollPercent = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100 || 0;
                                    const estimatedPage = Math.max(1, Math.ceil((scrollPercent / 100) * numPdfPages));

                                    if (estimatedPage !== currentPdfPage) {
                                        setCurrentPdfPage(estimatedPage);
                                        // Pass true as third arg to indicate this is a scroll update, preventing infinite loops if needed
                                        onProgressUpdate(estimatedPage, numPdfPages);
                                    }
                                }
                            }}
                        >
                            <Document
                                file={memoPdfFile}
                                onLoadSuccess={(pdf) => {
                                    setNumPdfPages(pdf.numPages || 0);
                                    try {
                                        pdf.getMetadata?.().then((meta) => {
                                            const extracted = extractPdfMetaObject(meta || {});
                                            const title = extracted.title || book.title;
                                            const author = extracted.author || book.author;
                                            if (onMetaExtracted && (title || author)) {
                                                onMetaExtracted({ title, author });
                                            }
                                        }).catch(() => { });
                                    } catch (e) {
                                        // ignore
                                    }
                                }}
                                loading={
                                    <div className="flex items-center justify-center h-full py-20">
                                        <LoadingSpinner text="Loading PDF..." />
                                    </div>
                                }
                            >
                                <div className="flex flex-col items-center gap-4 py-6 px-6 max-w-4xl mx-auto">
                                    {Array.from(new Array(numPdfPages), (el, index) => (
                                        <div key={`page_${index + 1}`} className="shadow-lg">
                                            <Page
                                                pageNumber={index + 1}
                                                width={pdfDimensions.width || 600}
                                                renderAnnotationLayer={true}
                                                renderTextLayer={true}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </Document>
                        </div>
                    ) : (
                        // Paginated mode - render single page
                        <div className="w-full h-full flex items-center justify-center">
                            <Document
                                file={memoPdfFile}
                                onLoadSuccess={(pdf) => {
                                    setNumPdfPages(pdf.numPages || 0);
                                    try {
                                        pdf.getMetadata?.().then((meta) => {
                                            const extracted = extractPdfMetaObject(meta || {});
                                            const title = extracted.title || book.title;
                                            const author = extracted.author || book.author;
                                            if (onMetaExtracted && (title || author)) {
                                                onMetaExtracted({ title, author });
                                            }
                                        }).catch(() => { });
                                    } catch (e) {
                                        // ignore
                                    }
                                }}
                                loading={
                                    <div className="flex items-center justify-center h-full">
                                        <LoadingSpinner text="Loading PDF..." />
                                    </div>
                                }
                            >
                                <div className="flex items-center justify-center p-6">
                                    <Page
                                        pageNumber={currentPdfPage}
                                        width={pdfDimensions.width || 600}
                                        renderAnnotationLayer={true}
                                        renderTextLayer={true}
                                        className="shadow-lg"
                                    />
                                </div>
                            </Document>
                        </div>
                    )
                )}

                {book.format === 'txt' && (
                    <div
                        ref={txtScrollRef}
                        className="flex-1 overflow-auto w-full"
                        onScroll={handleTxtScroll}
                        style={{ maxWidth: '700px', margin: '0 auto' }}
                    >
                        <div className="px-6 py-8">
                            <pre
                                className="whitespace-pre-wrap font-sans leading-relaxed"
                                style={{
                                    fontSize: `${(fontSize / 100) * 16}px`,
                                    lineHeight: '1.7',
                                    textAlign: 'justify',
                                    fontFamily: "'DM Sans', sans-serif"
                                }}
                            >
                                {textContent}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Swipe Zones for navigation */}
                {scrollDirection === 'paginated' && (book.format === 'pdf' || book.format === 'epub') && (
                    <>
                        <div
                            className="absolute left-0 top-16 bottom-20 w-20 z-10 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handlePagePrev(); }}
                        />
                        <div
                            className="absolute right-0 top-16 bottom-20 w-20 z-10 cursor-pointer"
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
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handlePagePrev(); }}
                            disabled={book.format === 'pdf' && currentPdfPage <= 1}
                            style={{ color: themes[theme].fg }}
                        >
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
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handlePageNext(); }}
                            disabled={book.format === 'pdf' && currentPdfPage >= numPdfPages}
                            style={{ color: themes[theme].fg }}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}