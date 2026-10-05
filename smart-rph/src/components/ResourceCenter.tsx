
import React, { useState, useMemo } from 'react';
import { 
  Plus, X, FileText, Link as LinkIcon, ExternalLink, Search, 
  Upload, Trash2, Eye, Filter, ChevronRight, Globe, Lock, User
} from 'lucide-react';
import { Resource, UserProfile } from '../types';
import FileViewer from './FileViewer';

interface ResourceCenterProps {
  viewId: string;
  label: string;
  resources: Resource[];
  user: UserProfile;
  teachers: UserProfile[];
  onAdd: (resource: Omit<Resource, 'id' | 'uploadedAt'>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  isAdmin?: boolean;
}

const ResourceCenter: React.FC<ResourceCenterProps> = ({ viewId, label, resources, user, teachers, onAdd, onDelete, onClose, isAdmin = false }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<Resource | null>(null);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'FILE' | 'LINK'>('FILE');
  const [fileData, setFileData] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileExt, setFileExt] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const filteredResources = useMemo(() => {
    // Deduplicate resources to prevent key errors
    const uniqueResources = Array.from(new Map(resources.map(r => [r.id, r])).values());

    return uniqueResources
      .filter(r => r.targetView === viewId)
      // Show all resources for this view, regardless of uploader (Shared View)
      .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [resources, viewId, searchTerm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadstart = () => setIsUploading(true);
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFileData(base64);
        setFileName(file.name);
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        setFileExt(ext);
        if (!newName) setNewName(file.name.split('.')[0]);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !fileData) return;

    onAdd({
      name: newName,
      fileName: newType === 'LINK' ? 'Pautan Drive' : fileName,
      fileType: newType === 'LINK' ? 'LINK' : fileExt,
      fileData: fileData,
      targetView: viewId
    });

    // Reset
    setNewName('');
    setFileData('');
    setFileName('');
    setFileExt('');
    setShowAddModal(false);
  };

  return (
    <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 border-slate-100 animate-slideUp text-left space-y-8 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-2 h-10 bg-blue-600 rounded-full shadow-lg shadow-blue-100"></div>
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight text-xl md:text-2xl">
              {label}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pusat Sumber Digital Warga SSEMJ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari bahan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
              title="Tambah Bahan"
            >
              <Plus size={24} />
            </button>
          )}
          <button onClick={onClose} className="p-3 text-slate-400 hover:text-red-500 transition-all"><X size={24}/></button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 relative z-10">
        {filteredResources.length === 0 ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
            <div className="p-8 bg-slate-50 rounded-full mb-6 opacity-50">
              <FileText size={64} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest">Tiada bahan dimuat naik lagi</p>
            {isAdmin && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="mt-6 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline"
              >
                Muat naik bahan pertama anda
              </button>
            )}
          </div>
        ) : (
          filteredResources.map(res => (
            <div 
              key={res.id} 
              className="group bg-white p-6 rounded-[2rem] border border-slate-100 premium-shadow hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
              onClick={() => setSelectedFile(res)}
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl shadow-sm ${res.fileType === 'LINK' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  {res.fileType === 'LINK' ? <LinkIcon size={24}/> : <FileText size={24}/>}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border ${res.fileType === 'LINK' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                    {res.fileType}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1 group-hover:text-blue-600 transition-colors">{res.name}</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User size={10} /> {teachers.find(t => t.id === res.uploaderId)?.name || 'Sistem'}
                </p>
                <p className="text-[8px] font-medium text-slate-300 uppercase tracking-tighter truncate">{res.fileName}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{new Date(res.uploadedAt).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-400 hover:text-blue-600 transition-all"><Eye size={16}/></button>
                  {onDelete && isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(res.id); }}
                      className="p-2 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[700] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100">
                  <Plus size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Tambah Bahan {label}</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-red-500 transition-all"><X size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                  type="button"
                  onClick={() => { setNewType('FILE'); setFileData(''); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newType === 'FILE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Muat Naik Fail
                </button>
                <button 
                  type="button"
                  onClick={() => { setNewType('LINK'); setFileData(''); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newType === 'LINK' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Kongsi Pautan
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nama Bahan</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Takwim Sekolah 2026"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>

                {newType === 'FILE' ? (
                  <div className="space-y-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Pilih Fail</label>
                    <div className="relative group">
                      <div className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${fileData ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-300 bg-slate-50/50'}`}>
                        {isUploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Memproses...</p>
                          </div>
                        ) : fileData ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg"><FileText size={32}/></div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest truncate max-w-[200px]">{fileName}</p>
                            <button type="button" onClick={() => setFileData('')} className="text-[8px] font-bold text-red-500 uppercase hover:underline">Padam</button>
                          </div>
                        ) : (
                          <>
                            <div className="p-4 bg-white text-slate-400 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform"><Upload size={32}/></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Klik atau seret fail di sini<br/><span className="text-[8px] opacity-60">(PDF, XLSX, PNG, JPG)</span></p>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Pautan Google Drive</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="url" 
                        required
                        value={fileData}
                        onChange={(e) => setFileData(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={!newName || !fileData || isUploading}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
              >
                {isUploading ? 'Sila Tunggu...' : 'Simpan Bahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Viewer Modal */}
      {selectedFile && (
        <FileViewer 
          name={selectedFile.name}
          fileType={selectedFile.fileType}
          fileData={selectedFile.fileData}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
};

export default ResourceCenter;