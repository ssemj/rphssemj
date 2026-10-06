// ============================================================
// Salin RPH → pilih Minggu, Hari (tab) & Masa sasaran
// Digunakan dari senarai RPH (butang Salin) dan dalam Editor Mingguan.
// ============================================================
import React, { useMemo, useState } from 'react';
import { Copy, X, CalendarDays } from 'lucide-react';
import { AcademicCalendar, ERPHData, ERPHStatus } from '../types';
import { addDays, mondayOf, weekToMonday, holidayOn } from '../services/calendarService';
import { WEEKS } from '../constants';

export const COPY_DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'] as const;
const ALL_DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const dayOfDate = (s?: string) => (s ? ALL_DAYS[new Date(`${s}T12:00:00`).getDay()] : '');
const shortDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Buang maklumat semakan/pencerapan/perkongsian — salinan sentiasa bermula sebagai DRAF. */
export function cleanCopy(src: ERPHData, patch: Partial<ERPHData>): ERPHData {
  const { reviewSignature, reviewComment, reviewedBy, reviewedAt, reviewerDesignation, submittedAt,
          observationComment, observationSignature, observedBy, observerDesignation, observedAt, isObservation,
          peerFeedback, sharedWith, ...content } = src as any;
  return { ...content, ...patch, id: Math.random().toString(36).slice(2, 11), status: ERPHStatus.DRAFT } as ERPHData;
}

/** Tarikh bagi Minggu + Hari: ikut Kalendar Akademik, atau anggar daripada tarikh RPH asal. */
export function dateForWeekDay(calendar: AcademicCalendar | null | undefined, week: number, day: string, ref?: ERPHData): string {
  const idx = Math.max(0, COPY_DAYS.indexOf(day as any));
  if (calendar?.week1Monday) return addDays(weekToMonday(calendar, week), idx);
  if (ref?.date && ref.week) return addDays(addDays(mondayOf(ref.date), (week - Number(ref.week)) * 7), idx);
  return addDays(mondayOf(new Date().toISOString().slice(0, 10)), idx);
}

export interface CopyTarget { week: number; day: string; date: string; startTime: string; endTime: string; }

interface Props {
  source: ERPHData;
  calendar?: AcademicCalendar | null;
  /** Lalai minggu sasaran (cth minggu sedang dibuka) */
  defaultWeek?: number;
  title?: string;
  busy?: boolean;
  onConfirm: (target: CopyTarget) => void;
  onClose: () => void;
}

const CopyRphModal: React.FC<Props> = ({ source, calendar, defaultWeek, title, busy, onConfirm, onClose }) => {
  const srcDay = (COPY_DAYS as readonly string[]).includes(String(source.day)) ? String(source.day) : (dayOfDate(source.date) || 'Isnin');
  const [week, setWeek] = useState<number>(defaultWeek || Number(source.week) || 1);
  const [day, setDay] = useState<string>((COPY_DAYS as readonly string[]).includes(srcDay) ? srcDay : 'Isnin');
  const [startTime, setStartTime] = useState(source.startTime || '');
  const [endTime, setEndTime] = useState(source.endTime || '');
  const [dateOverride, setDateOverride] = useState<string>('');

  const autoDate = useMemo(() => dateForWeekDay(calendar, week, day, source), [calendar, week, day, source]);
  const date = !calendar?.week1Monday && dateOverride ? dateOverride : autoDate;
  const holiday = holidayOn(calendar, date);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-left" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><Copy size={18} className="text-indigo-600" /> {title || 'Salin RPH'}</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Dari: <b>M{source.week} · {srcDay}</b> · {source.subject} {source.classTitle ? `· ${source.classTitle}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-500">Salin ke Minggu</span>
            <select value={week} onChange={e => { setWeek(Number(e.target.value)); setDateOverride(''); }}
              className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
              {WEEKS.map(w => <option key={w} value={w}>Minggu {w}</option>)}
            </select>
          </label>

          <div>
            <span className="text-[10px] font-black uppercase text-slate-500">Hari</span>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {COPY_DAYS.map(d => (
                <button key={d} type="button" onClick={() => { setDay(d); setDateOverride(''); }}
                  className={`py-2 rounded-lg text-[11px] font-black border ${day === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-500">Masa mula</span>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-500">Masa tamat</span>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
            </label>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 flex items-center gap-2">
            <CalendarDays size={14} />
            {calendar?.week1Monday ? (
              <span>Tarikh: <b>{shortDate(date)}</b> <span className="opacity-70">(ikut Kalendar Akademik)</span></span>
            ) : (
              <span className="flex items-center gap-2 flex-wrap">Tarikh:
                <input type="date" value={date} onChange={e => setDateOverride(e.target.value)} className="bg-white border border-indigo-200 rounded-lg px-2 py-1 font-bold" />
              </span>
            )}
          </div>
          {holiday && <p className="text-[11px] text-amber-700 font-bold">⚠ {shortDate(date)} ialah hari cuti: {holiday.name}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase">Batal</button>
          <button disabled={busy} onClick={() => onConfirm({ week, day, date, startTime, endTime })}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase hover:bg-indigo-500 disabled:opacity-50">
            {busy ? 'Menyalin...' : `Salin ke ${day}, M${week}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyRphModal;
