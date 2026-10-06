
import React, { useRef, useState } from 'react';
import { ERPHData, ERPHStatus } from '../types';
import { formatDate, formatTime } from '../constants';
import { Printer, X, FileText, Calendar, Clock, BookOpen, Layers, CheckCircle2, SendHorizontal, Loader2, ChevronLeft, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { appendWeek, loadLogo, newRphPdf } from '../services/rphPdf';
import { useBranding } from '../services/brandingService';
import { printPdfBlob, saveBlob } from '../services/pdfOutput';
import { subjectLanguage } from '../services/geminiService';
const isIslamSubject = (s?: string) => subjectLanguage(s) === 'JAWI';

interface ERPHPreviewProps {
  erphs: ERPHData[];
  onBack: () => void;
  onSubmit?: (week: number, pdfBase64: string) => Promise<void>;
  hideModal?: boolean;
}

const ERPHPreview: React.FC<ERPHPreviewProps> = ({ erphs, onBack, onSubmit, hideModal = false }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const branding = useBranding();

  const pdfName = () => `RPH_M${erphs[0]?.week}_${String(erphs[0]?.teacherName || '').replace(/\s+/g, '_')}.pdf`;

  // CETAK: jana PDF A4 (vektor) dan cetak melalui iframe tersembunyi (tiada tab blob: baharu → tidak disekat)
  const handlePrint = async () => {
    setIsGenerating(true);
    try {
      const pdf = await buildPdf();
      const blob = pdf.output('blob');
      const ok = await printPdfBlob(blob);
      if (!ok) {
        saveBlob(blob, pdfName());
        alert('Pelayar anda (atau sambungan penyekat iklan) menghalang dialog cetak.\n\nFail PDF telah dimuat turun — buka fail itu dan tekan Cmd+P / Ctrl+P untuk cetak.');
      }
    } catch (e) {
      console.error(e); alert('Gagal menyediakan cetakan. Sila cuba lagi.');
    } finally { setIsGenerating(false); }
  };

  // PDF vektor (teks tajam, saiz kecil). Halaman Jawi sahaja ditangkap sebagai imej resolusi tinggi.
  const buildPdf = async () => {
    const pages = Array.from(printRef.current?.querySelectorAll<HTMLElement>('.a4-page') || []);
    const pdf = newRphPdf();
    const logo = await loadLogo();
    await appendWeek(pdf, erphs, {
      first: true,
      logo,
      renderImage: async (index) => {
        const el = pages[index];
        if (!el) return null;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: el.offsetWidth, height: el.offsetHeight });
        return canvas.toDataURL('image/jpeg', 0.8);
      },
    });
    return pdf;
  };

  const generatePDFBase64 = async (): Promise<string> => {
    const pdf = await buildPdf();
    const dataUri = pdf.output('datauristring');
    return dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
  };

  // Muat turun PDF minggu ini terus (tanpa hantar)
  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const pdf = await buildPdf();
      saveBlob(pdf.output('blob'), pdfName());
    } catch (e) {
      console.error(e); alert("Gagal menjana PDF. Sila cuba lagi.");
    } finally { setIsGenerating(false); }
  };

  const handleBulkSubmit = async () => {
    if (!onSubmit || erphs.length === 0) return;
    
    setIsGenerating(true);
    try {
      const pdfBase64 = await generatePDFBase64();
      await onSubmit(erphs[0].week, pdfBase64);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal menjana PDF. Sila cuba lagi.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (erphs.length === 0) return null;

  const getLabels = (isPendidikanIslam: boolean) => ({
    schoolName: isPendidikanIslam ? 'سكوله سني مليسيا جوهر' : branding.schoolName,
    rphTitle: isPendidikanIslam ? 'رنچڠن ڤڠاجرن هارين' : 'Rancangan Pengajaran Harian',
    teacherName: isPendidikanIslam ? 'نام ڬورو' : 'NAMA GURU',
    subject: isPendidikanIslam ? 'مات ڤلاجرن' : 'MATA PELAJARAN',
    class: isPendidikanIslam ? 'كلس' : 'KELAS',
    dateDay: isPendidikanIslam ? 'تاريخ / هاري' : 'TARIKH / HARI',
    time: isPendidikanIslam ? 'ماس' : 'MASA',
    themeTitle: isPendidikanIslam ? 'تيما / تاجوق' : 'TEMA / BIDANG / TAJUK',
    sk: isPendidikanIslam ? 'ستندرد كاندوڠن' : 'STANDARD KANDUNGAN',
    sp: isPendidikanIslam ? 'ستندرد ڤمبلاجرن' : 'STANDARD PEMBELAJARAN',
    objective: isPendidikanIslam ? 'اوبجيكتيف ڤڠاجرن' : 'OBJEKTIF PDP',
    activities: isPendidikanIslam ? 'اكتيويتي ڤڠاجرن' : 'AKTIVITI PDP',
    bbm: isPendidikanIslam ? 'باهن بنتو مڠاجر' : 'BAHAN BANTU MENGAJAR',
    reflection: isPendidikanIslam ? 'ريفليك‌سي' : 'REFLEKSI',
    observationComment: isPendidikanIslam ? 'اولسن ڤنچرڤن' : 'ULASAN PENCERAPAN',
    observer: isPendidikanIslam ? 'ڤنچرڤ' : 'PENCERAP',
    confirmationTitle: isPendidikanIslam ? 'ڤڠسهن رنچڠن ڤڠاجرن هارين' : 'Pengesahan Rancangan Pengajaran Harian',
    weeklyComment: isPendidikanIslam ? 'اولسن ميڠڬوان' : 'Ulasan Mingguan',
    admin: isPendidikanIslam ? 'ڤنتدبير' : 'PENTADBIR'
  });

  const content = (
    <div ref={printRef} className={`flex-1 p-6 md:p-12 space-y-12 bg-slate-50/30 custom-scrollbar print:p-0 print:bg-white print:overflow-visible ${hideModal ? 'bg-white h-auto overflow-visible' : 'overflow-y-auto'}`}>
      {erphs.map((erph, idx) => {
        const isPendidikanIslam = isIslamSubject(erph.subject);
        const labels = getLabels(isPendidikanIslam);
        
        return (
        <div key={erph.id || idx} className="a4-page bg-white p-4 sm:p-6 md:p-10 shadow-lg relative overflow-hidden print:shadow-none print:border-none print:p-0 print:m-0 print:break-after-page max-w-[210mm] mx-auto border border-slate-200">
          

          {/* Formal Header */}
          <div className={`flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8 border-b-4 border-slate-900 pb-4 sm:pb-6 ${isPendidikanIslam ? 'flex-row-reverse text-right' : ''}`}>
            <img 
              src={branding.logo || "/icon.svg"} 
              alt="Logo SSEMJ" 
              className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
            />
            <div className={`flex-1 ${isPendidikanIslam ? 'pr-0 pl-16 sm:pl-24' : 'pr-16 sm:pr-24 text-center'}`}>
              <h1 className={`text-xl sm:text-2xl font-black text-slate-900 leading-tight uppercase tracking-wider ${isPendidikanIslam ? 'font-jawi text-2xl sm:text-3xl' : ''}`}>
                {labels.schoolName}
              </h1>
              <h2 className={`text-base sm:text-lg font-bold text-slate-700 uppercase mt-1 ${isPendidikanIslam ? 'font-jawi text-xl sm:text-2xl' : ''}`}>
                {labels.rphTitle} (M{erph.week})
              </h2>
            </div>
          </div>

          {/* Formal Table Layout */}
          <table className="w-full border-collapse text-[11px]" dir={isPendidikanIslam ? 'rtl' : 'ltr'}>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 w-[25%] uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.teacherName}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase text-slate-800">{erph.teacherName}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 w-[25%] uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.subject}
                </td>
                <td className={`p-3 font-semibold uppercase text-slate-800 w-[35%] ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{isPendidikanIslam ? 'ڤنديديقن اسلام' : erph.subject}</td>
                <td className={`p-3 font-bold bg-slate-50 w-[15%] uppercase text-center text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.class}
                </td>
                <td className="p-3 font-semibold uppercase text-slate-800">{erph.className} ({erph.classTitle})</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 w-[25%] uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.dateDay}
                </td>
                <td className="p-3 font-semibold uppercase text-slate-800 w-[35%]">{formatDate(erph.date)} ({['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(erph.date + 'T12:00:00').getDay()]})</td>
                <td className={`p-3 font-bold bg-slate-50 w-[15%] uppercase text-center text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.time}
                </td>
                <td className="p-3 font-semibold uppercase text-slate-800">{formatTime(erph.startTime)} - {formatTime(erph.endTime)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.themeTitle}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase leading-relaxed text-slate-800">{[String(erph.field || '').split(' | ').join(' / '), erph.title].filter(Boolean).join(' / ')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.sk}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase leading-relaxed text-slate-800">{erph.sk}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.sp}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase leading-relaxed text-slate-800">{erph.sp}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.objective}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.objective?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.objective }} />
                  ) : (
                    erph.objective
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.activities}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.activities?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.activities }} />
                  ) : (
                    erph.activities
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.bbm}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.bbm?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.bbm }} />
                  ) : (
                    erph.bbm
                  )}
                </td>
              </tr>
              <tr>
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.reflection}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.reflection?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.reflection }} />
                  ) : (
                    erph.reflection
                  )}
                </td>
              </tr>
              {(erph.status === ERPHStatus.REVIEWED || erph.status === ERPHStatus.SELESAI) && (erph.observationComment || erph.isObservation) && (
                <tr className="border-t-2 border-emerald-100 bg-emerald-50/30">
                  <td className={`p-3 font-bold bg-emerald-50/50 uppercase align-top text-emerald-700 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                    {labels.observationComment}
                  </td>
                  <td colSpan={3} className="p-4">
                    <div className="flex flex-col gap-3">
                      <p className="font-medium italic text-emerald-800 whitespace-pre-wrap leading-relaxed">"{erph.observationComment}"</p>
                      <div className="flex items-center gap-4 mt-2 pt-3 border-t border-emerald-100/50">
                        {erph.observationSignature && erph.observationSignature.trim() !== "" && (
                          <img src={erph.observationSignature} alt="Tandatangan" className="h-12 object-contain mix-blend-multiply" />
                        )}
                        <div>
                          <p className={`text-xs font-black uppercase tracking-widest text-emerald-900 ${isPendidikanIslam ? 'font-jawi text-base' : ''}`}>{erph.observedBy || labels.observer}</p>
                          {erph.observerDesignation && (
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{erph.observerDesignation}</p>
                          )}
                          {erph.observedAt && (
                            <p className="text-[9px] font-medium text-emerald-500 mt-0.5">{new Date(erph.observedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    })}

      {/* Helaian Tambahan untuk Ulasan Mingguan */}
      {(erphs[0]?.status === ERPHStatus.REVIEWED || erphs[0]?.status === ERPHStatus.SELESAI) && (
        <div className="a4-page bg-white p-4 sm:p-6 md:p-10 shadow-lg relative overflow-hidden print:shadow-none print:border-none print:p-0 print:m-0 print:break-after-page max-w-[210mm] mx-auto border border-slate-200 flex flex-col">
          {/* Formal Header */}
          <div className={`flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8 border-b-4 border-slate-900 pb-4 sm:pb-6 ${isIslamSubject(erphs[0].subject) ? 'flex-row-reverse text-right' : ''}`}>
            <img 
              src={branding.logo || "/icon.svg"} 
              alt="Logo SSEMJ" 
              className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
            />
            <div className={`flex-1 ${isIslamSubject(erphs[0].subject) ? 'pr-0 pl-16 sm:pl-24' : 'pr-16 sm:pr-24 text-center'}`}>
              <h1 className={`text-xl sm:text-2xl font-black text-slate-900 leading-tight uppercase tracking-wider ${isIslamSubject(erphs[0].subject) ? 'font-jawi text-2xl sm:text-3xl' : ''}`}>
                {getLabels(isIslamSubject(erphs[0].subject)).schoolName}
              </h1>
              <h2 className={`text-base sm:text-lg font-bold text-slate-700 uppercase mt-1 ${isIslamSubject(erphs[0].subject) ? 'font-jawi text-xl sm:text-2xl' : ''}`}>
                {getLabels(isIslamSubject(erphs[0].subject)).confirmationTitle} (M{erphs[0].week})
              </h2>
            </div>
          </div>

          <div className="flex-1 flex flex-col mt-4" dir={isIslamSubject(erphs[0].subject) ? 'rtl' : 'ltr'}>
            <h3 className={`text-xl font-bold text-slate-800 uppercase mb-6 border-b-2 border-slate-200 pb-2 ${isIslamSubject(erphs[0].subject) ? 'font-jawi text-2xl' : ''}`}>{getLabels(isIslamSubject(erphs[0].subject)).weeklyComment}</h3>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex-1">
              <p className="text-lg font-medium italic text-slate-800 whitespace-pre-wrap leading-relaxed">
                "{erphs[0].reviewComment}"
              </p>
            </div>
            
            <div className={`mt-16 pt-8 border-t-2 border-slate-900 flex flex-col ${isIslamSubject(erphs[0].subject) ? 'items-start' : 'items-end'}`}>
              <div className="text-center w-72">
                {erphs[0].reviewSignature && erphs[0].reviewSignature.trim() !== "" && (
                  <img src={erphs[0].reviewSignature} alt="Tandatangan" className="h-24 object-contain mix-blend-multiply mx-auto mb-4" />
                )}
                <p className={`text-sm font-black uppercase tracking-widest text-slate-900 border-t border-slate-400 pt-2 ${isIslamSubject(erphs[0].subject) ? 'font-jawi text-lg' : ''}`}>
                  {erphs[0].reviewedBy || getLabels(isIslamSubject(erphs[0].subject)).admin}
                </p>
                {erphs[0].reviewerDesignation && (
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mt-1">
                    {erphs[0].reviewerDesignation}
                  </p>
                )}
                {erphs[0].reviewedAt && (
                  <p className="text-xs font-medium text-slate-500 mt-2">
                    Tarikh: {new Date(erphs[0].reviewedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (hideModal) return content;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fadeIn">
      <div className="bg-white w-full max-w-5xl h-full rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 print:hidden">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase transition-all"
          >
            <ChevronLeft size={18} /> KEMBALI
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-800 transition-all shadow-lg"
            >
              <Printer size={16} /> cetak
            </button>
            
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PDF
            </button>
            {onSubmit && (
              <button 
                onClick={handleBulkSubmit}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />} 
                {isGenerating ? 'MENJANA...' : `Sah& Hantar`}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {content}

        {/* Footer Actions */}
        <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-center gap-4 print:hidden">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sistem Rekod Pengajaran Harian Pintar &copy; 2026</p>
        </div>
      </div>
    </div>
  );
};

export default ERPHPreview;