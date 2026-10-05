// ============================================================
// Jadual Waktu gaya sekolah
// Baris = hari (Isnin–Jumaat), lajur = waktu. Slot yang panjang
// digabung merentas lajur (colSpan). Warna ikut subjek.
// Klik slot → buka RPH untuk slot itu.
// ============================================================
import React, { useMemo } from 'react';
import { ScheduleSlot } from '../types';

const DAYS = ['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'];
const DAY_LABEL: Record<string, string> = { ISNIN: 'Isnin', SELASA: 'Selasa', RABU: 'Rabu', KHAMIS: 'Khamis', JUMAAT: 'Jumaat' };

// Palet lembut (latar, sempadan, teks) — dipilih ikut subjek
const PALETTE = [
  ['#EEF2FF', '#C7D2FE', '#3730A3'], ['#ECFDF5', '#A7F3D0', '#065F46'], ['#FFF7ED', '#FED7AA', '#9A3412'],
  ['#FDF2F8', '#FBCFE8', '#9D174D'], ['#F0F9FF', '#BAE6FD', '#075985'], ['#FEFCE8', '#FDE68A', '#854D0E'],
  ['#F5F3FF', '#DDD6FE', '#5B21B6'], ['#F0FDFA', '#99F6E4', '#115E59'], ['#FEF2F2', '#FECACA', '#991B1B'],
  ['#F7FEE7', '#D9F99D', '#3F6212'],
];

/** Singkatan subjek, cth "Pendidikan Seni Visual" → "PSV". Nama pendek dikekalkan. */
export const abbreviate = (subject: string) => {
  const s = String(subject || '').trim();
  if (s.length <= 10) return s;
  const words = s.split(/\s+/).filter(w => !/^(dan|&|and|of)$/i.test(w));
  return words.map(w => w[0]).join('').toUpperCase();
};

const toMin = (t: string) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmtTime = (t: string) => {
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`;
};

interface Props {
  slots: ScheduleSlot[];
  onSelect?: (slot: ScheduleSlot) => void;
}

const SchoolTimetableGrid: React.FC<Props> = ({ slots, onSelect }) => {
  const clean = useMemo(
    () => slots
      .map(s => ({ ...s, day: String(s.day || '').trim().toUpperCase() }))
      .filter(s => DAYS.includes(s.day) && s.startTime && s.endTime && toMin(s.endTime) > toMin(s.startTime)),
    [slots]
  );

  // Sempadan waktu = semua masa mula/tamat yang unik → lajur jadual
  const bounds = useMemo(() => {
    const set = new Set<string>();
    clean.forEach(s => { set.add(s.startTime); set.add(s.endTime); });
    return Array.from(set).sort((a, b) => toMin(a) - toMin(b));
  }, [clean]);

  const colorOf = useMemo(() => {
    const subjects = Array.from(new Set(clean.map(s => s.subject))).sort();
    const map: Record<string, string[]> = {};
    subjects.forEach((sub, i) => { map[sub] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [clean]);

  const todayKey = DAYS[new Date().getDay() - 1];

  const totals = useMemo(() => {
    const mins = clean.reduce((n, s) => n + (toMin(s.endTime) - toMin(s.startTime)), 0);
    return {
      periods: clean.length,
      hours: Math.round((mins / 60) * 10) / 10,
      subjects: new Set(clean.map(s => s.subject)).size,
      classes: new Set(clean.map(s => `${s.className} ${s.classTitle}`)).size,
    };
  }, [clean]);

  if (clean.length === 0) return null;

  // Bina sel bagi setiap hari: slot (colSpan) atau sel kosong
  const rowCells = (day: string) => {
    const daySlots = clean.filter(s => s.day === day).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    const cells: React.ReactNode[] = [];
    let i = 0;
    while (i < bounds.length - 1) {
      const start = bounds[i];
      const slot = daySlots.find(s => s.startTime === start);
      if (slot) {
        const endIdx = bounds.indexOf(slot.endTime);
        const span = Math.max(1, endIdx - i);
        const [bg, border, text] = colorOf[slot.subject];
        cells.push(
          <td key={`${day}-${start}`} colSpan={span} className="p-1 align-top">
            <button
              onClick={() => onSelect?.(slot)}
              title={`${slot.subject} · ${slot.className} ${slot.classTitle} · ${slot.startTime}–${slot.endTime}\nKlik untuk isi RPH`}
              style={{ background: bg, borderColor: border, color: text }}
              className="w-full h-full min-h-[64px] rounded-lg border px-2 py-1.5 text-left hover:shadow-md hover:-translate-y-px transition-all"
            >
              <span className="block text-[13px] font-black leading-tight truncate">{abbreviate(slot.subject)}</span>
              <span className="block text-[11px] font-semibold opacity-80 truncate">{slot.classTitle || slot.className}</span>
              <span className="block text-[10px] opacity-60 tabular-nums">{fmtTime(slot.startTime)}–{fmtTime(slot.endTime)}</span>
            </button>
          </td>
        );
        i += span;
      } else {
        // Sel kosong: teruskan sehingga sempadan seterusnya yang ada slot bermula
        cells.push(<td key={`${day}-${start}-empty`} className="p-1"><div className="min-h-[64px] rounded-lg bg-slate-50/60" /></td>);
        i += 1;
      }
    }
    return cells;
  };

  const legend = Object.keys(colorOf);

  return (
    <div className="bg-white rounded-[2rem] premium-shadow border border-slate-100 overflow-hidden">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { v: totals.periods, l: 'Waktu seminggu' },
          { v: `${totals.hours} j`, l: 'Jam mengajar' },
          { v: totals.subjects, l: 'Subjek' },
          { v: totals.classes, l: 'Kelas' },
        ].map(x => (
          <div key={x.l} className="px-4 py-3 text-center">
            <p className="text-lg font-black text-slate-900 leading-none">{x.v}</p>
            <p className="text-[11px] text-slate-500 mt-1">{x.l}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 min-w-[760px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 text-left w-20">Hari</th>
              {bounds.slice(0, -1).map((b, i) => (
                <th key={b} className="bg-slate-900 text-white text-[10px] font-semibold px-1 py-2 text-center tabular-nums whitespace-nowrap">
                  {fmtTime(b)}<span className="opacity-50">–{fmtTime(bounds[i + 1])}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => {
              const isToday = day === todayKey;
              return (
                <tr key={day} className={isToday ? 'bg-blue-50/60' : ''}>
                  <th className={`sticky left-0 z-10 px-3 py-2 text-left text-xs font-black border-b border-slate-100 ${isToday ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>
                    {DAY_LABEL[day]}
                    {isToday && <span className="block text-[9px] font-semibold opacity-80">Hari ini</span>}
                  </th>
                  {rowCells(day)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Petunjuk subjek */}
      <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-2 items-center">
        {legend.map(sub => {
          const [bg, border, text] = colorOf[sub];
          return (
            <span key={sub} className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="px-1.5 py-0.5 rounded border text-[10px] font-black" style={{ background: bg, borderColor: border, color: text }}>{abbreviate(sub)}</span>
              {abbreviate(sub) !== sub && sub}
            </span>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">Klik mana-mana slot untuk isi RPH</span>
      </div>
    </div>
  );
};

export default SchoolTimetableGrid;
