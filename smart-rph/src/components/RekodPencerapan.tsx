import React, { useState, useMemo } from 'react';
import { ERPHData, UserProfile, ERPHStatus } from '../types';
import { Search, ArrowLeft, ShieldCheck, Calendar, Clock, BookOpen, User } from 'lucide-react';

interface RekodPencerapanProps {
  user: UserProfile;
  erphs: ERPHData[];
  teachers: UserProfile[];
  onBack: () => void;
  onView: (erph: ERPHData) => void;
}

const RekodPencerapan: React.FC<RekodPencerapanProps> = ({ user, erphs, teachers, onBack, onView }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const observedErphs = useMemo(() => {
    return erphs.filter(e => 
      e.teacherId === user.id &&
      e.isObservation === true &&
      (e.status === ERPHStatus.REVIEWED || e.status === ERPHStatus.SELESAI) && 
      e.observationSignature && 
      e.observationSignature.trim() !== ''
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [erphs, user.id]);

  const filteredErphs = useMemo(() => {
    if (!searchTerm) return observedErphs;
    const lower = searchTerm.toLowerCase();
    return observedErphs.filter(e => 
      e.teacherName.toLowerCase().includes(lower) ||
      e.subject.toLowerCase().includes(lower) ||
      e.className.toLowerCase().includes(lower) ||
      (e.observedBy && e.observedBy.toLowerCase().includes(lower))
    );
  }, [observedErphs, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white text-slate-600 rounded-full hover:bg-slate-50 premium-shadow transition-all hover:-translate-x-1"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-slate-900 uppercase tracking-tight text-xl md:text-2xl flex items-center gap-3">
              <ShieldCheck className="text-emerald-600" size={28} />
              Rekod Pencerapan
            </h1>
            <p className="text-slate-500 text-sm mt-1">Senarai RPH harian yang telah dicerap dan disahkan</p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Cari guru, subjek, kelas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
          />
        </div>
      </div>

      {filteredErphs.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 text-center border-2 border-slate-100 premium-shadow">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-slate-300" size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-2">Tiada Rekod</h3>
          <p className="text-slate-500">Belum ada RPH yang dicerap atau tiada padanan carian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredErphs.map(erph => (
            <div 
              key={erph.id}
              onClick={() => onView(erph)}
              className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 premium-shadow hover:border-emerald-300 hover:shadow-emerald-100 transition-all cursor-pointer group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    {erph.teacherName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {erph.teacherName}
                    </h3>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Minggu {erph.week}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                  Dicerap
                </span>
              </div>

              <div className="space-y-3 mb-6 flex-grow">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <BookOpen size={16} className="text-slate-400" />
                  <span className="font-medium truncate">{erph.subject}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium">{erph.className}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={16} className="text-slate-400" />
                  <span>{erph.date} ({erph.day})</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} className="text-slate-400" />
                  <span>{erph.startTime} - {erph.endTime}</span>
                </div>
                
                {erph.observationComment && (
                  <div className="mt-4 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <p className="text-xs text-emerald-800 italic line-clamp-2">
                      "{erph.observationComment}"
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <User size={14} />
                    <span className="truncate max-w-[150px]">Oleh: {erph.observedBy || 'Pencerap'}</span>
                  </div>
                  <button className="text-emerald-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Lihat PDF <ArrowLeft className="rotate-180" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RekodPencerapan;