// ============================================================
// Arkib & Muat Turun RPH (Guru)
// Muat turun semua RPH setahun, dikepilkan mengikut minggu:
//  • Satu PDF: muka depan + senarai kandungan + pembahagi setiap minggu (+ bookmark)
//  • ZIP: satu PDF bagi setiap minggu
// Halaman RPH dijana menggunakan format rasmi yang sama (ERPHPreview).
// ============================================================
import React, { useMemo, useRef, useState } from 'react';
import { saveBlob } from '../services/pdfOutput';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import { appendWeek, loadLogo, newRphPdf } from '../services/rphPdf';
import { getBranding } from '../services/brandingService';
import html2canvas from 'html2canvas';
import { Download, FileArchive, FileText, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import ERPHPreview from './ERPHPreview';
import { ERPHData, ERPHStatus, UserProfile } from '../types';

interface Props {
  user: UserProfile;
  erphs: ERPHData[];          // RPH milik guru ini sahaja
  onClose: () => void;
}

type Mode = 'single' | 'zip';

const fmtLong = (s?: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const safeName = (s: string) => String(s || 'Guru').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Pasang paparan RPH satu minggu di luar skrin (hanya bila ada halaman Jawi yang perlu ditangkap sebagai imej). */
async function mountOffscreen(list: ERPHData[]) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;background:#fff;z-index:-1;';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<ERPHPreview erphs={list} onBack={() => {}} hideModal />);
  await sleep(150);
  const imgs = Array.from(host.querySelectorAll('img'));
  await Promise.race([
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; }))),
    sleep(4000),
  ]);
  return {
    capture: async (index: number) => {
      const el = host.querySelectorAll<HTMLElement>('.a4-page')[index];
      if (!el) return null;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: el.offsetWidth, height: el.offsetHeight });
      return canvas.toDataURL('image/jpeg', 0.8);
    },
    dispose: () => { root.unmount(); host.remove(); },
  };
}

/** Tambah satu minggu ke PDF: vektor untuk RPH biasa, imej resolusi tinggi untuk Jawi sahaja. */
async function appendWeekToPdf(pdf: jsPDF, list: ERPHData[], first: boolean, logo: string | null) {
  let off: { capture: (i: number) => Promise<string | null>; dispose: () => void } | null = null;
  try {
    await appendWeek(pdf, list, {
      first, logo,
      renderImage: async (i) => { if (!off) off = await mountOffscreen(list); return off.capture(i); },
    });
  } finally {
    off?.dispose();
  }
}

function drawCover(pdf: jsPDF, user: UserProfile, label: string, weeks: number[], total: number) {
  const W = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, W, 70, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
  pdf.text(String(getBranding().schoolName || 'SEKOLAH SENI MALAYSIA JOHOR').toUpperCase(), W / 2, 30, { align: 'center' });
  pdf.setFontSize(22); pdf.text('REKOD PENGAJARAN HARIAN', W / 2, 46, { align: 'center' });
  pdf.setFontSize(12); pdf.setFont('helvetica', 'normal'); pdf.text(label, W / 2, 58, { align: 'center' });
  pdf.setTextColor(15, 23, 42);
  const rows: [string, string][] = [
    ['Nama Guru', user.name || '-'],
    ['Jawatan', user.designation || '-'],
    ['Bidang / Unit', user.department || '-'],
    ['Minggu', weeks.length ? `Minggu ${weeks[0]} hingga Minggu ${weeks[weeks.length - 1]} (${weeks.length} minggu)` : '-'],
    ['Jumlah RPH', String(total)],
    ['Dijana pada', new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })],
  ];
  let y = 100;
  rows.forEach(([k, v]) => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(k, 30, y);
    pdf.setFont('helvetica', 'normal'); pdf.text(pdf.splitTextToSize(v, W - 95), 80, y);
    pdf.setDrawColor(226, 232, 240); pdf.line(30, y + 4, W - 30, y + 4);
    y += 14;
  });
}

