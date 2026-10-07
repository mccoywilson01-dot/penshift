let segmenter = null;
try {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  }
} catch {
  segmenter = null;
}

export function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  if (segmenter) {
    let count = 0;
    const segments = segmenter.segment(text);
    for (const segment of segments) {
      if (segment.isWordLike) count++;
    }
    return count;
  }
  // High-performance Unicode fallback for environments without Intl.Segmenter
  const matches = text.trim().match(/[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*/gu);
  return matches ? matches.length : 0;
}
