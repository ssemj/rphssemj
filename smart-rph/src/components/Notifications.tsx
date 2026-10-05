
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { UserProfile, AppNotification } from '../types';
import { 
  MessageCircle, Send, ChevronLeft, User, Clock, Bell, Search
} from 'lucide-react';

interface NotificationsProps {
  user: UserProfile;
  notifications: AppNotification[];
  onSend: (message: string) => void;
  onRead: (id: string) => void;
  onBack: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ user, notifications, onSend, onRead, onBack }) => {
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString('ms-MY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return ts;
    }
  };

  const filteredNotifications = useMemo(() => {
    return [...notifications]
      .filter(n => n.message.toLowerCase().includes(searchTerm.toLowerCase()) || n.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
  }, [notifications, searchTerm]);

  const unreadNotifications = useMemo(() => filteredNotifications.filter(n => !n.read), [filteredNotifications]);
  const readNotifications = useMemo(() => filteredNotifications.filter(n => n.read), [filteredNotifications]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSend(newMessage);
    setNewMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
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
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Notifikasi & Mesej</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pusat Komunikasi Warga SSEMJ</p>
            </div>
          </div>
          <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
            <motion.div
              animate={unreadNotifications.length > 0 ? {
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1.1, 1.1, 1.1, 1]
              } : {}}
              transition={{ duration: 0.5, repeat: unreadNotifications.length > 0 ? Infinity : 0, repeatDelay: 1 }}
            >
              <Bell size={24} />
            </motion.div>
          </div>
        </div>

        {/* Search & Input */}
        <div className="bg-white p-6 rounded-[2.5rem] premium-shadow border border-slate-100 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari mesej atau pengirim..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-6 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3">
            <textarea 
              placeholder="Tulis mesej anda di sini..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all min-h-[100px] resize-none"
            />
            <button 
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="bg-blue-600 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-100"
            >
              <Send size={20} />
              <span>Hantar</span>
            </button>
          </div>
        </div>

        {/* Inbox: Mesej Baharu */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className={`w-2 h-2 rounded-full ${unreadNotifications.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`}></div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Mesej Baharu</h2>
            <span className={`${unreadNotifications.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'} px-2 py-0.5 rounded-md text-[10px] font-black`}>
              {unreadNotifications.length}
            </span>
          </div>

          {unreadNotifications.length === 0 ? (
            <div className="py-12 bg-white rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
              <p className="text-[9px] font-black uppercase tracking-widest">Tiada mesej baharu</p>
            </div>
          ) : (
            unreadNotifications.map((notif) => (
              <div 
                key={notif.id} 
                className="bg-white p-6 rounded-[2rem] border-2 border-blue-100 shadow-xl shadow-blue-50/50 animate-slideUp relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-1 h-full bg-blue-600"></div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 rounded-xl bg-blue-600 text-white">
                      <User size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{notif.senderName}</p>
                        {notif.type === 'ANNOUNCEMENT' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-[7px] font-black rounded-md uppercase tracking-widest border border-amber-200">Pengumuman</span>
                        )}
                        {notif.type === 'SYSTEM' && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[7px] font-black rounded-md uppercase tracking-widest border border-indigo-200">Sistem</span>
                        )}
                      </div>
                      <p className="text-[13px] font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{notif.message}</p>
                      <div className="flex items-center gap-1.5 mt-3 text-slate-400">
                        <Clock size={10} />
                        <p className="text-[8px] font-bold uppercase tracking-widest">{formatTimestamp(notif.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onRead(notif.id)}
                    className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                  >
                    Mesej telah dibaca
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Archive: Arkib Notifikasi */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3 px-2">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-tight">Arkib Notifikasi</h2>
          </div>

          <div className="space-y-3 opacity-70">
            {readNotifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-300">
                <p className="text-[9px] font-black uppercase tracking-widest">Arkib kosong</p>
              </div>
            ) : (
              readNotifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className="bg-white/50 p-5 rounded-[1.5rem] border border-slate-100"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-400">
                      <User size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{notif.senderName}</p>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed line-clamp-2">{notif.message}</p>
                      <p className="text-[7px] font-bold text-slate-300 uppercase tracking-widest mt-2">{formatTimestamp(notif.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;