import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ePub from 'epubjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Type, Maximize, Minimize } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from './ui/button';
import { LoadingSpinner } from './ui/loading-spinner';
import { Slider } from './ui/slider';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { debounce } from '../lib/utils';
import { cleanMetaString, normalizeAuthor, extractPdfMetaObject } from '../lib/meta-utils';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// --- Constants ---
const HEADER_HEIGHT = 60;
const PAGINATED_BOTTOM_CONTROLS_HEIGHT = 80;
const FONT_SIZE_STEP = 5;
const SCROLL_DEBOUNCE_MS = 150;
const LOCATION_GENERATION_CHARS = 1600;

const themes = {
    light: { bg: '#faf8f5', fg: '#2a2522', label: 'Light', secondary: '#ece7df' },
    sepia: { bg: '#f4ecd8', fg: '#5b4636', label: 'Sepia', secondary: '#e8ddc0' },
    dark: { bg: '#1a1d24', fg: '#d5cfc5', label: 'Dark', secondary: '#2a2f3a' },
};

// --- Custom Hooks for Reader Logic ---

/**
 * Hook to manage EPUB book rendering and state
 */
function useEpubReader({ book, fileData, scrollDirection, theme, fontSize, onProgressUpdate, onMetaExtracted }) {
    const viewerRef = useRef(null);
    const epubRef = useRef(null);
    const renditionRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [progress, setProgress] = useState({ page: 1, total: 0 });

    useEffect(() => {
        if (!viewerRef.current || !fileData) return;

        const epub = ePub(fileData);
        epubRef.current = epub;

        const cleanup = () => {
            if (epubRef.current) {
                epubRef.current.destroy();
                epubRef.current = null;
            }
            if (renditionRef.current) {
                renditionRef.current = null;
            }
        };

        epub.ready.then(() => {
            const containerWidth = viewerRef.current.clientWidth;
            const containerHeight = viewerRef.current.clientHeight;
            const readableWidth = Math.min(700, containerWidth - 48);

            const rendition = epub.renderTo(viewerRef.current, {
                width: readableWidth,
                height: containerHeight,
                spread: 'none',
                flow: scrollDirection === 'scrolled' ? 'scrolled-doc' : 'paginated',
                manager: scrollDirection === 'scrolled' ? 'continuous' : 'default',
                snap: false,
                allowScriptedContent: true,
                ignoreClass: 'annotator-hl',
            });
            renditionRef.current = rendition;

            // Extract metadata
            try {
                const pkg = epub.package || {};
                let title = pkg.metadata?.title || book.title || '';
                let author = pkg.metadata?.creator || book.author || '';
                if (Array.isArray(author)) author = author.join(', ');

                title = cleanMetaString(title, book.title || '');
                author = cleanMetaString(author, book.author || '');
                author = normalizeAuthor(author);

                if (onMetaExtracted && (title || author)) {
                    onMetaExtracted({ title, author });
                }
            } catch (e) {
                console.error("Failed to extract EPUB metadata:", e);
            }

            rendition.display(book.currentCfi || undefined).then(() => {
                setIsReady(true);
            });

            epub.locations.generate(LOCATION_GENERATION_CHARS).then((locations) => {
                setProgress(prev => ({ ...prev, total: locations.length }));
            }).catch(err => {
                console.error('Failed to generate EPUB locations:', err);
            });

            const handleRelocated = (location) => {
                if (!location?.start || !epub.locations?.length) return;
                const cfi = location.start.cfi;
                const page = epub.locations.locationFromCfi(cfi) || 1;
                const total = epub.locations.length;
                setProgress({ page, total });
                const percentage = Math.round((page / total) * 100);
                onProgressUpdate(percentage, cfi, page, total);
            };

            rendition.on('relocated', handleRelocated);
            rendition.on('error', (err) => console.error('EPUB rendering error:', err));

            const handleKeyDown = (e) => {
                if (!renditionRef.current) return;
                if (e.key === 'ArrowLeft') renditionRef.current.prev();
                if (e.key === 'ArrowRight') renditionRef.current.next();
            };

            document.addEventListener('keydown', handleKeyDown);

            let scrollCleanup = () => {};
            if (scrollDirection === 'scrolled') {
                const scrollContainer = viewerRef.current;
                const handleScroll = debounce(() => {
                    const currentLocation = rendition.currentLocation();
                    if (currentLocation) handleRelocated(currentLocation);
                }, SCROLL_DEBOUNCE_MS);

                scrollContainer.addEventListener('scroll', handleScroll, { capture: true });
                scrollCleanup = () => scrollContainer.removeEventListener('scroll', handleScroll, { capture: true });
            }

            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                scrollCleanup();
            };
        });

        return cleanup;
    }, [fileData, scrollDirection, onMetaExtracted, onProgressUpdate, book.currentCfi, book.title, book.author]);

    useEffect(() => {
        if (!renditionRef.current || !isReady) return;
        const t = themes[theme];
        renditionRef.current.themes.default({
            '*': { 'box-sizing': 'border-box !important' },
            body: {
                background: `${t.bg} !important`,
                color: `${t.fg} !important`,
                'font-family': "'DM Sans', sans-serif",
                'line-height': '1.7',
                padding: '40px 24px !important',
                'overflow': 'visible !important',
            },
            p: {
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
            img: {
                'max-width': '100%',
                'height': 'auto',
                'display': 'block',
                'margin': '1em auto'
            }
        });
    }, [theme, fontSize, isReady]);

    return { viewerRef, renditionRef, epubRef, isReady, progress };
}

