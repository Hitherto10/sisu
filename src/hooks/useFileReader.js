import { useCallback } from 'react';
import { pdfjs } from 'react-pdf';
import { detectFormat, generateFileHash } from '../lib/book-utils';
import { getCoverArt } from '../lib/cover-utils';
import {
  cleanMetaString,
  extractPdfMetaObject,
  normalizeAuthor,
} from '../lib/meta-utils';

// BUG 1 FIX: foliate metadata fields (title, author) can be:
//   - a plain string
//   - an object { name, sortAs } (contributor object)
//   - a locale map { en: "...", ja: "..." }
//   - an array of any of the above
// Calling String() on an object gives "[object Object]". Use resolveMetaString instead.
function resolveMetaString(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map(v => resolveMetaString(v)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    if (value.name) return String(value.name);
    const first = Object.values(value)[0];
    return first ? resolveMetaString(first) : '';
  }
  return String(value);
}

async function parseEpubMetadata(fileData) {
  try {
    const { makeBook } = await import('foliate-js/view.js');
    // Must be File (not Blob) — foliate calls file.name.endsWith('.epub') internally
    const file = new File([fileData], 'book.epub', { type: 'application/epub+zip' });
    const book = await makeBook(file);
    const meta = book?.metadata ?? {};

    const title  = cleanMetaString(resolveMetaString(meta.title));
    const author = normalizeAuthor(
        cleanMetaString(resolveMetaString(meta.author ?? meta.creator ?? meta.contributor))
    ) || 'Unknown Author';

    return { title, author };
  } catch (e) {
    console.warn('[Sisu] EPUB metadata extraction failed:', e);
    return { title: '', author: 'Unknown Author' };
  }
}

async function parsePdfMetadata(fileData) {
  const pdf  = await pdfjs.getDocument({ data: fileData }).promise;
  const meta = await pdf.getMetadata();
  const { title, author } = extractPdfMetaObject(meta);
  return { title, author: author || 'Unknown Author' };
}

export function useFileReader() {
  const readFile = useCallback(async (file) => {
    const format = detectFormat(file);
    if (!format) throw new Error('Unsupported format');

    const data = await file.arrayBuffer();
    const id   = await generateFileHash(data);

    let metadata = {
      title:  file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
      author: 'Unknown Author',
    };

    try {
      if (format === 'epub') {
        const m = await parseEpubMetadata(data.slice(0));
        if (m.title)  metadata.title  = m.title;
        metadata.author = m.author;
      } else if (format === 'pdf') {
        const m = await parsePdfMetadata(data.slice(0));
        if (m.title)  metadata.title  = m.title;
        metadata.author = m.author;
      }
    } catch (e) {
      console.warn('[Sisu] Metadata extraction failed, using file name.', e);
    }

    const coverUrl = await getCoverArt({
      format,
      fileData: data.slice(0),
      title: metadata.title,
    });

    return { id, ...metadata, format, data, coverUrl, fileSize: file.size, addedAt: Date.now() };
  }, []);

  return { readFile };
}