export async function extractTextFromFile(file) {
  // Client-Side DoS Protection: 5MB hard limit prevents V8 engine OOM crashes
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File exceeds maximum size of 5MB.');
  }

  const name = file.name.toLowerCase();
  
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.rtf') || name.endsWith('.csv') || name.endsWith('.json')) {
    return await file.text();
  }

  if (name.endsWith('.docx')) {
    const { default: mammoth } = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (name.endsWith('.pdf')) {
    const [pdfjsLib, pdfjsWorkerUrl] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl.default;
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    return fullText.trim();
  }

  throw new Error('Unsupported file type. Please upload .txt, .md, .docx, or .pdf');
}
