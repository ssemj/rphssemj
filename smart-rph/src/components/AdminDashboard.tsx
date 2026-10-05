
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { UserProfile, ERPHData, WeeklyBundle, MasterData, ERPHStatus, Resource } from '../types';
import { 
  Users, FileText, CheckCircle2, Clock, Search, RefreshCw, Settings, 
  ShieldCheck, AlertCircle, Eye, ArrowUpRight, Download, ChevronRight, Info,
  LogOut, Loader2, X, MessageSquare, ChevronLeft, Calendar, BookOpen, BarChart3, Mail, Database,
  LayoutGrid, Layers, UserCheck, MessageCircle
  , Image as ImageIcon
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import ERPHPreview from './ERPHPreview';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DATA_SOURCE_SHEET_URL } from '../constants';
import { ExternalLink } from 'lucide-react';

import ReviewForm from './ReviewForm';
import ResourceCenter from './ResourceCenter';
import DSKPUploader from './DSKPUploader';
import AcademicCalendarSettings from './AcademicCalendarSettings';
import SchoolBrandingSettings from './SchoolBrandingSettings';

interface AdminDashboardProps {
  user: UserProfile;
  teachers: any[];
  erphs: ERPHData[];
  bundles: WeeklyBundle[];
  masterData: MasterData;
  setMasterData: (data: MasterData) => void;
  onReview: (id: string, status: ERPHStatus, comment: string, signature: string) => void;
  onReviewBundle: (bundleId: string, status: string, comment: string, signature: string, reviewedBy: string, reviewedPdfBase64?: string) => void;
  onSyncMaster: (data: MasterData) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  onLoginAsTeacher?: (teacher: any) => void;
  onAddResource?: (resource: Omit<Resource, 'id' | 'uploadedAt'>) => void;
  onDeleteResource?: (id: string) => void;
  onDskpUpdated?: () => void;
  onCalendarUpdated?: () => void;
}

const UTILITY_MENUS = [
  { id: 'TAKWIM', label: 'Takwim', icon: Calendar, color: 'bg-blue-600' },
  { id: 'RPT', label: 'RPT', icon: BookOpen, color: 'bg-indigo-600' },
  { id: 'DSKP_COLL', label: 'DSKP', icon: Layers, color: 'bg-violet-600' },
  { id: 'UPLOAD_DSKP', label: 'Muat Naik DSKP', icon: Database, color: 'bg-emerald-600' },
  { id: 'KALENDAR', label: 'Kalendar Akademik', icon: Calendar, color: 'bg-sky-600' },
  { id: 'LOGO', label: 'Logo Sekolah', icon: ImageIcon, color: 'bg-indigo-600' },
  { id: 'ANALYSIS', label: 'Analisis', icon: BarChart3, color: 'bg-purple-600' },
  { id: 'SCHEDULE', label: 'Jadual', icon: LayoutGrid, color: 'bg-fuchsia-600' },
  { id: 'CHAT', label: 'Notifikasi', icon: MessageCircle, color: 'bg-pink-600' },
  { id: 'REKOD_PENCERAPAN', label: 'Pencerapan', icon: UserCheck, color: 'bg-emerald-600' },
];

