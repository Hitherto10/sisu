import { useCallback } from 'react';
import ePub from 'epubjs';
import { pdfjs } from 'react-pdf';
import { detectFormat, generateFileHash } from '../lib/book-utils';
import { getCoverArt } from '../lib/cover-utils';
import { cleanMetaString, normalizeAuthor } from '../lib/meta-utils';

export function useFileReader() {
  const parseEpubMetadata = async (fileData) => {
    const book = ePub(fileData);
    const metadata = await book.loaded.metadata;
    return {
      title: cleanMetaString(metadata.title || ''),
      author: normalizeAuthor(cleanMetaString(metadata.creator || '')) || 'Unknown Author',
    };
  };

  const parsePdfMetadata = async (fileData) => {
    const pdf = await pdfjs.getDocument({ data: fileData }).promise;
    const metadata = await pdf.getMetadata();
    return {
      title: cleanMetaString(metadata.info?.Title || ''),
      author: normalizeAuthor(cleanMetaString(metadata.info?.Author || '')) || 'Unknown Author',
    };
  };

  const readFile = useCallback(async (file) => {
    const format = detectFormat(file);
    if (!format) throw new Error('Unsupported format');

    const data = await file.arrayBuffer();
    const id = await generateFileHash(data);
    
    let metadata = {
      title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
      author: 'Unknown Author',
    };

    try {
      if (format === 'epub') {
        const epubMeta = await parseEpubMetadata(data.slice(0));
        if (epubMeta.title) metadata.title = epubMeta.title;
        metadata.author = epubMeta.author;
      } else if (format === 'pdf') {
        const pdfMeta = await parsePdfMetadata(data.slice(0));
        if (pdfMeta.title) metadata.title = pdfMeta.title;
        metadata.author = pdfMeta.author;
      }
    } catch (e) {
      console.warn('Metadata extraction failed, falling back to file name', e);
    }

    const coverUrl = await getCoverArt({
      format,
      fileData: data.slice(0),
      title: metadata.title,
    });

    return {
      id,
      ...metadata,
      format,
      data,
      coverUrl,
      fileSize: file.size,
      addedAt: Date.now(),
    };
  }, []);

  return { readFile };
}