function drawDivider(pdf: jsPDF, week: number, list: ERPHData[]) {
  const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
  const dates = list.map(e => e.date).filter(Boolean).sort();
  pdf.setFillColor(37, 99, 235); pdf.rect(0, H / 2 - 40, W, 80, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(40); pdf.text(`MINGGU ${week}`, W / 2, H / 2 - 5, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(13);
  const range = dates.length ? (dates[0] === dates[dates.length - 1] ? fmtLong(dates[0]) : `${fmtLong(dates[0])} – ${fmtLong(dates[dates.length - 1])}`) : '';
  pdf.text(`${range}${range ? '  ·  ' : ''}${list.length} RPH`, W / 2, H / 2 + 14, { align: 'center' });
  const reviewed = list.every(e => e.status === ERPHStatus.REVIEWED);
  pdf.setFontSize(11);
  pdf.text(reviewed ? 'Status: Disemak' : list.some(e => e.status === ERPHStatus.SELESAI || e.status === ERPHStatus.REVIEWED) ? 'Status: Dihantar' : 'Status: Draf', W / 2, H / 2 + 26, { align: 'center' });
  pdf.setTextColor(15, 23, 42);
}

const RPHArchiveDownload: React.FC<Props> = ({ user, erphs, onClose }) => {
  const byWeek = useMemo(() => {
    const m = new Map<number, ERPHData[]>();
    erphs.filter(e => Number(e.week) > 0 && (e as any).status !== 'DELETED').forEach(e => {
      const w = Number(e.week);
      if (!m.has(w)) m.set(w, []);
      m.get(w)!.push(e);
    });
    m.forEach(list => list.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
    return m;
  }, [erphs]);
  const allWeeks = useMemo(() => Array.from(byWeek.keys()).sort((a, b) => a - b), [byWeek]);

  const [from, setFrom] = useState(allWeeks[0] ?? 1);
  const [to, setTo] = useState(allWeeks[allWeeks.length - 1] ?? 1);
  const [mode, setMode] = useState<Mode>('single');
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const cancelRef = useRef(false);

  const selectedWeeks = allWeeks.filter(w => w >= from && w <= to);
  const listFor = (w: number) => (byWeek.get(w) || []).filter(e => !onlyReviewed || e.status === ERPHStatus.REVIEWED);
  const weeksToExport = selectedWeeks.filter(w => listFor(w).length > 0);
  const totalRph = weeksToExport.reduce((n, w) => n + listFor(w).length, 0);
  const label = `Minggu ${from} – ${to}`;

  const download = (blob: Blob, name: string) => saveBlob(blob, name);

  const run = async () => {
    if (weeksToExport.length === 0) return;
    cancelRef.current = false;
    setResult(null);
    setProgress({ done: 0, total: totalRph, label: 'Menyediakan...' });
    const base = `RPH_${safeName(user.name)}_M${from}-M${to}`;
    let done = 0;
    try {
      if (mode === 'single') {
        const pdf = newRphPdf();
        const logo = await loadLogo();
        drawCover(pdf, user, label, weeksToExport, totalRph);
        // Simpan ruang untuk Senarai Kandungan (30 minggu satu muka)
        const tocPages = Math.ceil(weeksToExport.length / 30);
        for (let i = 0; i < tocPages; i++) pdf.addPage();
        const tocEntries: { week: number; page: number; count: number; list: ERPHData[] }[] = [];

        for (const w of weeksToExport) {
          if (cancelRef.current) throw new Error('Dibatalkan');
          const list = listFor(w);
          pdf.addPage(); drawDivider(pdf, w, list);
          const dividerPage = pdf.getNumberOfPages();
          tocEntries.push({ week: w, page: dividerPage, count: list.length, list });
          pdf.outline.add(null, `Minggu ${w} (${list.length} RPH)`, { pageNumber: dividerPage });
          setProgress({ done, total: totalRph, label: `Menjana Minggu ${w}...` });
          await appendWeekToPdf(pdf, list, false, logo);
          done += list.length;
          setProgress({ done, total: totalRph, label: `Minggu ${w} siap` });
        }

        // Tulis Senarai Kandungan
        tocEntries.forEach((t, i) => {
          const page = 2 + Math.floor(i / 30);
          pdf.setPage(page);
          if (i % 30 === 0) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text('SENARAI KANDUNGAN', 20, 25);
            pdf.setFontSize(10); pdf.text('Minggu', 20, 38); pdf.text('Tarikh', 50, 38); pdf.text('Bil. RPH', 140, 38); pdf.text('Muka surat', 170, 38);
            pdf.setDrawColor(15, 23, 42); pdf.line(20, 41, 190, 41);
          }
          const y = 49 + (i % 30) * 8;
          const dates = t.list.map(e => e.date).filter(Boolean).sort();
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
          pdf.text(`Minggu ${t.week}`, 20, y);
          pdf.text(dates.length ? `${fmtLong(dates[0])}${dates.length > 1 && dates[0] !== dates[dates.length - 1] ? ' – ' + fmtLong(dates[dates.length - 1]) : ''}` : '-', 50, y);
          pdf.text(String(t.count), 148, y, { align: 'right' });
          pdf.text(String(t.page), 185, y, { align: 'right' });
          pdf.link(18, y - 5, 174, 7, { pageNumber: t.page });
        });
        // Nombor muka surat
        const n = pdf.getNumberOfPages();
        for (let p = 2; p <= n; p++) {
          pdf.setPage(p); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184);
          pdf.text(`${user.name} · ${label} · ${p}/${n}`, 105, 292, { align: 'center' });
          pdf.setTextColor(15, 23, 42);
        }
        download(pdf.output('blob'), `${base}.pdf`);
      } else {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const logo = await loadLogo();
        const folder = zip.folder(base)!;
        for (const w of weeksToExport) {
          if (cancelRef.current) throw new Error('Dibatalkan');
          const list = listFor(w);
          setProgress({ done, total: totalRph, label: `Menjana Minggu ${w}...` });
          const pdf = newRphPdf();
          await appendWeekToPdf(pdf, list, true, logo);
          const first = list.map(e => e.date).filter(Boolean).sort()[0] || '';
          folder.file(`M${String(w).padStart(2, '0')}${first ? '_' + first : ''}.pdf`, pdf.output('arraybuffer'));
          done += list.length;
          setProgress({ done, total: totalRph, label: `Minggu ${w} siap` });
        }
        setProgress({ done, total: totalRph, label: 'Memampatkan fail ZIP...' });
        download(await zip.generateAsync({ type: 'blob' }), `${base}.zip`);
      }
      setResult({ ok: true, msg: `Selesai! ${totalRph} RPH (${weeksToExport.length} minggu) telah dimuat turun.` });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message === 'Dibatalkan' ? 'Muat turun dibatalkan.' : `Gagal menjana fail: ${e?.message || e}` });
    } finally {
      setProgress(null);
    }
  };

  const busy = !!progress;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Download size={20} /></div>
          <div className="flex-1">
            <h3 className="font-black text-slate-900 text-lg leading-none">Muat Turun Semua RPH</h3>
            <p className="text-xs text-slate-500 mt-1">RPH dikepilkan mengikut minggu dalam format rasmi.</p>
          </div>
          <button onClick={() => { cancelRef.current = true; onClose(); }} className="p-2 text-slate-400 hover:text-red-500"><X size={22} /></button>
        </div>

        <div className="p-6 space-y-5">
          {allWeeks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Belum ada RPH untuk dimuat turun.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600 space-y-1">
                  <span>Dari minggu</span>
                  <select value={from} disabled={busy} onChange={e => { const v = Number(e.target.value); setFrom(v); if (v > to) setTo(v); }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    {allWeeks.map(w => <option key={w} value={w}>Minggu {w}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600 space-y-1">
                  <span>Hingga minggu</span>
                  <select value={to} disabled={busy} onChange={e => { const v = Number(e.target.value); setTo(v); if (v < from) setFrom(v); }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    {allWeeks.map(w => <option key={w} value={w}>Minggu {w}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => { setFrom(allWeeks[0]); setTo(allWeeks[allWeeks.length - 1]); }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200">Setahun penuh</button>
                <label className="flex items-center gap-2 text-xs text-slate-600 ml-auto">
                  <input type="checkbox" checked={onlyReviewed} disabled={busy} onChange={e => setOnlyReviewed(e.target.checked)} className="accent-blue-600" />
                  Hanya RPH yang telah disemak
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ['single', FileText, 'Satu fail PDF', 'Muka depan, senarai kandungan & pembahagi setiap minggu. Sesuai untuk dicetak / fail rekod.'],
                  ['zip', FileArchive, 'ZIP: satu PDF setiap minggu', 'Fail M01, M02, M03… dalam satu folder. Mudah dicari ikut minggu.'],
                ] as const).map(([val, Icon, title, desc]) => (
                  <button key={val} disabled={busy} onClick={() => setMode(val)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${mode === val ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icon size={18} className={mode === val ? 'text-blue-600' : 'text-slate-400'} />
                    <p className="text-sm font-bold text-slate-900 mt-2">{title}</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{desc}</p>
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                Akan dimuat turun: <b>{totalRph} RPH</b> daripada <b>{weeksToExport.length} minggu</b>.
                {totalRph > 80 && <span className="block mt-1 text-amber-700">Jumlah besar — mungkin mengambil sedikit masa. Jangan tutup tab ini.</span>}
              </div>

              {progress && (
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {progress.label} ({progress.done}/{progress.total})</p>
                </div>
              )}

              {result && (
                <div className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${result.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                  {result.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {result.msg}
                </div>
              )}

              <div className="flex gap-2">
                {busy ? (
                  <button onClick={() => { cancelRef.current = true; }} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                ) : (
                  <button onClick={run} disabled={weeksToExport.length === 0}
                    className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-40 flex items-center justify-center gap-2">
                    <Download size={16} /> Muat Turun {mode === 'single' ? 'PDF' : 'ZIP'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RPHArchiveDownload;