/**
 * Hook to manage PDF book rendering and state
 */
function usePdfReader({ book, fileData, scrollDirection, onProgressUpdate, onMetaExtracted }) {
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(book.currentPageNumber || 1);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [visiblePages, setVisiblePages] = useState(new Set());
    const scrollRef = useRef(null);
    const observerRef = useRef(null);
    const pageObserverRef = useRef(null);
    const initialScrollDoneRef = useRef(false);
    const targetPageNumberRef = useRef(null);
    const userHasScrolledRef = useRef(false);

    const memoizedFile = useMemo(() => (fileData ? { data: fileData } : null), [fileData]);

    // Calculate which pages should be rendered (visible + buffer)
    const pagesToRender = useMemo(() => {
        if (scrollDirection !== 'scrolled' || numPages === 0) {
            return new Set([currentPage]); // Paginated mode: just current page
        }

        // Vertical scroll: render visible pages + buffer
        const pages = new Set();
        const targetPage = targetPageNumberRef.current || book.currentPageNumber || 1;
        const BUFFER_PAGES = 3; // Render 3 pages before and after

        // Always include target page area
        for (let i = Math.max(1, targetPage - BUFFER_PAGES); i <= Math.min(numPages, targetPage + BUFFER_PAGES); i++) {
            pages.add(i);
        }

        // Add visible pages
        visiblePages.forEach(p => pages.add(p));

        // Add buffer around visible pages
        visiblePages.forEach(vp => {
            for (let i = Math.max(1, vp - BUFFER_PAGES); i <= Math.min(numPages, vp + BUFFER_PAGES); i++) {
                pages.add(i);
            }
        });

        return pages;
    }, [scrollDirection, numPages, currentPage, visiblePages, book.currentPageNumber]);

    const handlePageChange = useCallback((page) => {
        const newPage = Math.max(1, Math.min(numPages, page));
        setCurrentPage(newPage);
        onProgressUpdate(newPage, numPages);
    }, [numPages, onProgressUpdate]);

    const onDocumentLoadSuccess = useCallback((pdf) => {
        setNumPages(pdf.numPages || 0);
        initialScrollDoneRef.current = false;
        targetPageNumberRef.current = book.currentPageNumber || 1;
        userHasScrolledRef.current = false;

        try {
            pdf.getMetadata?.().then((meta) => {
                const extracted = extractPdfMetaObject(meta || {});
                if (onMetaExtracted && (extracted.title || extracted.author)) {
                    onMetaExtracted(extracted);
                }
            }).catch((e) => console.error("Failed to get PDF metadata", e));
        } catch (e) {
            console.error("Failed to extract PDF metadata:", e);
        }
    }, [onMetaExtracted, book.currentPageNumber]);

    const onPageRenderSuccess = useCallback((page) => {
        // Not used in this approach, but kept for API compatibility
    }, []);

    // Main scroll restoration effect - runs continuously until user scrolls
    useEffect(() => {
        if (scrollDirection !== 'scrolled' || !scrollRef.current || numPages === 0) {
            return;
        }

        const container = scrollRef.current;
        const targetPageNumber = targetPageNumberRef.current || 1;
        let rafId = null;
        let lastKnownScrollTop = 0;
        let stableFrameCount = 0;
        const STABLE_FRAMES_NEEDED = 10; // Need 10 consecutive stable frames

        // Function to check and restore scroll position
        const checkAndRestoreScroll = () => {
            if (!container || initialScrollDoneRef.current || userHasScrolledRef.current) {
                return;
            }

            const pageElement = container.querySelector(`[data-pdf-page="${targetPageNumber}"]`);

            if (pageElement && pageElement.offsetHeight > 0) {
                const targetScrollTop = pageElement.offsetTop;
                const currentScrollTop = container.scrollTop;

                // If we're not at the target position, force it
                if (Math.abs(currentScrollTop - targetScrollTop) > 5) {
                    container.scrollTop = targetScrollTop;
                    lastKnownScrollTop = targetScrollTop;
                    stableFrameCount = 0;
                } else {
                    // Position is good, check if it's stable
                    if (Math.abs(currentScrollTop - lastKnownScrollTop) < 2) {
                        stableFrameCount++;
                        if (stableFrameCount >= STABLE_FRAMES_NEEDED) {
                            // Position has been stable for enough frames
                            initialScrollDoneRef.current = true;
                            return; // Stop the loop
                        }
                    } else {
                        stableFrameCount = 0;
                    }
                    lastKnownScrollTop = currentScrollTop;
                }
            }

            // Continue checking
            rafId = requestAnimationFrame(checkAndRestoreScroll);
        };

        // Start checking after a short delay to let initial render happen
        const startTimeoutId = setTimeout(() => {
            rafId = requestAnimationFrame(checkAndRestoreScroll);
        }, 300);

        // Detect user scroll to stop auto-restoration
        const handleUserScroll = (e) => {
            if (initialScrollDoneRef.current) {
                return;
            }

            // If user initiates scroll (via wheel, touch, or drag), stop auto-restoration
            if (e.isTrusted) {
                const now = Date.now();
                const lastScrollTime = container.dataset.lastScrollTime || 0;

                // If two scroll events happen close together, it's likely user-initiated
                if (now - lastScrollTime < 100) {
                    userHasScrolledRef.current = true;
                    initialScrollDoneRef.current = true;
                }

                container.dataset.lastScrollTime = now;
            }
        };

        container.addEventListener('scroll', handleUserScroll, { passive: true });

        return () => {
            clearTimeout(startTimeoutId);
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            container.removeEventListener('scroll', handleUserScroll);
        };
    }, [scrollDirection, numPages]);

    // Observer to track which pages are visible (for lazy loading)
    useEffect(() => {
        if (scrollDirection !== 'scrolled' || !scrollRef.current || numPages === 0) {
            return;
        }

        if (pageObserverRef.current) {
            pageObserverRef.current.disconnect();
        }

        const container = scrollRef.current;
        const options = {
            root: container,
            rootMargin: '200% 0px', // Large margin to preload pages
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            const newVisiblePages = new Set(visiblePages);
            let changed = false;

            entries.forEach(entry => {
                const pageNum = parseInt(entry.target.getAttribute('data-pdf-page'), 10);
                if (!isNaN(pageNum)) {
                    if (entry.isIntersecting) {
                        if (!newVisiblePages.has(pageNum)) {
                            newVisiblePages.add(pageNum);
                            changed = true;
                        }
                    }
                }
            });

            if (changed) {
                setVisiblePages(newVisiblePages);
            }
        }, options);

        pageObserverRef.current = observer;

        // Observe all page containers
        const pageElements = Array.from(container.querySelectorAll('[data-pdf-page]'));
        pageElements.forEach(el => observer.observe(el));

        return () => {
            observer.disconnect();
        };
    }, [scrollDirection, numPages, visiblePages]);

    // Observer for tracking visible page during scrolling
    useEffect(() => {
        if (scrollDirection !== 'scrolled' || !scrollRef.current) return;

        if (observerRef.current) observerRef.current.disconnect();

        const container = scrollRef.current;
        const options = { root: container, rootMargin: '0px', threshold: 0.5 };

        const setVisiblePage = debounce((pageNumber) => {
            setCurrentPage(pageNumber);
            onProgressUpdate(pageNumber, numPages);
        }, SCROLL_DEBOUNCE_MS);

        const observer = new IntersectionObserver((entries) => {
            const visibleEntry = entries.find(e => e.isIntersecting);
            if (visibleEntry) {
                const pageNum = parseInt(visibleEntry.target.getAttribute('data-pdf-page'), 10);
                if (!isNaN(pageNum)) {
                    setVisiblePage(pageNum);
                }
            }
        }, options);
        observerRef.current = observer;

        const pageElements = Array.from(container.querySelectorAll('[data-pdf-page]'));
        pageElements.forEach(el => observer.observe(el));

        return () => {
            observer.disconnect();
            setVisiblePage.cancel?.();
        };
    }, [scrollDirection, numPages, onProgressUpdate]);

    return {
        numPages,
        currentPage,
        dimensions,
        setDimensions,
        scrollRef,
        memoizedFile,
        handlePageChange,
        onDocumentLoadSuccess,
        onPageRenderSuccess,
        pagesToRender
    };
}

