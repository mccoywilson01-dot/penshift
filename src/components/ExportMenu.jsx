import { useState, useRef, useEffect } from 'react';
import { Download, FileText, File as FileIcon, FileType2 } from 'lucide-react';
import { exportToDocx, exportToPdf, exportToTxt } from '../lib/exportUtils.js';

export function ExportMenu({ text, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (type) => {
    setOpen(false);
    if (!text) return;
    try {
      if (type === 'docx') await exportToDocx(text, `PenShift-${Date.now()}.docx`);
      else if (type === 'pdf') await exportToPdf(text, `PenShift-${Date.now()}.pdf`);
      else if (type === 'md') await exportToTxt(text, `PenShift-${Date.now()}.md`);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Check console for details.');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        disabled={disabled}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-150 ${disabled ? 'opacity-40 bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200/50' : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 active:scale-95 border border-slate-200/80 shadow-xs'}`}
      >
        <Download size={12} className="text-slate-500" />
        Export
      </button>
      
      {open && !disabled && (
        <div className="absolute right-0 mt-1.5 w-36 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-[0_16px_36px_-6px_rgba(15,23,42,0.12),0_1px_1px_rgba(255,255,255,0.9)] border border-slate-200/80 p-1 z-50 overflow-hidden anim-scale-in" style={{ animationDuration: '0.15s' }}>
          <button onClick={() => handleExport('docx')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl transition-colors">
            <FileText size={14} className="text-blue-500" /> DOCX
          </button>
          <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl transition-colors">
            <FileIcon size={14} className="text-red-500" /> PDF
          </button>
          <button onClick={() => handleExport('md')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl transition-colors">
            <FileType2 size={14} className="text-slate-500" /> Markdown
          </button>
        </div>
      )}
    </div>
  );
}
