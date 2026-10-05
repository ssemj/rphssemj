import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import SignaturePad from './SignaturePad';
import { OFFICIAL_REVIEWERS } from '../constants';

interface ReviewFormProps {
  user: UserProfile;
  reviewComment: string;
  setReviewComment: (comment: string) => void;
  reviewSignature: string;
  setReviewSignature: (signature: string) => void;
  onReviewerInfoChange: (name: string, designation: string) => void;
  isObservation?: boolean;
  setIsObservation?: (val: boolean) => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ 
  user, 
  reviewComment, 
  setReviewComment, 
  reviewSignature, 
  setReviewSignature,
  onReviewerInfoChange,
  isObservation = false,
  setIsObservation
}) => {
  const [reviewerName, setReviewerName] = useState(user.name);
  const [reviewerDesignation, setReviewerDesignation] = useState(user.designation);
  const [otherReviewerName, setOtherReviewerName] = useState('');
  const [otherReviewerDesignation, setOtherReviewerDesignation] = useState('');

  const [selectedComment, setSelectedComment] = useState('Sila pilih ulasan...');
  const [otherComment, setOtherComment] = useState('');

  // Load saved signatures from localStorage
  const [savedSignatures, setSavedSignatures] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('ssemj_reviewer_signatures');
    return saved ? JSON.parse(saved) : {};
  });

  const commentOptions = [
    'Sila pilih ulasan...',
    'RPH lengkap dan dikemas kini mengikut jadual. Teruskan momentum kecemerlangan.',
    'Perancangan PdP yang kemas. Sila pastikan refleksi ditulis sejurus selepas sesi PdP tamat untuk tujuan penambahbaikan',
    'Telah disemak. Secara keseluruhan, perancangan menepati sukatan DSKP semasa.',
    'Tahniah, perancangan PdP yang sangat mantap. Objektif pembelajaran (OP) dan kriteria kejayaan (KK) dinyatakan dengan jelas dan boleh diukur.',
    'Syabas atas penggunaan elemen PAK-21 (seperti Think-Pair-Share) yang menarik. Ini dapat meningkatkan penglibatan aktif murid secara berkesan.',
    'Penggunaan bahan bantu mengajar (BBM) digital yang kreatif. Teruskan usaha memaksimumkan potensi murid melalui pembelajaran bermakna.',
    'RPH disediakan dengan baik. Cadangan: Pastikan aktiviti pembelajaran selari dengan kriteria kejayaan yang ditetapkan supaya hasil pembelajaran lebih fokus.',
    'Boleh tambah baik bahagian aktiviti dengan memasukkan elemen pembezaan mengikut tahap keupayaan murid (Aras Rendah/Sederhana/Tinggi).',
    'Lain-lain:Nyatakan'
  ];

  const reviewerNameOptions = useMemo(() => {
    const names = [user.name, ...OFFICIAL_REVIEWERS.map(r => r.name), 'LAIN-LAIN'];
    return Array.from(new Set(names));
  }, [user.name]);

  const handleNameChange = (name: string) => {
    setReviewerName(name);
    
    if (name === 'LAIN-LAIN') {
      setOtherReviewerName('');
      return;
    }

    // Auto-sync designation
    const official = OFFICIAL_REVIEWERS.find(r => r.name === name);
    if (official) {
      setReviewerDesignation(official.designation);
    } else if (name === user.name) {
      setReviewerDesignation(user.designation);
    }

    // Auto-sync signature if saved
    if (savedSignatures[name]) {
      setReviewSignature(savedSignatures[name]);
    } else {
      setReviewSignature('');
    }
  };

  // Save signature to localStorage when it changes
  const handleSignatureChange = (sig: string) => {
    setReviewSignature(sig);
    if (sig && sig.startsWith('data:image') && reviewerName !== 'LAIN-LAIN') {
      const newSigs = { ...savedSignatures, [reviewerName]: sig };
      setSavedSignatures(newSigs);
      localStorage.setItem('ssemj_reviewer_signatures', JSON.stringify(newSigs));
    }
  };

  useEffect(() => {
    const finalName = reviewerName === 'LAIN-LAIN' ? otherReviewerName : reviewerName;
    const finalDesignation = reviewerDesignation === 'LAIN-LAIN' ? otherReviewerDesignation : reviewerDesignation;
    onReviewerInfoChange(finalName, finalDesignation);
  }, [reviewerName, otherReviewerName, reviewerDesignation, otherReviewerDesignation, onReviewerInfoChange]);

  useEffect(() => {
    if (selectedComment === 'Lain-lain:Nyatakan') {
      setReviewComment(otherComment);
    } else if (selectedComment === 'Sila pilih ulasan...') {
      setReviewComment('');
    } else {
      setReviewComment(selectedComment);
    }
  }, [selectedComment, otherComment, setReviewComment]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reviewer Name */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Penyemak</label>
          <select
            value={reviewerName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full mt-2 h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          >
            {reviewerNameOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          {reviewerName === 'LAIN-LAIN' && (
            <input
              type="text"
              placeholder="Sila nyatakan nama..."
              value={otherReviewerName}
              onChange={(e) => setOtherReviewerName(e.target.value)}
              className="w-full mt-2 h-14 px-5 bg-white border border-slate-300 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-200 outline-none transition-all animate-fadeIn"
            />
          )}
        </div>

        {/* Reviewer Designation */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jawatan</label>
          <select
            value={reviewerDesignation}
            onChange={(e) => {
               const value = e.target.value;
               setReviewerDesignation(value);
               if (value !== 'LAIN-LAIN') setOtherReviewerDesignation('');
            }}
            className="w-full mt-2 h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          >
            {/* Show current designation and official ones */}
            <option value={reviewerDesignation}>{reviewerDesignation}</option>
            {Array.from(new Set(OFFICIAL_REVIEWERS.map(r => r.designation))).map(title => (
              title !== reviewerDesignation && <option key={title} value={title}>{title}</option>
            ))}
            <option value="LAIN-LAIN">LAIN-LAIN</option>
          </select>
          {reviewerDesignation === 'LAIN-LAIN' && (
            <input
              type="text"
              placeholder="Sila nyatakan jawatan..."
              value={otherReviewerDesignation}
              onChange={(e) => setOtherReviewerDesignation(e.target.value)}
              className="w-full mt-2 h-14 px-5 bg-white border border-slate-300 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-200 outline-none transition-all animate-fadeIn"
            />
          )}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ulasan / Maklum Balas</label>
        <select
          value={selectedComment}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedComment(value);
            if (value !== 'Lain-lain:Nyatakan') setOtherComment('');
          }}
          className="w-full mt-2 h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
        >
          {commentOptions.map(comment => <option key={comment} value={comment}>{comment}</option>)}
        </select>
        {selectedComment === 'Lain-lain:Nyatakan' && (
          <textarea
            value={otherComment}
            onChange={(e) => setOtherComment(e.target.value)}
            placeholder="Sila nyatakan ulasan anda di sini..."
            className="w-full mt-2 p-5 bg-white border border-slate-300 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-200 outline-none transition-all min-h-[120px] animate-fadeIn"
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tandatangan Digital & Pengesahan</label>
          {setIsObservation && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={isObservation} 
                onChange={(e) => setIsObservation(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:text-indigo-700 transition-colors">
                Tandakan sebagai Pencerapan
              </span>
            </label>
          )}
          {savedSignatures[reviewerName] && reviewerName !== 'LAIN-LAIN' && (
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
              Tandatangan Tersimpan Automatik
            </span>
          )}
        </div>
        <div className="mt-2">
          <SignaturePad 
            initialValue={reviewSignature}
            onSign={handleSignatureChange}
          />
        </div>
      </div>
    </div>
  );
};

export default ReviewForm;
