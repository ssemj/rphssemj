import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Loader2, FileText, Table as TableIcon, Image as ImageIcon, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileViewerProps {
  name: string;
  fileType: string;
  fileData: string; // Base64 or URL
  onClose: () => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ name, fileType, fileData, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [excelData, setExcelData] = useState<{ headers: string[], rows: any[] } | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fileType === 'XLSX' || fileType === 'XLS') {
      parseExcel();
    } else {
      setLoading(false);
    }
  }, [fileData, fileType]);

  const parseExcel = async () => {
    try {
      setLoading(true);
      let data: ArrayBuffer;
      
      if (fileData.startsWith('data:')) {
        const base64 = fileData.split(',')[1];
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        data = bytes.buffer;
      } else {
        const response = await fetch(fileData);
        data = await response.arrayBuffer();
      }

      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length > 0) {
        setExcelData({
          headers: jsonData[0].map(h => String(h || '')),
          rows: jsonData.slice(1)
        });
      }
      setLoading(false);
    } catch (err) {
      console.error("Excel Parse Error:", err);
      setError("Gagal memproses fail Excel. Sila muat turun untuk lihat.");
      setLoading(false);
    }
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    console.error("PDF Load Error:", err);
    setError("Gagal memuatkan fail PDF. Sila muat turun untuk lihat.");
    setLoading(false);
  }

  const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(fileType.toUpperCase());
  const isPDF = fileType.toUpperCase() === 'PDF';
  const isExcel = ['XLSX', 'XLS'].includes(fileType.toUpperCase());
  const isLink = fileType.toUpperCase() === 'LINK';

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg">
            {isExcel ? <TableIcon size={20}/> : isImage ? <ImageIcon size={20}/> : <FileText size={20}/>}
          </div>
          <div>
            <h2 className="text-white font-black text-sm md:text-lg uppercase tracking-tight truncate max-w-[200px] md:max-w-md">{name}</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{fileType} • Paparan Interaktif</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isPDF && numPages && (
            <div className="hidden md:flex items-center gap-2 bg-white/10 p-1 rounded-xl mr-4">
              <button 
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber(prev => prev - 1)}
                className="p-2 text-white hover:bg-white/10 rounded-lg disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-[10px] font-black text-white uppercase tracking-widest px-2">
                Muka {pageNumber} / {numPages}
              </span>
              <button 
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber(prev => prev + 1)}
                className="p-2 text-white hover:bg-white/10 rounded-lg disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-2 text-white hover:bg-white/10 rounded-lg"><ZoomOut size={18}/></button>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-2 text-white hover:bg-white/10 rounded-lg"><ZoomIn size={18}/></button>
            </div>
          )}
          
          {!isLink && (
            <a 
              href={fileData} 
              download={name}
              className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Muat Turun"
            >
              <Download size={20} />
            </a>
          )}
          <button 
            onClick={onClose}
            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 md:p-8">
        {loading && (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="animate-spin text-blue-500" size={48} />
            <p className="text-xs font-black uppercase tracking-widest animate-pulse">Memuatkan Bahan...</p>
          </div>
        )}

        {!loading && error && (
          <div className="max-w-md text-center space-y-6 p-10 bg-white/5 rounded-[2.5rem] border border-white/10">
            <div className="p-6 bg-red-500/20 text-red-500 rounded-3xl w-fit mx-auto">
              <FileText size={48} />
            </div>
            <p className="text-white font-bold">{error}</p>
            <button 
              onClick={() => window.open(fileData, '_blank')}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <ExternalLink size={16} /> Buka Pautan Luar
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="w-full h-full bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-slideUp flex flex-col">
            {isImage && (
              <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                <img src={fileData} alt={name} className="max-w-full max-h-full object-contain rounded-xl" />
              </div>
            )}

            {isPDF && (
              <div className="flex-1 overflow-auto flex flex-col items-center bg-slate-100 p-2 md:p-4 custom-scrollbar">
                <Document
                  file={fileData}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex flex-col items-center gap-4 py-20">
                      <Loader2 className="animate-spin text-blue-600" size={32} />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menyediakan Dokumen...</p>
                    </div>
                  }
                >
                  <Page 
                    pageNumber={pageNumber} 
                    scale={scale} 
                    className="shadow-2xl rounded-lg overflow-hidden"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
                
                {/* Mobile Pagination */}
                {numPages && (
                  <div className="md:hidden flex items-center gap-4 mt-6 bg-white p-3 rounded-2xl shadow-lg">
                    <button 
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber(prev => prev - 1)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-30"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                      {pageNumber} / {numPages}
                    </span>
                    <button 
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber(prev => prev + 1)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-30"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {isExcel && excelData && (
              <div className="flex-1 overflow-auto custom-scrollbar p-6">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr>
                      {excelData.headers.map((h, i) => (
                        <th key={i} className="p-4 bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        {excelData.headers.map((_, j) => (
                          <td key={j} className="p-4 border border-slate-100 text-xs font-medium text-slate-600">
                            {row[j] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isLink && (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8">
                <div className="p-8 bg-amber-50 text-amber-600 rounded-[2.5rem] shadow-inner">
                  <ExternalLink size={64} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pautan Luar (Google Drive)</h3>
                  <p className="text-slate-400 text-sm font-medium max-w-md mx-auto">Bahan ini dikongsi melalui pautan Drive. Sila klik butang di bawah untuk membuka bahan tersebut.</p>
                </div>
                <button 
                  onClick={() => window.open(fileData, '_blank')}
                  className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-600 transition-all shadow-xl"
                >
                  <ExternalLink size={18} /> Buka di Google Drive
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileViewer;