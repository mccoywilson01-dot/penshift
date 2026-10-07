export async function exportToDocx(text, filename = 'document.docx') {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const { saveAs } = await import('file-saver');

  const paragraphs = text.split('\n').map(line => {
    return new Paragraph({
      children: [new TextRun(line)],
    });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

export async function exportToPdf(text, filename = 'document.pdf') {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  
  // Basic PDF export with word wrapping
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxLineWidth = pageWidth - margin * 2;
  
  // Normalize unicode punctuation (em-dashes, smart quotes, ellipses) to prevent jsPDF font mojibake
  const cleanText = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...');
  
  const lines = doc.splitTextToSize(cleanText, maxLineWidth);
  
  let cursorY = margin;
  for (let i = 0; i < lines.length; i++) {
    if (cursorY > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(lines[i], margin, cursorY);
    cursorY += 7; // line height
  }
  
  doc.save(filename);
}

export async function exportToTxt(text, filename = 'document.txt') {
  const { saveAs } = await import('file-saver');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
}
