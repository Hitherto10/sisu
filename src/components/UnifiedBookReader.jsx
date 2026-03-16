import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
pdfjs.GlobalWorkerOptions.wasmUrl = '/pdfjs-dist/wasm/';
pdfjs.GlobalWorkerOptions.standardFontDataUrl = '/pdfjs-dist/standard_fonts/';
pdfjs.GlobalWorkerOptions.cMapUrl = '/pdfjs-dist/cmaps/';
pdfjs.GlobalWorkerOptions.cMapPacked = true;

const HEADER_HEIGHT = 60;
const PAGINATED_BOTTOM_CONTROLS_HEIGHT = 80;
const FONT_SIZE_STEP = 5;
const SCROLL_DEBOUNCE_MS = 150;

const themes = {
    light: { bg: '#faf8f5', fg: '#2a2522', label: 'Light', secondary: '#ece7df' },
    sepia: { bg: '#f4ecd8', fg: '#5b4636', label: 'Sepia', secondary: '#e8ddc0' },
    dark:  { bg: '#1a1d24', fg: '#d5cfc5', label: 'Dark',  secondary: '#2a2f3a' },
};

// BUG 1 FIX: author/title can be object {name, sortAs} or locale map {en: "..."}
// or array of any of the above. Safely flatten to a plain string.
function resolveMetaString(value) {
    if (!value) return '';
    if (Array.isArray(value)) {
        return value.map(v => resolveMetaString(v)).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
        // Contributor object: { name: "...", sortAs: "..." }
        if (value.name) return String(value.name);
        // Locale map: { en: "...", ja: "..." } — pick first value
        const first = Object.values(value)[0];
        if (first) return resolveMetaString(first);
        return '';
    }
    return String(value);
}

function buildReaderStyles(theme, fontSize) {
    const t = themes[theme];
    return `
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box !important; }
        html, body {
            background: ${t.bg} !important;
            color: ${t.fg} !important;
            font-family: 'DM Sans', sans-serif !important;
            line-height: 1.7 !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        p, li, td, th {
            font-size: ${fontSize}% !important;
            text-align: justify;
            hyphens: auto;
            -webkit-hyphens: auto;
            margin-bottom: 1em;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Libre Baskerville', serif !important;
            margin-top: 1.5em;
            margin-bottom: 0.75em;
            line-height: 1.3;
        }
        img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
        a { color: inherit; }
    `;
}

