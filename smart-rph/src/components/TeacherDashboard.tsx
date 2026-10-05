
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile, ERPHData, ERPHStatus, WeeklyBundle, Resource, DskpLink, AppNotification, ScheduleSlot, MasterData } from '../types';
import { 
  Calendar, FileText, CheckCircle2, Clock, Plus, Pencil, Copy, Eye, FileDown, AlertCircle, SendHorizontal, Layers, ChevronRight, UserCheck, Filter, ChevronDown, 
  Database, BookOpen, LayoutGrid, BarChart3, MessageCircle, Info, ExternalLink, X, Link as LinkIcon, Share2, Search, ArrowRight, Bell, Trash2, RefreshCw
} from 'lucide-react';
import { WEEKS, formatDate } from '../constants';

import ResourceCenter from './ResourceCenter';
import SchoolTimetableGrid from './SchoolTimetableGrid';
const DSKPUploader = React.lazy(() => import('./DSKPUploader'));
const RPHArchiveDownload = React.lazy(() => import('./RPHArchiveDownload'));

interface TeacherDashboardProps {
  user: UserProfile;
  adminUser?: UserProfile | null;
  erphs: ERPHData[];
  bundles: WeeklyBundle[];
  teachers: UserProfile[];
  masterSchedule?: ScheduleSlot[];
  masterData?: MasterData;
  onAddNew: () => void;
  onEdit: (erph: ERPHData) => void;
  onCopy: (erph: ERPHData) => void;
  onView: (erph: ERPHData) => void;
  onShare: (erph: ERPHData, recipientId: string) => void;
  onDelete?: (id: string) => void;
  onSelectScheduleSlot?: (slot: Partial<ERPHData>) => void;
  onViewWeek?: (week: number) => void;
  /** Dipanggil selepas guru memuat naik DSKP baharu */
  onDskpUpdated?: () => void;
  /** Buka editor RPH mingguan pada minggu tertentu */
  onOpenWeek?: (week: number) => void;
  /** Minggu untuk difokuskan (selepas simpan / tutup editor) */
  focusWeek?: { week: number; ts: number } | null;
  onShareWeek?: (week: number, recipientIds: string[]) => Promise<void>;
  onBulkSubmit?: (week: number, pdfBase64?: string) => void;
  onNavigate?: (view: string) => void;
  onSync?: () => void;
  onAddResource?: (resource: Omit<Resource, 'id' | 'uploadedAt'>) => void;
  onDeleteResource?: (id: string) => void;
  notifications?: AppNotification[];
  syncStatus?: 'IDLE' | 'SYNCING' | 'OFFLINE';
}

