import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, Save, Loader2, User, Mail, Phone, Briefcase, Award, Image as ImageIcon, Key } from 'lucide-react';

interface ProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    id: user.id || '', // Login ID
    name: user.name || '',
    photoUrl: user.photoUrl || '',
    department: user.department || '',
    email: user.email || '',
    phone: user.phone || '',
    grade: user.grade || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Auto-convert Drive URL if pasted into photoUrl field
    if (name === 'photoUrl' && value.includes('drive.google.com')) {
      const idMatch = value.match(/\/d\/([^/]+)/) || value.match(/id=([^&]+)/) || value.match(/\/file\/d\/([^/]+)/);
      if (idMatch && idMatch[1]) {
        finalValue = `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
      }
    }
    
    setFormData({ ...formData, [name]: finalValue });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      alert('Gagal mengemaskini profil. Sila cuba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Kemaskini Profil</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Urus maklumat peribadi anda</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Avatar Preview */}
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <img 
                src={formData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`} 
                alt="Profile Preview" 
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg transition-transform group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`; }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Login ID */}
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                name="id" 
                value={formData.id} 
                onChange={handleChange} 
                placeholder="Login ID" 
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                required 
              />
            </div>

            {/* Nama Guru */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Nama Guru" 
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                required 
              />
            </div>

            {/* URL Gambar Profil */}
            <div className="relative">
              <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="url" 
                name="photoUrl" 
                value={formData.photoUrl} 
                onChange={handleChange} 
                placeholder="URL Gambar Profil" 
                className="w-full h-12 pl-12 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
              />
              {formData.photoUrl && (
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, photoUrl: '' })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Kosongkan URL Gambar"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Bidang */}
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                name="department" 
                value={formData.department} 
                onChange={handleChange} 
                placeholder="Bidang" 
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
              />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                placeholder="Alamat E-mel" 
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
              />
            </div>

            {/* No Telefon */}
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
                placeholder="No. Telefon" 
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
              />
            </div>

            {/* Gred */}
            <div className="relative">
              <Award className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                name="grade" 
                value={formData.grade} 
                onChange={handleChange} 
                placeholder="Gred (Cth: DG41)" 
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full h-14 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;