function applyRendererSettings(view, scrollDirection, theme, fontSize) {
    if (!view || !view.renderer) return;
    view.renderer.setAttribute('flow', scrollDirection === 'scrolled' ? 'scrolled' : 'paginated');
    view.renderer.setAttribute('gap', '0.06');
    view.renderer.setAttribute('margin', '48');
    if (typeof view.renderer.setStyles === 'function') {
        view.renderer.setStyles(buildReaderStyles(theme, fontSize));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// useEpubReader — all four bugs fixed
// ─────────────────────────────────────────────────────────────────────────────
function useEpubReader({ book, fileData, scrollDirection, theme, fontSize, onProgressUpdate, onMetaExtracted }) {
    const containerRef    = useRef(null);
    const viewRef         = useRef(null);
    const [isReady,     setIsReady]     = useState(false);
    const [fraction,    setFraction]    = useState(0);
    const [sectionIdx,  setSectionIdx]  = useState(0);
    const [totalSecs,   setTotalSecs]   = useState(0);

    // Refs so the 'load' closure always sees latest prop values
    const themeRef     = useRef(theme);
    const fontSizeRef  = useRef(fontSize);
    const scrollDirRef = useRef(scrollDirection);
    useEffect(() => { themeRef.current     = theme;           }, [theme]);
    useEffect(() => { fontSizeRef.current  = fontSize;        }, [fontSize]);
    useEffect(() => { scrollDirRef.current = scrollDirection; }, [scrollDirection]);

    useEffect(() => {
        if (!containerRef.current || !fileData) return;
        let destroyed = false;

        const init = async () => {
            try {
                await import('foliate-js/view.js');
                if (destroyed) return;

                // BUG 4 FIX: explicit sizing so foliate fills the container
                const view = document.createElement('foliate-view');
                view.style.cssText = 'display:block;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;';
                containerRef.current.appendChild(view);
                viewRef.current = view;

                // BUG 3 FIX: use fraction, not location.current (which is section index, not page)
                view.addEventListener('relocate', (e) => {
                    if (destroyed) return;
                    const detail  = e.detail ?? {};
                    const frac    = typeof detail.fraction === 'number' ? detail.fraction : 0;
                    const secIdx  = typeof detail.index === 'number' ? detail.index : 0;
                    const tot     = viewRef.current?._totalSections ?? 0;
                    setFraction(frac);
                    setSectionIdx(secIdx);
                    const pct = Math.round(frac * 100);
                    onProgressUpdate(pct, detail.cfi ?? null, secIdx, tot);
                });

                // BUG 2 FIX: apply styles inside 'load' event, NOT after view.open()
                // The renderer only exists and has correct dimensions after 'load' fires.
                view.addEventListener('load', (e) => {
                    if (destroyed) return;

                    // Apply styles now — renderer is mounted and sized correctly
                    applyRendererSettings(view, scrollDirRef.current, themeRef.current, fontSizeRef.current);
                    setIsReady(true);

                    // Store total section count on the element for relocate handler
                    const bookObj = e.detail?.book;
                    if (bookObj) {
                        const total = bookObj.sections?.length ?? 0;
                        viewRef.current._totalSections = total;
                        setTotalSecs(total);

                        // BUG 1 FIX: safely extract author/title using resolveMetaString
                        try {
                            const meta   = bookObj.metadata ?? {};
                            const title  = cleanMetaString(resolveMetaString(meta.title));
                            const author = normalizeAuthor(
                                cleanMetaString(resolveMetaString(meta.author ?? meta.creator ?? meta.contributor))
                            );
                            if (onMetaExtracted && (title || author)) {
                                onMetaExtracted({ title, author });
                            }
                        } catch (_) {}
                    }
                });

                // Wrap in File (not Blob) so foliate can call file.name.endsWith('.epub')
                const safeName = (book.title ?? 'book').replace(/[^a-zA-Z0-9_\- ]/g, '_');
                const file = new File([fileData], `${safeName}.epub`, { type: 'application/epub+zip' });

                await view.open(file);
                if (destroyed) return;

                // Restore position after open (styles applied in 'load' above)
                if (book.currentCfi) {
                    setTimeout(() => {
                        if (!destroyed && viewRef.current) {
                            viewRef.current.goTo(book.currentCfi).catch(() => {});
                        }
                    }, 400);
                }

            } catch (err) {
                console.error('[Sisu] foliate-js init error:', err);
            }
        };

        init();

        return () => {
            destroyed = true;
            if (viewRef.current) {
                viewRef.current.close?.();
                viewRef.current.remove();
                viewRef.current = null;
            }
            setIsReady(false);
            setFraction(0);
            setSectionIdx(0);
            setTotalSecs(0);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileData]);

    // Re-apply settings when theme/fontSize/flow changes
    useEffect(() => {
        if (!viewRef.current || !isReady) return;
        applyRendererSettings(viewRef.current, scrollDirection, theme, fontSize);
    }, [theme, fontSize, scrollDirection, isReady]);

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e) => {
            if (!viewRef.current) return;
            if (e.key === 'ArrowLeft')  viewRef.current.prev();
            if (e.key === 'ArrowRight') viewRef.current.next();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const prev = useCallback(() => viewRef.current?.prev(), []);
    const next = useCallback(() => viewRef.current?.next(), []);
    const goTo = useCallback((cfi) => viewRef.current?.goTo(cfi), []);

    // BUG 3 FIX: slider uses fraction (0–1), scaled to 0–1000 for integer steps
    const goToFraction = useCallback((frac) => {
        if (!viewRef.current) return;
        if (typeof viewRef.current.goToFraction === 'function') {
            viewRef.current.goToFraction(frac);
        } else {
            viewRef.current.goTo?.(frac);
        }
    }, []);

    return { containerRef, viewRef, isReady, fraction, sectionIdx, totalSecs, prev, next, goTo, goToFraction };
}

// ─────────────────────────────────────────────────────────────────────────────
// usePdfReader — completely unchanged from original
// ─────────────────────────────────────────────────────────────────────────────
function usePdfReader({ book, fileData, scrollDirection, onProgressUpdate, onMetaExtracted }) {
    const [numPages, setNumPages]         = useState(0);
    const [currentPage, setCurrentPage]   = useState(book.currentPageNumber || 1);
    const [dimensions, setDimensions]     = useState({ width: 0, height: 0 });
    const [visiblePages, setVisiblePages] = useState(new Set());
    const scrollRef          = useRef(null);
    const observerRef        = useRef(null);
    const pageObserverRef    = useRef(null);
    const initialScrollDoneRef = useRef(false);
    const targetPageNumberRef  = useRef(null);
    const userHasScrolledRef   = useRef(false);

    const memoizedFile = useMemo(() => (fileData ? { data: fileData } : null), [fileData]);

    const pagesToRender = useMemo(() => {
        if (scrollDirection !== 'scrolled' || numPages === 0) return new Set([currentPage]);
        const pages = new Set();
        const tp = targetPageNumberRef.current || book.currentPageNumber || 1;
        const B  = 3;
        for (let i = Math.max(1, tp - B); i <= Math.min(numPages, tp + B); i++) pages.add(i);
        visiblePages.forEach(vp => {
            for (let i = Math.max(1, vp - B); i <= Math.min(numPages, vp + B); i++) pages.add(i);
        });
        return pages;
    }, [scrollDirection, numPages, currentPage, visiblePages, book.currentPageNumber]);

    const handlePageChange = useCallback((page) => {
        const p = Math.max(1, Math.min(numPages, page));
        setCurrentPage(p);
        onProgressUpdate(p, numPages);
    }, [numPages, onProgressUpdate]);

    const onDocumentLoadSuccess = useCallback((pdf) => {
        setNumPages(pdf.numPages || 0);
        initialScrollDoneRef.current = false;
        targetPageNumberRef.current  = book.currentPageNumber || 1;
        userHasScrolledRef.current   = false;
        try {
            pdf.getMetadata?.().then(meta => {
                const ex = extractPdfMetaObject(meta || {});
                if (onMetaExtracted && (ex.title || ex.author)) onMetaExtracted(ex);
            }).catch(console.error);
        } catch (e) { console.error(e); }
    }, [onMetaExtracted, book.currentPageNumber]);

    const onPageRenderSuccess = useCallback(() => {}, []);

    useEffect(() => {
        if (scrollDirection !== 'scrolled' || !scrollRef.current || numPages === 0) return;
        const container = scrollRef.current;
        const targetPN  = targetPageNumberRef.current || 1;
        let rafId = null, lastTop = 0, stable = 0;
        const STABLE = 10;
        const check = () => {
            if (!container || initialScrollDoneRef.current || userHasScrolledRef.current) return;
            const el = container.querySelector(`[data-pdf-page="${targetPN}"]`);
            if (el && el.offsetHeight > 0) {
                const target = el.offsetTop, curr = container.scrollTop;
                if (Math.abs(curr - target) > 5) { container.scrollTop = target; lastTop = target; stable = 0; }
                else {
                    if (Math.abs(curr - lastTop) < 2) { if (++stable >= STABLE) { initialScrollDoneRef.current = true; return; } }
                    else stable = 0;
                    lastTop = curr;
                }
            }
            rafId = requestAnimationFrame(check);
        };
        const tid = setTimeout(() => { rafId = requestAnimationFrame(check); }, 300);
        const onScroll = e => {
            if (initialScrollDoneRef.current) return;
            if (e.isTrusted) {
                const now = Date.now(), last = Number(container.dataset.lst) || 0;
                if (now - last < 100) { userHasScrolledRef.current = true; initialScrollDoneRef.current = true; }
                container.dataset.lst = now;
            }
        };
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => { clearTimeout(tid); if (rafId) cancelAnimationFrame(rafId); container.removeEventListener('scroll', onScroll); };
    }, [scrollDirection, numPages]);

    useEffect(() => {
        if (scrollDirection !== 'scrolled' || !scrollRef.current || numPages === 0) return;
        if (pageObserverRef.current) pageObserverRef.current.disconnect();
        const container = scrollRef.current;
        const obs = new IntersectionObserver(entries => {
            const nv = new Set(visiblePages); let ch = false;
            entries.forEach(e => {
                const n = parseInt(e.target.getAttribute('data-pdf-page'), 10);
                if (!isNaN(n) && e.isIntersecting && !nv.has(n)) { nv.add(n); ch = true; }
            });
            if (ch) setVisiblePages(nv);
        }, { root: container, rootMargin: '200% 0px', threshold: 0 });
        pageObserverRef.current = obs;
        container.querySelectorAll('[data-pdf-page]').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [scrollDirection, numPages, visiblePages]);

    useEffect(() => {
        if (scrollDirection !== 'scrolled' || !scrollRef.current) return;
        if (observerRef.current) observerRef.current.disconnect();
        const container = scrollRef.current;
        const sp = debounce((n) => { setCurrentPage(n); onProgressUpdate(n, numPages); }, SCROLL_DEBOUNCE_MS);
        const obs = new IntersectionObserver(entries => {
            const v = entries.find(e => e.isIntersecting);
            if (v) { const n = parseInt(v.target.getAttribute('data-pdf-page'), 10); if (!isNaN(n)) sp(n); }
        }, { root: container, rootMargin: '0px', threshold: 0.5 });
        observerRef.current = obs;
        container.querySelectorAll('[data-pdf-page]').forEach(el => obs.observe(el));
        return () => { obs.disconnect(); sp.cancel?.(); };
    }, [scrollDirection, numPages, onProgressUpdate]);

    return { numPages, currentPage, dimensions, setDimensions, scrollRef, memoizedFile, handlePageChange, onDocumentLoadSuccess, onPageRenderSuccess, pagesToRender };
}

// ─────────────────────────────────────────────────────────────────────────────
// useTxtReader — completely unchanged
// ─────────────────────────────────────────────────────────────────────────────
function useTxtReader({ fileData, book, onProgressUpdate }) {
    const scrollRef   = useRef(null);
    const [progress, setProgress] = useState(book.progress || 0);
    const textContent = useMemo(() => fileData ? new TextDecoder().decode(fileData) : '', [fileData]);
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) || 0;
        setProgress(pct);
        onProgressUpdate(pct);
    }, [onProgressUpdate]);
    return { scrollRef, progress, textContent, handleScroll };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function UnifiedBookReader({ book, fileData, onBack, onProgressUpdate, scrollDirection = 'paginated', onMetaExtracted }) {
    const [showControls, setShowControls] = useState(true);
    const [theme,        setTheme]        = useState('light');
    const [fontSize,     setFontSize]     = useState(100);
    const [showSettings, setShowSettings] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastError,    setLastError]    = useState(null);
    const containerRef = useRef(null);

    const epub = useEpubReader({ book, fileData, scrollDirection, theme, fontSize, onProgressUpdate, onMetaExtracted });
    const pdf  = usePdfReader({ book, fileData, scrollDirection, onProgressUpdate, onMetaExtracted });
    const txt  = useTxtReader({ fileData, book, onProgressUpdate });

    useEffect(() => {
        const update = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            const vp = scrollDirection === 'paginated'
                ? HEADER_HEIGHT + PAGINATED_BOTTOM_CONTROLS_HEIGHT
                : HEADER_HEIGHT;
            pdf.setDimensions({ width: clientWidth, height: clientHeight - vp });
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [scrollDirection, pdf.setDimensions]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setIsFullscreen(true); }
        else { document.exitFullscreen(); setIsFullscreen(false); }
    };

    const handlePagePrev = () => {
        if (book.format === 'epub') epub.prev();
        else if (book.format === 'pdf') pdf.handlePageChange(pdf.currentPage - 1);
    };
    const handlePageNext = () => {
        if (book.format === 'epub') epub.next();
        else if (book.format === 'pdf') pdf.handlePageChange(pdf.currentPage + 1);
    };

    // BUG 3 FIX: EPUB status shows section + percentage (no fake page numbers)
    const currentStatus = () => {
        if (book.format === 'epub') {
            const pct = Math.round(epub.fraction * 100);
            if (epub.totalSecs > 0) return `Section ${epub.sectionIdx + 1} of ${epub.totalSecs} · ${pct}%`;
            return `${pct}% read`;
        }
        if (book.format === 'pdf')  return `Page ${pdf.currentPage} of ${pdf.numPages}`;
        if (book.format === 'txt')  return `${txt.progress}% read`;
        return '';
    };

    const t = themes[theme];

    // BUG 4 FIX: compute reading area padding so foliate-view gets a real height
    const hasPaginatedBar = scrollDirection === 'paginated' && book.format !== 'txt';

    return (
        <div ref={containerRef} className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.fg }}>

            {/* Header */}
            <motion.div
                initial={{ y: -HEADER_HEIGHT }}
                animate={{ y: showControls ? 0 : -HEADER_HEIGHT }}
                className="absolute top-0 left-0 right-0 z-50 px-4 py-3 backdrop-blur-md flex items-center justify-between border-b"
                style={{ background: `${t.bg}ee`, borderColor: `${t.fg}15`, height: `${HEADER_HEIGHT}px` }}
            >
                <Button variant="ghost" size="icon" onClick={onBack} style={{ color: t.fg }}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-center flex-1 mx-4 overflow-hidden">
                    <h2 className="text-sm font-serif font-bold line-clamp-1">{book.title}</h2>
                    {book.author && <p className="text-xs truncate" style={{ color: `${t.fg}88` }}>{book.author}</p>}
                    <p className="text-xs" style={{ color: `${t.fg}88` }}>{currentStatus()}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon"
                            onClick={() => { setShowSettings(!showSettings); setShowControls(true); }}
                            style={{ color: t.fg }}>
                        <Type className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} style={{ color: t.fg }}>
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </Button>
                </div>
            </motion.div>

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="absolute left-4 right-4 z-40 p-4 rounded-lg border shadow-lg space-y-4"
                        style={{ top: `${HEADER_HEIGHT + 8}px`, background: t.bg, borderColor: `${t.fg}15`, maxWidth: '400px', margin: '0 auto' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-50">Theme</p>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(themes).map(([key, th]) => (
                                    <button key={key} onClick={() => setTheme(key)}
                                            className={`flex-1 py-3 rounded-lg text-xs font-medium border-2 transition-all ${theme === key ? 'border-primary' : 'border-transparent'}`}
                                            style={{ background: th.secondary, color: th.fg }}
                                    >{th.label}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-50">Font Size: {fontSize}%</p>
                            <Slider value={[fontSize]} min={70} max={200} step={FONT_SIZE_STEP}
                                    onValueChange={([v]) => setFontSize(v)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reading Area — BUG 4 FIX: explicit paddingTop+paddingBottom so child height resolves */}
            <div
                className="flex-1 flex flex-col overflow-hidden"
                style={{
                    paddingTop:    `${HEADER_HEIGHT}px`,
                    paddingBottom: hasPaginatedBar ? `${PAGINATED_BOTTOM_CONTROLS_HEIGHT}px` : '0px',
                }}
                onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
            >
                {/* EPUB */}
                {book.format === 'epub' && (
                    <div
                        ref={epub.containerRef}
                        style={{
                            flex: '1 1 0',
                            minHeight: 0,
                            width: '100%',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {!epub.isReady && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: t.bg, zIndex: 10 }}>
                                <LoadingSpinner text="Loading book..." />
                            </div>
                        )}
                    </div>
                )}

                {/* PDF */}
                {book.format === 'pdf' && pdf.memoizedFile && (
                    scrollDirection === 'scrolled' ? (
                        <div ref={pdf.scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
                            <Document
                                file={pdf.memoizedFile}
                                onLoadSuccess={pdf.onDocumentLoadSuccess}
                                onLoadError={err => { console.error('PDF Load Error:', err); setLastError(err.message); }}
                                loading={<div className="flex items-center justify-center h-full py-20"><LoadingSpinner text="Loading PDF..." /></div>}
                                onPageRenderSuccess={pdf.onPageRenderSuccess}
                            >
                                <div className="flex flex-col items-center" style={{ width: '100%' }}>
                                    {Array.from(new Array(pdf.numPages), (_, i) => {
                                        const pn = i + 1, sr = pdf.pagesToRender.has(pn);
                                        return (
                                            <div key={`page_${pn}`} data-pdf-page={pn} className="w-full"
                                                 style={{ width: pdf.dimensions.width || '100%', minHeight: sr ? 'auto' : `${pdf.dimensions.height || 800}px`, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                                {sr
                                                    ? <Page pageNumber={pn} width={pdf.dimensions.width || undefined} height={pdf.dimensions.height || undefined} />
                                                    : <div style={{ height: `${pdf.dimensions.height || 800}px`, background: 'rgba(0,0,0,0.02)' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Document>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                            <Document
                                file={pdf.memoizedFile}
                                onLoadSuccess={pdf.onDocumentLoadSuccess}
                                onLoadError={err => { console.error('PDF Load Error:', err); setLastError(err.message); }}
                                loading={<div className="flex items-center justify-center h-full"><LoadingSpinner text="Loading PDF..." /></div>}
                            >
                                <Page pageNumber={pdf.currentPage}
                                      width={pdf.dimensions.width || undefined}
                                      height={pdf.dimensions.height || undefined}
                                      renderAnnotationLayer renderTextLayer />
                            </Document>
                        </div>
                    )
                )}

                {/* TXT */}
                {book.format === 'txt' && (
                    <div ref={txt.scrollRef} className="flex-1 overflow-auto" onScroll={txt.handleScroll}>
                        <div className="max-w-2xl mx-auto px-6 py-8">
                            <pre className="whitespace-pre-wrap font-sans leading-relaxed"
                                 style={{ fontSize: `${(fontSize / 100) * 16}px`, lineHeight: '1.7', textAlign: 'justify' }}>
                                {txt.textContent}
                            </pre>
                        </div>
                    </div>
                )}

                {lastError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-700 p-4">{lastError}</div>
                )}

                {/* Tap zones */}
                {scrollDirection === 'paginated' && (book.format === 'pdf' || book.format === 'epub') && (
                    <>
                        <button aria-label="Previous Page"
                                className="absolute left-0 z-10 cursor-pointer"
                                style={{ top: `${HEADER_HEIGHT}px`, bottom: `${PAGINATED_BOTTOM_CONTROLS_HEIGHT}px`, width: '80px' }}
                                onClick={e => { e.stopPropagation(); handlePagePrev(); }} />
                        <button aria-label="Next Page"
                                className="absolute right-0 z-10 cursor-pointer"
                                style={{ top: `${HEADER_HEIGHT}px`, bottom: `${PAGINATED_BOTTOM_CONTROLS_HEIGHT}px`, width: '80px' }}
                                onClick={e => { e.stopPropagation(); handlePageNext(); }} />
                    </>
                )}
            </div>

            {/* Bottom Nav */}
            {hasPaginatedBar && (
                <motion.div
                    initial={{ y: PAGINATED_BOTTOM_CONTROLS_HEIGHT }}
                    animate={{ y: showControls ? 0 : PAGINATED_BOTTOM_CONTROLS_HEIGHT }}
                    className="absolute bottom-0 left-0 right-0 z-50 px-4 py-4 backdrop-blur-md border-t"
                    style={{ background: `${t.bg}ee`, borderColor: `${t.fg}15`, height: `${PAGINATED_BOTTOM_CONTROLS_HEIGHT}px` }}
                >
                    <div className="flex items-center gap-4 max-w-lg mx-auto">
                        <Button variant="ghost" size="icon"
                                onClick={e => { e.stopPropagation(); handlePagePrev(); }}
                                disabled={book.format === 'pdf' && pdf.currentPage <= 1}
                                style={{ color: t.fg }}>
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex-1">
                            {/* BUG 3 FIX: EPUB uses fraction×1000 for smooth slider; PDF uses page numbers */}
                            <Slider
                                value={[book.format === 'pdf'
                                    ? pdf.currentPage
                                    : Math.round(epub.fraction * 1000)
                                ]}
                                min={book.format === 'pdf' ? 1 : 0}
                                max={book.format === 'pdf' ? pdf.numPages : 1000}
                                step={1}
                                onValueChange={([v]) => {
                                    if (book.format === 'pdf') pdf.handlePageChange(v);
                                    else if (book.format === 'epub') epub.goToFraction(v / 1000);
                                }}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                        <Button variant="ghost" size="icon"
                                onClick={e => { e.stopPropagation(); handlePageNext(); }}
                                disabled={book.format === 'pdf' && pdf.currentPage >= pdf.numPages}
                                style={{ color: t.fg }}>
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}