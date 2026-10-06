// ============================================================
// Tetapan Kalendar Akademik (Admin)
// Admin tetapkan tarikh Isnin Minggu 1 + senarai cuti.
// Semua guru guna kalendar ini untuk tarikh RPH mingguan.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AcademicCalendar, CalendarHoliday } from '../types';
import { addDays, holidayOn, loadCalendar, mondayOf, parseDate, saveCalendar, todayStr, weekToMonday, dateToWeek } from '../services/calendarService';

interface Props {
  userName?: string;
  onSaved?: (cal: AcademicCalendar) => void;
}

const fmtShort = (s: string) => parseDate(s).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });

const AcademicCalendarSettings: React.FC<Props> = ({ userName, onSaved }) => {
  const [cal, setCal] = useState<AcademicCalendar>({ year: String(new Date().getFullYear()), week1Monday: '', holidays: [] });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'idle' | 'busy' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [previewWeeks, setPreviewWeeks] = useState(45);

  useEffect(() => {
    loadCalendar()
      .then(c => { if (c) setCal(c); })
      .catch(e => setStatus({ type: 'error', message: `Gagal membaca kalendar: ${e.message}` }))
      .finally(() => setLoading(false));
  }, []);

  const setHoliday = (i: number, patch: Partial<CalendarHoliday>) =>
    setCal(c => ({ ...c, holidays: c.holidays.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) }));

  const weeks = useMemo(() => {
    if (!cal.week1Monday) return [];
    return Array.from({ length: previewWeeks }, (_, i) => {
      const w = i + 1;
      const mon = weekToMonday(cal, w);
      const days = [0, 1, 2, 3, 4].map(n => addDays(mon, n));
      const hol = days.map(d => holidayOn(cal, d)).filter(Boolean) as CalendarHoliday[];
      return { w, mon, fri: days[4], holidayNames: Array.from(new Set(hol.map(h => h.name))), fullHoliday: hol.length === 5 };
    });
  }, [cal, previewWeeks]);

  const currentWeek = cal.week1Monday ? dateToWeek(cal, todayStr()) : null;

  const handleSave = async () => {
    if (!cal.week1Monday) { setStatus({ type: 'error', message: 'Sila isi tarikh Minggu 1.' }); return; }
    setStatus({ type: 'busy', message: 'Menyimpan kalendar...' });
    try {
      await saveCalendar(cal, userName);
      const fresh = { ...cal, week1Monday: mondayOf(cal.week1Monday) };
      setCal(fresh);
      onSaved?.(fresh);
      setStatus({ type: 'success', message: 'Kalendar akademik disimpan. Tarikh RPH semua guru kini mengikut kalendar ini.' });
    } catch (e: any) {
      setStatus({ type: 'error', message: `Gagal simpan: ${e.message}. Pastikan Firestore Rules membenarkan koleksi "settings".` });
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-400"><Loader2 className="animate-spin inline" /> Memuatkan kalendar...</div>;

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><CalendarDays size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Kalendar Akademik</h2>
          <p className="text-sm text-slate-500">Tetapkan tarikh Minggu 1 dan cuti. Tab hari dalam RPH Mingguan guru akan ikut tarikh ini secara automatik.</p>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Tahun / Sesi</span>
            <input value={cal.year} onChange={e => setCal(c => ({ ...c, year: e.target.value }))} placeholder="cth 2026"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal outline-none" />
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Tarikh mula Minggu 1 * <span className="font-normal text-slate-400">(akan dilaraskan ke hari Isnin)</span></span>
            <input type="date" value={cal.week1Monday} onChange={e => setCal(c => ({ ...c, week1Monday: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal outline-none" />
          </label>
          <div className="text-xs text-slate-600 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center">
            {currentWeek !== null
              ? <span>Hari ini: <b>Minggu {currentWeek}</b> ({fmtShort(todayStr())})</span>
              : <span>Isi tarikh Minggu 1 untuk melihat minggu semasa.</span>}
          </div>
        </div>

        {/* Senarai cuti */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Cuti (penggal, perayaan, umum)</h3>
            <button onClick={() => setCal(c => ({ ...c, holidays: [...c.holidays, { name: '', start: '', end: '' }] }))}
              className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={14} /> Tambah cuti</button>
          </div>
          {cal.holidays.length === 0 && <p className="text-xs text-slate-400">Tiada cuti ditambah. Hari cuti akan ditanda "CUTI" pada tab hari guru.</p>}
          {cal.holidays.map((h, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
              <input value={h.name} onChange={e => setHoliday(i, { name: e.target.value })} placeholder="Nama cuti, cth Cuti Penggal 1"
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" />
              <input type="date" value={h.start} onChange={e => setHoliday(i, { start: e.target.value, end: h.end || e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" title="Mula" />
              <input type="date" value={h.end} onChange={e => setHoliday(i, { end: e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" title="Tamat" />
              <button onClick={() => setCal(c => ({ ...c, holidays: c.holidays.filter((_, idx) => idx !== i) }))}
                className="p-2 text-slate-300 hover:text-rose-500 justify-self-start"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        {status.type !== 'idle' && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm border ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : status.type === 'busy' ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : status.type === 'busy' ? <Loader2 size={18} className="animate-spin" /> : <AlertCircle size={18} />}
            <span>{status.message}</span>
          </div>
        )}

        <button onClick={handleSave} disabled={status.type === 'busy'}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={14} /> Simpan Kalendar
        </button>

        {/* Pratonton minggu */}
        {weeks.length > 0 && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Pratonton minggu</span>
              <select value={previewWeeks} onChange={e => setPreviewWeeks(Number(e.target.value))} className="text-xs p-1 border border-slate-200 rounded">
                {[20, 45, 55].map(n => <option key={n} value={n}>{n} minggu</option>)}
              </select>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {weeks.map(r => (
                    <tr key={r.w} className={`border-t border-slate-100 ${r.w === currentWeek ? 'bg-blue-50' : r.fullHoliday ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-4 py-2 font-bold text-slate-700 w-24">Minggu {r.w}</td>
                      <td className="px-4 py-2 text-slate-600">{fmtShort(r.mon)} – {fmtShort(r.fri)}</td>
                      <td className="px-4 py-2 text-amber-700">{r.holidayNames.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademicCalendarSettings;
