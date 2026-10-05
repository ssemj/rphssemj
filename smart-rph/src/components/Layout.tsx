
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile, UserRole, AppNotification } from '../types';
import { LayoutDashboard, FilePlus, LogOut, BookOpen, Settings, MessageSquare, Bell, Menu, X as CloseIcon } from 'lucide-react';
import ProfileModal from './ProfileModal';
import { useBranding } from '../services/brandingService';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  user: UserProfile | null;
  onLogout: () => void;
  setView: (view: any) => void;
  children: React.ReactNode;
  onUpdateProfile?: (data: Partial<UserProfile>) => Promise<void>;
  notifications?: AppNotification[];
  adminUser?: UserProfile | null;
  onReturnToAdmin?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, setView, children, onUpdateProfile, notifications = [], adminUser, onReturnToAdmin }) => {
  const branding = useBranding();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasNewNotification = useMemo(() => {
    return notifications.some(n => !n.read);
  }, [notifications]);

  const handleNotificationClick = () => {
    setView('CHAT');
    setIsMobileMenuOpen(false);
  };

  const navigateTo = (view: any) => {
    setView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {adminUser && onReturnToAdmin && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between z-[60]">
          <div className="text-sm font-medium">
            Anda sedang log masuk sebagai <span className="font-bold">{user?.name}</span>.
          </div>
          <button 
            onClick={onReturnToAdmin}
            className="text-xs bg-white text-blue-600 px-3 py-1 rounded-full font-bold hover:bg-blue-50 transition-colors"
          >
            Kembali ke Admin
          </button>
        </div>
      )}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200/60 h-16 sm:h-20 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 w-full flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => navigateTo(user?.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}>
            <div className="rounded-lg sm:rounded-xl group-hover:rotate-3 transition-transform overflow-hidden">
              <img 
                src={branding.logo || "/icon.svg"} 
                alt="Logo SSEMJ" 
                className="h-7 w-7 sm:h-10 sm:w-10 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-lg font-black tracking-[0.45em] text-slate-900 leading-none mr-[-0.45em]">SMART RPH</span>
              <span className="text-[6px] sm:text-[8px] font-bold text-blue-600 tracking-tight uppercase max-w-[120px] sm:max-w-[200px] leading-tight -mt-0.5">
                RAKAN DIGITAL WARGA SSEMJ
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-8">
            {user && (
              <nav className="hidden md:flex items-center space-x-1">
                <button 
                  onClick={() => navigateTo(user.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all"
                >
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </button>
                {user.role === UserRole.GURU && (
                  <button 
                    onClick={() => navigateTo('FORM')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-blue-600 shadow-lg shadow-slate-200 transition-all"
                  >
                    <FilePlus size={18} />
                    <span>Bina RPH</span>
                  </button>
                )}
              </nav>
            )}
            
            {user && (
              <div className="flex items-center gap-1 sm:gap-4 md:pl-6 md:border-l md:border-slate-200">
                <div 
                  className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-slate-50 p-1 sm:p-2 rounded-2xl transition-colors"
                  onClick={() => setShowProfileModal(true)}
                  title="Kemaskini Profil"
                >
                  {user.photoUrl && user.photoUrl.trim() !== "" ? (
                    <img 
                      src={user.photoUrl} 
                      alt="Profile" 
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl border-2 border-white shadow-sm object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=random`; }}
                    />
                  ) : (
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl border-2 border-white shadow-sm bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-black text-slate-900 leading-none">
                      {user.name ? user.name.split(' ').slice(0, 2).join(' ') : 'User'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{user.role}</p>
                  </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-1">
                  <button onClick={() => navigateTo('SETTINGS')} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                    <Settings size={20} />
                  </button>
                  <button 
                    onClick={handleNotificationClick} 
                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all relative"
                  >
                    <motion.div
                      animate={hasNewNotification ? {
                        rotate: [0, -10, 10, -10, 10, 0],
                        scale: [1, 1.2, 1.2, 1]
                      } : {}}
                      transition={{ duration: 0.5, repeat: hasNewNotification ? Infinity : 0, repeatDelay: 1 }}
                    >
                      <Bell size={20} className={hasNewNotification ? 'text-blue-600' : ''} />
                    </motion.div>
                    {notifications.some(n => !n.read) && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                  </button>
                  <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <LogOut size={20} />
                  </button>
                </div>

                {/* Mobile Menu Toggle */}
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  {isMobileMenuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden z-40 sticky top-20"
          >
            <div className="px-4 py-6 space-y-2">
              <button 
                onClick={() => navigateTo(user?.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all"
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </button>
              {user?.role === UserRole.GURU && (
                <button 
                  onClick={() => navigateTo('FORM')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-blue-600 transition-all"
                >
                  <FilePlus size={20} />
                  <span>Bina RPH Baharu</span>
                </button>
              )}
              <div className="h-px bg-slate-100 my-2"></div>
              <button 
                onClick={() => navigateTo('SETTINGS')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all"
              >
                <Settings size={20} />
                <span>Tetapan</span>
              </button>
              <button 
                onClick={handleNotificationClick}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all relative"
              >
                <Bell size={20} />
                <span>Notifikasi</span>
                {hasNewNotification && (
                  <span className="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut size={20} />
                <span>Log Keluar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 md:py-12 safe-bottom">
        {children}
      </main>

      <footer className="bg-white/50 border-t py-6 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
        Copyright @ DZURRIHENSEM @ 2026 SEKOLAH SENI MALAYSIA JOHOR
      </footer>

      {showProfileModal && user && onUpdateProfile && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfileModal(false)} 
          onSave={onUpdateProfile} 
        />
      )}
    </div>
  );
};

export default Layout;