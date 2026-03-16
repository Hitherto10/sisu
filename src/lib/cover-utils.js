import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─────────────────────────────────────────────────────────────────────────────
// generatePlaceholderCover — completely unchanged from original
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePlaceholderCover(title) {
    const canvas = document.createElement('canvas');
    canvas.width  = 400;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    const colors = [
        ['#c36322', '#e76f51'],
        ['#8b5cf6', '#a78bfa'],
        ['#0ea5e9', '#38bdf8'],
        ['#10b981', '#34d399'],
        ['#2a2522', '#4a4542'],
    ];
    const [color1, color2] = colors[Math.floor(Math.random() * colors.length)];

    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 600);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 400, Math.random() * 600, Math.random() * 100, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, 30, 600);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(30, 0, 2, 600);

    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 36px "Outfit", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur   = 10;

    const words = title.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        if (ctx.measureText(testLine).width > 300) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);

    const startY = 300 - (lines.length * 25);
    lines.forEach((line, i) => ctx.fillText(line, 215, startY + i * 50));

    return canvas.toDataURL('image/jpeg', 0.9);
}

// ─────────────────────────────────────────────────────────────────────────────
// extractPdfCover — completely unchanged from original
// ─────────────────────────────────────────────────────────────────────────────
export async function extractPdfCover(fileData) {
    try {
        const pdf      = await pdfjs.getDocument({ data: fileData }).promise;
        const page     = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas   = document.createElement('canvas');
        const context  = canvas.getContext('2d');
        canvas.width   = viewport.width;
        canvas.height  = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
        console.error('[Sisu] Failed to extract PDF cover:', error);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// extractEpubCover — rewritten to use foliate-js
//
// FIX: foliate-js calls file.name.endsWith('.epub') internally to pick its
// EPUB parser. A plain `new Blob([data])` has no .name → crash with
// "Cannot read properties of undefined (reading 'endsWith')".
//
// Solution: use `new File([data], 'book.epub', { type })` so .name exists.
// foliate's book interface exposes getCover() which returns a Blob directly,
// no hidden-div rendering required.
// ─────────────────────────────────────────────────────────────────────────────
export async function extractEpubCover(fileData) {
    try {
        const { makeBook } = await import('foliate-js/view.js');

        // File (not Blob) — foliate needs .name to detect the format
        const file = new File([fileData], 'book.epub', { type: 'application/epub+zip' });
        const book = await makeBook(file);

        // getCover() returns a Blob containing the cover image, or null/undefined
        const coverBlob = await book.getCover?.();
        if (!coverBlob) return null;

        return new Promise((resolve) => {
            const reader     = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror   = () => resolve(null);
            reader.readAsDataURL(coverBlob);
        });
    } catch (error) {
        console.error('[Sisu] Failed to extract EPUB cover via foliate-js:', error);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCoverArt — main entry point, logic unchanged
// ─────────────────────────────────────────────────────────────────────────────
export async function getCoverArt({ format, fileData, title, coverUrl }) {
    // Case A: Online / pre-computed URL
    if (coverUrl && (coverUrl.startsWith('http') || coverUrl.startsWith('data:'))) {
        return coverUrl;
    }

    // Case B: PDF
    if (format === 'pdf') {
        const extracted = await extractPdfCover(fileData);
        if (extracted) return extracted;
    }

    // Case C: EPUB (now via foliate-js with File fix)
    if (format === 'epub') {
        const extracted = await extractEpubCover(fileData);
        if (extracted) return extracted;
    }

    // Case D: TXT or any fallback
    return generatePlaceholderCover(title);
}