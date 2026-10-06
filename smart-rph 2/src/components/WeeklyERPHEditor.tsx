// ============================================================
// Editor RPH Mingguan — tab Isnin hingga Jumaat
// Guru boleh isi semua slot seminggu tanpa keluar-masuk borang.
// Slot diambil daripada Jadual Waktu guru + RPH yang sudah disimpan.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, AlertTriangle, Circle, Copy, Plus, X, SendHorizontal, ChevronRight, Clock } from 'lucide-react';
import ERPHForm from './ERPHForm';
import CopyRphModal, { CopyTarget, cleanCopy } from './CopyRphModal';
import { AcademicCalendar, DskpDocument, ERPHData, ERPHStatus, MasterData, ScheduleSlot, UserProfile } from '../types';
import { weekToMonday, dateToWeek, holidayOn } from '../services/calendarService';
import { WEEKS } from '../constants';

const DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'] as const;
type Day = typeof DAYS[number];
const ALL_DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

// ---- Tarikh (guna waktu tengah hari untuk elak isu zon masa) ----
const parseDate = (s: string) => new Date(`${s}T12:00:00`);
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmt(d); };
const mondayOf = (s: string) => { const d = parseDate(s); const wd = d.getDay() || 7; d.setDate(d.getDate() - (wd - 1)); return fmt(d); };
const dayNameOf = (s: string) => ALL_DAYS[parseDate(s).getDay()];
const shortDate = (s: string) => parseDate(s).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
const normDay = (d?: string) => { const x = String(d || '').trim().toLowerCase(); return DAYS.find(D => D.toLowerCase() === x); };
const newId = () => Math.random().toString(36).slice(2, 11);

// Medan kandungan yang disalin bila guru guna "Salin kandungan dari..."
const CONTENT_FIELDS: (keyof ERPHData)[] = ['subject', 'className', 'title', 'field', 'sk', 'sp', 'core', 'objective', 'activities', 'bbm', 'reflection', 'language'];

interface Entry {
  key: string;
  day: Day;
  data: ERPHData;
  saved: boolean;
}

interface Props {
  user: UserProfile;
  masterData: MasterData;
  dskpDocs?: DskpDocument[];
  erphs: ERPHData[];
  masterSchedule: ScheduleSlot[];
  /** @deprecated Groq telah dibuang */
  groqApiKey?: string | null;
  initialErph?: ERPHData | null;
  onSave: (data: ERPHData) => void | Promise<void>;
  onSaveMany?: (list: ERPHData[]) => Promise<void>;
  /** Kalendar akademik sekolah — jika ada, tarikh setiap hari ikut kalendar ini. */
  calendar?: AcademicCalendar | null;
  /** Tutup editor; `week` = minggu yang sedang diisi (untuk kembali ke minggu itu di senarai) */
  onClose: (week?: number) => void;
  /** Minggu awal bila dibuka dari senarai (butang 'Isi / Sunting minggu ini') */
  initialWeek?: number;
  onPreviewWeek?: (week: number) => void;
}

