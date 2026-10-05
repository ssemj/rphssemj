
import React, { useState } from 'react';
import { UserRole, UserProfile } from '../types';
import { useBranding } from '../services/brandingService';
import { User, Shield, ArrowRight, Search, Lock, ChevronLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface RegisterProps {
  onSelectRole: (role: UserRole, teacherProfile?: UserProfile) => void;
  teachers: any[];
  isLoading?: boolean;
  isOffline?: boolean;
  onSync?: () => void;
}

const Register: React.FC<RegisterProps> = ({ onSelectRole, teachers, isLoading, isOffline, onSync }) => {
  const branding = useBranding();
  const [step, setStep] = useState<'ROLE' | 'SELECT_TEACHER' | 'ENTER_LOGIN' | 'ADMIN_LOGIN'>('ROLE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [loginId, setLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');

  const filteredTeachers = React.useMemo(() => {
    const filtered = teachers.filter(t => {
      return t.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    // Limit to 50 items to prevent DOM lag when list is huge
    return filtered.slice(0, 50);
  }, [teachers, searchTerm]);

  const handleTeacherSelect = (teacher: any) => {
    setSelectedTeacher(teacher);
    setStep('ENTER_LOGIN');
    setError('');
  };

  const handleAdminLogin = () => {
    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'dzurri';
    if (adminPassword === correctPassword) {
      onSelectRole(UserRole.ADMIN);
    } else {
      setError('Kata laluan tidak sah. Sila cuba lagi.');
    }
  };

  const handleLogin = () => {
    if (!selectedTeacher) return;
    
    // Validation: Check if entered loginId matches the one from registry
    // We prioritize the 'login' property explicitly set in App.tsx
    let actualLogin = String(selectedTeacher.login || '').trim();
    
    if (!actualLogin) {
      // Fallback: Check raw data if login property is missing
      const source = selectedTeacher.raw || selectedTeacher;
      const possibleLoginKeys = ['LOGIN', 'login', 'Login', 'Login ID', 'LOGIN ID', 'login id', 'ID'];
      
      for (const key of possibleLoginKeys) {
        if (source[key] !== undefined && source[key] !== null) {
          actualLogin = String(source[key]).trim();
          break;
        }
      }
      
      // Secondary Fallback: Try the first key (Column A)
      if (!actualLogin) {
        const allKeys = Object.keys(source);
        if (allKeys.length > 0) {
          const firstKey = allKeys[0];
          if (!['id', 'name', 'nama_guru', 'NAMA GURU'].includes(firstKey.toLowerCase())) {
            actualLogin = String(source[firstKey]).trim();
          }
        }
      }
    }
    
    const inputLogin = loginId.trim();
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'dzurri';
    
    if ((inputLogin === actualLogin && actualLogin !== '') || inputLogin === adminPassword) {
      onSelectRole(UserRole.GURU, selectedTeacher);
    } else {
      if (actualLogin === '') {
        setError('Data Login tidak dijumpai dalam sistem. Sila hubungi pentadbir.');
      } else {
        setError('Login ID tidak sah. Sila cuba lagi.');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>

      <div className="text-center mb-12 relative z-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full mb-6 border border-blue-100">
          <img 
            src={branding.logo || "/icon.svg"} 
            alt="Logo" 
            className="w-6 h-6 object-contain"
          />
          <span className="text-blue-700 text-[10px] font-extrabold uppercase tracking-widest">Sistem Pintar Warga SSEMJ</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-4">
          SMART <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">RPH</span>
        </h1>
        <p className="text-slate-500 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed uppercase tracking-tight">
          {step === 'ROLE' && "Platform perancangan pengajaran digital masa hadapan"}
          {step === 'SELECT_TEACHER' && "Sila pilih nama anda daripada senarai"}
          {step === 'ENTER_LOGIN' && "Pengesahan Identiti Diperlukan"}
        </p>
      </div>

      <div className="max-w-4xl w-full relative z-10 flex justify-center">
        {step === 'ROLE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            {/* Guru Portal Card */}
            <button 
              onClick={() => setStep('SELECT_TEACHER')}
              className="glass group p-10 rounded-[2.5rem] premium-shadow hover:scale-[1.02] hover:bg-white/90 transition-all duration-500 text-left relative overflow-hidden border border-white/50"
            >
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
                <User className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Portal Guru</h2>
              <p className="text-slate-500 mb-10 text-sm leading-relaxed font-medium">
                Bina RPH dengan bantuan kecerdasan buatan, pantau status mingguan, dan tingkatkan efisiensi PdP.
              </p>
              <div className="flex items-center gap-3 text-blue-600 font-bold text-sm">
                <span>Mula Bertugas</span>
                <div className="bg-blue-600/10 p-2 rounded-full group-hover:translate-x-2 transition-transform">
                  <ArrowRight size={18} />
                </div>
              </div>
            </button>

            {/* Admin Portal Card */}
            <button 
              onClick={() => { setStep('ADMIN_LOGIN'); setError(''); setAdminPassword(''); }}
              className="glass group p-10 rounded-[2.5rem] premium-shadow hover:scale-[1.02] hover:bg-white/90 transition-all duration-500 text-left relative overflow-hidden border border-white/50"
            >
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-200 group-hover:-rotate-6 transition-transform">
                <Shield className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Pentadbir</h2>
              <p className="text-slate-500 mb-10 text-sm leading-relaxed font-medium">
                Semak, beri ulasan, dan sahkan penghantaran RPH guru secara digital dengan kawalan penuh sistem.
              </p>
              <div className="flex items-center gap-3 text-indigo-600 font-bold text-sm">
                <span>Urus Sistem</span>
                <div className="bg-indigo-600/10 p-2 rounded-full group-hover:translate-x-2 transition-transform">
                  <ArrowRight size={18} />
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 'SELECT_TEACHER' && (
          <div className="w-full max-w-2xl animate-slideUp">
            <div className="bg-white rounded-[3rem] premium-shadow border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <button onClick={() => setStep('ROLE')} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <div className="relative flex-1 ml-6 mr-2">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Cari nama anda..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 pl-12 pr-6 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={onSync}
                  disabled={isLoading}
                  className={`p-3 rounded-xl transition-all ${isLoading ? 'text-slate-200' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                  title="Kemaskini Senarai"
                >
                  <RefreshCw className={isLoading ? 'animate-spin' : ''} size={20} />
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {isLoading && teachers.length === 0 ? (
                  <div className="p-20 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-4 opacity-50" size={48} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Menghubungkan ke Cloud...</p>
                  </div>
                ) : isOffline && teachers.length === 0 ? (
                  <div className="p-20 text-center text-rose-400">
                    <Lock size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-black uppercase tracking-widest mb-4">Sambungan Gagal</p>
                    <button 
                      onClick={onSync}
                      className="px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                    >
                      Cuba Lagi
                    </button>
                  </div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="p-20 text-center text-slate-300">
                    <User size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-black uppercase tracking-widest">Nama tidak dijumpai</p>
                  </div>
                ) : (
                  filteredTeachers.map(teacher => (
                    <button 
                      key={teacher.id}
                      onClick={() => handleTeacherSelect(teacher)}
                      className="w-full p-6 flex items-center gap-4 border-b border-slate-50 last:border-0 hover:bg-blue-50/50 transition-all text-left group"
                    >
                      {teacher.photoUrl && teacher.photoUrl.trim() !== "" ? (
                        <img 
                          src={teacher.photoUrl} 
                          className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm" 
                          alt="" 
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'U')}&background=random`; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-black text-sm">
                          {(teacher.name || 'U').charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900 uppercase group-hover:text-blue-600 transition-colors">
                          {teacher.name}
                        </p>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">{teacher.department || 'TIADA BIDANG'}</p>
                      </div>
                      <ArrowRight size={18} className="text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'ENTER_LOGIN' && selectedTeacher && (
          <div className="w-full max-w-md animate-slideUp">
            <div className="bg-white p-10 rounded-[3rem] premium-shadow border border-slate-100 text-center">
              <button onClick={() => setStep('SELECT_TEACHER')} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-blue-600 transition-colors">
                <ChevronLeft size={24} />
              </button>
              
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-blue-600 shadow-inner">
                <Lock size={32} />
              </div>
              
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Sila Masukkan Login ID</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Untuk: {selectedTeacher.name}</p>
              
              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="password"
                    value={loginId}
                    onChange={(e) => { setLoginId(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className={`w-full h-16 bg-slate-50 border-2 ${error ? 'border-red-100' : 'border-slate-100'} rounded-2xl text-center text-2xl tracking-[0.5em] font-black focus:bg-white focus:border-blue-600 outline-none transition-all`}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  {error && (
                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-3 animate-pulse">{error}</p>
                  )}
                </div>
                
                <button 
                  onClick={handleLogin}
                  className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 shadow-xl transition-all active:scale-95"
                >
                  <CheckCircle2 size={20} />
                  Log Masuk Portal
                </button>
                
                <p className="text-slate-300 text-[9px] font-bold uppercase tracking-[0.2em] pt-4">
                  Sila hubungi pentadbir jika anda terlupa Login ID anda
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'ADMIN_LOGIN' && (
          <div className="w-full max-w-md animate-slideUp">
            <div className="bg-white p-10 rounded-[3rem] premium-shadow border border-slate-100 text-center relative">
              <button onClick={() => setStep('ROLE')} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <ChevronLeft size={24} />
              </button>
              
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-inner">
                <Shield size={32} />
              </div>
              
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Log Masuk Pentadbir</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Sistem Pengurusan eRPH</p>
              
              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="password"
                    value={adminPassword}
                    onChange={(e) => { setAdminPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className={`w-full h-16 bg-slate-50 border-2 ${error ? 'border-red-100' : 'border-slate-100'} rounded-2xl text-center text-2xl tracking-[0.5em] font-black focus:bg-white focus:border-indigo-600 outline-none transition-all`}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                  {error && (
                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-3 animate-pulse">{error}</p>
                  )}
                </div>
                
                <button 
                  onClick={handleAdminLogin}
                  className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 shadow-xl transition-all active:scale-95"
                >
                  <CheckCircle2 size={20} />
                  Log Masuk Pentadbir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-20 text-center">
        <p className="text-slate-400 text-[10px] font-black tracking-[0.4em] uppercase">Edisi SSEMJ #CELIK IT 2026</p>
      </div>
    </div>
  );
};

export default Register;