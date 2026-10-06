
import React, { useMemo } from 'react';
import { UserProfile, WeeklyBundle } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { 
  ChevronLeft, Trophy, Star, Send, CheckCircle2, Users, BarChart3, TrendingUp
} from 'lucide-react';

interface AnalysisProps {
  teachers: UserProfile[];
  bundles: WeeklyBundle[];
  onBack: () => void;
}

const Analysis: React.FC<AnalysisProps> = ({ teachers, bundles, onBack }) => {
  const analysisData = useMemo(() => {
    return teachers.map(teacher => {
      const teacherBundles = bundles.filter(b => 
        (String(b.teacherId || "").trim().toLowerCase() === String(teacher.id || "").trim().toLowerCase()) ||
        (String(b.teacherName || "").trim().toLowerCase() === String(teacher.name || "").trim().toLowerCase())
      );
      const hantar = teacherBundles.length;
      const semak = teacherBundles.filter(b => b.status_proses === 'DISEMAK' || (b.linkPdfSelesai && b.linkPdfSelesai.trim() !== "")).length;
      
      let statusIcon = null;
      if (hantar > 0) {
        if (hantar === semak) {
          statusIcon = 'TROPHY';
        } else {
          statusIcon = 'STAR';
        }
      }

      return {
        id: teacher.id,
        name: teacher.name,
        photoUrl: teacher.photoUrl,
        department: teacher.department,
        hantar,
        semak,
        statusIcon
      };
    }).sort((a, b) => b.hantar - a.hantar);
  }, [teachers, bundles]);

  const chartData = useMemo(() => {
    return analysisData.slice(0, 10).map(d => ({
      name: d.name.split(' ')[0],
      Hantar: d.hantar,
      Semak: d.semak
    }));
  }, [analysisData]);

  const totalHantar = bundles.length;
  const totalSemak = bundles.filter(b => b.status_proses === 'DISEMAK' || (b.linkPdfSelesai && b.linkPdfSelesai.trim() !== "")).length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-blue-600 transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Analisis Penghantaran</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statistik & Prestasi Guru SSEMJ</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2">
              <Send size={14} className="text-blue-600" />
              <span className="text-[10px] font-black text-blue-700 uppercase">Total: {totalHantar}</span>
            </div>
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700 uppercase">Disemak: {totalSemak}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 md:p-6 rounded-[2rem] premium-shadow border border-slate-100 flex flex-col sm:flex-row items-center gap-3 md:gap-4 text-center sm:text-left">
            <div className="p-3 md:p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><Users size={20} className="md:w-6 md:h-6" /></div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Jumlah Guru</p>
              <p className="text-xl md:text-2xl font-black text-slate-900">{teachers.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-[2rem] premium-shadow border border-slate-100 flex flex-col sm:flex-row items-center gap-3 md:gap-4 text-center sm:text-left">
            <div className="p-3 md:p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><Send size={20} className="md:w-6 md:h-6" /></div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Penghantaran</p>
              <p className="text-xl md:text-2xl font-black text-slate-900">{totalHantar}</p>
            </div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-[2rem] premium-shadow border border-slate-100 flex flex-col sm:flex-row items-center gap-3 md:gap-4 text-center sm:text-left">
            <div className="p-3 md:p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><CheckCircle2 size={20} className="md:w-6 md:h-6" /></div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Telah Disemak</p>
              <p className="text-xl md:text-2xl font-black text-slate-900">{totalSemak}</p>
            </div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-[2rem] premium-shadow border border-slate-100 flex flex-col sm:flex-row items-center gap-3 md:gap-4 text-center sm:text-left">
            <div className="p-3 md:p-4 bg-amber-50 text-amber-600 rounded-2xl shadow-inner"><TrendingUp size={20} className="md:w-6 md:h-6" /></div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kadar Semakan</p>
              <p className="text-xl md:text-2xl font-black text-slate-900">{totalHantar > 0 ? Math.round((totalSemak / totalHantar) * 100) : 0}%</p>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] premium-shadow border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Graf Penghantaran (Top 10)</h2>
          </div>
          <div className="h-[300px] md:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
                <Bar dataKey="Hantar" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={30} />
                <Bar dataKey="Semak" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-[2.5rem] premium-shadow border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-slate-900 rounded-full"></div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Prestasi Individu Guru</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guru</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hantar</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Semak</th>
                  <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Pencapaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analysisData.map(teacher => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        {teacher.photoUrl && teacher.photoUrl.trim() !== "" ? (
                          <img 
                            src={teacher.photoUrl} 
                            className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm" 
                            alt="" 
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'U')}&background=random`; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                            {(teacher.name || 'U').charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-black text-slate-900 uppercase leading-none mb-1">{teacher.name}</p>
                          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{teacher.department || 'TIADA BIDANG'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-sm font-black text-slate-700">{teacher.hantar}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-sm font-black text-emerald-600">{teacher.semak}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {teacher.statusIcon === 'TROPHY' && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100 shadow-sm animate-bounce-subtle">
                          <Trophy size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Trophy</span>
                        </div>
                      )}
                      {teacher.statusIcon === 'STAR' && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm">
                          <Star size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Bintang</span>
                        </div>
                      )}
                      {!teacher.statusIcon && (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Tiada Rekod</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;