const WeeklyERPHEditor: React.FC<Props> = ({
  user, masterData, dskpDocs = [], erphs, masterSchedule, initialErph, initialWeek, onSave, onSaveMany, calendar, onClose, onPreviewWeek,
}) => {
  const isMine = (e: ERPHData) =>
    String(e.teacherId || '').trim().toLowerCase() === String(user.id || '').trim().toLowerCase() ||
    String(e.teacherName || '').trim().toLowerCase() === String(user.name || '').trim().toLowerCase();
  const myErphs = useMemo(() => erphs.filter(isMine), [erphs, user.id, user.name]);

  const [week, setWeek] = useState<number>(() => {
    if (initialErph?.week) return Number(initialErph.week);
    if (initialWeek) return initialWeek;
    if (calendar) {
      // Minggu semasa ikut kalendar (hujung minggu → minggu seterusnya)
      const today = new Date(); const wd = today.getDay();
      const ref = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + (wd === 6 ? 2 : wd === 0 ? 1 : 0)));
      const w = dateToWeek(calendar, ref);
      if (w >= 1 && w <= WEEKS.length) return w;
    }
    const weeks = myErphs.map(e => Number(e.week)).filter(Boolean);
    return weeks.length ? Math.max(...weeks) : 1;
  });
  const [mondayOverride, setMondayOverride] = useState<string | null>(
    !calendar && initialErph?.date ? mondayOf(initialErph.date) : null
  );
  const [activeDay, setActiveDay] = useState<Day>(() => {
    const d = normDay(initialErph?.day) || (initialErph?.date ? normDay(dayNameOf(initialErph.date)) : undefined);
    return d || normDay(ALL_DAYS[new Date().getDay()]) || 'Isnin';
  });
  // Entri baharu yang belum disimpan (slot tambahan / salinan / dari jadual)
  const initialDay: Day = normDay(initialErph?.day) || (initialErph?.date ? normDay(dayNameOf(initialErph.date)) : undefined) || 'Isnin';
  // Rekod yang dibuka dari dashboard (salin / slot jadual) tetapi belum wujud → mula sebagai entri sementara
  const [extraEntries, setExtraEntries] = useState<Entry[]>(() =>
    initialErph && !erphs.some(e => e.id === initialErph.id)
      ? [{ key: initialErph.id, day: initialDay, data: initialErph, saved: false }]
      : []
  );
  const [activeKey, setActiveKey] = useState<string | null>(initialErph?.id ?? null);
  const [remount, setRemount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Partial<ERPHData>>>({});
  const slotIds = useRef<Record<string, string>>({});

  // ---- Tarikh Isnin bagi minggu dipilih ----
  const weekErphs = useMemo(() => myErphs.filter(e => Number(e.week) === week), [myErphs, week]);
  const monday = useMemo(() => {
    if (calendar?.week1Monday) return weekToMonday(calendar, week);   // ikut kalendar akademik
    if (mondayOverride) return mondayOverride;
    const inWeek = weekErphs.find(e => e.date);
    if (inWeek) return mondayOf(inWeek.date);
    const ref = [...myErphs].filter(e => e.date && e.week).sort((a, b) => Number(b.week) - Number(a.week))[0];
    if (ref) return addDays(mondayOf(ref.date), (week - Number(ref.week)) * 7);
    return mondayOf(fmt(new Date()));
  }, [calendar, mondayOverride, weekErphs, myErphs, week]);
  const dateOf = (day: Day) => addDays(monday, DAYS.indexOf(day));

  // Tukar minggu → kira semula tarikh Isnin secara automatik
  const weekTouched = useRef(!!initialErph || !!initialWeek);
  const changeWeek = (w: number) => { weekTouched.current = true; setWeek(w); setMondayOverride(null); setActiveKey(null); setExtraEntries([]); };
  // Kalendar dimuat selepas editor dibuka → lompat ke minggu semasa (jika guru belum tukar minggu)
  useEffect(() => {
    if (!calendar || weekTouched.current) return;
    const w = dateToWeek(calendar, fmt(new Date()));
    if (w >= 1 && w <= WEEKS.length && w !== week) setWeek(w);
  }, [calendar]);

  // ---- Entri bagi setiap hari ----
  const entriesByDay = useMemo(() => {
    const map = {} as Record<Day, Entry[]>;
    DAYS.forEach(day => {
      const saved: Entry[] = weekErphs
        .filter(e => (normDay(e.day) || (e.date ? normDay(dayNameOf(e.date)) : undefined)) === day)
        .map(e => ({ key: e.id, day, data: e, saved: true }));

      const mySlots = masterSchedule
        .filter(s => s.teacherId === user.id && normDay(s.day) === day)
        .filter(s => !saved.some(x =>
          x.data.startTime === s.startTime &&
          String(x.data.classTitle || '').toLowerCase() === String(s.classTitle || '').toLowerCase() &&
          String(x.data.subject || '').toLowerCase() === String(s.subject || '').toLowerCase()));
      const slotEntries: Entry[] = mySlots.map(s => {
        const k = `slot-${s.id}-${week}`;
        slotIds.current[k] ??= newId();
        return {
          key: k, day, saved: false,
          data: {
            id: slotIds.current[k], teacherId: user.id, teacherName: user.name, week, date: dateOf(day), day,
            startTime: s.startTime, endTime: s.endTime, subject: s.subject, className: s.className, classTitle: s.classTitle,
            field: '', title: '', sk: '', sp: '', core: '', objective: '', activities: '', bbm: 'Buku Teks', reflection: '',
            language: 'BM', status: ERPHStatus.DRAFT,
          } as ERPHData,
        };
      });

      const extras = extraEntries.filter(x => x.day === day && !saved.some(s => s.key === x.data.id));
      map[day] = [...saved, ...slotEntries, ...extras].sort((a, b) => String(a.data.startTime).localeCompare(String(b.data.startTime)));
    });
    return map;
  }, [weekErphs, masterSchedule, extraEntries, week, monday, user.id, user.name]);


  const dayEntries = entriesByDay[activeDay] || [];
  const activeEntry = useMemo(() => {
    const all = DAYS.flatMap(d => entriesByDay[d] || []);
    return all.find(e => e.key === activeKey) || all.find(e => e.data.id === activeKey) || null;
  }, [entriesByDay, activeKey]);

  // Pilih entri pertama bila tukar hari / tiada entri aktif
  useEffect(() => {
    if (activeEntry && activeEntry.day === activeDay) return;
    setActiveKey(dayEntries[0]?.key ?? null);
  }, [activeDay, dayEntries.length]);

  const addEntry = () => {
    const last = dayEntries[dayEntries.length - 1]?.data;
    const id = newId();
    const data = {
      id, teacherId: user.id, teacherName: user.name, week, date: dateOf(activeDay), day: activeDay,
      startTime: last?.endTime || '08:00', endTime: '', subject: '', className: '', classTitle: '',
      field: '', title: '', sk: '', sp: '', core: '', objective: '', activities: '', bbm: 'Buku Teks', reflection: '',
      language: 'BM', status: ERPHStatus.DRAFT,
    } as ERPHData;
    setExtraEntries(prev => [...prev, { key: id, day: activeDay, data, saved: false }]);
    setActiveKey(id);
  };

  // ---- Salin RPH minggu lepas → minggu ini, ikut hari ----
  const [copyingWeek, setCopyingWeek] = useState(false);
  const prevWeekSource = useMemo(() => {
    // Minggu sebelum yang ada RPH (biasanya minggu - 1; jika kosong, cari minggu terdekat sebelumnya)
    const earlier = Array.from(new Set(myErphs.map(e => Number(e.week)).filter(w => w > 0 && w < week))).sort((a, b) => b - a);
    const w = earlier[0];
    return w ? { week: w, list: myErphs.filter(e => Number(e.week) === w) } : null;
  }, [myErphs, week]);

  const copyPreviousWeek = async () => {
    if (!prevWeekSource || !onSaveMany) return;
    const sameSlot = (a: ERPHData, b: ERPHData) =>
      a.startTime === b.startTime &&
      String(a.classTitle || '').toLowerCase() === String(b.classTitle || '').toLowerCase() &&
      String(a.subject || '').toLowerCase() === String(b.subject || '').toLowerCase();
    const toCopy: ERPHData[] = [];
    let skipped = 0;
    prevWeekSource.list.forEach(src => {
      const day = normDay(src.day) || (src.date ? normDay(dayNameOf(src.date)) : undefined);
      if (!day) return;
      const already = weekErphs.some(e => (normDay(e.day) || normDay(dayNameOf(e.date))) === day && sameSlot(e, src));
      if (already) { skipped++; return; }
      const { reviewSignature, reviewComment, reviewedBy, reviewedAt, reviewerDesignation, submittedAt,
              observationComment, observationSignature, observedBy, observerDesignation, observedAt, isObservation,
              peerFeedback, sharedWith, ...content } = src as any;
      toCopy.push({ ...content, id: newId(), teacherId: user.id, teacherName: user.name,
        week, date: dateOf(day), day, status: ERPHStatus.DRAFT } as ERPHData);
    });
    if (toCopy.length === 0) {
      alert(`Semua RPH Minggu ${prevWeekSource.week} sudah ada dalam Minggu ${week}. Tiada yang disalin.`);
      return;
    }
    const msg = `Salin ${toCopy.length} RPH dari Minggu ${prevWeekSource.week} ke Minggu ${week}?\n\n` +
      `• Setiap RPH diletak pada hari yang sama (Isnin → Isnin, dst.) dengan tarikh Minggu ${week}.\n` +
      `• Disimpan sebagai DRAF — cikgu boleh sunting selepas ini.` +
      (skipped ? `\n• ${skipped} RPH dilangkau kerana slot itu sudah diisi minggu ini.` : '');
    if (!confirm(msg)) return;
    setCopyingWeek(true);
    try { await onSaveMany(toCopy); setActiveKey(null); }
    finally { setCopyingWeek(false); }
  };

  const removeExtra = (key: string) => {
    setExtraEntries(prev => prev.filter(e => e.key !== key));
    if (activeKey === key) setActiveKey(null);
  };

  // Salin kandungan dari mana-mana RPH (minggu ini dahulu, kemudian minggu-minggu lain)
  const copySourceGroups = useMemo(() => {
    const others = myErphs.filter(e => e.id !== activeEntry?.data.id);
    const weeks = Array.from(new Set(others.map(e => Number(e.week)).filter(Boolean)))
      .sort((a, b) => (a === week ? -1 : b === week ? 1 : b - a));
    const dayIdx = (e: ERPHData) => DAYS.indexOf((normDay(e.day) || normDay(dayNameOf(e.date)) || 'Isnin') as Day);
    return weeks.map(w => ({
      week: w,
      list: others.filter(e => Number(e.week) === w)
        .sort((a, b) => dayIdx(a) - dayIdx(b) || String(a.startTime).localeCompare(String(b.startTime))),
    }));
  }, [myErphs, activeEntry, week]);
  const copyFrom = (srcId: string) => {
    const src = myErphs.find(e => e.id === srcId);
    if (!src || !activeEntry) return;
    const patch: Partial<ERPHData> = {};
    CONTENT_FIELDS.forEach(f => {
      if ((f === 'subject' || f === 'className') && activeEntry.data[f]) return; // kekalkan kelas/subjek slot
      (patch as any)[f] = src[f];
    });
    setOverrides(prev => ({ ...prev, [activeEntry.key]: { ...(prev[activeEntry.key] || {}), ...patch } }));
    setRemount(r => r + 1);
  };

  // Salin RPH aktif ke hari (tab) lain / minggu lain → dibuka sebagai slot baharu (belum disimpan)
  const [copyTo, setCopyTo] = useState<ERPHData | null>(null);
  const doCopyTo = (t: CopyTarget) => {
    if (!copyTo) return;
    const day = t.day as Day;
    const data = cleanCopy(copyTo, { teacherId: user.id, teacherName: user.name, week: t.week, day, date: t.date, startTime: t.startTime, endTime: t.endTime });
    const entry: Entry = { key: data.id, day, data, saved: false };
    if (t.week !== week) {
      weekTouched.current = true;
      setWeek(t.week); setMondayOverride(calendar?.week1Monday ? null : mondayOf(t.date));
      setExtraEntries([entry]);
    } else {
      setExtraEntries(prev => [...prev, entry]);
    }
    setActiveDay(day);
    setActiveKey(data.id);
    setCopyTo(null);
  };

  const handleSaved = (data: ERPHData, mode: 'close' | 'next' = 'next') => {
    if (mode === 'close') { onClose(week); return; }   // kembali ke senarai RPH, terus pada minggu ini
    // Rekod kini wujud dalam senarai RPH → buang daripada entri sementara
    setExtraEntries(prev => prev.filter(e => e.data.id !== data.id));
    setOverrides(prev => { const n = { ...prev }; if (activeEntry) delete n[activeEntry.key]; return n; });
    setActiveKey(data.id);
    setTimeout(() => goNextRef.current?.(data.id), 50);
  };
  const goNextRef = useRef<((fromId?: string) => void) | undefined>(undefined);

  const goNext = (fromId?: string) => {
    const idx = dayEntries.findIndex(e => e.key === (fromId ?? activeEntry?.key) || e.data.id === fromId);
    const nextPending = dayEntries.slice(idx + 1).find(e => !e.saved) || dayEntries[idx + 1];
    if (nextPending) { setActiveKey(nextPending.key); return; }
    const dIdx = DAYS.indexOf(activeDay);
    if (dIdx < DAYS.length - 1) setActiveDay(DAYS[dIdx + 1]);
  };
  goNextRef.current = goNext;

  const totalSaved = DAYS.reduce((n, d) => n + (entriesByDay[d] || []).filter(e => e.saved).length, 0);
  const totalAll = DAYS.reduce((n, d) => n + (entriesByDay[d] || []).length, 0);

  // Tarikh, hari & minggu sentiasa ikut tab yang dipilih (dan kalendar akademik jika ditetapkan)
  const formInitial = activeEntry
    ? { ...activeEntry.data, ...(overrides[activeEntry.key] || {}), week, day: activeEntry.day, date: dateOf(activeEntry.day) } as ERPHData
    : undefined;

  return (
    <div className="max-w-6xl mx-auto pb-10 animate-fadeIn text-left">
      <div className="bg-white rounded-[2rem] premium-shadow border border-slate-100 overflow-hidden">
        {/* Kepala */}
        <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">RPH Mingguan</h2>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">
              {totalSaved}/{totalAll} slot disimpan · Isnin {shortDate(monday)} – Jumaat {shortDate(addDays(monday, 4))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={week} onChange={e => changeWeek(Number(e.target.value))}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" title="Minggu">
              {WEEKS.map(w => <option key={w} value={w}>Minggu {w}</option>)}
            </select>
            {calendar?.week1Monday ? (
              <span className="flex items-center gap-2 px-3 py-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] font-bold text-blue-700" title="Tarikh ditetapkan oleh Admin (Kalendar Akademik)">
                <CalendarDays size={14} /> Ikut Kalendar Akademik {calendar.year}
              </span>
            ) : (
              <label className="flex items-center gap-2 p-2 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500">
                <CalendarDays size={14} /> Isnin
                <input type="date" value={monday} onChange={e => e.target.value && setMondayOverride(mondayOf(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none" />
              </label>
            )}
            <button onClick={() => onClose(week)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl" title="Tutup">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab hari */}
        <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-100 bg-slate-50/50">
          {DAYS.map(day => {
            const list = entriesByDay[day] || [];
            const done = list.filter(e => e.saved).length;
            const active = day === activeDay;
            return (
              <button key={day} onClick={() => setActiveDay(day)}
                className={`flex-1 min-w-[110px] px-4 py-3 text-left border-b-2 transition-all ${active ? 'border-blue-600 bg-white' : 'border-transparent hover:bg-white/60'}`}>
                <p className={`text-xs font-black uppercase tracking-wide ${active ? 'text-blue-600' : 'text-slate-600'}`}>{day}</p>
                {holidayOn(calendar, dateOf(day)) && (
                  <p className="text-[9px] font-black text-amber-600 uppercase truncate">Cuti · {holidayOn(calendar, dateOf(day))!.name}</p>
                )}
                <p className="text-[10px] text-slate-400 font-bold">{shortDate(dateOf(day))}
                  {list.length > 0 && <span className={`ml-2 px-1.5 py-0.5 rounded-md ${done === list.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{done}/{list.length}</span>}
                </p>
              </button>
            );
          })}
        </div>

        {holidayOn(calendar, dateOf(activeDay)) && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertTriangle size={14} /> {activeDay}, {shortDate(dateOf(activeDay))} ialah hari cuti: <b>{holidayOn(calendar, dateOf(activeDay))!.name}</b>. RPH masih boleh diisi jika perlu.
          </div>
        )}

        {/* Slot hari dipilih */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-wrap items-center gap-2">
          {dayEntries.length === 0 && (
            <span className="text-xs text-slate-400 mr-2">Tiada slot untuk {activeDay}. Tambah slot, atau rekod Jadual Waktu supaya slot muncul automatik.</span>
          )}
          {dayEntries.map(e => {
            const active = e.key === activeEntry?.key;
            const isExtra = !e.saved && extraEntries.some(x => x.key === e.key);
            return (
              <div key={e.key} className={`group flex items-center rounded-xl border text-[11px] font-bold transition-all ${active ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'}`}>
                <button onClick={() => setActiveKey(e.key)} className="flex items-center gap-2 pl-3 pr-2 py-2">
                  {e.saved ? <CheckCircle2 size={14} className={active ? 'text-white' : 'text-emerald-500'} /> : <Circle size={14} className={active ? 'text-white' : 'text-slate-300'} />}
                  <span className="flex items-center gap-1 opacity-80"><Clock size={11} />{e.data.startTime || '--:--'}</span>
                  <span>{e.data.subject || 'Slot baharu'}</span>
                  {e.data.classTitle && <span className="opacity-70">· {e.data.classTitle}</span>}
                </button>
                {isExtra && (
                  <button onClick={() => removeExtra(e.key)} className={`pr-2 ${active ? 'text-white/70 hover:text-white' : 'text-slate-300 hover:text-red-500'}`} title="Buang slot (belum disimpan)"><X size={12} /></button>
                )}
              </div>
            );
          })}
          <button onClick={addEntry} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:border-blue-500 hover:text-blue-600">
            <Plus size={14} /> Tambah slot
          </button>
          {onSaveMany && (
            <button onClick={copyPreviousWeek} disabled={!prevWeekSource || copyingWeek}
              title={prevWeekSource ? `Salin semua RPH Minggu ${prevWeekSource.week} ke Minggu ${week}, ikut hari` : 'Tiada RPH minggu sebelumnya'}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">
              {copyingWeek ? <Clock size={14} className="animate-spin" /> : <Copy size={14} />}
              {copyingWeek ? 'Menyalin...' : `Salin RPH minggu lepas${prevWeekSource ? ` (M${prevWeekSource.week})` : ''}`}
            </button>
          )}
        </div>

        {/* Borang */}
        <div className="p-4 sm:p-8">
          {activeEntry && formInitial ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${activeEntry.saved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {activeEntry.saved ? 'Disimpan' : 'Belum disimpan'}
                </span>
                {copySourceGroups.length > 0 && (
                  <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <Copy size={13} /> Salin kandungan dari:
                    <select value="" onChange={e => e.target.value && copyFrom(e.target.value)}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] outline-none max-w-[260px]">
                      <option value="">— pilih RPH (mana-mana minggu/hari) —</option>
                      {copySourceGroups.map(g => (
                        <optgroup key={g.week} label={`Minggu ${g.week}${g.week === week ? ' (minggu ini)' : ''}`}>
                          {g.list.map(s => (
                            <option key={s.id} value={s.id}>{normDay(s.day) || dayNameOf(s.date)} {s.startTime} · {s.subject} · {s.classTitle} {s.title ? `· ${s.title}` : ''}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}
                <button onClick={() => setCopyTo({ ...activeEntry.data, ...(overrides[activeEntry.key] || {}), week, day: activeEntry.day, date: dateOf(activeEntry.day) } as ERPHData)}
                  disabled={!activeEntry.saved}
                  title={activeEntry.saved ? 'Salin RPH ini ke hari / minggu lain' : 'Simpan RPH ini dahulu sebelum menyalin'}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">
                  <Copy size={13} /> Salin ke hari / minggu lain
                </button>
                <button onClick={() => goNext()} className="ml-auto flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-slate-200">
                  Slot seterusnya <ChevronRight size={14} />
                </button>
              </div>
              <ERPHForm
                key={`${activeEntry.key}-${remount}`}
                embedded
                user={user}
                masterData={masterData}
                dskpDocs={dskpDocs}
                erphs={erphs}
                masterSchedule={masterSchedule}
                initialData={formInitial}
                onSave={onSave}
                onSaved={handleSaved}
                onCancel={() => onClose(week)}
              />
            </>
          ) : (
            <div className="py-16 text-center text-slate-400 text-sm">Pilih atau tambah slot untuk mula mengisi RPH {activeDay}.</div>
          )}
        </div>

        {/* Kaki */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500"><b>Simpan</b> = simpan &amp; kembali ke senarai RPH minggu ini. <b>Simpan &amp; Slot Seterusnya</b> = simpan &amp; terus isi slot berikutnya.</p>
          {onPreviewWeek && totalSaved > 0 && (
            <button onClick={() => onPreviewWeek(week)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase hover:bg-blue-500">
              <SendHorizontal size={16} /> Preview & Hantar Minggu {week}
            </button>
          )}
        </div>
      </div>
      {copyTo && (
        <CopyRphModal source={copyTo} calendar={calendar} defaultWeek={week} title="Salin ke hari / minggu lain"
          onConfirm={doCopyTo} onClose={() => setCopyTo(null)} />
      )}
    </div>
  );
};

export default WeeklyERPHEditor;
