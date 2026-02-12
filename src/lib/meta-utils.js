// Utilities to clean and normalize title/author metadata across the app
export function decodeRFC2047(str) {
  if (!str || typeof str !== 'string') return str;
  const m = str.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
  if (!m) return str;
  const [, charset, encoding, encoded] = m;
  try {
    if (encoding.toUpperCase() === 'B') {
      const binary = atob(encoded.replace(/\s/g, ''));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder(charset || 'utf-8').decode(bytes);
    }
    // Q encoding
    return encoded.replace(/_/g, ' ').replace(/=([A-Fa-f0-9]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16)));
  } catch (e) {
    return str;
  }
}

export function cleanMetaString(s, fallback = '') {
  if (!s) return fallback;
  let out = String(s).replace(/\u0000/g, '').trim();
  out = out.replace(/[\r\n]+/g, ' ');
  out = out.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
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

  const stripped = out.replace(/[^A-Za-z0-9\s,.'-]/g, '');
  if (stripped.length < 2 || /^untitled$/i.test(out)) return fallback || out;
  return out;
}

export function normalizeAuthor(raw) {
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

export function extractPdfMetaObject(meta) {
  const info = meta?.info || {};
  const metadata = meta?.metadata || null;

  let title = info?.Title || info?.title || (metadata?.get ? (metadata.get('dc:title') || metadata.get('title')) : undefined);
  let author = info?.Author || info?.author || info?.Creator || (metadata?.get ? (metadata.get('dc:creator') || metadata.get('creator')) : undefined);

  if (Array.isArray(title)) title = title[0];
  if (Array.isArray(author)) author = Array.isArray(author[0]) ? author[0].join(', ') : author[0];

  title = cleanMetaString(title);
  author = cleanMetaString(author);
  author = normalizeAuthor(author);

  return { title, author };
}

