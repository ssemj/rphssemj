
import React, { useState } from 'react';
import { MasterData } from '../types';
import { sortSubjects } from '../constants';
import { 
  ChevronLeft, Plus, Trash2, Edit2, Save, X, 
  BookOpen, Layers, LayoutGrid, ListChecks, ChevronRight,
  Database, Info, AlertCircle
} from 'lucide-react';

interface MasterDataManagerProps {
  masterData: MasterData;
  onSave: (data: MasterData) => void;
  onBack: () => void;
}

const MasterDataManager: React.FC<MasterDataManagerProps> = ({ masterData, onSave, onBack }) => {
  const [data, setData] = useState<MasterData>({ ...masterData });
  const [activeTab, setActiveTab] = useState<'SUBJECTS' | 'CLASSES' | 'HIERARCHY' | 'BBM'>('SUBJECTS');
  const [newItem, setNewItem] = useState('');
  const [editingItem, setEditingItem] = useState<{ type: string, key?: string, index?: number, value: string } | null>(null);

  const handleSave = () => {
    onSave({ ...data, lastUpdated: new Date().toLocaleString() });
  };

  const addItem = (type: 'SUBJECTS' | 'BBM') => {
    if (!newItem.trim()) return;
    if (type === 'SUBJECTS') {
      setData({ ...data, subjects: sortSubjects([...data.subjects, newItem.trim()]) });
    } else {
      setData({ ...data, bbmOptions: [...(data.bbmOptions || []), newItem.trim()] });
    }
    setNewItem('');
  };

  const removeItem = (type: 'SUBJECTS' | 'BBM', index: number) => {
    if (type === 'SUBJECTS') {
      const newSubjects = [...data.subjects];
      newSubjects.splice(index, 1);
      setData({ ...data, subjects: newSubjects });
    } else {
      const newBbm = [...(data.bbmOptions || [])];
      newBbm.splice(index, 1);
      setData({ ...data, bbmOptions: newBbm });
    }
  };

  const addClass = (form: string) => {
    if (!newItem.trim()) return;
    const newClasses = { ...data.classes };
    if (!newClasses[form]) newClasses[form] = [];
    newClasses[form] = [...newClasses[form], newItem.trim()];
    setData({ ...data, classes: newClasses });
    setNewItem('');
  };

  const removeClass = (form: string, index: number) => {
    const newClasses = { ...data.classes };
    newClasses[form].splice(index, 1);
    setData({ ...data, classes: newClasses });
  };

  const addForm = () => {
    if (!newItem.trim()) return;
    const newClasses = { ...data.classes };
    const addedForms = newItem.split(',').map(f => f.trim()).filter(f => f);
    addedForms.forEach(f => {
      if (!newClasses[f]) {
        newClasses[f] = [];
      }
    });
    setData({ ...data, classes: newClasses });
    setNewItem('');
  };

  const removeForm = (form: string) => {
    const newClasses = { ...data.classes };
    delete newClasses[form];
    setData({ ...data, classes: newClasses });
  };

  // Simple Hierarchy Editor logic
  const [hierarchyPath, setHierarchyPath] = useState<string[]>([]);
  
  const getSubHierarchy = (path: string[]) => {
    let current = data.hierarchy || {};
    for (const p of path) {
      current = current[p] || {};
    }
    return current;
  };

  const updateHierarchy = (path: string[], key: string, value: any, isDelete: boolean = false) => {
    const newData = JSON.parse(JSON.stringify(data));
    let current = newData.hierarchy;
    for (const p of path) {
      if (!current[p]) current[p] = {};
      current = current[p];
    }
    
    if (isDelete) {
      delete current[key];
    } else {
      current[key] = value;
    }
    setData(newData);
  };

  const subData = getSubHierarchy(hierarchyPath);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn pb-24 text-left">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-blue-600 transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Pengurusan Data Utama</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konfigurasi Sistem & Kurikulum</p>
            </div>
          </div>
          <button 
            onClick={handleSave}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-3"
          >
            <Save size={18} /> Simpan Perubahan
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 p-1 bg-white rounded-2xl border border-slate-100 shadow-sm hide-scrollbar">
          {[
            { id: 'SUBJECTS', label: 'Subjek', icon: BookOpen },
            { id: 'CLASSES', label: 'Tingkatan & Kelas', icon: LayoutGrid },
            { id: 'HIERARCHY', label: 'Kurikulum (DSKP)', icon: Layers },
            { id: 'BBM', label: 'Pilihan BBM', icon: ListChecks }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setHierarchyPath([]); setNewItem(''); }}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-transparent text-slate-500 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-[2.5rem] premium-shadow border border-slate-100 overflow-hidden min-h-[500px]">
          
          {/* Subjects Tab */}
          {activeTab === 'SUBJECTS' && (
            <div className="p-8 md:p-12 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Senarai Mata Pelajaran</h2>
              </div>
              
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Tambah subjek baharu..."
                  className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('SUBJECTS')}
                />
                <button 
                  onClick={() => addItem('SUBJECTS')}
                  className="px-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md"
                >
                  Tambah
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.subjects.map((subject, idx) => (
                  <div key={idx} className="group p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-blue-200 transition-all">
                    <span className="text-sm font-black text-slate-700 uppercase">{subject}</span>
                    <button 
                      onClick={() => removeItem('SUBJECTS', idx)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BBM Tab */}
          {activeTab === 'BBM' && (
            <div className="p-8 md:p-12 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-emerald-600 rounded-full"></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pilihan Bahan Bantu Mengajar (BBM)</h2>
              </div>
              
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Tambah pilihan BBM..."
                  className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100 focus:bg-white transition-all"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('BBM')}
                />
                <button 
                  onClick={() => addItem('BBM')}
                  className="px-6 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md"
                >
                  Tambah
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.bbmOptions || []).map((opt, idx) => (
                  <div key={idx} className="group p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                    <span className="text-sm font-black text-slate-700 uppercase">{opt}</span>
                    <button 
                      onClick={() => removeItem('BBM', idx)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classes Tab */}
          {activeTab === 'CLASSES' && (
            <div className="p-8 md:p-12 space-y-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pengurusan Tingkatan & Kelas</h2>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nama Tingkatan (cth: T1, T2)..."
                    className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addForm()}
                  />
                  <button onClick={addForm} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {Object.keys(data.classes).sort().map(form => (
                  <div key={form} className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{form}</h3>
                      <button onClick={() => removeForm(form)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id={`class-input-${form}`}
                        placeholder="Nama Kelas (pisahkan dengan koma)..."
                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            if (val.trim()) {
                              const newClasses = { ...data.classes };
                              const addedClasses = val.split(',').map(c => c.trim()).filter(c => c);
                              newClasses[form] = Array.from(new Set([...(newClasses[form] || []), ...addedClasses]));
                              setData({ ...data, classes: newClasses });
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById(`class-input-${form}`) as HTMLInputElement;
                          if (input && input.value.trim()) {
                            const newClasses = { ...data.classes };
                            const addedClasses = input.value.split(',').map(c => c.trim()).filter(c => c);
                            newClasses[form] = Array.from(new Set([...(newClasses[form] || []), ...addedClasses]));
                            setData({ ...data, classes: newClasses });
                            input.value = '';
                          }
                        }}
                        className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(data.classes[form] || []).map((cls, idx) => (
                        <div key={idx} className="group px-3 py-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-600 uppercase">{cls}</span>
                          <button onClick={() => removeClass(form, idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hierarchy Tab */}
          {activeTab === 'HIERARCHY' && (
            <div className="p-8 md:p-12 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-slate-900 rounded-full"></div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Struktur Kurikulum (DSKP)</h2>
                </div>
                {hierarchyPath.length > 0 && (
                  <button 
                    onClick={() => setHierarchyPath(prev => prev.slice(0, -1))}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all"
                  >
                    <ChevronLeft size={14} /> Kembali
                  </button>
                )}
              </div>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                <button 
                  onClick={() => setHierarchyPath([])}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${hierarchyPath.length === 0 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                >
                  Utama
                </button>
                {hierarchyPath.map((p, i) => (
                  <React.Fragment key={i}>
                    <ChevronRight size={12} className="text-slate-300 flex-none" />
                    <button 
                      onClick={() => setHierarchyPath(prev => prev.slice(0, i + 1))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${i === hierarchyPath.length - 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 md:p-10">
                <div className="flex gap-3 mb-8">
                  <input 
                    type="text" 
                    placeholder={hierarchyPath.length === 4 ? "Nilai / Teras..." : "Tambah item baharu..."}
                    className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                  />
                  <button 
                    onClick={() => {
                      if (!newItem.trim()) return;
                      // If at SP level (path length 4), value is a string (Core)
                      // Otherwise it's an object
                      const value = hierarchyPath.length === 4 ? "Teras" : {};
                      updateHierarchy(hierarchyPath, newItem.trim(), value);
                      setNewItem('');
                    }}
                    className="px-8 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md"
                  >
                    Tambah
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(subData).map(([key, value]) => (
                    <div key={key} className="group flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-all">
                      <div 
                        className="flex-1 cursor-pointer flex items-center gap-3"
                        onClick={() => {
                          if (typeof value === 'object') {
                            setHierarchyPath([...hierarchyPath, key]);
                          }
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full ${typeof value === 'object' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                        <span className="text-[11px] font-black text-slate-700 uppercase">{key}</span>
                        {typeof value === 'string' && (
                          <span className="text-[9px] font-bold text-slate-400 italic">({value})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {typeof value === 'string' && (
                          <button 
                            onClick={() => {
                              const newVal = prompt("Masukkan Nilai / Teras baharu:", value);
                              if (newVal !== null) updateHierarchy(hierarchyPath, key, newVal);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if (confirm(`Padam "${key}"?`)) {
                              updateHierarchy(hierarchyPath, key, null, true);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(subData).length === 0 && (
                    <div className="py-12 text-center text-slate-300">
                      <Database size={40} className="mx-auto mb-4 opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Tiada data di tahap ini</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2rem] flex items-start gap-4">
                <Info size={20} className="text-blue-600 mt-1 flex-none" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Panduan Struktur DSKP</p>
                  <p className="text-[9px] font-bold text-blue-700/70 uppercase leading-relaxed">
                    Struktur: Subjek → Tingkatan → Tajuk → SK → SP. <br/>
                    Klik pada item untuk masuk ke tahap seterusnya. Tahap terakhir (SP) memerlukan input Nilai/Teras.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MasterDataManager;