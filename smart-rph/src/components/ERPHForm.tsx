
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ERPHData, ERPHStatus, MasterData, ScheduleSlot, DskpDocument } from '../types';
import { generateErphContent, getGeminiKey, convertToJawi, subjectLanguage, effectiveLanguage, isManagementSubject, MGMT_SK, MGMT_TAJUK, MGMT_SP_FALLBACK, describeManagementSk } from '../services/geminiService';
import { findDskpRows, getFormOptions, splitField, joinField } from '../services/dskpService';
import { WEEKS, LANGUAGES } from '../constants';
import { 
  Sparkles, X, Loader2, Database, Clock, Calendar, 
  Book, Send, ChevronRight, Languages, Edit3, 
  Layers, Target, Activity, PenTool, MessageSquare, Info, RefreshCw, CheckCircle, Eye, LayoutGrid
} from 'lucide-react';
import ERPHPreview from './ERPHPreview';

interface ERPHFormProps {
  user: UserProfile;
  onSave: (data: ERPHData) => void;
  onCancel: () => void;
  masterData: MasterData;
  erphs?: ERPHData[];
  masterSchedule?: ScheduleSlot[];
  initialData?: ERPHData;
  /** @deprecated Groq telah dibuang — diabaikan */
  groqApiKey?: string | null;
  dskpDocs?: DskpDocument[];
  /** Mod editor mingguan: tiada tajuk/butang tutup, dan borang tidak ditutup selepas simpan. */
  embedded?: boolean;
  /** 'close' = kembali ke senarai RPH; 'next' = kekal & pergi ke slot seterusnya */
  onSaved?: (data: ERPHData, mode: 'close' | 'next') => void;
}