/**
 * Hook to manage TXT book rendering and state
 */
function useTxtReader({ fileData, book, onProgressUpdate }) {
    const scrollRef = useRef(null);
    const [progress, setProgress] = useState(book.progress || 0);

    const textContent = useMemo(() => {
        if (fileData) return new TextDecoder().decode(fileData);
        return '';
    }, [fileData]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) || 0;
        setProgress(pct);
        onProgressUpdate(pct);
    }, [onProgressUpdate]);

    return { scrollRef, progress, textContent, handleScroll };
}

// --- Main Component ---

export default function UnifiedBookReader({ book, fileData, onBack, onProgressUpdate, scrollDirection = 'paginated', onMetaExtracted }) {
    const [showControls, setShowControls] = useState(true);
    const [theme, setTheme] = useState('light');
    const [fontSize, setFontSize] = useState(100);
    const [showSettings, setShowSettings] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);
    const [lastError, setLastError] = useState(null);

    // --- Reader-specific logic is now in hooks ---
    const epub = useEpubReader({ book, fileData, scrollDirection, theme, fontSize, onProgressUpdate, onMetaExtracted, enabled: book.format === 'epub' });
    const pdf = usePdfReader({ book, fileData, scrollDirection, onProgressUpdate, onMetaExtracted, enabled: book.format === 'pdf' });
    const txt = useTxtReader({ book, fileData, onProgressUpdate, enabled: book.format === 'txt' });

    // Calculate optimal dimensions based on viewport
    useEffect(() => {
        const updateDimensions = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            const verticalPadding = scrollDirection === 'paginated' ? (HEADER_HEIGHT + PAGINATED_BOTTOM_CONTROLS_HEIGHT) : HEADER_HEIGHT;
            const height = clientHeight - verticalPadding;
            pdf.setDimensions({ width: clientWidth, height });
        };
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [scrollDirection, pdf.setDimensions]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handlePagePrev = () => {
        if (book.format === 'epub' && epub.renditionRef.current) {
            epub.renditionRef.current.prev();
        } else if (book.format === 'pdf') {
            pdf.handlePageChange(pdf.currentPage - 1);
        }
    };

    const handlePageNext = () => {
        if (book.format === 'epub' && epub.renditionRef.current) {
            epub.renditionRef.current.next();
        } else if (book.format === 'pdf') {
            pdf.handlePageChange(pdf.currentPage + 1);
        }
    };

    const totalProgress = book.format === 'epub'
        ? (epub.progress.total > 0 ? Math.round((epub.progress.page / epub.progress.total) * 100) : 0)
        : book.format === 'pdf'
            ? (pdf.numPages > 0 ? Math.round((pdf.currentPage / pdf.numPages) * 100) : 0)
            : txt.progress;

    const currentStatus = () => {
        if (book.format === 'epub') return `Page ${epub.progress.page} of ${epub.progress.total}`;
        if (book.format === 'pdf') return `Page ${pdf.currentPage} of ${pdf.numPages}`;
        if (book.format === 'txt') return `${txt.progress}% read`;
        return '';
    };

    return (
        <div ref={containerRef} className="fixed inset-0 flex flex-col" style={{ background: themes[theme].bg, color: themes[theme].fg }}>
            <motion.div
                initial={{ y: -HEADER_HEIGHT }}
                animate={{ y: showControls ? 0 : -HEADER_HEIGHT }}
                className="absolute top-0 left-0 right-0 z-50 px-4 py-3 backdrop-blur-md flex items-center justify-between border-b"
                style={{ background: `${themes[theme].bg}ee`, borderColor: `${themes[theme].fg}15`, height: `${HEADER_HEIGHT}px` }}
            >
                <Button variant="ghost" size="icon" onClick={onBack} style={{ color: themes[theme].fg }}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-center flex-1 mx-4">
                    <h2 className="text-sm font-serif font-bold line-clamp-1">{book.title}</h2>
                    {book.author && <p className="text-xs" style={{ color: `${themes[theme].fg}88` }}>{book.author}</p>}
                    <p className="text-xs" style={{ color: `${themes[theme].fg}88` }}>{currentStatus()}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setShowSettings(!showSettings); setShowControls(true); }} style={{ color: themes[theme].fg }}>
                        <Type className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} style={{ color: themes[theme].fg }}>
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </Button>
                </div>
            </motion.div>

            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute left-4 right-4 z-40 p-4 rounded-lg border shadow-lg space-y-4"
                        style={{ top: `${HEADER_HEIGHT + 8}px`, background: themes[theme].bg, borderColor: `${themes[theme].fg}15`, maxWidth: '400px', margin: '0 auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-50">Theme</p>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(themes).map(([key, t]) => (
                                    <button
                                        key={key}
                                        onClick={() => setTheme(key)}
                                        className={`flex-1 py-3 rounded-lg text-xs font-medium border-2 transition-all ${theme === key ? 'border-primary' : 'border-transparent'}`}
                                        style={{ background: t.secondary, color: t.fg }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-50">Font Size: {fontSize}%</p>
                            <Slider value={[fontSize]} min={70} max={200} step={FONT_SIZE_STEP} onValueChange={([v]) => setFontSize(v)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className="flex-1 relative flex flex-col items-center justify-center overflow-hidden"
                style={{ paddingTop: `${HEADER_HEIGHT}px` }}
                onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
            >
                {book.format === 'epub' && (
                    <div ref={epub.viewerRef} className="w-full h-full" style={{ maxWidth: '700px', margin: '0 auto' }}>
                        {!epub.isReady && <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner text="Loading book..." /></div>}
                    </div>
                )}

                {book.format === 'pdf' && pdf.memoizedFile && (
                    scrollDirection === 'scrolled' ? (
                        <div id="pdf-scroll-container" ref={pdf.scrollRef} className="w-full h-full overflow-y-auto overflow-x-hidden">
                            <Document
                                file={pdf.memoizedFile}
                                onLoadSuccess={pdf.onDocumentLoadSuccess}
                                onLoadError={(error) => { console.error('PDF Load Error:', error); setLastError(error.message); }}
                                loading={<div className="flex items-center justify-center h-full py-20"><LoadingSpinner text="Loading PDF..." /></div>}
                                onPageRenderSuccess={pdf.onPageRenderSuccess}
                            >
                                <div className="flex flex-col items-center gap-0" style={{ width: '100%' }}>
                                    {Array.from(new Array(pdf.numPages), (_, index) => {
                                        const pageNum = index + 1;
                                        const shouldRender = pdf.pagesToRender.has(pageNum);

                                        return (
                                            <div
                                                key={`page_${pageNum}`}
                                                data-pdf-page={pageNum}
                                                className="w-full"
                                                style={{
                                                    display: 'block',
                                                    width: pdf.dimensions.width || '100%',
                                                    minHeight: shouldRender ? 'auto' : `${pdf.dimensions.height || 800}px`,
                                                    borderBottom: '1px solid rgba(0,0,0,0.08)'
                                                }}
                                            >
                                                {shouldRender ? (
                                                    <Page
                                                        pageNumber={pageNum}
                                                        width={pdf.dimensions.width || undefined}
                                                        height={pdf.dimensions.height || undefined}
                                                    />
                                                ) : (
                                                    <div
                                                        className="flex items-center justify-center"
                                                        style={{
                                                            height: `${pdf.dimensions.height || 800}px`,
                                                            background: 'rgba(0,0,0,0.02)'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Document>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Document
                                file={pdf.memoizedFile}
                                onLoadSuccess={pdf.onDocumentLoadSuccess}
                                onLoadError={(error) => { console.error('PDF Load Error:', error); setLastError(error.message); }}
                                loading={<div className="flex items-center justify-center h-full"><LoadingSpinner text="Loading PDF..." /></div>}
                            >
                                <div className="flex items-center justify-center" style={{ width: '100%' }}>
                                    <div style={{ width: '100%', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                        <Page
                                            pageNumber={pdf.currentPage}
                                            width={pdf.dimensions.width || undefined}
                                            height={pdf.dimensions.height || undefined}
                                            renderAnnotationLayer={true}
                                            renderTextLayer={true}
                                        />
                                    </div>
                                </div>
                            </Document>
                        </div>
                    )
                )}

                {book.format === 'txt' && (
                    <div ref={txt.scrollRef} className="flex-1 overflow-auto w-full" onScroll={txt.handleScroll} style={{ maxWidth: '700px', margin: '0 auto' }}>
                        <div className="px-6 py-8" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                            <pre className="whitespace-pre-wrap font-sans leading-relaxed" style={{ fontSize: `${(fontSize / 100) * 16}px`, lineHeight: '1.7', textAlign: 'justify' }}>
                                {txt.textContent}
                            </pre>
                        </div>
                    </div>
                )}

                {lastError && <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-700 p-4">{lastError}</div>}

                {scrollDirection === 'paginated' && (book.format === 'pdf' || book.format === 'epub') && (
                    <>
                        <button
                            aria-label="Previous Page"
                            className="absolute left-0 top-16 bottom-20 w-20 z-10 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handlePagePrev(); }}
                        />
                        <button
                            aria-label="Next Page"
                            className="absolute right-0 top-16 bottom-20 w-20 z-10 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handlePageNext(); }}
                        />
                    </>
                )}
            </div>

            {scrollDirection === 'paginated' && book.format !== 'txt' && (
                <motion.div
                    initial={{ y: PAGINATED_BOTTOM_CONTROLS_HEIGHT }}
                    animate={{ y: showControls ? 0 : PAGINATED_BOTTOM_CONTROLS_HEIGHT }}
                    className="absolute bottom-0 left-0 right-0 z-50 px-4 py-4 backdrop-blur-md border-t"
                    style={{ background: `${themes[theme].bg}ee`, borderColor: `${themes[theme].fg}15`, minHeight: `${PAGINATED_BOTTOM_CONTROLS_HEIGHT}px` }}
                >
                    <div className="flex items-center gap-4 max-w-lg mx-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handlePagePrev(); }}
                            disabled={book.format === 'pdf' && pdf.currentPage <= 1}
                            style={{ color: themes[theme].fg }}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex-1">
                            <Slider
                                value={[book.format === 'pdf' ? pdf.currentPage : epub.progress.page]}
                                min={1}
                                max={book.format === 'pdf' ? pdf.numPages : epub.progress.total || 1}
                                step={1}
                                onValueChange={([v]) => {
                                    if (book.format === 'pdf') {
                                        pdf.handlePageChange(v);
                                    } else if (epub.renditionRef.current && epub.epubRef.current) {
                                        const cfi = epub.epubRef.current.locations.cfiFromLocation(v);
                                        epub.renditionRef.current.display(cfi);
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handlePageNext(); }}
                            disabled={book.format === 'pdf' && pdf.currentPage >= pdf.numPages}
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