import { pdfjs } from 'react-pdf';
import ePub from 'epubjs';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Generate a placeholder cover for text files
 * @param {string} title
 * @returns {Promise<string>} Base64 data URL
 */
export async function generatePlaceholderCover(title) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Mellow, cosy color palette
    const colors = [
        ['#c36322', '#e76f51'], // Burnt Orange
        ['#8b5cf6', '#a78bfa'], // Lavender
        ['#0ea5e9', '#38bdf8'], // Sky
        ['#10b981', '#34d399'], // Emerald
        ['#2a2522', '#4a4542'], // Dark Cocoa
    ];
    const [color1, color2] = colors[Math.floor(Math.random() * colors.length)];

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 600);

    // Subtle texture/pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for(let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 400, Math.random() * 600, Math.random() * 100, 0, Math.PI * 2);
        ctx.fill();
    }

    // Book spine line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, 30, 600);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(30, 0, 2, 600);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;

    // Word wrap
    const words = title.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 300) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);

    // Draw lines
    const startY = 300 - (lines.length * 25);
    lines.forEach((line, i) => {
        ctx.fillText(line, 215, startY + (i * 50));
    });

    return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Extract cover from PDF first page
 * @param {ArrayBuffer} fileData
 * @returns {Promise<string>} Base64 data URL
 */
export async function extractPdfCover(fileData) {
    try {
        const pdf = await pdfjs.getDocument({ data: fileData }).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport,
        }).promise;

        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
        console.error('Failed to extract PDF cover:', error);
        return null;
    }
}

/**
 * Extract cover from EPUB
 * @param {ArrayBuffer} fileData
 * @returns {Promise<string>} Cover URL or null
 */
export async function extractEpubCover(fileData) {
    try {
        const book = ePub(fileData);
        await book.ready;

        // Try to get cover from manifest
        const coverUrl = await book.coverUrl();
        if (coverUrl) {
            // Convert to blob and then to base64
            const response = await fetch(coverUrl);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }

        // Fallback: render first page
        const rendition = book.renderTo(document.createElement('div'), {
            width: 400,
            height: 600,
        });

        await rendition.display();

        // Get the rendered content
        const iframe = rendition.manager.container.querySelector('iframe');
        if (iframe) {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');

            // This is a simplified approach - might need html2canvas for better results
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 600);

            await book.destroy();
            return canvas.toDataURL('image/png');
        }

        await book.destroy();
        return null;
    } catch (error) {
        console.error('Failed to extract EPUB cover:', error);
        return null;
    }
}

/**
 * Main function to extract or generate cover based on file type
 * @param {Object} params
 * @param {string} params.format - 'pdf', 'epub', or 'txt'
 * @param {ArrayBuffer} params.fileData
 * @param {string} params.title
 * @param {string} [params.coverUrl] - Optional online cover URL
 * @returns {Promise<string>} Cover URL (data URL or online URL)
 */
export async function getCoverArt({ format, fileData, title, coverUrl }) {
    // Case A: Online/Metadata URL provided
    if (coverUrl && (coverUrl.startsWith('http') || coverUrl.startsWith('data:'))) {
        return coverUrl;
    }

    // Case B: Local PDF
    if (format === 'pdf') {
        const extracted = await extractPdfCover(fileData);
        if (extracted) return extracted;
    }

    // Case C: Local EPUB
    if (format === 'epub') {
        const extracted = await extractEpubCover(fileData);
        if (extracted) return extracted;
    }

    // Case D: TXT or fallback for failed extractions
    return await generatePlaceholderCover(title);
}