import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Loader2, Database,
  Sparkles, Trash2, Plus, Save, Pencil, Download, RefreshCw, X
} from 'lucide-react';
import { DskpDocument, DskpRow, MasterData } from '../types';
import { extractDskp, getGeminiKey } from '../services/geminiService';
import { cleanRows, deleteDskp, loadAllDskp, saveDskp, saveDskpOptions } from '../services/dskpService';

interface DSKPUploaderProps {
  masterData: MasterData;
  userName?: string;
  /** Dipanggil selepas pangkalan data DSKP berubah supaya App muat semula hierarki. */
  onDskpUpdated?: () => void;
  /** Kosongkan DSKP lama dalam Google Sheet (masterData.hierarchy). */
  onClearLegacy?: () => Promise<boolean>;
  /** false = mod guru: boleh muat naik DSKP baharu sahaja (tiada sunting/padam/ganti). Lalai: true (Admin). */
  isAdmin?: boolean;
}

/** Kunci perbandingan supaya "Sains / Tingkatan 1", "SAINS / 1", "sains / T1" dianggap sama. */
const normSubject = (s: string) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const normForm = (f: string) => String(f || '').trim().toUpperCase().replace(/^(TINGKATAN|TING\.?|TKT\.?|T)\s*/, '').replace(/\s+/g, ' ');

/** Satu kumpulan pratonton = satu dokumen Firestore (Subjek + Tingkatan). */
interface DraftGroup {
  subject: string;
  form: string;
  sourceFile: string;
  rows: DskpRow[];
}

type Status = { type: 'idle' | 'busy' | 'success' | 'error'; message: string };

const COLS: { key: keyof DskpRow; label: string; width: string }[] = [
  { key: 'title', label: 'Tajuk', width: 'min-w-[140px]' },
  { key: 'field', label: 'Bidang', width: 'min-w-[110px]' },
  { key: 'sk', label: 'Standard Kandungan', width: 'min-w-[200px]' },
  { key: 'sp', label: 'Standard Pembelajaran', width: 'min-w-[240px]' },
  { key: 'core', label: 'Teras', width: 'min-w-[80px]' },
  { key: 'performance', label: 'Standard Prestasi (TP)', width: 'min-w-[220px]' },
  { key: 'notes', label: 'Catatan / Cadangan Aktiviti', width: 'min-w-[220px]' },
];

// Padanan nama lajur Excel/CSV (huruf besar/kecil & BM/BI diterima)
const HEADER_ALIASES: Record<keyof DskpRow | 'subject' | 'form', string[]> = {
  subject: ['SUBJECT', 'SUBJEK', 'MATA PELAJARAN', 'MP'],
  form: ['FORM', 'TINGKATAN', 'TAHUN', 'KELAS'],
  title: ['TITLE', 'TAJUK', 'UNIT', 'TEMA'],
  field: ['FIELD', 'BIDANG', 'KEMAHIRAN', 'MODUL'],
  sk: ['SK', 'STANDARD KANDUNGAN'],
  sp: ['SP', 'STANDARD PEMBELAJARAN'],
  core: ['CORE', 'TERAS'],
  performance: ['TP', 'SPI', 'STANDARD PRESTASI', 'PERFORMANCE'],
  notes: ['CATATAN', 'NOTES', 'AKTIVITI', 'CADANGAN AKTIVITI'],
};

const pick = (row: Record<string, any>, key: keyof typeof HEADER_ALIASES) => {
  const aliases = HEADER_ALIASES[key];
  for (const k of Object.keys(row)) {
    if (aliases.includes(k.trim().toUpperCase())) return String(row[k] ?? '').trim();
  }
  return '';
};