const UTILITY_MENUS = [
  { id: 'TAKWIM', label: 'Takwim', icon: Calendar, color: 'bg-blue-600' },
  { id: 'RPT', label: 'RPT', icon: BookOpen, color: 'bg-indigo-600' },
  { id: 'DSKP_COLL', label: 'DSKP', icon: Layers, color: 'bg-violet-600' },
  { id: 'UPLOAD_DSKP', label: 'Muat Naik DSKP', icon: Database, color: 'bg-emerald-600' },
  { id: 'ANALYSIS', label: 'Analisis', icon: BarChart3, color: 'bg-purple-600' },
  { id: 'SCHEDULE', label: 'Jadual', icon: LayoutGrid, color: 'bg-fuchsia-600' },
  { id: 'CHAT', label: 'Notifikasi', icon: MessageCircle, color: 'bg-pink-600' },
  { id: 'REKOD_PENCERAPAN', label: 'Pencerapan', icon: UserCheck, color: 'bg-emerald-600' },
];

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
  user, adminUser, erphs, bundles, teachers, masterSchedule = [], masterData, 
  onAddNew, onEdit, onCopy, onView, onShare, onDelete, onSelectScheduleSlot, onViewWeek, onDskpUpdated, onOpenWeek, focusWeek, onShareWeek, onBulkSubmit, onNavigate, onSync, 
  onAddResource, onDeleteResource,
  notifications = [],
  syncStatus = 'IDLE'
}) => {
  const isAdmin = user.role === 'ADMIN' || !!adminUser;
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all'); 
  const [rangeFilter, setRangeFilter] = useState<number>(0); 
  const [activeResView, setActiveResView] = useState<string | null>(null);
  const [sharingErph, setSharingErph] = useState<ERPHData | null>(null);
  const [deletingErph, setDeletingErph] = useState<string | null>(null);
  const [shareSearch, setShareSearch] = useState('');
  // Kongsi pukal seminggu
  const [sharingWeek, setSharingWeek] = useState<number | null>(null);
  const [weekRecipients, setWeekRecipients] = useState<string[]>([]);
  const [isSharingWeek, setIsSharingWeek] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const closeWeekShare = () => { setSharingWeek(null); setWeekRecipients([]); setShareSearch(''); };
  const [rphSearch, setRphSearch] = useState('');

  const otherTeachers = useMemo(() => {
    return teachers.filter(t => t.id !== user.id && t.name.toLowerCase().includes(shareSearch.toLowerCase()));
  }, [teachers, user.id, shareSearch]);

  const ranges = [
    { label: 'M1-10', start: 1, end: 10 },
    { label: 'M11-20', start: 11, end: 20 },
    { label: 'M21-30', start: 21, end: 30 },
    { label: 'M31-40', start: 31, end: 40 },
    { label: 'M41-55', start: 41, end: 55 },
  ];

  // Statistik setiap minggu (untuk warna pemilih minggu)
  const weekStats = useMemo(() => {
    const m: Record<number, { total: number; draft: number; sent: number; reviewed: number }> = {};
    erphs.forEach(e => {
      const w = Number(e.week); if (!w) return;
      m[w] ??= { total: 0, draft: 0, sent: 0, reviewed: 0 };
      m[w].total++;
      if (e.status === ERPHStatus.REVIEWED) m[w].reviewed++;
      else if (e.status === ERPHStatus.SELESAI) m[w].sent++;
      else m[w].draft++;
    });
    return m;
  }, [erphs]);

  const logRef = useRef<HTMLDivElement>(null);
  const weekStripRef = useRef<HTMLDivElement>(null);

  // Lalai: minggu terkini yang ada RPH (lebih mudah daripada "Semua")
  useEffect(() => {
    if (focusWeek) return;
    const weeks = Object.keys(weekStats).map(Number);
    if (weeks.length && weekFilter === 'all') setWeekFilter(Math.max(...weeks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(weekStats).length]);

  // Selepas simpan / tutup editor → terus buka minggu yang sama & skrol ke senarai
  useEffect(() => {
    if (!focusWeek) return;
    setWeekFilter(focusWeek.week);
    setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [focusWeek?.ts]);

  // Pastikan butang minggu dipilih kelihatan dalam jalur minggu
  useEffect(() => {
    if (weekFilter === 'all') return;
    weekStripRef.current?.querySelector<HTMLElement>(`[data-week="${weekFilter}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [weekFilter]);

  const statusInfo = (st: ERPHStatus | string) =>
    st === ERPHStatus.REVIEWED ? { label: '✓ Disemak', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : st === ERPHStatus.SELESAI ? { label: 'Dihantar', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
    : { label: 'Draf', cls: 'bg-amber-50 text-amber-700 border-amber-200' };

  const DAY_ORDER = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];
  const dayOf = (e: ERPHData) => {
    const d = String(e.day || '').trim().toLowerCase();
    return DAY_ORDER.find(x => x.toLowerCase() === d) || (e.date ? ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(e.date + 'T12:00:00').getDay()] : 'Lain-lain');
  };
  const groupByDay = (list: ERPHData[]): [string, ERPHData[]][] => {
    const g: Record<string, ERPHData[]> = {};
    list.forEach(e => { (g[dayOf(e)] ??= []).push(e); });
    return Object.entries(g)
      .sort((a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]))
      .map(([d, items]) => [d, items.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))]);
  };

  const filteredErphs = useMemo(() => {
    let result = weekFilter === 'all' ? erphs : erphs.filter(e => Number(e.week) === weekFilter);
    
    if (rphSearch.trim() !== '') {
      const search = rphSearch.toLowerCase();
      result = result.filter(e => 
        e.subject.toLowerCase().includes(search) || 
        e.className.toLowerCase().includes(search) || 
        e.classTitle.toLowerCase().includes(search) ||
        (e.title && e.title.toLowerCase().includes(search))
      );
    }
    
    return result;
  }, [erphs, weekFilter, rphSearch]);

  const groupedByWeek = useMemo(() => {
    return filteredErphs.reduce((acc, erph) => {
      const w = Number(erph.week);
      if (!acc[w]) acc[w] = [];
      acc[w].push(erph);
      return acc;
    }, {} as Record<number, ERPHData[]>);
  }, [filteredErphs]);

  const sortedWeeks = useMemo(() => {
    return Object.keys(groupedByWeek)
      .map(Number)
      .sort((a, b) => b - a);
  }, [groupedByWeek]);

  // Label tarikh minggu dipilih (ikut tarikh RPH yang ada)
  const weekRangeLabel = useMemo(() => {
    if (weekFilter === 'all') return '';
    const dates = erphs.filter(e => Number(e.week) === weekFilter && e.date).map(e => e.date).sort();
    if (!dates.length) return '';
    const f = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    return dates[0] === dates[dates.length - 1] ? f(dates[0]) : `${f(dates[0])} – ${f(dates[dates.length - 1])}`;
  }, [erphs, weekFilter]);

  const dskpLinks = masterData?.dskpLinks || [];

  const teacherSchedule = useMemo(() => {
    return masterSchedule.filter(s => s.teacherId === user.id);
  }, [masterSchedule, user.id]);

  const generatedSchedule = useMemo(() => {
    const myErphs = erphs.filter(e => e.teacherId === user.id);
    const slotsMap = new Map<string, ScheduleSlot>();
    
    myErphs.forEach(e => {
      if (!e.day || !e.startTime || !e.endTime || !e.subject) return;
      const key = `${e.day.toUpperCase()}-${e.startTime}-${e.endTime}-${e.subject}-${e.className}-${e.classTitle}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, {
          id: key,
          teacherId: user.id,
          day: e.day.toUpperCase(),
          startTime: e.startTime,
          endTime: e.endTime,
          subject: e.subject,
          className: e.className,
          classTitle: e.classTitle
        });
      }
    });
    
    return Array.from(slotsMap.values());
  }, [erphs, user.id]);

  const stats = useMemo(() => {
    return {
      draft: erphs.filter(e => e.status === ERPHStatus.DRAFT).length,
      hantaranMingguan: bundles.length,
      belumDisahkan: bundles.filter(b => b.status_proses !== 'DISEMAK' && (!b.linkPdfSelesai || b.linkPdfSelesai.trim() === "")).length,
    };
  }, [erphs, bundles]);

  const getResourcesFor = (viewId: string) => {
    return masterData?.resources?.filter(r => r.targetView === viewId) || [];
  };

  const scheduleByDay = useMemo(() => {
    const days = ['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'];
    const grouped: Record<string, ScheduleSlot[]> = {};
    days.forEach(d => grouped[d] = []);
    
    teacherSchedule.forEach(slot => {
      const dayUpper = slot.day.toUpperCase();
      if (grouped[dayUpper]) {
        grouped[dayUpper].push(slot);
      }
    });
    
    days.forEach(d => {
      grouped[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    
    return grouped;
  }, [teacherSchedule]);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam'; })();
  const todayLabel = new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8 md:space-y-10 animate-fadeIn text-left pb-24 md:pb-20 max-w-6xl mx-auto">
      {/* ===== Kepala ringkas ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{greeting},</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{user.name.split(' ').slice(0, 3).join(' ')}</h1>
          <p className="text-xs text-slate-400 mt-1">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onSync?.()} disabled={syncStatus === 'SYNCING'} title="Kemaskini data"
            className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50">
            <RefreshCw size={18} className={syncStatus === 'SYNCING' ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => onNavigate?.('CHAT')} title="Notifikasi"
            className="relative h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300">
            <Bell size={18} />
            {notifications.length > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />}
          </button>
          <button onClick={onAddNew} className="h-11 px-5 flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-600 transition-colors">
            <Plus size={18} /> Bina RPH
          </button>
        </div>
      </div>

      {/* ===== Statistik ringkas ===== */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Jumlah RPH', value: erphs.length, icon: FileText, tone: 'text-blue-600 bg-blue-50' },
          { label: 'Minggu dihantar', value: stats.hantaranMingguan, icon: SendHorizontal, tone: 'text-indigo-600 bg-indigo-50' },
          { label: 'Belum disemak', value: stats.belumDisahkan, icon: stats.belumDisahkan > 0 ? AlertCircle : CheckCircle2, tone: stats.belumDisahkan > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-100 rounded-2xl px-3 py-3 sm:px-4 flex items-center gap-3 shadow-sm">
            <div className={`hidden sm:flex h-9 w-9 rounded-xl items-center justify-center flex-none ${c.tone}`}><c.icon size={17} /></div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{c.value}</p>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== REKOD RPH SAYA (paparan mudah difahami) ===== */}
      <div ref={logRef} className="space-y-4 scroll-mt-24">
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          {/* Tajuk + carian */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><FileText size={18} /></div>
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-none">Rekod RPH Saya</h3>
                <p className="text-xs text-slate-500 mt-1">Pilih minggu di bawah untuk lihat, sunting atau hantar RPH.</p>
              </div>
            </div>
            <button onClick={() => setShowArchive(true)}
              className="w-full md:w-auto h-12 px-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 flex-none">
              <FileDown size={16} /> Muat Turun Semua RPH
            </button>
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari subjek, kelas atau tajuk..." value={rphSearch} onChange={e => setRphSearch(e.target.value)}
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white" />
            </div>
          </div>

          {/* Pemilih minggu */}
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekFilter(w => (w === 'all' ? 1 : Math.max(1, w - 1)))} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex-none" title="Minggu sebelum">
              <ChevronRight size={16} className="rotate-180" />
            </button>
            <div ref={weekStripRef} className="flex-1 flex gap-2 overflow-x-auto hide-scrollbar py-1">
              <button onClick={() => setWeekFilter('all')}
                className={`flex-none px-4 h-14 rounded-xl text-xs font-bold border ${weekFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                Semua
              </button>
              {WEEKS.map(w => {
                const st = weekStats[w];
                const selected = weekFilter === w;
                const tone = !st ? 'empty' : st.reviewed === st.total ? 'reviewed' : st.sent > 0 ? 'sent' : 'draft';
                const toneCls = selected ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : tone === 'reviewed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : tone === 'sent' ? 'bg-sky-50 text-sky-800 border-sky-200'
                  : tone === 'draft' ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-white text-slate-400 border-slate-100';
                return (
                  <button key={w} data-week={w} onClick={() => setWeekFilter(w)}
                    className={`flex-none w-14 h-14 rounded-xl border flex flex-col items-center justify-center transition-all ${toneCls}`}>
                    <span className="text-[10px] font-bold opacity-70 leading-none">Minggu</span>
                    <span className="text-base font-black leading-tight">{w}</span>
                    {st && <span className="text-[9px] font-bold leading-none">{st.total} RPH</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setWeekFilter(w => (w === 'all' ? 1 : Math.min(WEEKS.length, w + 1)))} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex-none" title="Minggu seterusnya">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Petunjuk warna */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Ada draf (belum dihantar)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-100 border border-sky-300" /> Sudah dihantar</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Sudah disemak</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-slate-200" /> Tiada RPH</span>
          </div>
        </div>

        {/* Ringkasan minggu dipilih + tindakan */}
        {weekFilter !== 'all' && (
          <div className="bg-white border border-slate-100 p-5 md:p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Minggu {weekFilter}</h3>
                {weekRangeLabel && <p className="text-slate-500 text-sm mt-0.5">{weekRangeLabel}</p>}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Jumlah', value: weekStats[weekFilter]?.total || 0, cls: 'bg-slate-50 text-slate-900' },
                  { label: 'Draf', value: weekStats[weekFilter]?.draft || 0, cls: 'bg-amber-50 text-amber-700' },
                  { label: 'Dihantar', value: weekStats[weekFilter]?.sent || 0, cls: 'bg-sky-50 text-sky-700' },
                  { label: 'Disemak', value: weekStats[weekFilter]?.reviewed || 0, cls: 'bg-emerald-50 text-emerald-700' },
                ].map(c => (
                  <div key={c.label} className={`px-3 py-2 rounded-xl ${c.cls}`}>
                    <p className="text-xl font-black leading-none">{c.value}</p>
                    <p className="text-[10px] opacity-70 mt-1">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {onOpenWeek && (
                <button onClick={() => onOpenWeek(weekFilter as number)}
                  className="flex-1 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-700">
                  <Pencil size={16} /> {weekStats[weekFilter]?.total ? 'Isi / Sunting RPH minggu ini' : 'Mula isi RPH minggu ini'}
                </button>
              )}
              {(weekStats[weekFilter]?.total || 0) > 0 && (
                <>
                  <button onClick={() => onViewWeek?.(weekFilter as number)}
                    className="flex-1 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-500">
                    <SendHorizontal size={16} /> Preview &amp; Hantar
                  </button>
                  {onShareWeek && (
                    <button onClick={() => setSharingWeek(weekFilter as number)}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:border-slate-400">
                      <Share2 size={16} /> Kongsi Seminggu
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Senarai RPH */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {filteredErphs.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2 px-6 text-center">
              <FileText size={36} className="opacity-20" />
              <p className="text-sm font-bold">
                {rphSearch ? 'Tiada RPH sepadan dengan carian.' : weekFilter === 'all' ? 'Belum ada RPH.' : `Belum ada RPH untuk Minggu ${weekFilter}.`}
              </p>
              {weekFilter !== 'all' && onOpenWeek && !rphSearch && (
                <button onClick={() => onOpenWeek(weekFilter as number)} className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Mula isi RPH Minggu {weekFilter}</button>
              )}
            </div>
          ) : (
            <div className="max-h-[640px] overflow-y-auto custom-scrollbar">
              {sortedWeeks.map(week => (
                <div key={week}>
                  {weekFilter === 'all' && (
                    <button onClick={() => setWeekFilter(week)}
                      className="w-full sticky top-0 z-10 bg-slate-100/95 backdrop-blur px-5 md:px-8 py-2.5 flex items-center justify-between text-left border-b border-slate-200">
                      <span className="text-sm font-black text-slate-800">Minggu {week}</span>
                      <span className="text-xs text-slate-500">{groupedByWeek[week].length} RPH · klik untuk buka <ChevronRight size={12} className="inline" /></span>
                    </button>
                  )}
                  {groupByDay(groupedByWeek[week]).map(([day, items]) => (
                    <div key={day} className="border-b border-slate-100 last:border-0">
                      <div className="px-5 md:px-8 pt-4 pb-1 text-xs font-black text-slate-500 uppercase tracking-wide">
                        {day}{items[0]?.date ? `, ${formatDate(items[0].date)}` : ''}
                      </div>
                      {items.map(erph => {
                        const s = statusInfo(erph.status);
                        return (
                          <div key={erph.id} className="px-5 md:px-8 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-50/70">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-16 flex-none text-xs font-bold text-slate-500 pt-0.5">{erph.startTime || '--:--'}</div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{erph.subject} <span className="font-medium text-slate-500">· {erph.classTitle || erph.className}</span></p>
                                <p className="text-xs text-slate-500 truncate">{erph.title || <span className="italic text-slate-400">Tajuk belum diisi</span>}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap md:flex-nowrap pl-[76px] md:pl-0">
                              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${s.cls}`}>{s.label}</span>
                              <button onClick={() => onView(erph)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 flex items-center gap-1"><Eye size={13} /> Lihat</button>
                              <button onClick={() => onEdit(erph)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-amber-600 hover:border-amber-300 flex items-center gap-1"><Pencil size={13} /> Sunting</button>
                              <button onClick={() => onCopy(erph)} title="Salin RPH ini" className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600"><Copy size={14} /></button>
                              <button onClick={() => setSharingErph(erph)} title="Kongsi RPH ini" className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600"><Share2 size={14} /></button>
                              {onDelete && (
                                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeletingErph(erph.id); }} title="Padam" className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600"><Trash2 size={14} /></button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="p-3 bg-slate-50/60 border-t border-slate-100 flex justify-center">
            <button onClick={onSync} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline">
              <RefreshCw size={12} /> Muat semula rekod
            </button>
          </div>
        </div>
      </div>
      {/* Jadual Individu Quick Access */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">Jadual Individu</h2>
            <p className="text-xs text-slate-500">Klik slot untuk isi RPH</p>
          </div>
          <button onClick={() => onNavigate?.('TIMETABLE')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
            Urus Jadual <ChevronRight size={14} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Ringkasan Jadual Mengajar dari Google Sheet */}
          {(user.raw?.['RINGKASAN JADUAL MENGAJAR'] || user.raw?.['Ringkasan Jadual Mengajar'] || user.raw?.ringkasan_jadual) && (
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-2"><LayoutGrid size={12} /> Ringkasan Jadual Mengajar</p>
              <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                {user.raw?.['RINGKASAN JADUAL MENGAJAR'] || user.raw?.['Ringkasan Jadual Mengajar'] || user.raw?.ringkasan_jadual}
              </p>
            </div>
          )}

          {teacherSchedule.length === 0 && generatedSchedule.length === 0 ? (
            <div className="bg-white p-10 rounded-[2rem] border border-slate-100 text-center space-y-3">
              <Calendar size={32} className="text-slate-200 mx-auto" />
              <p className="text-sm font-bold text-slate-500">Jadual waktu belum direkodkan.</p>
              <button onClick={() => onNavigate?.('TIMETABLE')} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Rekod jadual waktu</button>
            </div>
          ) : (
            <>
              {teacherSchedule.length === 0 && (
                <p className="text-xs text-slate-500 px-1">Jadual ini dijana automatik daripada rekod RPH anda. Klik <b>Urus Jadual</b> untuk merekod jadual rasmi.</p>
              )}
              <SchoolTimetableGrid
                slots={teacherSchedule.length > 0 ? teacherSchedule : generatedSchedule}
                onSelect={(slot) => onSelectScheduleSlot?.(slot)}
              />
            </>
          )}
        </div>
      </div>

      {/* Status Pengesahan Mingguan - Horizontal Scroll for Mobile */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900">Status Pengesahan Mingguan</h2>
          <p className="text-xs text-slate-500">Hantaran RPH mingguan dan ulasan penyemak</p>
        </div>
        <div className="flex overflow-x-auto pb-2 gap-3 text-left hide-scrollbar snap-x snap-mandatory scroll-smooth">
           {bundles.length === 0 ? (
             <div className="w-full py-8 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-100">
                Belum ada hantaran mingguan.
             </div>
           ) : (
             bundles.map((bundle, idx) => {
               const isReviewed = bundle.status_proses === 'DISEMAK' || (bundle.linkPdfSelesai && bundle.linkPdfSelesai.trim() !== "");
               const finalLink = (bundle.linkPdfSelesai && bundle.linkPdfSelesai.trim() !== "") 
                                ? bundle.linkPdfSelesai 
                                : (bundle.jana_url || bundle.pdfBase64);

               return (
                 <div key={bundle.id_minggu || idx} className={`flex-none w-[240px] p-4 bg-white rounded-2xl border transition-all flex flex-col justify-between gap-3 snap-start ${isReviewed ? 'border-emerald-200 shadow-emerald-50' : 'border-slate-100 premium-shadow group hover:border-blue-300'}`}>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                         <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${isReviewed ? 'bg-emerald-600 text-white border-emerald-400 shadow-md' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {isReviewed ? 'DISEMAK' : 'MENUNGGU'}
                         </span>
                         <span className="text-[7px] font-black text-slate-300 uppercase">{bundle.timestamp.split(' ')[0]}</span>
                      </div>
                      <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight line-clamp-1">{bundle.week}</h3>
                    </div>
                    <div className="pt-2 md:pt-3 space-y-2">
                      {isReviewed ? (
                        <div className="space-y-2">
                           <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-[1rem]">
                             <p className="text-[7px] font-black text-emerald-600 uppercase mb-0.5 flex items-center gap-1"><UserCheck size={10}/> Ulasan:</p>
                             <p className="text-[8px] italic text-emerald-800 line-clamp-2 leading-tight">"{bundle.comment || "Rekod telah disemak."}"</p>
                           </div>
                           <button 
                             onClick={() => finalLink && window.open(finalLink, '_blank')}
                             className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-2.5 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                           >
                             <FileDown size={14} /> Lihat Template Rasmi
                           </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-[1rem]">
                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Status:</p>
                            <p className="text-[8px] font-bold text-slate-500 leading-tight uppercase">Sedang Diproses</p>
                          </div>
                          <button 
                            onClick={() => {
                              const weekNum = parseInt(bundle.week.replace(/[^0-9]/g, ''));
                              onViewWeek?.(weekNum);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-white text-slate-500 py-2.5 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95"
                          >
                            <Eye size={14} /> Lihat Draf Template
                          </button>
                        </div>
                      )}
                    </div>
                 </div>
               );
             })
           )}
        </div>
      </div>

      {/* Utility Menus Grid */}
      <div className="space-y-3">
         <h2 className="text-base md:text-lg font-bold text-slate-900">Sumber &amp; Utiliti</h2>
         <div className="flex flex-wrap gap-2">
            {UTILITY_MENUS.map(menu => (
              <button
                key={menu.id}
                onClick={() => {
                  if (menu.id === 'ANALYSIS') onNavigate?.('ANALYSIS');
                  else if (menu.id === 'CHAT') onNavigate?.('CHAT');
                  else if (menu.id === 'SCHEDULE') onNavigate?.('TIMETABLE');
                  else if (menu.id === 'REKOD_PENCERAPAN') onNavigate?.('REKOD_PENCERAPAN');
                  else setActiveResView(activeResView === menu.id ? null : menu.id);
                }}
                className={`relative flex items-center gap-2 pl-2 pr-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${activeResView === menu.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
              >
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${activeResView === menu.id ? 'bg-white/15' : menu.color + ' text-white'}`}>
                  <menu.icon size={14} />
                </span>
                {menu.label}
                {menu.id === 'CHAT' && notifications.length > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-pink-500 border-2 border-white" />}
              </button>
            ))}
         </div>

         {activeResView === 'UPLOAD_DSKP' && (
           <div className="relative">
             <button onClick={() => setActiveResView(null)} className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500"><X size={18} /></button>
             <React.Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Memuatkan...</div>}>
               <DSKPUploader masterData={masterData || { subjects: [], hierarchy: {}, classes: {}, resources: [] }} userName={user.name} isAdmin={isAdmin} onDskpUpdated={onDskpUpdated} />
             </React.Suspense>
           </div>
         )}

         {activeResView && activeResView !== 'UPLOAD_DSKP' && (
           <ResourceCenter 
             viewId={activeResView}
             label={UTILITY_MENUS.find(m => m.id === activeResView)?.label || ''}
             resources={masterData?.resources || []}
             user={user}
             teachers={teachers}
             isAdmin={isAdmin}
             onAdd={(res) => onAddResource?.(res)}
             onDelete={(id) => {
               if (isAdmin) {
                 onDeleteResource?.(id);
               } else {
                 alert('Hanya pentadbir boleh memadam bahan ini.');
               }
             }}
             onClose={() => setActiveResView(null)}
           />
         )}
      </div>

      {showArchive && (
        <React.Suspense fallback={null}>
          <RPHArchiveDownload user={user} erphs={erphs} onClose={() => setShowArchive(false)} />
        </React.Suspense>
      )}

      {/* Kongsi Seminggu (pukal) */}
      {sharingWeek !== null && (() => {
        const weekCount = erphs.filter(e => Number(e.week) === sharingWeek).length;
        const toggle = (id: string) => setWeekRecipients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        return (
          <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-slideUp">
              <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Share2 size={20} /></div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight leading-none">Kongsi RPH Minggu {sharingWeek}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{weekCount} RPH akan disalin sebagai draf kepada rakan dipilih</p>
                  </div>
                </div>
                <button onClick={closeWeekShare} disabled={isSharingWeek} className="p-2 text-slate-400 hover:text-red-500"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Cari nama rakan..." value={shareSearch} onChange={e => setShareSearch(e.target.value)}
                    className="w-full h-12 pl-12 pr-6 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                  {otherTeachers.length === 0 ? (
                    <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">Tiada rakan dijumpai</p>
                  ) : otherTeachers.map(t => {
                    const checked = weekRecipients.includes(t.id);
                    return (
                      <label key={t.id} className={`w-full p-3 flex items-center gap-3 rounded-2xl border cursor-pointer transition-all ${checked ? 'bg-emerald-50 border-emerald-200' : 'border-slate-50 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} className="w-4 h-4 accent-emerald-600" />
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xs">{(t.name || 'U').charAt(0)}</div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-slate-900 uppercase">{t.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{t.designation}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <button
                  disabled={weekRecipients.length === 0 || weekCount === 0 || isSharingWeek}
                  onClick={async () => {
                    setIsSharingWeek(true);
                    try { await onShareWeek?.(sharingWeek, weekRecipients); closeWeekShare(); }
                    finally { setIsSharingWeek(false); }
                  }}
                  className="w-full py-4 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-40"
                >
                  {isSharingWeek ? <RefreshCw size={16} className="animate-spin" /> : <Share2 size={16} />}
                  {isSharingWeek ? 'Sedang berkongsi...' : `Kongsi ${weekCount} RPH kepada ${weekRecipients.length} guru`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Share Modal */}
      {sharingErph && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight leading-none">Kongsi RPH</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pilih rakan untuk dikongsi</p>
                </div>
              </div>
              <button onClick={() => { setSharingErph(null); setShareSearch(''); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari nama rakan..."
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  className="w-full h-12 pl-12 pr-6 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                {otherTeachers.length === 0 ? (
                  <div className="py-12 text-center text-slate-300">
                    <p className="text-[10px] font-black uppercase tracking-widest">Tiada rakan dijumpai</p>
                  </div>
                ) : (
                  otherTeachers.map(teacher => (
                    <button 
                      key={teacher.id}
                      onClick={() => {
                        onShare(sharingErph, teacher.id);
                        setSharingErph(null);
                        setShareSearch('');
                        alert(`RPH telah dikongsi kepada ${teacher.name}`);
                      }}
                      className="w-full p-4 flex items-center gap-4 rounded-2xl border border-slate-50 hover:bg-emerald-50 hover:border-emerald-100 transition-all text-left group"
                    >
                      {teacher.photoUrl && teacher.photoUrl.trim() !== "" ? (
                        <img 
                          src={teacher.photoUrl} 
                          className="w-10 h-10 rounded-lg object-cover border-2 border-white shadow-sm" 
                          alt="" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'U')}&background=random`; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xs">
                          {(teacher.name || 'U').charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-[11px] font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors">{teacher.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{teacher.designation}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-200 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingErph && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-2">Padam RPH?</h3>
            <p className="text-xs font-bold text-slate-500 mb-8">Tindakan ini tidak boleh diundur. Adakah anda pasti mahu memadam RPH ini secara kekal?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingErph(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  if (onDelete) onDelete(deletingErph);
                  setDeletingErph(null);
                }}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
              >
                Padam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;