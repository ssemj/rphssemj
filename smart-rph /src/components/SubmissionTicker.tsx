// ============================================================
// Jalur LED makluman minggu penghantaran eRPH
//  • Teks bergerak perlahan: "Makluman, minggu ini adalah minggu ke X
//    yang akan disemak oleh Y" (data dari Google Sheet jadual penghantaran)
//  • Setiap hari Jumaat: "Sila hantar RPH anda pada hari ini!!" berkelip
// ============================================================
import React, { useEffect, useState } from 'react';
import { currentSubmissionWeek, hasReviewer, loadSubmissionSchedule, SubmissionWeek } from '../services/submissionSchedule';

const SubmissionTicker: React.FC = () => {
  const [info, setInfo] = useState<{ week: SubmissionWeek; upcoming: boolean } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let alive = true;
    loadSubmissionSchedule().then(w => { if (alive) setInfo(currentSubmissionWeek(w, new Date())); });
    const t = setInterval(() => setNow(new Date()), 60_000);   // kemas kini jika aplikasi dibiar terbuka melepasi tengah malam
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    loadSubmissionSchedule().then(w => setInfo(currentSubmissionWeek(w, now)));
  }, [now.toDateString()]);

  if (!info) return null;
  const { week, upcoming } = info;
  const num = week.week.replace(/[^0-9]/g, '') || week.id;

  let message: string;
  if (!hasReviewer(week)) {
    message = `Makluman, minggu ini adalah minggu ke ${num} (${week.range}) — ${week.note || 'tiada penyemakan RPH'}.`;
  } else if (upcoming) {
    message = `Makluman, minggu persekolahan seterusnya adalah minggu ke ${num} (${week.range}) yang akan disemak oleh ${week.reviewer}.`;
  } else {
    message = `Makluman, minggu ini adalah minggu ke ${num} yang akan disemak oleh ${week.reviewer}. Tarikh akhir penghantaran: ${week.submitDate}.`;
  }

  const isFriday = now.getDay() === 5 && !upcoming && hasReviewer(week);

  return (
    <div className="led-ticker" role="status" aria-label={message}>
      {isFriday && (
        <div className="led-friday">
          <span className="led-blink">⚠ Sila hantar RPH anda pada hari ini!! ⚠</span>
        </div>
      )}
      <div className="led-track" aria-hidden="true">
        {/* Dua salinan teks supaya pergerakan bersambung tanpa ruang kosong */}
        <span className="led-text">{message}<span className="led-sep">✦</span>{message}<span className="led-sep">✦</span></span>
        <span className="led-text">{message}<span className="led-sep">✦</span>{message}<span className="led-sep">✦</span></span>
      </div>
    </div>
  );
};

export default SubmissionTicker;
