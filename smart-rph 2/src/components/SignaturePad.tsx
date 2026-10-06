
import React, { useRef, useState, useCallback } from 'react';
import { Eraser, Upload, PenTool, Image as ImageIcon, Check } from 'lucide-react';
import { SignaturePadProps } from '../types';

const SignaturePad: React.FC<SignaturePadProps> = ({ onSign, initialValue }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'DRAW' | 'UPLOAD'>('DRAW');
  const [hasSignature, setHasSignature] = useState(!!initialValue);
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialValue || null);

  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getCoordinates = useCallback((e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  React.useEffect(() => {
    if (mode === 'DRAW' && !hasSignature) {
      initCanvas();
    }
  }, [mode, hasSignature, initCanvas]);

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const pos = getCoordinates(e);
    lastPoint.current = pos;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: any) => {
    if (!isDrawing || !lastPoint.current) return;
    const pos = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      const midPoint = {
        x: (lastPoint.current.x + pos.x) / 2,
        y: (lastPoint.current.y + pos.y) / 2
      };
      
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midPoint.x, midPoint.y);
      ctx.stroke();
      lastPoint.current = pos;
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPoint.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        // Use PNG for signature to preserve quality and transparency
        const dataUrl = canvas.toDataURL('image/png');
        onSign(dataUrl);
        setHasSignature(true);
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      onSign('');
      setHasSignature(false);
      setUploadedImage(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
        alert('Fail tidak sah. Sila muat naik fail PNG atau JPEG sahaja.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/png');
            setUploadedImage(compressedBase64);
            onSign(compressedBase64);
            setHasSignature(true);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4 w-full text-left">
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
        <button 
          type="button"
          onClick={() => setMode('DRAW')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'DRAW' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <PenTool size={14} /> Lukis Pad
        </button>
        <button 
          type="button"
          onClick={() => setMode('UPLOAD')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'UPLOAD' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Upload size={14} /> Muat Naik Imej
        </button>
      </div>

      <div className="relative group">
        {mode === 'DRAW' ? (
          <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] overflow-hidden shadow-inner cursor-crosshair h-[240px]">
            <canvas
              ref={canvasRef}
              width={800}
              height={480}
              className="w-full h-full touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] h-[240px] flex flex-col items-center justify-center p-6 text-center transition-all hover:border-blue-400 group relative overflow-hidden">
            {uploadedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img src={uploadedImage} alt="Tandatangan" className="max-h-full object-contain mix-blend-multiply" />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[2.5rem] transition-all">
                   <p className="text-white text-[9px] font-black uppercase tracking-widest">Tukar Imej</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl mb-3"><ImageIcon size={32}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Letakkan fail tandatangan di sini<br/><span className="text-[8px] opacity-60">(PNG atau JPEG sahaja)</span></p>
              </>
            )}
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              accept="image/png, image/jpeg" 
              onChange={handleFileUpload}
            />
          </div>
        )}

        {hasSignature && (
          <button 
            type="button"
            onClick={handleClear}
            className="absolute top-4 right-4 p-3 bg-white text-red-500 rounded-xl shadow-lg border border-slate-100 hover:bg-red-50 transition-all flex items-center gap-2 text-[9px] font-black uppercase"
          >
            <Eraser size={14} /> Padam
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
        {hasSignature ? <Check size={12} className="text-emerald-500"/> : null}
        {hasSignature ? 'Tandatangan sedia untuk pengesahan' : 'Sila masukkan tandatangan'}
      </div>
    </div>
  );
};

export default SignaturePad;
