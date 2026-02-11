import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfReader({
                                    book,
                                    fileData,
                                    onBack,
                                    onProgressUpdate,
                                  }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(400);

  /* ---------------- Resize handling ---------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ---------------- Progress update ---------------- */
  useEffect(() => {
    if (numPages > 0) {
      onProgressUpdate(currentPage, numPages);
    }
  }, [currentPage, numPages, onProgressUpdate]);

  /* ---------------- Page navigation ---------------- */
  const goTo = (page) => {
    setCurrentPage(Math.max(1, Math.min(numPages, page)));
  };

  /* ---------------- Fullscreen ---------------- */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  /* ---------------- PDF data (CRITICAL FIX) ---------------- */
  const pdfData = useMemo(() => {
    if (!fileData) return null;

    // Avoid re-wrapping or re-consuming buffers
    if (fileData instanceof Uint8Array) {
      return fileData;
    }

    return new Uint8Array(fileData);
  }, [fileData]);

  const pdfFile = useMemo(() => {
    if (!pdfData) return null;
    return { data: pdfData };
  }, [pdfData]);

  return (
      <div
          ref={containerRef}
          className="flex flex-col h-screen bg-background"
          onClick={() => setShowControls((v) => !v)}
      >
        {/* ---------------- Top bar ---------------- */}
        <motion.div
            initial={{ y: -60 }}
            animate={{ y: showControls ? 0 : -60 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-background/90 backdrop-blur-md border-b"
            onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="text-center flex-1 mx-4">
            <h2 className="text-sm font-serif font-bold line-clamp-1">
              {book.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {numPages}
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? (
                <Minimize className="w-4 h-4" />
            ) : (
                <Maximize className="w-4 h-4" />
            )}
          </Button>
        </motion.div>

        {/* ---------------- PDF content ---------------- */}
        <div
            className="flex-1 overflow-auto flex justify-center pt-16 pb-24"
            onClick={(e) => e.stopPropagation()}
        >
          {pdfFile ? (
              <Document
                  file={pdfFile}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Loading PDF...
                    </div>
                  }
              >
                <Page
                    pageNumber={currentPage}
                    width={Math.min(containerWidth - 32, 800)}
                />
              </Document>
          ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading PDF...
              </div>
          )}

        </div>

        {/* ---------------- Bottom nav ---------------- */}
        <motion.div
            initial={{ y: 80 }}
            animate={{ y: showControls ? 0 : 80 }}
            className="absolute bottom-0 left-0 right-0 z-10 px-4 py-4 bg-background/90 backdrop-blur-md border-t"
            onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => goTo(currentPage - 1)}
                disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <Slider
                value={[currentPage]}
                min={1}
                max={numPages || 1}
                step={1}
                onValueChange={([v]) => goTo(v)}
                className="flex-1"
            />

            <Button
                variant="ghost"
                size="icon"
                onClick={() => goTo(currentPage + 1)}
                disabled={currentPage >= numPages}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </div>
  );
}
