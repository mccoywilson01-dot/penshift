self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  if (type === 'countWords') {
    let count = 0;
    try {
      const text = payload || '';
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
        const segments = segmenter.segment(text);
        for (const segment of segments) {
          if (segment.isWordLike) count++;
        }
      } else {
        count = text.trim().split(/\s+/).filter(Boolean).length;
      }
    } catch {
      count = 0;
    }
    self.postMessage({ type: 'wordCountResult', id: e.data.id, result: count });
  }
};
