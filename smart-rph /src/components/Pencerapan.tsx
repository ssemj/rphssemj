import React, { useState, useMemo } from 'react';
import { UserProfile, ERPHData, ERPHStatus } from '../types';
import { ChevronLeft, Search, Calendar, Clock, BookOpen, MapPin, ShieldCheck, User, CheckCircle2, Eye, X } from 'lucide-react';
import ReviewForm from './ReviewForm';
import ERPHPreview from './ERPHPreview';

interface PencerapanProps {
  user: UserProfile;
  teachers: any[];
  erphs: ERPHData[];
  onBack: () => void;
  onSubmitObservation: (erphId: string, status: ERPHStatus, comment: string, signature: string, reviewerName: string, reviewerDesignation: string, isObservation?: boolean) => void;
}

const Pencerapan: React.FC<PencerapanProps> = ({ user, teachers, erphs, onBack, onSubmitObservation }) => {
  const [step, setStep] = useState<'SELECT_TEACHER' | 'SELECT_RPH' | 'REVIEW'>('SELECT_TEACHER');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedErph, setSelectedErph] = useState<ERPHData | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSignature, setReviewSignature] = useState('');
  const [reviewerInfo, setReviewerInfo] = useState({ name: user.name, designation: user.designation });

  const handleReviewerInfoChange = React.useCallback((name: string, designation: string) => {
    setReviewerInfo({ name, designation });
  }, []);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teachers, searchTerm]);

  const groupedTeachers = useMemo(() => {
    const groups: Record<string, typeof filteredTeachers> = {};
    filteredTeachers.forEach(teacher => {
      const dept = teacher.department || 'Lain-lain';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(teacher);
    });
    return groups;
  }, [filteredTeachers]);

  const teacherErphs = useMemo(() => {
    if (!selectedTeacher) return [];
    return erphs.filter(e => 
      (String(e.teacherId || "").trim().toLowerCase() === String(selectedTeacher.id || "").trim().toLowerCase()) ||
      (String(e.teacherName || "").trim().toLowerCase() === String(selectedTeacher.name || "").trim().toLowerCase())
    ).sort((a, b) => {
      if (a.date !== b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
      return b.startTime.localeCompare(a.startTime);
    });
  }, [erphs, selectedTeacher]);

  const availableWeeks = useMemo(() => {
    const weeks = new Set<number>();
    teacherErphs.forEach(e => {
      if (e.week) weeks.add(e.week);
    });
    return Array.from(weeks).sort((a, b) => b - a); // Sort descending
  }, [teacherErphs]);

  const filteredErphsByWeek = useMemo(() => {
    if (selectedWeek === null) return teacherErphs;
    return teacherErphs.filter(e => e.week === selectedWeek);
  }, [teacherErphs, selectedWeek]);

  const handleTeacherSelect = (teacher: any) => {
    setSelectedTeacher(teacher);
    setStep('SELECT_RPH');
    setSelectedWeek(null);
  };

  const handleErphSelect = (erph: ERPHData) => {
    setSelectedErph(erph);
    setReviewComment(erph.observationComment || '');
    setReviewSignature(erph.observationSignature || '');
    setReviewerInfo({
      name: erph.observedBy || user.name,
      designation: erph.observerDesignation || user.designation
    });
    setStep('REVIEW');
  };

  const handleSubmit = () => {
    if (!selectedErph) return;
    if (!reviewSignature) {
      alert("Sila masukkan tandatangan digital anda.");
      return;
    }
    
    onSubmitObservation(
      selectedErph.id,
      ERPHStatus.REVIEWED,
      reviewComment,
      reviewSignature,
      reviewerInfo.name,
      reviewerInfo.designation,
      true // isObservation
    );
    
    alert("Pencerapan berjaya disahkan dan dihantar!");
    setStep('SELECT_RPH');
    setSelectedErph(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-fadeIn pb-20">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <button 
            onClick={() => {
              if (step === 'REVIEW') setStep('SELECT_RPH');
              else if (step === 'SELECT_RPH') setStep('SELECT_TEACHER');
              else onBack();
            }}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase transition-all"
          >
            <ChevronLeft size={18} /> KEMBALI
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck size={20} />
            </div>
            <h1 className="font-black text-slate-900 uppercase tracking-tight text-sm md:text-base">Pencerapan RPH</h1>
          </div>
          <div className="w-10 md:w-20"></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {step === 'SELECT_TEACHER' && (
          <div className="space-y-6 max-w-3xl mx-auto animate-slideUp">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pilih Guru</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Untuk tujuan pencerapan PdP</p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari nama guru..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 pl-12 pr-6 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all premium-shadow"
              />
            </div>
            
            <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {filteredTeachers.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-12 text-center text-slate-400 border border-slate-100 premium-shadow">
                  <User size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest">Tiada guru dijumpai</p>
                </div>
              ) : (
                Object.entries(groupedTeachers).sort(([a], [b]) => a.localeCompare(b)).map(([dept, deptTeachers]) => (
                  <div key={dept} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-px flex-1 bg-slate-100"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dept}</span>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 premium-shadow overflow-hidden">
                      {deptTeachers.map(teacher => (
                        <button 
                          key={teacher.id}
                          onClick={() => handleTeacherSelect(teacher)}
                          className="w-full p-6 flex items-center gap-4 border-b border-slate-50 last:border-0 transition-all hover:bg-indigo-50/50 text-left group"
                        >
                          {teacher.photoUrl && teacher.photoUrl.trim() !== "" ? (
                            <img 
                              src={teacher.photoUrl} 
                              className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm" 
                              alt={teacher.name} 
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'U')}&background=random`; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm">
                              {(teacher.name || 'U').charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 uppercase truncate group-hover:text-indigo-600 transition-colors">{teacher.name}</p>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">{teacher.department || 'TIADA BIDANG'}</p>
                          </div>
                          <div className="bg-white p-2 rounded-full shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                            <ChevronLeft size={16} className="rotate-180" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'SELECT_RPH' && selectedTeacher && (
          <div className="space-y-8 animate-slideUp">
            <div className="bg-white p-8 rounded-[2.5rem] premium-shadow border border-slate-100 flex flex-col md:flex-row items-center gap-6">
              {selectedTeacher.photoUrl && selectedTeacher.photoUrl.trim() !== "" ? (
                <img 
                  src={selectedTeacher.photoUrl} 
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md" 
                  alt={selectedTeacher.name} 
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTeacher.name || 'U')}&background=random`; }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-2xl shadow-md">
                  {(selectedTeacher.name || 'U').charAt(0)}
                </div>
              )}
              <div className="text-center md:text-left">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedTeacher.name}</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Sila pilih minggu pencerapan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">Pilih Minggu</h3>
                <div className="bg-white rounded-[2rem] premium-shadow border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setSelectedWeek(null)}
                    className={`w-full p-4 text-left text-xs font-bold uppercase tracking-widest border-b border-slate-50 transition-colors ${selectedWeek === null ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Semua Minggu
                  </button>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {availableWeeks.map(week => (
                      <button
                        key={week}
                        onClick={() => setSelectedWeek(week)}
                        className={`w-full p-4 text-left text-xs font-bold uppercase tracking-widest border-b border-slate-50 transition-colors ${selectedWeek === week ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        Minggu {week}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">Senarai Kelas / RPH</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredErphsByWeek.length === 0 ? (
                    <div className="col-span-full bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center text-slate-400">
                      <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">Tiada RPH untuk minggu ini</p>
                    </div>
                  ) : (
                    filteredErphsByWeek.map(erph => (
                      <div key={erph.id} className="bg-white p-6 rounded-[2rem] premium-shadow border border-slate-100 flex flex-col h-full hover:border-indigo-300 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {erph.date ? new Date(erph.date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short' }) : erph.day}
                          </div>
                          {erph.observedBy ? (
                            <div className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle2 size={12} /> Dicerap
                            </div>
                          ) : erph.reviewedBy && (
                            <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle2 size={12} /> Disemak
                            </div>
                          )}
                        </div>
                        
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2 line-clamp-2">{erph.className} {erph.classTitle}</h4>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{erph.subject}</p>
                        
                        <div className="space-y-2 mb-6 flex-1">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                            <Clock size={14} className="text-indigo-400" />
                            {erph.startTime} - {erph.endTime}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                            <BookOpen size={14} className="text-indigo-400" />
                            <span className="truncate">{erph.title || 'Tiada Tajuk'}</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleErphSelect(erph)}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors mt-auto"
                        >
                          Pilih Untuk Pencerapan
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'REVIEW' && selectedErph && !showFullPreview && (
          <div className="space-y-8 animate-slideUp">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Paparan RPH</h3>
                  <button
                    onClick={() => setShowFullPreview(true)}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Eye size={14} /> Preview Penuh
                  </button>
                </div>
                <div className="bg-white rounded-[2.5rem] premium-shadow border border-slate-100 overflow-hidden relative">
                  <div className="h-[600px] overflow-y-auto custom-scrollbar bg-slate-100 p-4">
                    <div className="transform origin-top scale-[0.85] w-[117%]">
                      <ERPHPreview erphs={[selectedErph]} onBack={() => {}} hideModal={true} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">Borang Pencerapan</h3>
                <div className="bg-white rounded-[2.5rem] premium-shadow border border-slate-100 p-8">
                  <ReviewForm 
                    user={user}
                    reviewComment={reviewComment}
                    setReviewComment={setReviewComment}
                    reviewSignature={reviewSignature}
                    setReviewSignature={setReviewSignature}
                    onReviewerInfoChange={handleReviewerInfoChange}
                  />
                  
                  <div className="pt-8 mt-8 border-t border-slate-100">
                    <button 
                      onClick={handleSubmit}
                      className="w-full h-16 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                    >
                      <ShieldCheck size={20} />
                      Sahkan & Hantar Pencerapan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'REVIEW' && selectedErph && showFullPreview && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col pt-24 pb-4 px-4 md:pt-28 md:pb-8 md:px-8 animate-fadeIn">
            <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto w-full sticky top-0 z-10 bg-slate-900/50 p-4 rounded-3xl backdrop-blur-lg border border-white/10">
              <h2 className="text-white font-black text-lg md:text-xl uppercase tracking-widest hidden sm:block">Preview Penuh RPH</h2>
              <div className="flex gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowFullPreview(false)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                >
                  Isi Borang
                </button>
                <button
                  onClick={() => setShowFullPreview(false)}
                  className="p-3 bg-red-500/20 hover:bg-red-500 text-red-100 hover:text-white rounded-2xl transition-colors flex items-center justify-center"
                  title="Tutup"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar bg-slate-100 rounded-[2.5rem] max-w-5xl mx-auto w-full p-4 md:p-8 shadow-2xl">
              <ERPHPreview erphs={[selectedErph]} onBack={() => setShowFullPreview(false)} hideModal={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pencerapan;