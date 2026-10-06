
import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, ERPHData, MasterData, ScheduleSlot } from '../types';
import { ChevronLeft, Calendar, Clock, Filter, LayoutGrid, MapPin, PenTool, Plus, Trash2, X, Copy, Edit2, Columns, LayoutList, BarChart3, BookOpen } from 'lucide-react';
import { formatTime } from '../constants';

interface TimetableProps {
  user: UserProfile;
  schedule: ScheduleSlot[];
  erphs: ERPHData[];
  masterData: MasterData;
  onAddSlot: (slot: ScheduleSlot) => void;
  onDeleteSlot: (id: string) => void;
  onSelectSlot: (slot: Partial<ERPHData>) => void;
  onBack: () => void;
}

const DAYS = ['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'];
const START_TIME = 7.5; // 07:30
const END_TIME = 18; // 18:00

const GRADIENTS = [
  { bg: 'from-blue-500 to-indigo-600', border: 'border-blue-300', text: 'text-white', subtext: 'text-blue-100', icon: 'text-blue-200' },
  { bg: 'from-emerald-400 to-teal-500', border: 'border-emerald-200', text: 'text-white', subtext: 'text-emerald-100', icon: 'text-emerald-200' },
  { bg: 'from-orange-400 to-rose-500', border: 'border-orange-200', text: 'text-white', subtext: 'text-orange-100', icon: 'text-orange-200' },
  { bg: 'from-purple-500 to-fuchsia-600', border: 'border-purple-300', text: 'text-white', subtext: 'text-purple-100', icon: 'text-purple-200' },
  { bg: 'from-cyan-500 to-blue-600', border: 'border-cyan-200', text: 'text-white', subtext: 'text-cyan-100', icon: 'text-cyan-200' },
  { bg: 'from-pink-500 to-rose-500', border: 'border-pink-300', text: 'text-white', subtext: 'text-pink-100', icon: 'text-pink-200' },
];