const ERPHForm: React.FC<ERPHFormProps> = ({ user, onSave, onCancel, masterData, erphs = [], masterSchedule = [], initialData, dskpDocs = [], embedded = false, onSaved }) => {
  const bbmOptions = masterData.bbmOptions || [
    'Buku Teks',
    'Nota',
    'Latihan',
    'Slide',
    'Komputer',
    'Lain-lain (nyatakan)'
  ];
  
  const [loading, setLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
    const isCustomBbm = initialData?.bbm && !bbmOptions.includes(initialData.bbm);
  const [customBbm, setCustomBbm] = useState(isCustomBbm ? initialData.bbm : '');
  const [showPreview, setShowPreview] = useState(false);
  
  const filledWeeks = useMemo(() => {
    const weeks = new Set<number>();
    erphs.forEach(e => {
      if (e.teacherId === user.id) {
        weeks.add(Number(e.week));
      }
    });
    return weeks;
  }, [erphs, user.id]);

  const latestWeek = useMemo(() => {
    if (filledWeeks.size === 0) return 1;
    return Math.max(...Array.from(filledWeeks));
  }, [filledWeeks]);

  const [formData, setFormData] = useState<Partial<ERPHData>>(() => {
    const today = new Date();
    const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    const defaults = {
      id: Math.random().toString(36).substr(2, 9),
      teacherId: user.id,
      teacherName: user.name,
      week: 1, // Will be updated by useEffect if not initialData
      date: today.toISOString().split('T')[0],
      day: days[today.getDay()],
      startTime: '08:00',
      endTime: '09:00',
      className: '',
      classTitle: '',
      subject: '',
      title: '',
      field: '',
      sk: '',
      sp: '',
      core: '',
      language: 'BM' as 'BM' | 'BI',
      status: ERPHStatus.DRAFT,
      bbm: 'Buku Teks',
      objective: '',
      activities: '',
      reflection: ''
    };

    const cleanInitialData: Partial<ERPHData> = {};
    if (initialData && typeof initialData === 'object') {
      for (const key in initialData) {
        const k = key as keyof ERPHData;
        const value = initialData[k];
        if (typeof value === 'string' || typeof value === 'number') {
          (cleanInitialData as any)[k] = value;
        }
      }
    }

    const combinedData = { ...defaults, ...cleanInitialData };

    if (combinedData.date) {
      const dateObj = new Date(combinedData.date + 'T12:00:00');
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      combinedData.day = days[dateObj.getDay()];
    }

    if (combinedData.bbm && !bbmOptions.includes(combinedData.bbm)) {
      combinedData.bbm = 'Lain-lain (nyatakan)';
    }

    return combinedData;
  });

  const [availableForms, setAvailableForms] = useState<string[]>([]);
  const [availableClassTitles, setAvailableClassTitles] = useState<string[]>([]);
  const [availableTitles, setAvailableTitles] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [availableSKs, setAvailableSKs] = useState<string[]>([]);
  const [availableSPs, setAvailableSPs] = useState<string[]>([]);
  const [selectedSKs, setSelectedSKs] = useState<string[]>([]);
  const [selectedSPs, setSelectedSPs] = useState<string[]>([]);
  const [selectedCores, setSelectedCores] = useState<string[]>([]);

  const hierarchy = useMemo(() => masterData.hierarchy || {}, [masterData.hierarchy]);
  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '').replace(/tingkatan/g, 't').trim();

  

  useEffect(() => {
    if (formData.subject) {
      if (hierarchy[formData.subject] && Object.keys(hierarchy[formData.subject]).length > 0) {
        setAvailableForms(Object.keys(hierarchy[formData.subject]).sort());
      } else if (masterData.classes && Object.keys(masterData.classes).length > 0) {
        setAvailableForms(Object.keys(masterData.classes).sort());
      } else {
        setAvailableForms([]);
      }
    } else {
      setAvailableForms([]);
    }
  }, [formData.subject, hierarchy, masterData.classes]);

  useEffect(() => {
    if (formData.className && masterData.classes) {
      const normalizedSelectedForm = normalize(formData.className);
      const levelKey = Object.keys(masterData.classes).find(k => {
        const normalizedKey = normalize(k);
        if (normalizedKey === normalizedSelectedForm) return true;
        const num1 = k.match(/\d+/);
        const num2 = formData.className?.match(/\d+/);
        return num1 && num2 && num1[0] === num2[0];
      });

      if (levelKey && masterData.classes[levelKey]) {
        setAvailableClassTitles(masterData.classes[levelKey]);
      } else {
        setAvailableClassTitles([]);
      }
    } else {
      setAvailableClassTitles([]);
    }
  }, [formData.className, masterData.classes]);

  // ---- Pilihan bebas: Tema, Bidang/Skill & Tajuk tidak bergantung antara satu sama lain.
  //      Hanya SK → SP yang berkait (mengikut DSKP).
  const formOpts = useMemo(
    () => getFormOptions(masterData, dskpDocs, formData.subject, formData.className),
    [masterData, dskpDocs, formData.subject, formData.className]
  );
  const { tema: curTema, bidang: curBidang } = splitField(formData.field);
  const withCurrent = (list: string[], cur?: string) => (cur && !list.includes(cur) ? [cur, ...list] : list);
  const availableThemes = withCurrent(formOpts.tema, curTema);

  // ---- PENGURUSAN: SK = senarai aktiviti tetap, SP = huraian dijana AI ----
  const isPengurusan = isManagementSubject(formData.subject);
  const teacherSubjects = useMemo(() => {
    const skip = /pengurusan|cuti|peperiksaan|program|serlahan|ujian/i;
    const set = new Set<string>();
    masterSchedule.filter(sl => sl.teacherId === user.id).forEach(sl => sl.subject && set.add(sl.subject));
    erphs.filter(e => e.teacherId === user.id).forEach(e => e.subject && set.add(e.subject));
    return Array.from(set).filter(x => !skip.test(x));
  }, [masterSchedule, erphs, user.id]);
  // Bidang untuk PENGURUSAN = senarai subjek berdaftar (tanpa slot bukan subjek)
  const registeredSubjects = useMemo(() => {
    const skip = /^(pengurusan|cuti|cuti umum|cuti tambahan|program sekolah|ses[iİ] serlahan seni)$|peperiksaan|ujian/i;
    const seen = new Set<string>();
    return (masterData.subjects || []).filter(sub => {
      const k = sub.trim().toUpperCase();
      if (!sub.trim() || skip.test(sub.trim()) || seen.has(k)) return false;
      seen.add(k); return true;
    });
  }, [masterData.subjects]);
  // Subjek rujukan AI: Bidang yang dipilih, jika tiada guna subjek yang diajar guru
  const mgmtSubjects = () => (isPengurusan && splitField(formData.field).bidang ? [splitField(formData.field).bidang] : teacherSubjects);
  const [mgmtSp, setMgmtSp] = useState<Record<string, string>>({});
  const [mgmtLoading, setMgmtLoading] = useState(false);
  const addMgmtSk = async (sk: string) => {
    handleAddSK(sk);
    if (!MGMT_SK.includes(sk)) return;          // ditaip sendiri → tiada huraian automatik
    setMgmtLoading(true);
    try {
      const desc = (await describeManagementSk([sk], mgmtSubjects()))[sk] || MGMT_SP_FALLBACK[sk];
      if (desc) {
        setMgmtSp(prev => ({ ...prev, [sk]: desc }));
        handleAddSP(desc);                       // terus masukkan huraian sebagai SP
      }
    } finally { setMgmtLoading(false); }
  };

  // ---- Kumpulan SK ikut nombor utama: 1.0, 2.0, 3.0 ... ----
  const skGroupKey = (sk: string) => sk.match(/^\s*(\d+)\s*[.)]/)?.[1] || 'Lain';
  const [skGroup, setSkGroup] = useState('');
  const skGroups = useMemo(() => {
    const map = new Map<string, string>();
    formOpts.sks.forEach(sk => {
      const k = skGroupKey(sk);
      if (!map.has(k)) map.set(k, formOpts.skTitle?.[sk] || '');
    });
    return Array.from(map.entries())
      .sort((a, b) => (a[0] === 'Lain' ? 1 : b[0] === 'Lain' ? -1 : Number(a[0]) - Number(b[0])))
      .map(([key, title]) => ({ key, label: key === 'Lain' ? 'Lain-lain' : `${key}.0${title ? ` — ${title}` : ''}` }));
  }, [formOpts]);
  useEffect(() => { setSkGroup(''); }, [formData.subject, formData.className]);

  useEffect(() => {
    setAvailableTitles(withCurrent(formOpts.tajuk, formData.title));
    setAvailableFields(withCurrent(isPengurusan ? registeredSubjects : formOpts.bidang, curBidang));
    setAvailableSKs(formOpts.sks);
  }, [formOpts, formData.title, curBidang, isPengurusan, registeredSubjects]);

  useEffect(() => {
    const allSPs = new Set<string>();
    selectedSKs.forEach(sk => Object.keys(formOpts.skIndex[sk] || {}).forEach(sp => allSPs.add(sp)));
    setAvailableSPs(Array.from(allSPs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  }, [formOpts, selectedSKs]);

  useEffect(() => {
    if (initialData?.sk) {
      const sks = initialData.sk.split('; ').filter(s => s.trim() !== '');
      setSelectedSKs(sks);
    }
    if (initialData?.sp) {
      const sps = initialData.sp.split('; ').filter(s => s.trim() !== '');
      setSelectedSPs(sps);
    }
  }, [initialData]);

  useEffect(() => {
    if (selectedSKs.length > 0 && selectedSPs.length > 0) {
      const cores = new Set<string>();
      selectedSKs.forEach(sk => selectedSPs.forEach(sp => {
        const core = formOpts.skIndex[sk]?.[sp];
        if (core) cores.add(core);
      }));
      const uniqueCores = Array.from(cores).filter(c => c !== '');
      setSelectedCores(uniqueCores);
      setFormData(prev => ({ ...prev, core: uniqueCores.join('; ') || 'N/A' }));
    } else if (selectedSPs.length === 0) {
      setSelectedCores([]);
      setFormData(prev => ({ ...prev, core: 'N/A' }));
    }
  }, [selectedSPs, selectedSKs, formOpts]);

  useEffect(() => {
    if (!initialData && latestWeek > 1) {
      setFormData(prev => ({ ...prev, week: latestWeek }));
    }
  }, [latestWeek, initialData]);

  const handleFieldChange = (field: keyof ERPHData, value: string | number) => {
    const updates: any = { [field]: value };
    if (field === 'date') {
      const dateObj = new Date((value as string) + 'T12:00:00');
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      updates.day = days[dateObj.getDay()];
    }
    else if (field === 'subject') { updates.language = subjectLanguage(String(value)) || 'BM';
      // PENGURUSAN: tiada kelas — Tingkatan & Nama Kelas terus "GURU" (boleh ditaip sendiri)
      const mgmt = isManagementSubject(String(value));
      updates.className = mgmt ? 'GURU' : ''; updates.classTitle = mgmt ? 'GURU' : ''; updates.title = ''; updates.field = ''; updates.sk = ''; updates.sp = ''; updates.core = ''; setSelectedSKs([]); setSelectedSPs([]); }
    else if (field === 'className') { updates.classTitle = ''; updates.title = ''; updates.field = ''; updates.sk = ''; updates.sp = ''; updates.core = ''; setSelectedSKs([]); setSelectedSPs([]); }
    // Tajuk & Bidang bebas — tidak mengosongkan SK/SP
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const CUSTOM = '__CUSTOM__';
  /** Pilih daripada senarai, atau taip sendiri jika pilih "Taip sendiri". */
  const pickFree = (value: string, label: string, apply: (v: string) => void) => {
    if (value !== CUSTOM) { apply(value); return; }
    const typed = window.prompt(`Taip ${label}:`);
    if (typed && typed.trim()) apply(typed.trim());
  };

  // Kemas kini secara fungsian supaya penambahan berturut-turut (cth selepas AI) tidak hilang
  const handleAddSK = (sk: string) => {
    if (!sk) return;
    setSelectedSKs(prev => {
      if (prev.includes(sk)) return prev;
      const next = [...prev, sk];
      setFormData(f => ({ ...f, sk: next.join('; ') }));
      return next;
    });
  };

  const handleRemoveSK = (sk: string) => {
    setSelectedSKs(prev => {
      const next = prev.filter(s => s !== sk);
      setFormData(f => ({ ...f, sk: next.join('; ') }));
      return next;
    });
    // Buang hanya SP milik SK ini (SP yang ditaip sendiri dikekalkan)
    const owned = new Set<string>([...Object.keys(formOpts.skIndex[sk] || {}), ...(mgmtSp[sk] ? [mgmtSp[sk]] : [])]);
    setSelectedSPs(prev => {
      const next = prev.filter(sp => !owned.has(sp));
      setFormData(f => ({ ...f, sp: next.join('; ') }));
      return next;
    });
  };

  const handleAddSP = (sp: string) => {
    if (!sp) return;
    setSelectedSPs(prev => {
      if (prev.includes(sp)) return prev;
      const next = [...prev, sp];
      setFormData(f => ({ ...f, sp: next.join('; ') }));
      return next;
    });
  };

  const handleRemoveSP = (sp: string) => {
    const newSPs = selectedSPs.filter(s => s !== sp);
    setSelectedSPs(newSPs);
    setFormData(prev => ({ ...prev, sp: newSPs.join('; ') }));
  };

  // Baris DSKP penuh (TP & catatan) dari pangkalan data Firestore untuk pilihan semasa
  const matchedDskpRows = useMemo(
    () => findDskpRows(dskpDocs, formData.subject, formData.className, formData.title, selectedSKs, selectedSPs),
    [dskpDocs, formData.subject, formData.className, formData.title, selectedSKs, selectedSPs]
  );
  const [aiExtraNotes, setAiExtraNotes] = useState('');

  const handleBulkAiGenerate = async () => {
    if (!getGeminiKey()) { alert('Sila masukkan Kunci API Gemini di halaman Tetapan terlebih dahulu.'); return; }

    if (isPengurusan ? !formData.sk : (!formData.title || !formData.sk || !formData.sp)) {
      alert(isPengurusan ? "Sila pilih sekurang-kurangnya satu aktiviti pengurusan (SK)." : "Sila lengkapkan pilihan DSKP dahulu.");
      return;
    }
    setLoading(true);
    try {
      const toMin = (t?: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
      const mins = toMin(formData.endTime) - toMin(formData.startTime);
      const out = await generateErphContent({
        subject: formData.subject,
        form: formData.className,
        classTitle: formData.classTitle,
        title: formData.title,
        field: formData.field,
        sk: formData.sk,
        sp: formData.sp,
        dskpRows: matchedDskpRows,
        language: (formData.language as any) || 'BM',
        duration: mins > 0 ? `${mins} minit` : undefined,
        extraNotes: aiExtraNotes || undefined,
        teacherSubjects: mgmtSubjects(),
      });
      setFormData(prev => ({
        ...prev,
        language: effectiveLanguage(formData.subject, formData.language),   // PI → JAWI, English → BI
        objective: out.objective,
        activities: out.activities,
        reflection: out.reflection,
        bbm: 'Lain-lain (nyatakan)',
      }));
      setCustomBbm(out.bbm);
    } catch (error: any) {
      console.error("Gemini AI Error:", error);
      alert(`Gagal menjana kandungan AI (Gemini).\n\nPunca: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Tukar kandungan Rumi → Jawi menggunakan Gemini
  const handleJawiConversion = async () => {
    if (!getGeminiKey()) { alert('Sila masukkan Kunci API Gemini di halaman Tetapan terlebih dahulu.'); return; }
    if (!formData.objective && !formData.activities) { alert("Sila jana kandungan RPH rumi terlebih dahulu."); return; }
    setLoading(true);
    try {
      const result = await convertToJawi({
        objective: formData.objective || '',
        activities: formData.activities || '',
        reflection: formData.reflection || '',
        bbm: formData.bbm === 'Lain-lain (nyatakan)' ? customBbm : (formData.bbm || ''),
      });
      setFormData(prev => ({
        ...prev,
        objective: result.objective || prev.objective,
        activities: result.activities || prev.activities,
        reflection: result.reflection || prev.reflection,
        language: 'JAWI',
        bbm: 'Lain-lain (nyatakan)',
      }));
      if (result.bbm) setCustomBbm(result.bbm);
    } catch (error: any) {
      console.error("Jawi Conversion Error:", error);
      alert(`Gagal menukar ke Jawi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBbmValue = formData.bbm === 'Lain-lain (nyatakan)' ? customBbm : (formData.bbm || '');
    const fullData: ERPHData = {
      id: formData.id || Math.random().toString(36).substr(2, 9),
      teacherId: user.id,
      teacherName: user.name,
      week: formData.week || 1,
      date: formData.date || new Date().toISOString().split('T')[0],
      day: formData.day || 'Isnin',
      startTime: formData.startTime || '08:00',
      endTime: formData.endTime || '09:00',
      className: formData.className || '',
      classTitle: formData.classTitle || '',
      subject: formData.subject || '',
      title: formData.title || '',
      field: formData.field || '',
      sk: formData.sk || '',
      sp: formData.sp || '',
      core: formData.core || '',
      language: formData.language || 'BM',
      objective: formData.objective || '',
      activities: formData.activities || '',
      reflection: formData.reflection || '',
      bbm: finalBbmValue,
      status: ERPHStatus.SELESAI,
    };
    onSave(fullData);
  };

  const handleSaveDraft = (mode: 'close' | 'next' = 'close') => {
    const finalBbmValue = formData.bbm === 'Lain-lain (nyatakan)' ? customBbm : (formData.bbm || '');
    const fullData: ERPHData = {
      id: formData.id || Math.random().toString(36).substr(2, 9),
      teacherId: user.id,
      teacherName: user.name,
      week: formData.week || 1,
      date: formData.date || new Date().toISOString().split('T')[0],
      day: formData.day || 'Isnin',
      startTime: formData.startTime || '08:00',
      endTime: formData.endTime || '09:00',
      className: formData.className || '',
      classTitle: formData.classTitle || '',
      subject: formData.subject || '',
      title: formData.title || '',
      field: formData.field || '',
      sk: formData.sk || '',
      sp: formData.sp || '',
      core: formData.core || '',
      language: formData.language || 'BM',
      objective: formData.objective || '',
      activities: formData.activities || '',
      reflection: formData.reflection || '',
      bbm: finalBbmValue,
      status: ERPHStatus.DRAFT,
    };
    onSave(fullData);
    
    setDraftSaved(true);
    setTimeout(() => {
      setDraftSaved(false);
      if (embedded) onSaved?.(fullData, mode);   // editor mingguan
      else onCancel();                     // Close form after saving draft
    }, embedded ? 900 : 2000);
  };

  const isPendidikanIslam = subjectLanguage(formData.subject) === 'JAWI';
  const isJawiUI = formData.language === 'JAWI' || isPendidikanIslam;

  const scheduleSlots = useMemo(() => {
    if (masterSchedule && masterSchedule.length > 0) {
      return masterSchedule;
    }
    const teacherSlots = erphs.filter(e => e.teacherId === user.id);
    const uniqueSlots = new Map();
    teacherSlots.forEach(s => {
      const key = `${s.subject}-${s.className}-${s.classTitle}`;
      if (!uniqueSlots.has(key)) {
        uniqueSlots.set(key, s);
      }
    });
    return Array.from(uniqueSlots.values());
  }, [erphs, user.id, masterSchedule]);

  const labels = {
    title: isPendidikanIslam ? 'ڤنيضاءن سمار‌ت ر.ڤ.ه' : (initialData ? 'Kemaskini SMART RPH' : 'Penyediaan SMART RPH'),
    weekDate: isPendidikanIslam ? 'ميڠڬو & تاريخ' : 'Minggu & Tarikh',
    timeSlot: isPendidikanIslam ? 'سلوت وقتو ڤڠاجرن' : 'Slot Waktu PdP',
    to: isPendidikanIslam ? 'ك' : 'KE',
    curriculum: isPendidikanIslam ? 'كاندوڠن كوريكولوم' : 'Kandungan Kurikulum',
    subject: isPendidikanIslam ? 'مات ڤلاجرن' : 'Mata Pelajaran',
    form: isPendidikanIslam ? 'تيڠكتن' : 'Tingkatan',
    className: isPendidikanIslam ? 'نام كلس' : 'Nama Kelas',
    pdpTitle: isPendidikanIslam ? 'تاجوق ڤڠاجرن' : 'Tajuk PdP',
    field: isPendidikanIslam ? 'بيدڠ / تيما' : 'Bidang / Tema',
    sk: isPendidikanIslam ? 'ستندرد كاندوڠن' : 'Standard Kandungan (SK)',
    sp: isPendidikanIslam ? 'ستندرد ڤمبلاجرن' : 'Standard Pembelajaran (SP)',
    core: isPendidikanIslam ? 'نيلاي / كماهيرن / ترس' : 'Nilai / Kemahiran / Teras',
    objective: isPendidikanIslam ? 'اوبجيكتيف ڤمبلاجرن' : 'Objektif Pembelajaran',
    activities: isPendidikanIslam ? 'اكتيويتي ڤڠاجرن' : 'Aktiviti PdP',
    bbm: isPendidikanIslam ? 'باهن بنتو مڠاجر' : 'BBM',
    reflection: isPendidikanIslam ? 'ريفليك‌سي' : 'Refleksi',
    saveDraft: isPendidikanIslam ? 'سيمڤن' : 'Simpan',
    preview: isPendidikanIslam ? 'ڤراتينجاو' : 'Preview RPH',
    generateAI: isPendidikanIslam ? 'جانا ا.ءي.' : 'Jana AI',
    jawiBtn: isPendidikanIslam ? 'جاوي' : 'JAWI',
    syncSchedule: isPendidikanIslam ? 'امبيل دري جدول' : 'Sync dari Jadual'
  };

  return (
    <div className={embedded ? "relative text-left" : "max-w-5xl mx-auto pb-10 animate-fadeIn relative text-left"}>
      <div className={embedded ? "relative" : "bg-white rounded-[2rem] premium-shadow border border-slate-100 p-5 sm:p-8 md:p-10 relative overflow-hidden"}>
        {!embedded && <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none rotate-12"><Book size={200} /></div>}
        
        {!embedded && <div className={`flex justify-between items-center mb-6 sm:mb-8 relative z-10 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
          <div className={isPendidikanIslam ? 'text-right' : ''}>
            <h2 className={`text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight ${isPendidikanIslam ? 'font-jawi' : ''}`}>
              {labels.title}
            </h2>
            <p className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Portal Digital Warga SSEMJ</p>
          </div>
          <button onClick={onCancel} className="p-2 sm:p-3 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>}

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10" dir={isPendidikanIslam ? 'rtl' : 'ltr'}>
          {/* Header Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 sm:p-6 rounded-2xl border border-slate-100">
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}>
                <Calendar size={12} className="text-blue-600" /> {labels.weekDate}
              </label>
              {embedded ? (
                // Mod mingguan: minggu & tarikh dikawal oleh tab hari (ikut kalendar)
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                  M{formData.week} · {formData.day}, {formData.date ? new Date(formData.date + 'T12:00:00').toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </div>
              ) : (
              <div className="flex gap-2">
                <select className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={Number(formData.week ?? 1)} onChange={e => handleFieldChange('week', parseInt(e.target.value))}>
                  {WEEKS.map(w => (
                    <option key={w} value={w}>
                      M{w}{filledWeeks.has(w) ? ' .' : ''}
                    </option>
                  ))}
                </select>
                <input type="date" className="flex-[2] p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.date} onChange={e => handleFieldChange('date', e.target.value)} />
              </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}>
                <Clock size={12} className="text-blue-600" /> {labels.timeSlot}
              </label>
              <div className="flex items-center gap-2">
                <input type="time" className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.startTime} onChange={e => handleFieldChange('startTime', e.target.value)} />
                <span className={`text-slate-300 font-black text-[10px] ${isPendidikanIslam ? 'font-jawi text-sm' : ''}`}>{labels.to}</span>
                <input type="time" className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.endTime} onChange={e => handleFieldChange('endTime', e.target.value)} />
                <div className="flex bg-slate-200/50 p-1 rounded-lg ml-2">
                  {LANGUAGES.map(l => (
                    <button key={l.value} type="button" onClick={() => handleFieldChange('language', l.value)} className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${formData.language === l.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      {l.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Sync from Schedule */}
          {!embedded && scheduleSlots.length > 0 && (
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className={`flex items-center justify-between ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
                  <LayoutGrid size={14} className="text-indigo-600" />
                  <span className={`text-[9px] font-black text-indigo-400 uppercase tracking-widest ${isPendidikanIslam ? 'font-jawi text-sm' : ''}`}>{labels.syncSchedule}</span>
                </div>
                <span className="text-[8px] font-bold text-indigo-300 uppercase">Pilihan Pantas</span>
              </div>
              <div className={`flex flex-wrap gap-2 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
                {scheduleSlots.slice(0, 5).map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        subject: slot.subject,
                        className: slot.className,
                        classTitle: slot.classTitle,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        day: slot.day,
                        title: '',
                        field: '',
                        sk: '',
                        sp: '',
                        core: ''
                      }));
                      setSelectedSKs([]);
                      setSelectedSPs([]);
                    }}
                    className="px-3 py-2 bg-white border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:bg-white"></div>
                    {slot.subject} ({slot.classTitle})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Curriculum Selection Section */}
          <div className="space-y-4">
            <div className={`flex items-center gap-2 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
              <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
              <h3 className={`text-sm font-black text-slate-900 uppercase tracking-tight ${isPendidikanIslam ? 'font-jawi text-xl' : ''}`}>{labels.curriculum}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{labels.subject}</label>
                <select className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-extrabold text-xs outline-none" value={String(formData.subject ?? '')} onChange={e => handleFieldChange('subject', e.target.value)}>
                  <option value="">Pilih Subjek</option>
                  {masterData.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{labels.form}</label>
                <select className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-extrabold text-xs outline-none disabled:opacity-30" disabled={!formData.subject} value={String(formData.className ?? '')} onChange={e => pickFree(e.target.value, 'Tingkatan', v => handleFieldChange('className', v))}>
                  <option value="">Pilih Tingkatan</option>
                  {Array.from(new Set([...(isPengurusan ? ['GURU'] : []), ...(formData.className ? [formData.className] : []), ...availableForms])).map(f => <option key={f} value={f}>{f}</option>)}
                  <option value={CUSTOM}>✎ Taip sendiri...</option>
                </select>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-blue-600 uppercase ml-1 tracking-widest ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{labels.className}</label>
                <select className="w-full p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl font-black text-xs outline-none" disabled={!formData.className} value={String(formData.classTitle ?? '')} onChange={e => pickFree(e.target.value, 'Nama Kelas', v => handleFieldChange('classTitle', v))}>
                  <option value="">Pilih Nama Kelas</option>
                  {Array.from(new Set([...(isPengurusan ? ['GURU'] : []), ...(formData.classTitle ? [formData.classTitle] : []), ...availableClassTitles])).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                  <option value={CUSTOM}>✎ Taip sendiri...</option>
                </select>
               </div>
            </div>

            {/* Tema > Bidang/Skill > Tajuk — pilihan bebas (tidak berkait) */}
            <div className={`grid grid-cols-1 gap-4 ${availableThemes.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
               {availableThemes.length > 0 && (
               <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2"><Layers size={12}/> Tema</label>
                <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" disabled={!formData.className}
                  value={curTema} onChange={e => pickFree(e.target.value, 'Tema', v => handleFieldChange('field', joinField(v, curBidang)))}>
                  <option value="">Pilih Tema</option>
                  {availableThemes.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value={CUSTOM}>✎ Taip sendiri...</option>
                </select>
               </div>
               )}
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Layers size={12}/> {availableThemes.length > 0 ? 'Bidang / Skill' : labels.field}</label>
                <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" disabled={!formData.className}
                  value={curBidang} onChange={e => pickFree(e.target.value, 'Bidang', v => handleFieldChange('field', joinField(curTema, v)))}>
                  <option value="">Pilih Bidang</option>
                  {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                  <option value={CUSTOM}>✎ Taip sendiri...</option>
                </select>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Edit3 size={12}/> {labels.pdpTitle}</label>
                <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" disabled={!formData.className}
                  value={String(formData.title ?? '')} onChange={e => pickFree(e.target.value, 'Tajuk', v => handleFieldChange('title', v))}>
                  <option value="">Pilih Tajuk</option>
                  {isPengurusan ? (<>
                    {formData.title && !MGMT_TAJUK.includes(formData.title) && <option value={formData.title}>{formData.title}</option>}
                    {MGMT_TAJUK.map((t, i) => <option key={t} value={t}>{i + 1}) {t}</option>)}
                    <option value={CUSTOM}>{MGMT_TAJUK.length + 1}) LAIN-LAIN (TAIP SENDIRI)</option>
                  </>) : (<>
                    {availableTitles.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value={CUSTOM}>✎ Taip sendiri...</option>
                  </>)}
                </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Target size={12}/> {labels.sk}</label>
                <div className="space-y-2">
                  {/* Langkah 1: pilih kumpulan (1.0, 2.0 ...) — Langkah 2: pilih butiran (2.1, 2.2 ...) */}
                  {!isPengurusan && skGroups.length > 1 && (
                    <select
                      className="w-full p-3 bg-blue-50/60 border border-blue-100 rounded-xl font-bold text-[11px] outline-none"
                      disabled={!formData.className}
                      value={skGroup}
                      onChange={e => setSkGroup(e.target.value)}
                    >
                      <option value="">Semua kumpulan SK</option>
                      {skGroups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                    </select>
                  )}
                  <select 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-[11px] outline-none" 
                    disabled={!formData.className} 
                    value="" 
                    onChange={e => pickFree(e.target.value, isPengurusan ? 'aktiviti pengurusan' : 'Standard Kandungan (SK)', isPengurusan ? addMgmtSk : handleAddSK)}
                  >
                    {isPengurusan ? (<>
                      <option value="">{mgmtLoading ? 'AI sedang menjana huraian...' : 'Pilih aktiviti pengurusan (boleh lebih dari satu)'}</option>
                      {MGMT_SK.map((sk, i) => <option key={sk} value={sk} disabled={selectedSKs.includes(sk)}>{i + 1}) {sk}</option>)}
                      <option value={CUSTOM}>{MGMT_SK.length + 1}) LAIN-LAIN (TAIP SENDIRI)</option>
                    </>) : (<>
                    <option value="">{skGroup ? `Pilih SK ${skGroup === 'Lain' ? '' : skGroup + '.x'}` : 'Pilih SK (Boleh pilih lebih dari satu)'}</option>
                    {availableSKs.filter(sk => !skGroup || skGroupKey(sk) === skGroup).map(sk => <option key={sk} value={sk}>{sk}</option>)}
                    <option value={CUSTOM}>✎ Taip sendiri...</option>
                    </>)}
                  </select>
                  
                  {selectedSKs.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      {selectedSKs.map(sk => (
                        <div key={sk} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                          <span className="text-[10px] font-bold text-slate-700">{sk}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSK(sk)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Activity size={12}/> {labels.sp}</label>
                <div className="space-y-2">
                  <select 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-[11px] outline-none" 
                    disabled={!formData.className} 
                    value="" 
                    onChange={e => pickFree(e.target.value, 'Standard Pembelajaran (SP)', handleAddSP)}
                  >
                    <option value="">{selectedSKs.length ? 'Pilih SP (Boleh pilih lebih dari satu)' : 'Pilih SK dahulu, atau taip SP sendiri'}</option>
                    {/* SP dikumpul ikut SK yang dipilih (cth 2.1 → 2.1.1, 2.1.2 ...) */}
                    {isPengurusan && selectedSKs.filter(sk => mgmtSp[sk]).map(sk => (
                      <optgroup key={sk} label={sk}><option value={mgmtSp[sk]}>{mgmtSp[sk]}</option></optgroup>
                    ))}
                    {!isPengurusan && selectedSKs.map(sk => {
                      const sps = Object.keys(formOpts.skIndex[sk] || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                      return sps.length ? (
                        <optgroup key={sk} label={sk}>
                          {sps.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                        </optgroup>
                      ) : null;
                    })}
                    <option value={CUSTOM}>✎ Taip sendiri...</option>
                  </select>
                  
                  {selectedSPs.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      {selectedSPs.map(sp => (
                        <div key={sp} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                          <span className="text-[10px] font-bold text-slate-700">{sp}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSP(sp)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
               </div>
            </div>

            <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg hidden sm:block"><Info size={16} /></div>
              <div className="flex-1">
                <p className={`text-[8px] font-black uppercase tracking-widest text-blue-100 ${isPendidikanIslam ? 'font-jawi text-lg text-right' : ''}`}>{labels.core}</p>
                <p className={`text-xs sm:text-sm font-black italic ${isPendidikanIslam ? 'text-right' : ''}`}>{formData.core || "Sila lengkapkan pilihan SP..."}</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button 
                  type="button" 
                  onClick={handleBulkAiGenerate} 
                  title="Jana dengan Gemini (konteks DSKP)"
                  disabled={loading} 
                  className="flex-1 sm:flex-none justify-center bg-white text-blue-600 px-4 py-3 sm:py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {labels.generateAI}
                </button>
                <button 
                  type="button" 
                  onClick={handleJawiConversion} 
                  disabled={loading || (!formData.objective && !formData.activities)} 
                  className="flex-1 sm:flex-none justify-center bg-blue-500 text-white px-4 py-3 sm:py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-400 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {labels.jawiBtn}
                </button>
              </div>
            </div>
          {matchedDskpRows.some(r => r.performance || r.notes) && (
            <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl space-y-2 text-xs text-slate-700">
              <p className="text-[9px] font-black uppercase tracking-widest text-violet-500 flex items-center gap-1"><Database size={12} /> Rujukan DSKP (digunakan oleh AI)</p>
              {matchedDskpRows.map((r, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="font-bold">{r.sp}</p>
                  {r.performance && <p><span className="font-semibold text-violet-600">TP:</span> {r.performance}</p>}
                  {r.notes && <p><span className="font-semibold text-violet-600">Catatan:</span> {r.notes}</p>}
                </div>
              ))}
            </div>
          )}
          {getGeminiKey() && (
            <input
              value={aiExtraNotes}
              onChange={e => setAiExtraNotes(e.target.value)}
              placeholder="Arahan tambahan untuk AI (pilihan) — cth: guna kaedah stesen, murid lemah, ada projektor"
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100"
            />
          )}
          </div>

          {/* AI Content Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><PenTool size={12}/> {labels.objective}</label>
              <textarea rows={4} dir={isJawiUI ? "rtl" : "ltr"} className={`w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none leading-relaxed ${isJawiUI ? 'font-jawi text-2xl' : ''}`} value={formData.objective || ''} onChange={e => handleFieldChange('objective', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Activity size={12}/> {labels.activities}</label>
              <div className="relative">
                <textarea 
                  rows={4} 
                  dir={isJawiUI ? "rtl" : "ltr"}
                  className={`w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none leading-relaxed ${isJawiUI ? 'font-jawi text-2xl' : ''}`} 
                  value={formData.activities || ''} 
                  onChange={e => handleFieldChange('activities', e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Layers size={12}/> {labels.bbm}</label>
              <div className="space-y-2">
                <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={String(formData.bbm ?? '')} onChange={e => handleFieldChange('bbm', e.target.value)}>
                  {bbmOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {formData.bbm === 'Lain-lain (nyatakan)' && (
                  <input type="text" className={`w-full p-3 bg-blue-50/50 border border-blue-100 rounded-xl font-bold text-xs outline-none ${isJawiUI ? 'font-jawi text-xl' : ''}`} placeholder="Nyatakan BBM..." value={customBbm} onChange={e => setCustomBbm(e.target.value)} />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><MessageSquare size={12}/> {labels.reflection}</label>
              <textarea rows={3} dir={isJawiUI ? "rtl" : "ltr"} className={`w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none leading-relaxed ${isJawiUI ? 'font-jawi text-2xl' : ''}`} value={formData.reflection || ''} onChange={e => handleFieldChange('reflection', e.target.value)} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
            <motion.button 
              type="button" 
              onClick={() => handleSaveDraft('close')} 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={draftSaved}
              className={`flex-[2] py-4 rounded-xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                draftSaved ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              <AnimatePresence mode="wait">
                {draftSaved ? (
                  <motion.div 
                    key="saved"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle size={22} className="text-white" />
                    <span>Draf Disimpan!</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="save"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle size={18} /> {labels.saveDraft}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {draftSaved && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 4, opacity: 0.2 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-white rounded-full"
                />
              )}
            </motion.button>
            {embedded && (
              <button
                type="button"
                onClick={() => handleSaveDraft('next')}
                disabled={draftSaved}
                className="flex-1 py-4 rounded-xl font-black text-sm border-2 border-emerald-500 text-emerald-700 bg-white hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                title="Simpan dan terus isi slot seterusnya tanpa keluar"
              >
                <CheckCircle size={16} /> Simpan &amp; Slot Seterusnya
              </button>
            )}
            <motion.button 
              type="button" 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPreview(true)} 
              className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <Eye size={16} /> {labels.preview}
            </motion.button>
          </div>
        </form>
      </div>

      {showPreview && (
        <ERPHPreview 
          erphs={[{ ...formData, bbm: formData.bbm === 'Lain-lain (nyatakan)' ? customBbm : (formData.bbm || '') } as ERPHData]} 
          onBack={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
};

export default ERPHForm;