const extractWeekNumber = (weekStr: string): number => {
  const match = weekStr.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

const NextMondayPreview: React.FC<{ 
  teacherId: string; 
  currentWeek: number; 
  erphs: ERPHData[];
  onPreview: (erphs: ERPHData[]) => void;
}> = ({ teacherId, currentWeek, erphs, onPreview }) => {
  const nextWeek = currentWeek + 1;
  const nextMondayErphs = erphs.filter(e => 
    String(e.teacherId).trim().toLowerCase() === String(teacherId).trim().toLowerCase() && 
    Number(e.week) === nextWeek && 
    (String(e.day).toLowerCase() === 'isnin' || String(e.day).toLowerCase() === 'monday')
  );

  if (nextMondayErphs.length === 0) {
    return (
      <div className="p-6 bg-rose-50 rounded-3xl border-2 border-rose-100 flex items-center gap-4">
        <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
          <AlertCircle size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Amaran Persediaan</p>
          <p className="text-xs font-bold text-rose-900">Draf RPH Isnin Hadapan (Minggu {nextWeek}) belum disediakan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-indigo-50 rounded-3xl border-2 border-indigo-100 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest">Persediaan Isnin Hadapan</h3>
            <p className="text-xs font-bold text-indigo-900">Minggu {nextWeek}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onPreview(nextMondayErphs)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Eye size={12} /> Lihat Semua
          </button>
          <span className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest">Draf Sedia</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {nextMondayErphs.map(e => (
          <div 
            key={e.id} 
            onClick={() => onPreview([e])}
            className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm hover:border-indigo-400 cursor-pointer transition-all group"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[9px] font-black text-slate-900 uppercase truncate max-w-[120px] group-hover:text-indigo-600">{e.subject}</span>
              <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">{e.startTime}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-600 line-clamp-1">{e.title || 'Tiada Tajuk'}</p>
            <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{e.className}</span>
              <div className="flex items-center gap-2">
                <span className="text-[7px] font-black text-indigo-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Klik untuk baca</span>
                {e.status === ERPHStatus.SELESAI ? (
                  <CheckCircle2 size={12} className="text-emerald-500" />
                ) : (
                  <Clock size={12} className="text-amber-500" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeacherInfoCard: React.FC<{ teacher: any; bundles: WeeklyBundle[]; onBack: () => void; onLoginAsTeacher?: (teacher: any) => void }> = ({ teacher, bundles, onBack, onLoginAsTeacher }) => {
  const teacherBundles = bundles.filter(b => 
    (String(b.teacherId || "").trim().toLowerCase() === String(teacher.id || "").trim().toLowerCase()) ||
    (String(b.teacherName || "").trim().toLowerCase() === String(teacher.name || "").trim().toLowerCase())
  );
  const pending = teacherBundles.filter(b => b.status_proses !== 'DISEMAK');
  const reviewed = teacherBundles.filter(b => b.status_proses === 'DISEMAK');

  return (
    <div className="bg-white rounded-[2.5rem] border-2 border-indigo-100 p-8 animate-fadeIn space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {teacher.photoUrl && teacher.photoUrl.trim() !== "" ? (
            <img 
              src={teacher.photoUrl} 
              className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-lg" 
              alt={teacher.name} 
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'U')}&background=random`; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-2xl">
              {(teacher.name || 'U').charAt(0)}
            </div>
          )}
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{teacher.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-1">
              <Mail size={12} /> {teacher.email || 'Tiada Email'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onLoginAsTeacher && (
            <button 
              onClick={() => onLoginAsTeacher(teacher)} 
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
              title="Log Masuk Sebagai Guru Ini"
            >
              <Users size={14} /> Log Masuk
            </button>
          )}
          <button onClick={onBack} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-all">
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div className="bg-slate-50/70 p-4 rounded-2xl">
          <p className="text-3xl font-black text-slate-900">{teacherBundles.length}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Jumlah Hantaran</p>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl">
          <p className="text-3xl font-black text-amber-600">{pending.length}</p>
          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Menunggu</p>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl">
          <p className="text-3xl font-black text-emerald-600">{reviewed.length}</p>
          <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Disemak</p>
        </div>
      </div>

      <div>
        <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-3">Sejarah Hantaran</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
          {teacherBundles.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(b => (
            <div key={b.id_minggu} className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
              <div>
                <p className="text-[10px] font-bold text-indigo-600 uppercase">{b.week}</p>
                <p className="text-[9px] font-medium text-slate-400">{new Date(b.timestamp).toLocaleDateString('ms-MY')}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${b.status_proses === 'DISEMAK' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                {b.status_proses}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, teachers, erphs, bundles, masterData, setMasterData, onReview, onReviewBundle, onSyncMaster, onRefresh, onLogout, onNavigate, onLoginAsTeacher, onAddResource, onDeleteResource, onDskpUpdated, onCalendarUpdated
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeResView, setActiveResView] = useState<string | null>(null);
  const dskpPanelRef = useRef<HTMLDivElement>(null);
  // Skrol ke panel Muat Naik DSKP sekali sahaja bila ia dibuka
  useEffect(() => {
    if (activeResView === 'UPLOAD_DSKP' || activeResView === 'KALENDAR' || activeResView === 'LOGO') {
      setTimeout(() => dskpPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [activeResView]);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [reviewingBundle, setReviewingBundle] = useState<WeeklyBundle | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSignature, setReviewSignature] = useState('');
  const [reviewerInfo, setReviewerInfo] = useState({ name: user.name, designation: user.designation });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkSignature, setBulkSignature] = useState('');
  const [bulkReviewerInfo, setBulkReviewerInfo] = useState({ name: user.name, designation: user.designation });
  const [bulkActiveBundle, setBulkActiveBundle] = useState<WeeklyBundle | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const handleReviewerInfoChange = useCallback((name: string, designation: string) => {
    setReviewerInfo({ name, designation });
  }, []);

  const handleBulkReviewerInfoChange = useCallback((name: string, designation: string) => {
    setBulkReviewerInfo({ name, designation });
  }, []);

  const getBundleRPHs = useCallback((bundle: WeeklyBundle, comment: string, signature: string, reviewerName: string, reviewerDesignation?: string) => {
    try {
      let rphIds: string[] = [];
      if (typeof bundle.rphIds === 'string') {
        try {
          rphIds = JSON.parse(bundle.rphIds || "[]");
        } catch (e) {
          // Fallback if it's a comma-separated string
          rphIds = bundle.rphIds.split(',').map(id => id.trim());
        }
      } else if (Array.isArray(bundle.rphIds)) {
        rphIds = bundle.rphIds;
      }
      
      rphIds = rphIds.map(String);
      
      let filtered = erphs.filter(e => rphIds.includes(String(e.id))).map(e => ({
        ...e,
        status: ERPHStatus.REVIEWED,
        reviewComment: comment,
        reviewSignature: signature,
        reviewedBy: reviewerName,
        reviewerDesignation: reviewerDesignation,
        reviewedAt: new Date().toISOString()
      }));
      
      // Fallback if rphIds parsing failed or returned empty
      if (filtered.length === 0 && bundle.week) {
        const weekMatch = String(bundle.week).match(/\d+/);
        const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : null;
        
        if (weekNum !== null) {
          filtered = erphs.filter(e => {
            const eWeekMatch = String(e.week).match(/\d+/);
            const eWeekNum = eWeekMatch ? parseInt(eWeekMatch[0], 10) : null;
            return (
              (bundle.teacherId && String(e.teacherId).trim() === String(bundle.teacherId).trim()) || 
              (bundle.teacherName && String(e.teacherName || "").trim().toLowerCase() === String(bundle.teacherName).trim().toLowerCase())
            ) && eWeekNum === weekNum;
          }).map(e => ({
            ...e,
            status: ERPHStatus.REVIEWED,
            reviewComment: comment,
            reviewSignature: signature,
            reviewedBy: reviewerName,
            reviewerDesignation: reviewerDesignation,
            reviewedAt: new Date().toISOString()
          }));
          console.log(`[getBundleRPHs] Fallback matched ${filtered.length} RPHs by teacher and week.`);
        }
      }
      
      console.log(`[getBundleRPHs] Found ${filtered.length} RPHs for bundle ${bundle.id_minggu}`);
      return filtered;
    } catch (e) {
      console.error("[getBundleRPHs] Error:", e);
      return [];
    }
  }, [erphs]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [extraPreviewErphs, setExtraPreviewErphs] = useState<ERPHData[] | null>(null);
  
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    return {
      totalTeachers: teachers.length,
      pendingReviews: bundles.filter(b => b.status_proses !== 'DISEMAK' && (!b.linkPdfSelesai || b.linkPdfSelesai.trim() === "")).length,
      totalErphs: erphs.length,
      completedReviews: bundles.filter(b => b.status_proses === 'DISEMAK' || (b.linkPdfSelesai && b.linkPdfSelesai.trim() !== "")).length
    };
  }, [teachers, bundles, erphs]);

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedTeachers = useMemo(() => {
    const groups: Record<string, typeof filteredTeachers> = {};
    filteredTeachers.forEach(teacher => {
      const dept = teacher.department || 'Lain-lain';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(teacher);
    });
    return groups;
  }, [filteredTeachers]);

  const bundleRPHs = useMemo(() => {
    if (!reviewingBundle) return [];
    try {
      let rphIds: string[] = [];
      if (typeof reviewingBundle.rphIds === 'string') {
        try {
          rphIds = JSON.parse(reviewingBundle.rphIds || "[]");
        } catch (e) {
          rphIds = reviewingBundle.rphIds.split(',').map(id => id.trim());
        }
      } else if (Array.isArray(reviewingBundle.rphIds)) {
        rphIds = reviewingBundle.rphIds;
      }
      
      rphIds = rphIds.map(String);
      
      let filtered = erphs.filter(e => rphIds.includes(String(e.id))).map(e => ({
        ...e,
        status: ERPHStatus.REVIEWED,
        reviewComment: reviewComment,
        reviewSignature: reviewSignature,
        reviewedBy: user.name
      }));
      
      // Fallback if rphIds parsing failed or returned empty
      if (filtered.length === 0 && reviewingBundle.week) {
        const weekMatch = String(reviewingBundle.week).match(/\d+/);
        const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : null;
        
        if (weekNum !== null) {
          filtered = erphs.filter(e => {
            const eWeekMatch = String(e.week).match(/\d+/);
            const eWeekNum = eWeekMatch ? parseInt(eWeekMatch[0], 10) : null;
            return (
              (reviewingBundle.teacherId && String(e.teacherId).trim() === String(reviewingBundle.teacherId).trim()) || 
              (reviewingBundle.teacherName && String(e.teacherName || "").trim().toLowerCase() === String(reviewingBundle.teacherName).trim().toLowerCase())
            ) && eWeekNum === weekNum;
          }).map(e => ({
            ...e,
            status: ERPHStatus.REVIEWED,
            reviewComment: reviewComment,
            reviewSignature: reviewSignature,
            reviewedBy: user.name
          }));
          console.log(`[bundleRPHs] Fallback matched ${filtered.length} RPHs by teacher and week.`);
        }
      }
      
      console.log(`[bundleRPHs] Found ${filtered.length} RPHs for reviewingBundle ${reviewingBundle.id_minggu}`);
      return filtered;
    } catch (e) {
      console.error("[bundleRPHs] Error:", e);
      return [];
    }
  }, [reviewingBundle, erphs, reviewComment, reviewSignature, user.name]);

  const generateRasmiPDF = async (signatureData: string, bundleToUse?: WeeklyBundle, commentToUse?: string, reviewerToUse?: {name: string, designation: string}): Promise<string> => {
    const activeBundle = bundleToUse || reviewingBundle;
    const activeComment = commentToUse || reviewComment;
    const activeReviewer = reviewerToUse || reviewerInfo;

    if (!hiddenPreviewRef.current || !activeBundle) {
      console.error("Missing preview ref or active bundle");
      return "";
    }

    // Give more time for images and styles to settle, especially in bulk
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const a4Width = pdf.internal.pageSize.getWidth();
    const a4Height = pdf.internal.pageSize.getHeight();
    const targetWidth = a4Width * 0.95;

    const rphElements = Array.from(hiddenPreviewRef.current.querySelectorAll('.a4-page'));
    if (rphElements.length === 0) {
      console.error("No RPH elements found in preview");
      return "";
    }

    for (let i = 0; i < rphElements.length; i++) {
      const element = rphElements[i] as HTMLElement;
      
      // Ensure element is visible for capture
      element.style.display = 'block';
      
      try {
        const canvas = await html2canvas(element, {
          scale: 1.2, // Optimized for size
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.6); // Optimized for size
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.height / imgProps.width;
        const targetHeight = targetWidth * ratio;

        const xOffset = (a4Width - targetWidth) / 2;
        let finalHeight = targetHeight;
        if (targetHeight > a4Height * 0.95) {
          finalHeight = a4Height * 0.95;
        }
        const yOffset = (a4Height - finalHeight) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, targetWidth, finalHeight);
      } catch (canvasError) {
        console.error(`Error rendering page ${i + 1} with html2canvas:`, canvasError);
      }
      
      // Small break to prevent UI freeze
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const dataUri = pdf.output('datauristring');
    return dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
  };

  const handleReviewSubmit = async () => {
    const currentSignature = reviewSignature;
    if (!reviewingBundle || !currentSignature || currentSignature.trim() === "") {
      showNotification("Tandatangan digital diperlukan. Sila lukis atau muat naik tandatangan anda sebelum mengesahkan.", 'error');
      return;
    }
    
    if (bundleRPHs.length === 0) {
      showNotification("Tiada data RPH ditemui untuk hantaran ini. Sila pastikan RPH belum dipadam atau cuba muat semula (refresh) halaman.", 'error');
      return;
    }
    
    setIsSubmittingReview(true);
    console.log("Starting review submission...");
    try {
      console.log("Generating PDF on frontend with extreme compression...");
      const rasmiPdfBase64 = await generateRasmiPDF(currentSignature);
      
      if (!rasmiPdfBase64 || rasmiPdfBase64.length < 1000) {
        throw new Error("PDF generation failed or result too small");
      }
      
      const pdfSize = Math.round(rasmiPdfBase64.length / 1024);
      console.log(`PDF generated successfully. Size: ${pdfSize}KB. Sending to server...`);
      
      await onReviewBundle(
        reviewingBundle.id_minggu, 
        "DISEMAK", 
        reviewComment, 
        currentSignature,
        reviewerInfo.name,
        rasmiPdfBase64
      );
      
      console.log("Review submitted successfully.");
      showNotification("✅ Semakan telah berjaya disahkan!", 'success');
      setReviewingBundle(null);
      setReviewComment('');
      setReviewSignature('');
    } catch (error) {
      console.error("Review failed:", error);
      showNotification("Gagal mengesahkan semakan. Sila cuba lagi. Ralat: " + (error instanceof Error ? error.message : String(error)), 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const startBulkReview = async () => {
    setShowBulkConfirm(false);
    setIsBulkReviewing(true);
    setBulkProgress({ current: 0, total: selectedBundleIds.length });
    
    try {
      for (let i = 0; i < selectedBundleIds.length; i++) {
        setBulkProgress({ current: i + 1, total: selectedBundleIds.length });
        
        const id = selectedBundleIds[i];
        const bundle = bundles.find(b => b.id_minggu === id);
        if (!bundle) continue;

        // 1. Set as active bulk bundle to trigger hidden preview render
        setBulkActiveBundle(bundle);
        
        // 2. Wait for React to update the DOM (crucial for html2canvas)
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          console.log(`[BULK] Memproses hantaran ${i+1}/${selectedBundleIds.length}: ${bundle.teacherName}`);
          
          // 3. Generate PDF using the bulk data
          const rasmiPdfBase64 = await generateRasmiPDF(
            bulkSignature, 
            bundle, 
            bulkComment || "Disemak dan disahkan secara pukal.",
            bulkReviewerInfo
          );

          if (!rasmiPdfBase64 || rasmiPdfBase64.length < 1000) {
            console.error(`[BULK] Gagal menjana PDF untuk ${bundle.teacherName}: PDF kosong atau terlalu kecil`);
            throw new Error("PDF generation failed or result too small");
          }
          
          const pdfSize = Math.round(rasmiPdfBase64.length / 1024);
          console.log(`[BULK] PDF berjaya dijana untuk ${bundle.teacherName} (Saiz: ${pdfSize}KB), menghantar ke GAS...`);

          // 4. Submit to server
          await onReviewBundle(
            id,
            "DISEMAK",
            bulkComment || "Disemak dan disahkan secara pukal.",
            bulkSignature,
            bulkReviewerInfo.name,
            rasmiPdfBase64
          );
          
          console.log(`[BULK] Data ulasan berjaya dihantar untuk ${bundle.teacherName}, menghantar ke GAS...`);
          
          // 5. Wait 8 seconds before processing the next item to give GAS time to finish
          if (i < selectedBundleIds.length - 1) {
            console.log(`[BULK] Menunggu 8 saat sebelum memproses hantaran seterusnya...`);
            await new Promise(resolve => setTimeout(resolve, 8000));
          }
        } catch (err) {
          console.error(`Error processing bundle ${id}:`, err);
          showNotification(`Ralat semasa memproses ${bundle.teacherName}. Sistem akan teruskan dengan yang lain.`, 'error');
        }
      }

      showNotification(`✅ Berjaya mengesahkan ${selectedBundleIds.length} hantaran dengan penjanaan PDF lengkap.`, 'success');
      setShowBulkModal(false);
      setSelectedBundleIds([]);
      setBulkComment('');
      setBulkSignature('');
      setBulkActiveBundle(null);
    } catch (error) {
      console.error("Bulk review failed:", error);
      showNotification("Gagal mengesahkan semakan pukal. Sila cuba lagi.", 'error');
    } finally {
      setIsBulkReviewing(false);
      setBulkActiveBundle(null);
    }
  };

  const handleBulkReview = async () => {
    if (selectedBundleIds.length === 0) {
      showNotification("Sila pilih sekurang-kurangnya satu hantaran untuk disemak.", 'error');
      return;
    }

    if (!bulkSignature || bulkSignature.trim() === "") {
      showNotification("Tandatangan digital diperlukan untuk pengesahan pukal.", 'error');
      return;
    }

    setShowBulkConfirm(true);
  };

  const pendingBundles = useMemo(() => {
    return bundles.filter(b => b.status_proses !== 'DISEMAK' && (!b.linkPdfSelesai || b.linkPdfSelesai.trim() === ""));
  }, [bundles]);

  const groupedPendingBundles = useMemo(() => {
    const groups: Record<string, typeof pendingBundles> = {};
    pendingBundles.forEach(bundle => {
      const teacher = teachers.find(t => t.name.trim().toLowerCase() === bundle.teacherName.trim().toLowerCase());
      const dept = teacher?.department || 'Lain-lain';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(bundle);
    });
    return groups;
  }, [pendingBundles, teachers]);

  const handleSync = async () => {
    setIsSyncing(true);
    await onRefresh();
    setIsSyncing(false);
  };

  const sortedReviewedBundles = useMemo(() => {
    return bundles
      .filter(b => b.status_proses === 'DISEMAK' || (b.linkPdfSelesai && b.linkPdfSelesai.trim() !== ""))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [bundles]);

  const reviewedByTeacher = useMemo(() => {
    const groups: Record<string, WeeklyBundle[]> = {};
    sortedReviewedBundles.forEach(bundle => {
      const name = bundle.teacherName;
      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(bundle);
    });
    return groups;
  }, [sortedReviewedBundles]);

  return (
    <div className="space-y-10 md:space-y-16 animate-fadeIn pb-24">
      {/* ... (keep existing modals: Bulk Review, Hidden Preview, Preview Modal) ... */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-slideUp">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Semakan Pukal</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sahkan beberapa hantaran serentak</p>
              </div>
              <button 
                onClick={() => !isBulkReviewing && setShowBulkModal(false)} 
                disabled={isBulkReviewing}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {/* Teacher Selection List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Pilih Guru ({selectedBundleIds.length})</h3>
                  <button 
                    onClick={() => {
                      if (selectedBundleIds.length === pendingBundles.length) setSelectedBundleIds([]);
                      else setSelectedBundleIds(pendingBundles.map(b => b.id_minggu));
                    }}
                    className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
                  >
                    {selectedBundleIds.length === pendingBundles.length ? 'Nyahpilih Semua' : 'Pilih Semua'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingBundles.map((bundle) => (
                    <label 
                      key={bundle.id_minggu} 
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedBundleIds.includes(bundle.id_minggu) ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedBundleIds.includes(bundle.id_minggu)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBundleIds([...selectedBundleIds, bundle.id_minggu]);
                          else setSelectedBundleIds(selectedBundleIds.filter(id => id !== bundle.id_minggu));
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-900 uppercase truncate">{bundle.teacherName}</p>
                        <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">{bundle.week}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100"></div>

              {/* Review Form */}
              <ReviewForm 
                user={user}
                reviewComment={bulkComment}
                setReviewComment={setBulkComment}
                reviewSignature={bulkSignature}
                setReviewSignature={setBulkSignature}
                onReviewerInfoChange={handleBulkReviewerInfoChange}
              />
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
              {isBulkReviewing && (
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-500 ease-out"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowBulkModal(false)}
                  disabled={isBulkReviewing}
                  className="flex-1 h-14 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={handleBulkReview}
                  disabled={isBulkReviewing || selectedBundleIds.length === 0}
                  className="flex-[2] h-14 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all"
                >
                  {isBulkReviewing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Memproses {bulkProgress.current}/{bulkProgress.total}...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Sahkan Secara Pukal ({selectedBundleIds.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={hiddenPreviewRef} className="absolute top-[-9999px] left-[-9999px] pointer-events-none bg-white z-[-1]" style={{ width: '210mm', minHeight: '297mm' }}>
        {(bulkActiveBundle || reviewingBundle) && (
          <div className="bg-white p-4">
            <ERPHPreview 
              erphs={bulkActiveBundle 
                ? getBundleRPHs(bulkActiveBundle, bulkComment || "Disemak dan disahkan secara pukal.", bulkSignature, bulkReviewerInfo.name, bulkReviewerInfo.designation) 
                : reviewingBundle 
                  ? getBundleRPHs(reviewingBundle, reviewComment, reviewSignature, reviewerInfo.name, reviewerInfo.designation)
                  : bundleRPHs} 
              onBack={() => {}} 
              hideModal={true} 
            />
          </div>
        )}
      </div>

      {showPreview && reviewingBundle && (
        <ERPHPreview 
          erphs={bundleRPHs} 
          onBack={() => setShowPreview(false)} 
        />
      )}

      {extraPreviewErphs && (
        <ERPHPreview 
          erphs={extraPreviewErphs} 
          onBack={() => setExtraPreviewErphs(null)} 
        />
      )}

      {/* ... (keep existing Header) ... */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Portal <span className="text-indigo-600">Pentadbir</span>
          </h1>
          <p className="text-slate-400 font-bold mt-1 text-[9px] md:text-[10px] uppercase tracking-widest">Sistem Pengurusan & Pemantauan eRPH SSEMJ</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
           <button 
             onClick={() => onNavigate('PENCERAPAN')}
             className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-100 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-indigo-100 transition-all shadow-sm w-full sm:w-auto"
           >
             <ShieldCheck size={16} /> Pencerapan
           </button>

           <button 
             onClick={() => onNavigate('MASTER_DATA_MANAGER')}
             className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg w-full sm:w-auto"
           >
             <Database size={16} /> Data Utama
           </button>

           <button 
             onClick={handleSync}
             disabled={isSyncing}
             className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
           >
             <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> Kemaskini Data
           </button>

           <button 
             onClick={onLogout}
             className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-red-600 transition-all shadow-lg"
           >
             <LogOut size={16} /> Keluar
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex flex-row md:flex-col items-center md:items-start gap-5 md:gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl w-fit shadow-inner"><Users size={24} /></div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Jumlah Guru</p>
            <p className="text-2xl md:text-5xl font-black text-slate-900">{stats.totalTeachers}</p>
          </div>
        </div>
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex flex-row md:flex-col items-center md:items-start gap-5 md:gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit shadow-inner"><Clock size={24} /></div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Menunggu Semakan</p>
            <p className="text-2xl md:text-5xl font-black text-slate-900">{stats.pendingReviews}</p>
          </div>
        </div>
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex flex-row md:flex-col items-center md:items-start gap-5 md:gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl w-fit shadow-inner"><FileText size={24} /></div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Jumlah RPH</p>
            <p className="text-2xl md:text-5xl font-black text-slate-900">{stats.totalErphs}</p>
          </div>
        </div>
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex flex-row md:flex-col items-center md:items-start gap-5 md:gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl w-fit shadow-inner"><CheckCircle2 size={24} /></div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Selesai Semak</p>
            <p className="text-2xl md:text-5xl font-black text-slate-900">{stats.completedReviews}</p>
          </div>
        </div>
      </div>

      {/* Utility Menus Grid */}
      <div className="space-y-6">
         <div className="flex items-center gap-3 px-1">
            <div className="w-2 h-6 md:h-10 bg-slate-900 rounded-full"></div>
            <h2 className="font-black text-slate-900 text-lg md:text-xl tracking-tight uppercase">Sumber & Utiliti</h2>
         </div>
         <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-6">
            {UTILITY_MENUS.map(menu => (
              <button 
                key={menu.id} 
                onClick={() => {
                  if (menu.id === 'ANALYSIS') {
                    onNavigate('ANALYSIS');
                  } else if (menu.id === 'CHAT') {
                    onNavigate('CHAT');
                  } else if (menu.id === 'SCHEDULE') {
                    onNavigate('TIMETABLE');
                  } else if (menu.id === 'REKOD_PENCERAPAN') {
                    onNavigate('REKOD_PENCERAPAN');
                  } else {
                    setActiveResView(activeResView === menu.id ? null : menu.id);
                  }
                }}
                className={`relative overflow-hidden p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[1.5rem] md:rounded-[2.5rem] flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4 transition-all hover:scale-105 active:scale-95 ${activeResView === menu.id ? 'bg-slate-900 text-white shadow-2xl' : 'bg-white premium-shadow border border-slate-100 text-slate-600'}`}
              >
                <div className={`p-2.5 sm:p-3 md:p-5 rounded-xl md:rounded-2xl ${activeResView === menu.id ? 'bg-white/10' : menu.color + ' text-white shadow-lg shadow-blue-100'}`}>
                  <menu.icon size={18} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </div>
                <span className="text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-tight leading-tight">{menu.label}</span>
              </button>
            ))}
         </div>

         {activeResView && activeResView !== 'UPLOAD_DSKP' && activeResView !== 'KALENDAR' && activeResView !== 'LOGO' && (
           <ResourceCenter 
             viewId={activeResView}
             label={UTILITY_MENUS.find(m => m.id === activeResView)?.label || ''}
             resources={masterData?.resources || []}
             user={user}
             teachers={teachers}
             onAdd={(res) => onAddResource?.(res)}
             onDelete={(id) => onDeleteResource?.(id)}
             onClose={() => setActiveResView(null)}
             isAdmin={true}
           />
         )}

         {activeResView === 'LOGO' && (
           <div className="relative scroll-mt-24" ref={dskpPanelRef}>
             <button onClick={() => setActiveResView(null)}
               className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 transition-all">
               <X size={20} />
             </button>
             <SchoolBrandingSettings />
           </div>
         )}

         {activeResView === 'KALENDAR' && (
           <div className="relative scroll-mt-24" ref={dskpPanelRef}>
             <button onClick={() => setActiveResView(null)}
               className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 transition-all">
               <X size={20} />
             </button>
             <AcademicCalendarSettings userName={user.name} onSaved={() => onCalendarUpdated?.()} />
           </div>
         )}

         {activeResView === 'UPLOAD_DSKP' && (
           <div className="relative scroll-mt-24" ref={dskpPanelRef}>
             <button 
               onClick={() => setActiveResView(null)}
               className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 transition-all"
             >
               <X size={20} />
             </button>
             <DSKPUploader 
               masterData={masterData}
               userName={user.name}
               onDskpUpdated={onDskpUpdated}
               onClearLegacy={async () => {
                 const ok = await onSyncMaster({ ...masterData, hierarchy: {} });
                 if (ok) setMasterData({ ...masterData, hierarchy: {} });
                 return ok;
               }}
             />
           </div>
         )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Column: Teacher List / Info */}
        <div className="lg:col-span-1 space-y-6">
          {selectedTeacher ? (
            <TeacherInfoCard 
              teacher={selectedTeacher} 
              bundles={bundles} 
              onBack={() => setSelectedTeacher(null)} 
              onLoginAsTeacher={onLoginAsTeacher}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight">Senarai Guru</h2>
                <span className="text-[10px] font-black text-slate-400 uppercase">{filteredTeachers.length} Orang</span>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari nama guru..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-14 pl-12 pr-6 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {Object.entries(groupedTeachers).sort(([a], [b]) => a.localeCompare(b)).map(([dept, deptTeachers]) => (
                  <div key={dept} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-px flex-1 bg-slate-100"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dept}</span>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 premium-shadow overflow-hidden">
                      {deptTeachers.map(teacher => (
                        <button 
                          key={teacher.id}
                          onClick={() => setSelectedTeacher(teacher)}
                          className="w-full p-5 flex items-center gap-4 border-b border-slate-100 last:border-0 transition-all hover:bg-indigo-50/50 text-left focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                          <div className="relative">
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
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{teacher.name}</p>
                            <p className="text-xs font-medium text-indigo-600 truncate uppercase tracking-widest">{teacher.department || 'TIADA BIDANG'}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Column: Review Section */}
        <div className="lg:col-span-2 space-y-8">
          {reviewingBundle ? (
            <div className="bg-white rounded-[3rem] border-2 border-indigo-100 premium-shadow p-8 md:p-12 animate-slideUp space-y-10">
              {/* ... Reviewing Bundle Form (no changes) ... */}
              <div className="flex justify-between items-start">
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Semakan Mingguan</h2>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-5">
                      {reviewingBundle.teacherName} • {reviewingBundle.week}
                    </p>
                 </div>
                 <button onClick={() => setReviewingBundle(null)} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 rounded-2xl transition-all">
                   <AlertCircle size={20} />
                 </button>
              </div>

              <ReviewForm 
                user={user}
                reviewComment={reviewComment}
                setReviewComment={setReviewComment}
                reviewSignature={reviewSignature}
                setReviewSignature={setReviewSignature}
                onReviewerInfoChange={handleReviewerInfoChange}
              />

              {/* Next Monday Preview Section */}
              <NextMondayPreview 
                teacherId={reviewingBundle.teacherId} 
                currentWeek={extractWeekNumber(reviewingBundle.week)} 
                erphs={erphs} 
                onPreview={(data) => setExtraPreviewErphs(data)}
              />

              <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row gap-4">
                 <button 
                   onClick={handleReviewSubmit}
                   disabled={isSubmittingReview}
                   className="flex-1 h-16 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                 >
                   {isSubmittingReview ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                   Sahkan Semakan
                 </button>
                 <button 
                   onClick={() => setShowPreview(true)}
                   className="flex-1 h-16 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                 >
                   <Eye size={18} /> Lihat Rekod
                 </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight">Menunggu Semakan</h2>
                  <span className="text-[10px] font-black text-amber-600 uppercase">{pendingBundles.length} Hantaran</span>
                </div>
                <div className="flex items-center gap-3">
                  {selectedBundleIds.length > 0 && (
                    <button 
                      onClick={() => setSelectedBundleIds([])}
                      className="text-[9px] font-black text-slate-400 uppercase hover:text-slate-600 transition-all"
                    >
                      Batal Pilihan
                    </button>
                  )}
                  {pendingBundles.length > 0 && (
                    <button 
                      onClick={() => {
                        if (selectedBundleIds.length === 0) {
                          setSelectedBundleIds(pendingBundles.map(b => b.id_minggu));
                        }
                        setShowBulkModal(true);
                      }}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-700 transition-all shadow-lg"
                    >
                      <ShieldCheck size={14} />
                      {selectedBundleIds.length > 0 ? `Sahkan Pukal (${selectedBundleIds.length})` : 'Sahkan Pukal'}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-12">
                {pendingBundles.length === 0 ? (
                  <div className="col-span-full bg-white p-20 rounded-[3rem] border-2 border-slate-100 premium-shadow flex flex-col items-center text-slate-300">
                    <ShieldCheck size={64} className="opacity-50 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiada hantaran baharu</p>
                  </div>
                ) : (
                  Object.entries(groupedPendingBundles).sort(([a], [b]) => a.localeCompare(b)).map(([dept, deptBundles]) => (
                    <div key={dept} className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <h3 className="font-black text-slate-500 text-sm uppercase tracking-widest">{dept}</h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">{deptBundles.length}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <button 
                            onClick={() => {
                              const deptIds = deptBundles.map(b => b.id_minggu);
                              const allSelected = deptIds.every(id => selectedBundleIds.includes(id));
                              if (allSelected) {
                                setSelectedBundleIds(prev => prev.filter(id => !deptIds.includes(id)));
                              } else {
                                setSelectedBundleIds(prev => Array.from(new Set([...prev, ...deptIds])));
                              }
                            }}
                            className="text-[9px] font-black text-indigo-600 uppercase hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all"
                          >
                            {deptBundles.map(b => b.id_minggu).every(id => selectedBundleIds.includes(id)) ? 'Nyahpilih Semua' : 'Pilih Semua'}
                          </button>
                        </div>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>
                      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden premium-shadow">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="p-4 w-12 text-center">Pilih</th>
                                <th className="p-4">Nama Guru</th>
                                <th className="p-4">Minggu</th>
                                <th className="p-4">Tarikh Hantar</th>
                                <th className="p-4 text-center">Isnin Depan</th>
                                <th className="p-4 text-right">Tindakan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {deptBundles.map((bundle, idx) => (
                                <tr 
                                  key={idx} 
                                  className={`transition-colors hover:bg-slate-50/50 ${selectedBundleIds.includes(bundle.id_minggu) ? 'bg-indigo-50/30' : ''}`}
                                >
                                  <td className="p-4 text-center">
                                    <input 
                                      type="checkbox"
                                      checked={selectedBundleIds.includes(bundle.id_minggu)}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedBundleIds(prev => [...prev, bundle.id_minggu]);
                                        else setSelectedBundleIds(prev => prev.filter(id => id !== bundle.id_minggu));
                                      }}
                                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[8px] font-black uppercase tracking-widest">BARU</span>
                                      <span className="font-bold text-slate-900 text-sm">{bundle.teacherName}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{bundle.week}</span>
                                  </td>
                                  <td className="p-4">
                                    <span className="text-xs font-medium text-slate-500">{new Date(bundle.timestamp).toLocaleDateString('ms-MY')}</span>
                                  </td>
                                  <td className="p-4 text-center">
                                    {(() => {
                                      const nextWeek = extractWeekNumber(bundle.week) + 1;
                                      const hasNextMonday = erphs.some(e => 
                                        String(e.teacherId).trim().toLowerCase() === String(bundle.teacherId).trim().toLowerCase() && 
                                        Number(e.week) === nextWeek && 
                                        (String(e.day).toLowerCase() === 'isnin' || String(e.day).toLowerCase() === 'monday')
                                      );
                                      return (
                                        <div className="flex items-center justify-center">
                                          {hasNextMonday ? (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                          ) : (
                                            <AlertCircle size={16} className="text-rose-400" />
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="p-4 text-right">
                                    <button 
                                      onClick={() => setReviewingBundle(bundle)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md"
                                    >
                                      Semak <ArrowUpRight size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-6 pt-8">
                <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight px-1">Telah Disemak</h2>
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 premium-shadow overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                        <BarChart3 size={18} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Statistik Penghantaran</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {Object.keys(reviewedByTeacher).length} Guru • {sortedReviewedBundles.length} Minggu Disemak
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[500px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/3">Guru</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Rekod Mingguan (Klik untuk muat turun)</th>
                          <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">Jum.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.keys(reviewedByTeacher).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center p-12">
                              <p className="text-xs font-bold text-slate-400">Belum ada rekod.</p>
                            </td>
                          </tr>
                        ) : (
                          Object.entries(reviewedByTeacher)
                            .sort(([, a], [, b]) => b.length - a.length) // Sort by count descending
                            .map(([teacherName, bundles], idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black border border-indigo-100">
                                    {teacherName.charAt(0)}
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tight line-clamp-1">{teacherName}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 align-middle">
                                <div className="flex flex-wrap gap-1.5">
                                  {bundles
                                    .sort((a, b) => extractWeekNumber(a.week) - extractWeekNumber(b.week))
                                    .map((bundle, bIdx) => {
                                      const weekNum = extractWeekNumber(bundle.week);
                                      return (
                                        <a 
                                          key={bIdx}
                                          href={bundle.linkPdfSelesai || bundle.jana_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-lg text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition-all border border-slate-200 hover:border-indigo-600 shadow-sm"
                                          title={`Muat Turun Minggu ${weekNum}`}
                                        >
                                          {weekNum}
                                        </a>
                                      );
                                    })}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right align-middle">
                                 <span className="inline-flex items-center justify-center h-6 px-3 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black">
                                   {bundles.length}
                                 </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 space-y-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pengesahan Pukal</h3>
              <p className="text-sm font-bold text-slate-500">
                Anda pasti ingin mengesahkan {selectedBundleIds.length} hantaran secara pukal? 
                Sistem akan menjana PDF untuk setiap hantaran secara automatik.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowBulkConfirm(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                onClick={startBulkReview}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Teruskan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp border ${
          notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 
          notification.type === 'error' ? 'bg-rose-500 text-white border-rose-400' : 
          'bg-slate-900 text-white border-slate-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : 
           notification.type === 'error' ? <AlertCircle size={18} /> : 
           <Info size={18} />}
          <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;