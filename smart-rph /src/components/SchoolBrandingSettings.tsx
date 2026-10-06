// Tetapan Logo & Nama Sekolah (Admin)
import React, { useRef, useState } from 'react';
import { ImageUp, Save, Trash2, Loader2, CheckCircle2, AlertCircle, School } from 'lucide-react';
import { DEFAULT_SCHOOL_NAME, resizeImageFile, saveBranding, useBranding } from '../services/brandingService';

const SchoolBrandingSettings: React.FC = () => {
  const branding = useBranding();
  const [logo, setLogo] = useState<string | null>(branding.logo);
  const [name, setName] = useState(branding.schoolName || DEFAULT_SCHOOL_NAME);
  const [status, setStatus] = useState<{ type: 'idle' | 'busy' | 'success' | 'error'; msg: string }>({ type: 'idle', msg: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setStatus({ type: 'error', msg: 'Sila pilih fail imej (PNG / JPG).' }); return; }
    try {
      setLogo(await resizeImageFile(file, 400));
      setStatus({ type: 'idle', msg: '' });
    } catch (e: any) { setStatus({ type: 'error', msg: e.message }); }
    finally { if (inputRef.current) inputRef.current.value = ''; }
  };

  const save = async () => {
    setStatus({ type: 'busy', msg: 'Menyimpan...' });
    try {
      await saveBranding({ logo, schoolName: name });
      setStatus({ type: 'success', msg: 'Disimpan. Logo kini dipaparkan dalam aplikasi dan semua PDF RPH.' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: `Gagal simpan: ${e.message}. Pastikan Firestore Rules membenarkan koleksi "settings".` });
    }
  };

  const sizeKb = logo ? Math.round((logo.length * 3) / 4 / 1024) : 0;

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><School size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Logo & Nama Sekolah</h2>
          <p className="text-sm text-slate-500">Dipaparkan di kepala aplikasi, halaman log masuk, Preview RPH dan setiap PDF yang dijana.</p>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Logo */}
        <div className="space-y-3">
          <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-[conic-gradient(#f1f5f9_25%,#fff_0_50%,#f1f5f9_0_75%,#fff_0)] bg-[length:20px_20px] flex items-center justify-center overflow-hidden">
            {logo ? <img src={logo} alt="Logo sekolah" className="max-w-[85%] max-h-[85%] object-contain" /> : <span className="text-xs text-slate-400">Tiada logo</span>}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" id="logo-upload" onChange={e => pick(e.target.files?.[0])} />
          <div className="flex gap-2">
            <label htmlFor="logo-upload" className="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-600">
              <ImageUp size={14} /> {logo ? 'Tukar logo' : 'Muat naik logo'}
            </label>
            {logo && (
              <button onClick={() => setLogo(null)} className="px-3 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-500" title="Buang logo"><Trash2 size={14} /></button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">PNG berlatar lut sinar paling sesuai. Imej dikecilkan automatik ke 400 px{logo ? ` (≈${sizeKb} KB)` : ''}.</p>
        </div>

        {/* Nama + pratonton kepala PDF */}
        <div className="space-y-5">
          <label className="block text-xs font-bold text-slate-600 space-y-1">
            <span>Nama sekolah (kepala RPH & PDF)</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={DEFAULT_SCHOOL_NAME}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal outline-none uppercase" />
          </label>

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Pratonton kepala RPH</p>
            <div className="border border-slate-200 rounded-xl p-5 bg-white">
              <div className="flex items-center gap-4 border-b-4 border-slate-900 pb-4">
                {logo ? <img src={logo} alt="" className="h-16 w-16 object-contain" /> : <div className="h-16 w-16 rounded bg-slate-100" />}
                <div className="flex-1 text-center pr-16">
                  <p className="text-lg font-black uppercase tracking-wide text-slate-900">{name || DEFAULT_SCHOOL_NAME}</p>
                  <p className="text-sm font-bold uppercase text-slate-600">Rancangan Pengajaran Harian (M1)</p>
                </div>
              </div>
            </div>
          </div>

          {status.type !== 'idle' && (
            <div className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : status.type === 'busy' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {status.type === 'success' ? <CheckCircle2 size={16} /> : status.type === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
              {status.msg}
            </div>
          )}

          <button onClick={save} disabled={status.type === 'busy'}
            className="px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2">
            <Save size={14} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolBrandingSettings;