const DSKPUploader: React.FC<DSKPUploaderProps> = ({ masterData, userName, onDskpUpdated, onClearLegacy, isAdmin = true }) => {
  const [status, setStatus] = useState<Status>({ type: 'idle', message: '' });
  const [subject, setSubject] = useState('');
  const [form, setForm] = useState('');
  const [pages, setPages] = useState('');
  const [drafts, setDrafts] = useState<DraftGroup[]>([]);
  const [activeDraft, setActiveDraft] = useState(0);
  const [saved, setSaved] = useState<DskpDocument[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = status.type === 'busy';
  const hasGeminiKey = !!getGeminiKey();

  const formOptions = useMemo(() => {
    const s = new Set<string>(Object.keys(masterData.classes || {}));
    Object.values(masterData.hierarchy || {}).forEach((forms: any) => Object.keys(forms || {}).forEach(f => s.add(f)));
    return Array.from(s).sort();
  }, [masterData]);

  // ---- Senarai pilihan bebas (Tema / Bidang / Tajuk) ----
  const [optSubject, setOptSubject] = useState('');
  const [optForm, setOptForm] = useState('');
  const [optTema, setOptTema] = useState('');
  const [optBidang, setOptBidang] = useState('');
  const [optTajuk, setOptTajuk] = useState('');
  const [optAllForms, setOptAllForms] = useState(true);
  const toLines = (a?: string[]) => (a || []).join('\n');
  const fromLines = (t: string) => t.split('\n').map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);

  const subjectForms = (subj: string) => {
    const set = new Set<string>(Object.keys(masterData.hierarchy?.[subj] || {}));
    saved.filter(d => d.subject === subj).forEach(d => set.add(d.form));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  // Muat senarai sedia ada bila subjek/tingkatan dipilih
  useEffect(() => {
    const d = saved.find(x => x.subject === optSubject && x.form === optForm);
    setOptTema(toLines(d?.options?.tema));
    setOptBidang(toLines(d?.options?.bidang));
    setOptTajuk(toLines(d?.options?.tajuk));
  }, [optSubject, optForm, saved]);

  const handleSaveOptions = async () => {
    if (!optSubject.trim() || !optForm.trim()) { setStatus({ type: 'error', message: 'Pilih Subjek dan Tingkatan untuk senarai pilihan.' }); return; }
    setStatus({ type: 'busy', message: 'Menyimpan senarai pilihan...' });
    try {
      const tema = fromLines(optTema), bidang = fromLines(optBidang), tajuk = fromLines(optTajuk);
      await saveDskpOptions(optSubject, optForm, { tema, bidang, tajuk }, userName);
      let others = 0;
      if (optAllForms) {
        // Tema & Bidang sama untuk semua tingkatan — Tajuk kekal ikut tingkatan masing-masing
        for (const f of subjectForms(optSubject).filter(f => f !== optForm)) {
          const ex = saved.find(x => x.subject === optSubject && x.form === f)?.options;
          await saveDskpOptions(optSubject, f, { tema, bidang, tajuk: ex?.tajuk || [] }, userName);
          others++;
        }
      }
      await refreshSaved();
      onDskpUpdated?.();
      setStatus({ type: 'success', message: `Senarai pilihan ${optSubject} (${optForm}) disimpan${others ? `; Tema & Bidang turut digunakan untuk ${others} tingkatan lain` : ''}.` });
    } catch (e: any) {
      setStatus({ type: 'error', message: `Gagal simpan senarai: ${e.message}` });
    }
  };

  const refreshSaved = async () => {
    setLoadingSaved(true);
    try {
      setSaved((await loadAllDskp()).sort((a, b) => `${a.subject}${a.form}`.localeCompare(`${b.subject}${b.form}`)));
    } catch (e: any) {
      setStatus({ type: 'error', message: `Gagal membaca pangkalan data DSKP: ${e.message}` });
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => { refreshSaved(); }, []);

  // ---------- Pemprosesan fail ----------

  const fromTabular = (data: Record<string, any>[], fileName: string) => {
    const groups = new Map<string, DraftGroup>();
    data.forEach(r => {
      const subj = pick(r, 'subject') || subject;
      const frm = pick(r, 'form') || form;
      if (!subj || !frm) return;
      const key = `${subj}__${frm}`;
      if (!groups.has(key)) groups.set(key, { subject: subj, form: frm, sourceFile: fileName, rows: [] });
      groups.get(key)!.rows.push({
        title: pick(r, 'title'), field: pick(r, 'field'), sk: pick(r, 'sk'), sp: pick(r, 'sp'),
        core: pick(r, 'core'), performance: pick(r, 'performance'), notes: pick(r, 'notes'),
      });
    });
    const result = Array.from(groups.values())
      .map(g => ({ ...g, rows: cleanRows(g.rows) }))
      .filter(g => g.rows.length > 0);
    if (result.length === 0) {
      throw new Error('Tiada baris sah ditemui. Pastikan lajur TAJUK/TITLE, SK dan SP wujud, dan isikan Subjek & Tingkatan (sama ada dalam fail atau di atas).');
    }
    return result;
  };

  /** Cari DSKP (yang ada baris SK/SP) bagi subjek + tingkatan yang sama. */
  const findExisting = (list: DskpDocument[], subj: string, frm: string) =>
    list.find(d => d.rows.length > 0 && normSubject(d.subject) === normSubject(subj) && normForm(d.form) === normForm(frm));
  const uploadedMsg = (d: DskpDocument) =>
    `DSKP ${d.subject} (Tingkatan ${normForm(d.form)}) telah dimuat naik${d.updatedBy ? ` oleh ${d.updatedBy}` : ''}${d.updatedAt ? ` pada ${new Date(d.updatedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. ${isAdmin ? '' : 'Hubungi Admin jika perlu dikemas kini.'}`;

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    setStatus({ type: 'busy', message: 'Memproses fail...' });
    try {
      let groups: DraftGroup[] = [];

      if (ext === 'pdf' || ext === 'docx') {
        if (!hasGeminiKey) throw new Error('Kunci API Gemini diperlukan untuk membaca PDF/Word. Sila tetapkan di halaman Tetapan.');
        if (!subject.trim() || !form.trim()) throw new Error('Sila isi Subjek dan Tingkatan dahulu sebelum memuat naik PDF/Word.');
        // Semak dahulu supaya tidak membazir masa/kuota AI untuk DSKP yang sudah ada
        const dup = findExisting(saved, subject, form);
        if (dup && !isAdmin) throw new Error(uploadedMsg(dup));
        if (dup && isAdmin && !confirm(`${uploadedMsg(dup)}\n\nTeruskan untuk MENGGANTI DSKP sedia ada?`)) { setStatus({ type: 'idle', message: '' }); return; }
        const res = await extractDskp(file, { subject, form, pages }, msg => setStatus({ type: 'busy', message: msg }));
        const rows = cleanRows(res.rows);
        if (rows.length === 0) throw new Error('AI tidak menemui sebarang SK/SP. Pastikan fail ialah DSKP (bukan imbasan kabur) atau cuba hadkan julat halaman.');
        groups = [{ subject: subject.trim(), form: form.trim(), sourceFile: file.name, rows }];
      } else if (ext === 'csv') {
        const parsed = await new Promise<Record<string, any>[]>((resolve, reject) =>
          Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => resolve(r.data as any), error: reject })
        );
        groups = fromTabular(parsed, file.name);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
        const rows: Record<string, any>[] = [];
        wb.SheetNames.forEach(n => rows.push(...XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[n])));
        groups = fromTabular(rows, file.name);
      } else {
        throw new Error('Format tidak disokong. Guna PDF, DOCX, XLSX atau CSV.');
      }

      // Semak pendua (terutama Excel/CSV yang mungkin mengandungi beberapa subjek/tingkatan)
      const dups = groups.map(g => findExisting(saved, g.subject, g.form)).filter(Boolean) as DskpDocument[];
      if (dups.length && !isAdmin) {
        groups = groups.filter(g => !findExisting(saved, g.subject, g.form));
        if (!groups.length) throw new Error(dups.map(uploadedMsg).join('\n'));
        alert(`Dilangkau kerana sudah dimuat naik:\n${dups.map(d => `• ${d.subject} (Tingkatan ${normForm(d.form)})`).join('\n')}`);
      }
      setDrafts(groups);
      setActiveDraft(0);
      const total = groups.reduce((n, g) => n + g.rows.length, 0);
      setStatus({ type: 'success', message: `${total} Standard Pembelajaran diekstrak. Sila semak dan betulkan jadual di bawah sebelum simpan.` });
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message || 'Ralat tidak diketahui.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------- Suntingan pratonton ----------

  const draft = drafts[activeDraft];

  const updateDraft = (patch: Partial<DraftGroup>) =>
    setDrafts(prev => prev.map((d, i) => (i === activeDraft ? { ...d, ...patch } : d)));

  const updateCell = (rowIdx: number, key: keyof DskpRow, value: string) =>
    updateDraft({ rows: draft.rows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)) });

  const addRow = () => {
    const last = draft.rows[draft.rows.length - 1];
    updateDraft({ rows: [...draft.rows, { title: last?.title || '', field: last?.field || 'Umum', sk: last?.sk || '', sp: '', core: 'Teras', performance: '', notes: '' }] });
  };

  const removeRow = (rowIdx: number) => updateDraft({ rows: draft.rows.filter((_, i) => i !== rowIdx) });

  const handleSaveAll = async () => {
    setStatus({ type: 'busy', message: 'Menyimpan ke pangkalan data...' });
    try {
      // Semak semula dengan data terkini (elak dua guru simpan serentak)
      const latest = await loadAllDskp();
      for (const d of drafts) {
        const dup = findExisting(latest, d.subject, d.form);
        if (dup && !isAdmin) throw new Error(uploadedMsg(dup));
      }
      for (const d of drafts) {
        if (!d.subject.trim() || !d.form.trim()) throw new Error('Setiap kumpulan mesti ada Subjek dan Tingkatan.');
        await saveDskp({ subject: d.subject, form: d.form, rows: d.rows, sourceFile: d.sourceFile, updatedBy: userName });
      }
      setStatus({ type: 'success', message: `Berjaya disimpan: ${drafts.map(d => `${d.subject} (${d.form})`).join(', ')}.` });
      setDrafts([]);
      await refreshSaved();
      onDskpUpdated?.();
    } catch (e: any) {
      setStatus({ type: 'error', message: /telah dimuat naik/.test(e.message) ? e.message : `Gagal simpan: ${e.message}. Semak Firestore Security Rules untuk koleksi "dskp".` });
    }
  };

  const handleEditSaved = (d: DskpDocument) => {
    setDrafts([{ subject: d.subject, form: d.form, sourceFile: d.sourceFile || '', rows: d.rows }]);
    setActiveDraft(0);
    setStatus({ type: 'idle', message: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSaved = async (d: DskpDocument) => {
    if (!confirm(`Padam DSKP ${d.subject} (${d.form}) dari pangkalan data?`)) return;
    try {
      await deleteDskp(d.id);
      await refreshSaved();
      onDskpUpdated?.();
    } catch (e: any) {
      setStatus({ type: 'error', message: `Gagal padam: ${e.message}` });
    }
  };

  const legacyCount = useMemo(() => {
    let n = 0;
    const walk = (o: any, depth: number) => {
      if (!o || typeof o !== 'object') return;
      if (depth === 5) { n += Object.keys(o).length; return; }
      Object.values(o).forEach(v => walk(v, depth + 1));
    };
    walk(masterData.hierarchy, 0);
    return n;
  }, [masterData.hierarchy]);

  const confirmTyped = (what: string) =>
    (prompt(`${what}\n\nTindakan ini TIDAK boleh dibatalkan.\nTaip KOSONGKAN untuk sahkan:`) || '').trim().toUpperCase() === 'KOSONGKAN';

  const handleClearFirestore = async () => {
    if (!confirmTyped(`Padam SEMUA ${saved.length} DSKP dalam pangkalan data baharu (Firestore)?`)) return;
    setStatus({ type: 'busy', message: 'Memadam semua DSKP baharu...' });
    try {
      const all = await loadAllDskp();
      for (const d of all) await deleteDskp(d.id);
      await refreshSaved();
      onDskpUpdated?.();
      setStatus({ type: 'success', message: `${all.length} DSKP telah dipadam dari pangkalan data baharu.` });
    } catch (e: any) {
      setStatus({ type: 'error', message: `Gagal padam: ${e.message}` });
    }
  };

  const handleClearLegacy = async () => {
    if (!onClearLegacy) return;
    if (!confirmTyped(`Kosongkan DSKP LAMA dalam Google Sheet (${legacyCount} SP)?\nSubjek, kelas dan rekod RPH TIDAK terjejas.`)) return;
    setStatus({ type: 'busy', message: 'Mengosongkan DSKP lama di Google Sheet...' });
    const ok = await onClearLegacy();
    setStatus(ok
      ? { type: 'success', message: 'DSKP lama telah dikosongkan. Dropdown eRPH kini hanya menggunakan DSKP yang dimuat naik di sini.' }
      : { type: 'error', message: 'Gagal mengosongkan DSKP lama. Cuba lagi.' });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['SUBJEK', 'TINGKATAN', 'TAJUK', 'BIDANG', 'SK', 'SP', 'TERAS', 'TP', 'CATATAN'],
      ['Pendidikan Seni Visual', 'Tingkatan 1', 'Bahasa Seni Visual', 'Umum', '1.1 Bahasa Seni Visual', '1.1.1 Mengenal pasti unsur seni dalam karya', 'Teras', 'TP1: Mengetahui unsur seni; TP2: ...', 'Murid melihat contoh karya'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DSKP');
    XLSX.writeFile(wb, 'Templat_DSKP.xlsx');
  };

  // ---------- UI ----------

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
        <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl"><Database size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pangkalan Data DSKP</h2>
          <p className="text-sm text-slate-500">Muat naik DSKP (PDF, Word, Excel atau CSV). AI akan mengekstrak Tajuk, SK, SP, Standard Prestasi dan Catatan.</p>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {!isAdmin && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 text-xs leading-relaxed">
            Anda boleh memuat naik DSKP untuk subjek &amp; tingkatan yang <b>belum ada</b> dalam pangkalan data. DSKP yang telah dimuat naik tidak boleh dimuat naik semula. <b>Sunting dan padam hanya oleh Admin.</b>
          </div>
        )}
        {/* LANGKAH 1: Maklumat & fail */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Subjek *</span>
            <input list="dskp-subjects" value={subject} onChange={e => setSubject(e.target.value)} placeholder="cth Pendidikan Seni Visual"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal outline-none focus:ring-2 focus:ring-violet-100" />
            <datalist id="dskp-subjects">{(masterData.subjects || []).map(s => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Tingkatan * <span className="font-normal text-slate-400">(mesti sama dengan nama dalam jadual kelas)</span></span>
            <input list="dskp-forms" value={form} onChange={e => setForm(e.target.value)} placeholder="cth Tingkatan 1"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal outline-none focus:ring-2 focus:ring-violet-100" />
            <datalist id="dskp-forms">{formOptions.map(f => <option key={f} value={f} />)}</datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Julat halaman <span className="font-normal text-slate-400">(pilihan, PDF besar)</span></span>
            <input value={pages} onChange={e => setPages(e.target.value)} placeholder="cth 15-48"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal outline-none focus:ring-2 focus:ring-violet-100" />
          </label>
        </div>

        {!hasGeminiKey && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
            <AlertCircle size={16} className="shrink-0" />
            Kunci API Gemini belum ditetapkan. PDF/Word memerlukannya (Tetapan → Kunci API Gemini). Excel/CSV masih boleh dimuat naik.
          </div>
        )}

        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:bg-slate-50 transition-colors">
          <input type="file" id="dskp-upload" className="hidden" ref={fileInputRef} disabled={isBusy}
            accept=".pdf,.docx,.xlsx,.xls,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <label htmlFor="dskp-upload" className={`flex flex-col items-center cursor-pointer ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mb-3">
              {isBusy ? <Loader2 size={30} className="animate-spin" /> : <Upload size={30} />}
            </div>
            <span className="text-sm font-bold text-slate-900">{isBusy ? 'Sedang diproses...' : 'Klik untuk pilih fail DSKP'}</span>
            <span className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1"><FileText size={12} /> PDF / DOCX (AI)</span>
              <span className="flex items-center gap-1"><FileSpreadsheet size={12} /> XLSX / CSV</span>
            </span>
          </label>
          <button onClick={downloadTemplate} className="mt-4 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
            <Download size={12} /> Muat turun templat Excel
          </button>
        </div>

        {status.type !== 'idle' && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm border ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : status.type === 'busy' ? 'bg-violet-50 text-violet-700 border-violet-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : status.type === 'busy' ? <Sparkles size={20} className="animate-pulse" /> : <AlertCircle size={20} />}
            <span>{status.message}</span>
          </div>
        )}

        {/* LANGKAH 2: Semak & sunting */}
        {draft && (
          <div className="border border-slate-200 rounded-3xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
              {drafts.length > 1 && (
                <select value={activeDraft} onChange={e => setActiveDraft(Number(e.target.value))}
                  className="p-2 border border-slate-200 rounded-lg text-xs">
                  {drafts.map((d, i) => <option key={i} value={i}>{d.subject} — {d.form} ({d.rows.length})</option>)}
                </select>
              )}
              <input value={draft.subject} onChange={e => updateDraft({ subject: e.target.value })}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold" title="Subjek" />
              <input value={draft.form} onChange={e => updateDraft({ form: e.target.value })} list="dskp-forms"
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold" title="Tingkatan" />
              <span className="text-xs text-slate-500">{draft.rows.length} SP</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setDrafts([])} className="px-3 py-2 text-xs rounded-lg border border-slate-200 hover:bg-white flex items-center gap-1"><X size={14} /> Batal</button>
                <button onClick={handleSaveAll} disabled={isBusy}
                  className="px-4 py-2 text-xs rounded-lg bg-slate-900 text-white font-bold hover:bg-violet-600 disabled:opacity-50 flex items-center gap-1">
                  <Save size={14} /> Simpan {drafts.length > 1 ? `${drafts.length} DSKP` : 'ke Pangkalan Data'}
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              <table className="text-xs w-full">
                <thead className="bg-white sticky top-0 shadow-sm">
                  <tr>
                    <th className="p-2 text-left text-slate-400">#</th>
                    {COLS.map(c => <th key={c.key} className={`p-2 text-left font-bold text-slate-600 ${c.width}`}>{c.label}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="p-2 text-slate-400">{i + 1}</td>
                      {COLS.map(c => (
                        <td key={c.key} className="p-1">
                          <textarea value={(r[c.key] as string) || ''} rows={c.key === 'sp' || c.key === 'performance' || c.key === 'notes' ? 2 : 1}
                            onChange={e => updateCell(i, c.key, e.target.value)}
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:border-violet-300 focus:bg-white rounded-md outline-none resize-y" />
                        </td>
                      ))}
                      <td className="p-1">
                        <button onClick={() => removeRow(i)} className="p-1.5 text-slate-300 hover:text-rose-500" title="Padam baris"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-100">
              <button onClick={addRow} className="text-xs text-violet-600 font-bold flex items-center gap-1 hover:underline"><Plus size={14} /> Tambah baris</button>
            </div>
          </div>
        )}

        {/* LANGKAH 3: Senarai DSKP dalam pangkalan data */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">DSKP dalam pangkalan data ({saved.length})</h3>
            <button onClick={refreshSaved} className="text-xs text-slate-500 flex items-center gap-1 hover:text-violet-600">
              <RefreshCw size={12} className={loadingSaved ? 'animate-spin' : ''} /> Muat semula
            </button>
          </div>
          {saved.length === 0 ? (
            <p className="text-xs text-slate-400">{loadingSaved ? 'Memuatkan...' : 'Belum ada DSKP disimpan.'}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {saved.filter(d => isAdmin || d.rows.length > 0).map(d => (
                <div key={d.id} className="p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{d.subject}</p>
                    <p className="text-xs text-slate-500">{d.form} · {d.rows.length} SP · {new Set(d.rows.map(r => r.title)).size} tajuk</p>
                    {d.updatedAt && <p className="text-[10px] text-slate-400">Dikemas kini {new Date(d.updatedAt).toLocaleString('ms-MY')}{d.updatedBy ? ` oleh ${d.updatedBy}` : ''}</p>}
                  </div>
                  {isAdmin && <>
                    <button onClick={() => handleEditSaved(d)} className="p-2 text-slate-400 hover:text-violet-600" title="Sunting"><Pencil size={16} /></button>
                    <button onClick={() => handleDeleteSaved(d)} className="p-2 text-slate-400 hover:text-rose-500" title="Padam"><Trash2 size={16} /></button>
                  </>}
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && <>
        {/* SENARAI PILIHAN BEBAS */}
        <div className="border border-blue-200 rounded-3xl p-5 bg-blue-50/30 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Senarai Pilihan Borang eRPH (Tema / Bidang / Tajuk)</h3>
            <p className="text-xs text-slate-600 mt-1">Item di sini muncul sebagai pilihan bebas dalam borang guru — tidak terikat antara satu sama lain. Hanya SK → SP yang mengikut DSKP. Satu item setiap baris.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-600 space-y-1">
              <span>Subjek</span>
              <input list="dskp-subjects" value={optSubject} onChange={e => setOptSubject(e.target.value)} placeholder="cth ENGLISH"
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-normal outline-none" />
            </label>
            <label className="text-xs font-bold text-slate-600 space-y-1">
              <span>Tingkatan</span>
              <input list="opt-forms" value={optForm} onChange={e => setOptForm(e.target.value)} placeholder="cth 1"
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-normal outline-none" />
              <datalist id="opt-forms">{subjectForms(optSubject).map(f => <option key={f} value={f} />)}</datalist>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([
              ['Tema (pilihan — kosongkan jika tiada)', optTema, setOptTema, 'People and Culture\nHealth and Environment'],
              ['Bidang / Skill', optBidang, setOptBidang, 'Listening\nSpeaking\nReading'],
              ['Tajuk', optTajuk, setOptTajuk, 'Money\nFree Time Activities'],
            ] as const).map(([label, val, set, ph]) => (
              <label key={label} className="text-xs font-bold text-slate-600 space-y-1">
                <span>{label} <span className="font-normal text-slate-400">({fromLines(val).length})</span></span>
                <textarea rows={10} value={val} onChange={e => (set as any)(e.target.value)} placeholder={ph}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-normal outline-none resize-y" />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={optAllForms} onChange={e => setOptAllForms(e.target.checked)} className="accent-blue-600" />
            Guna <b>Tema</b> &amp; <b>Bidang</b> yang sama untuk semua tingkatan subjek ini (Tajuk kekal ikut tingkatan)
          </label>
          <button onClick={handleSaveOptions} disabled={isBusy}
            className="px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2">
            <Save size={14} /> Simpan Senarai Pilihan
          </button>
        </div>

        {/* ZON KOSONGKAN */}
        <div className="border border-rose-200 rounded-3xl p-5 bg-rose-50/40 space-y-3">
          <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2"><AlertCircle size={16} /> Kosongkan Pangkalan Data DSKP</h3>
          <p className="text-xs text-slate-600">Guna ini sebelum memuat naik semula semua DSKP baharu. Subjek, senarai kelas dan rekod RPH guru <b>tidak</b> akan terjejas.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleClearLegacy} disabled={isBusy || !onClearLegacy || legacyCount === 0}
              className="flex-1 px-4 py-3 rounded-xl border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-40 flex items-center justify-center gap-2">
              <Trash2 size={14} /> Kosongkan DSKP lama (Google Sheet) — {legacyCount} SP
            </button>
            <button onClick={handleClearFirestore} disabled={isBusy || saved.length === 0}
              className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-40 flex items-center justify-center gap-2">
              <Trash2 size={14} /> Padam semua DSKP baharu (Firestore) — {saved.length} dokumen
            </button>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
};

export default DSKPUploader;