const Timetable: React.FC<TimetableProps> = ({ user, schedule, erphs, masterData, onAddSlot, onDeleteSlot, onSelectSlot, onBack }) => {
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  const [selectedForm, setSelectedForm] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK'>('WEEK');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [newSlot, setNewSlot] = useState<Partial<ScheduleSlot>>({
    day: DAYS[0],
    startTime: '08:00',
    endTime: '09:00',
    subject: '',
    className: '',
    classTitle: ''
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const forms = useMemo(() => {
    return ['ALL', ...Object.keys(masterData.classes || {})];
  }, [masterData.classes]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_TIME; hour <= END_TIME; hour += 0.5) {
      const h = Math.floor(hour);
      const m = (hour % 1) * 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
    return slots;
  }, []);

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

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

  const timetableData = useMemo(() => {
    let filtered = generatedSchedule;
    
    if (viewMode === 'DAY' && selectedDay !== 'ALL') {
      filtered = filtered.filter(e => e.day.toUpperCase() === selectedDay);
    }
    
    if (selectedForm !== 'ALL') {
      filtered = filtered.filter(e => e.className === selectedForm);
    }

    return filtered.map(item => {
      const start = parseTime(item.startTime);
      const end = parseTime(item.endTime);
      const top = (start - START_TIME) * 2; // 2 slots per hour
      const height = (end - start) * 2;
      return { ...item, gridTop: top + 1, gridSpan: height };
    });
  }, [generatedSchedule, selectedDay, selectedForm, viewMode]);

  const stats = useMemo(() => {
    let totalHours = 0;
    generatedSchedule.forEach(slot => {
      totalHours += parseTime(slot.endTime) - parseTime(slot.startTime);
    });
    return {
      totalSlots: generatedSchedule.length,
      totalHours: totalHours.toFixed(1),
      avgPerDay: (totalHours / 5).toFixed(1)
    };
  }, [generatedSchedule]);



  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const timeInHours = hours + minutes / 60;
    
    if (timeInHours < START_TIME || timeInHours > END_TIME) return null;
    
    const top = (timeInHours - START_TIME) * 2 * 80;
    return top;
  };

  const renderSlotCard = (slot: any, idx: number, isWeekView: boolean = false) => {
    const theme = GRADIENTS[idx % GRADIENTS.length];
    return (
      <div 
        key={slot.id || idx}
        className={`absolute ${isWeekView ? 'left-1 right-1' : 'left-2 right-2 md:left-4 md:right-4'} rounded-xl md:rounded-2xl border-l-4 ${theme.border} bg-gradient-to-br ${theme.bg} p-2 md:p-3 shadow-md group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}
        style={{ 
          top: `${(slot.gridTop - 1) * 80 + 4}px`, 
          height: `${slot.gridSpan * 80 - 8}px`,
          zIndex: 10
        }}
      >
        {/* Hover Actions Overlay */}
        <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
          <div className="flex gap-2">
            <button 
              onClick={() => onSelectSlot(slot)}
              className="bg-white/20 p-2 rounded-lg hover:bg-white/40 transition-all text-white tooltip-trigger"
              title="Bina RPH"
            >
              <PenTool size={14} />
            </button>
          </div>
        </div>
        
        <div className="flex flex-col h-full justify-between relative z-10">
          <div className="space-y-0.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className={`text-[7px] md:text-[8px] font-black ${theme.text} uppercase tracking-widest truncate drop-shadow-sm`}>{slot.subject}</span>
              {!isWeekView && (
                <span className={`text-[7px] md:text-[8px] font-bold ${theme.text} tabular-nums bg-black/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/20 w-fit shadow-sm`}>
                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </span>
              )}
            </div>
            <h3 className={`text-[9px] md:text-xs font-black ${theme.text} uppercase tracking-tight leading-tight line-clamp-2 drop-shadow-sm`}>
              {slot.className} {slot.classTitle}
            </h3>
            {isWeekView && (
               <span className={`text-[7px] font-bold ${theme.text} tabular-nums opacity-80`}>
                 {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
               </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-fadeIn pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase transition-all"
          >
            <ChevronLeft size={18} /> KEMBALI
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <LayoutGrid size={20} />
            </div>
            <h1 className="font-black text-slate-900 uppercase tracking-tight text-sm md:text-base hidden sm:block">Jadual Waktu Interaktif</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Stats & Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Stats Card */}
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] premium-shadow border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Mingguan</p>
                <div className="flex gap-4 mt-1">
                  <div>
                    <span className="text-lg font-black text-slate-900">{stats.totalSlots}</span>
                    <span className="text-[10px] font-bold text-slate-500 ml-1">Kelas</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-slate-900">{stats.totalHours}</span>
                    <span className="text-[10px] font-bold text-slate-500 ml-1">Jam</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] premium-shadow border border-slate-100 flex items-center justify-center gap-2">
            <button
              onClick={() => setViewMode('DAY')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'DAY' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <LayoutList size={16} /> Paparan Hari
            </button>
            <button
              onClick={() => setViewMode('WEEK')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'WEEK' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Columns size={16} /> Paparan Minggu
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] premium-shadow border border-slate-100 space-y-3 sm:col-span-2 lg:col-span-1">
             <div className="flex items-center gap-2 px-1">
              <Filter size={14} className="text-indigo-600" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tapis Tingkatan</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {forms.map(form => (
                <button
                  key={form}
                  onClick={() => setSelectedForm(form)}
                  className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                    selectedForm === form 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                      : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  {form === 'ALL' ? 'SEMUA' : form}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Day Selector (Only in DAY mode) */}
        {viewMode === 'DAY' && (
          <div className="bg-white p-2 rounded-2xl premium-shadow border border-slate-100 flex overflow-x-auto hide-scrollbar">
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-1 min-w-[100px] py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  selectedDay === day 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-transparent text-slate-500 hover:bg-slate-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {/* Timetable Grid View */}
        <div className="bg-white rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 overflow-hidden">
          <div className="relative overflow-x-auto">
            <div className={`min-w-[800px] relative flex ${viewMode === 'WEEK' ? 'w-full' : ''}`}>
              {/* Time Column */}
              <div className="w-16 md:w-20 flex-none bg-slate-50/80 backdrop-blur-sm border-r border-slate-200/60 z-30 sticky left-0">
                {viewMode === 'WEEK' && (
                  <div className="h-12 border-b border-slate-200/60 bg-slate-100/50"></div>
                )}
                {timeSlots.map((time, idx) => (
                  <div 
                    key={time} 
                    className="flex items-start justify-center pt-2 relative"
                    style={{ height: `${idx === timeSlots.length - 1 ? 40 : 80}px` }}
                  >
                    <span className="text-[9px] font-black text-slate-400 tabular-nums bg-slate-50 px-1 rounded-sm">{time}</span>
                    <div className="absolute right-[-3px] top-3 w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  </div>
                ))}
              </div>

              {/* Schedule Grid */}
              <div className="flex-1 relative bg-white flex">
                {/* Current Time Indicator */}
                {getCurrentTimePosition() !== null && (
                  <div 
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                    style={{ top: `${getCurrentTimePosition()! + (viewMode === 'WEEK' ? 48 : 0)}px` }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                    <div className="bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-r ml-1">
                      {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                )}

                {viewMode === 'WEEK' ? (
                  // Week View Columns
                  DAYS.map((day, dayIdx) => {
                    const daySlots = timetableData.filter(s => s.day.toUpperCase() === day);
                    const isToday = new Date().getDay() === dayIdx + 1; // 1=Monday
                    
                    return (
                      <div key={day} className={`flex-1 min-w-[140px] border-r border-slate-100 relative ${isToday ? 'bg-blue-50/30' : ''}`}>
                        {/* Day Header */}
                        <div className={`h-12 border-b border-slate-200/60 flex items-center justify-center sticky top-0 z-20 ${isToday ? 'bg-blue-100/50' : 'bg-slate-50/80'} backdrop-blur-sm`}>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                            {day}
                          </span>
                        </div>
                        
                        {/* Grid Lines */}
                        <div className="relative" style={{ height: `${(timeSlots.length - 1) * 80}px` }}>
                          {timeSlots.map((_, idx) => (
                            <div 
                              key={idx} 
                              className="absolute left-0 right-0 border-b border-slate-100 border-dashed"
                              style={{ top: `${idx * 80}px`, height: '1px' }}
                            />
                          ))}
                          
                          {/* Slots */}
                          {daySlots.map((slot, idx) => renderSlotCard(slot, idx, true))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Day View Single Column
                  <div className="flex-1 relative" style={{ height: `${(timeSlots.length - 1) * 80}px` }}>
                    {timeSlots.map((_, idx) => (
                      <div 
                        key={idx} 
                        className="absolute left-0 right-0 border-b border-slate-200/60 border-dashed"
                        style={{ top: `${idx * 80}px`, height: '1px' }}
                      />
                    ))}

                    {timetableData.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                        <Clock size={40} className="opacity-10 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Tiada rekod Jadual untuk {selectedDay}</p>
                      </div>
                    ) : (
                      timetableData.map((slot, idx) => renderSlotCard(slot, idx, false))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ringkasan Jadual Widget */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Ringkasan Jadual Mengajar</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Subjek, Tingkatan & Masa mengikut hari</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {DAYS.map(day => {
              const daySlots = timetableData.filter(s => s.day.toUpperCase() === day).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
              
              if (daySlots.length === 0) return null;

              return (
                <div key={day} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 pb-2 border-b border-slate-200/60">{day}</h4>
                  <div className="space-y-3">
                    {daySlots.map((slot, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-800 uppercase leading-tight">{slot.subject}</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">{slot.className} {slot.classTitle}</span>
                          <span className="text-[8px] font-black text-slate-400 bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100 tabular-nums">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Legend / Info */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <Clock size={16} className="text-blue-600 mt-0.5" />
          <div>
            <p className="text-[9px] font-black text-blue-900 uppercase tracking-widest">Nota Jadual Interaktif</p>
            <p className="text-[8px] font-bold text-blue-700/70 uppercase mt-1 leading-relaxed">
              Jadual ini dijana secara automatik berdasarkan RPH yang telah anda sediakan. Hover pada slot untuk membina RPH baharu. Garis merah menunjukkan waktu semasa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timetable;