// ============================================================
// Jadual Minggu Penghantaran eRPH & Pegawai Penyemak
// Sumber: Google Sheet "minggu_sekolah" (dikongsi oleh pentadbir).
// Dibaca terus dari Sheet setiap kali aplikasi dibuka — jika gagal,
// guna salinan terbina di bawah (dikemas kini 5 Okt 2026).
// ============================================================
export const SCHEDULE_SHEET_ID = '1rx8gxm2Xj64IDexhHRzwfg5dQEeHlGS_JL7J9XNm6Ag';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SCHEDULE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

export interface SubmissionWeek {
  id: string;          // M36
  week: string;        // Minggu 36
  range: string;       // 05 OKT - 09 OKT 2026
  submitDate: string;  // 09 OKT 2026
  reviewer: string;    // PKPA / PKS  ("-" = tiada penyemakan)
  note: string;        // Cuti Tambahan
  start: Date;
  end: Date;
}

const MONTHS: Record<string, number> = {
  JAN: 0, JANUARI: 0, FEB: 1, FEBRUARI: 1, MAC: 2, MAR: 2, APR: 3, APRIL: 3, MEI: 4, MAY: 4, JUN: 5,
  JUL: 6, JULAI: 6, OGOS: 7, OGO: 7, AUG: 7, SEP: 8, SEPT: 8, SEPTEMBER: 8, OKT: 9, OKTOBER: 9, OCT: 9,
  NOV: 10, NOVEMBER: 10, DIS: 11, DISEMBER: 11, DEC: 11,
};

/** "05 OKT - 09 OKT 2026" atau "30 MAC - 03 APRIL 2026" → {start, end} */
export function parseRange(range: string): { start: Date; end: Date } | null {
  const m = String(range).toUpperCase().match(/(\d{1,2})\s+([A-Z]+)\s*-\s*(\d{1,2})\s+([A-Z]+)\s+(\d{4})/);
  if (!m) return null;
  const [, d1, m1, d2, m2, y] = m;
  const mo1 = MONTHS[m1], mo2 = MONTHS[m2];
  if (mo1 === undefined || mo2 === undefined) return null;
  const year = Number(y);
  const start = new Date(mo1 > mo2 ? year - 1 : year, mo1, Number(d1), 0, 0, 0);
  const end = new Date(year, mo2, Number(d2), 23, 59, 59);
  return { start, end };
}

// Salinan sandaran (jika Sheet tidak dapat dibaca)
const FALLBACK: [string, string, string, string, string, string][] = [
  ['M1','Minggu 1','12 JAN - 16 JAN 2026','16 Jan 2026','Pengetua',''],['M2','Minggu 2','19 JAN - 23 JAN 2026','23 Jan 2026','PKPA / PKS',''],
  ['M3','Minggu 3','26 JAN - 30 JAN 2026','30 Jan 2026','KB / GKMP',''],['M4','Minggu 4','02 FEB - 06 FEB 2026','06 Feb 2026','Pengetua',''],
  ['M5','Minggu 5','09 FEB - 13 FEB 2026','13 Feb 2026','PKPA / PKS',''],['M6','Minggu 6','16 FEB - 20 FEB 2026','20 Feb 2026','-','Cuti Tambahan'],
  ['M7','Minggu 7','23 FEB - 27 FEB 2026','27 Feb 2026','KB / GKMP',''],['M8','Minggu 8','02 MAC - 06 MAC 2026','06 MAC 2026','Pengetua',''],
  ['M9','Minggu 9','09 MAC - 13 MAC 2026','13 MAC 2026','PKPA / PKS',''],['M10','Minggu 10','16 MAC - 20 MAC 2026','20 MAC 2026','-','Cuti Tambahan'],
  ['M11','Minggu 11','23 MAC - 27 MAC 2026','27 MAC 2026','Pengetua',''],['M12','Minggu 12','30 MAC - 03 APRIL 2026','03 April 2026','PKPA / PKS',''],
  ['M13','Minggu 13','06 APRIL - 10 APRIL 2026','10 April 2026','KB / GKMP',''],['M14','Minggu 14','13 APRIL - 17 APRIL 2026','17 April 2026','Pengetua',''],
  ['M15','Minggu 15','20 APRIL - 24 APRIL 2026','24 April 2026','-','Cuti Hari Buruh'],['M16','Minggu 16','27 APRIL - 01 MEI 2026','01 MEI 2026','KB / GKMP',''],
  ['M17','Minggu 17','04 MEI - 08 MEI 2026','08 MEI 2026','Pengetua',''],['M18','Minggu 18','11 MEI - 15 MEI 2026','15 MEI 2026','PKPA / PKS',''],
  ['M19','Minggu 19','18 MEI - 22 MEI 2026','22 MEI 2026','KB / GKMP',''],['M20','Minggu 20','08 JUN - 12 JUN 2026','12 Jun 2026','Pengetua',''],
  ['M21','Minggu 21','15 JUN - 19 JUN 2026','19 Jun 2026','PKPA / PKS',''],['M22','Minggu 22','22 JUN - 26 JUN 2026','26 Jun 2026','KB / GKMP',''],
  ['M23','Minggu 23','29 JUN - 03 JULAI 2026','03 JULAI 2026','Pengetua',''],['M24','Minggu 24','06 JULAI - 10 JULAI 2026','10 JULAI 2026','PKPA / PKS',''],
  ['M25','Minggu 25','13 JULAI - 17 JULAI 2026','17 JULAI 2026','KB / GKMP',''],['M26','Minggu 26','20 JULAI - 24 JULAI 2026','24 JULAI 2026','Pengetua',''],
  ['M27','Minggu 27','27 JULAI - 31 JULAI 2026','31 JULAI 2026','PKPA / PKS',''],['M28','Minggu 28','03 OGOS - 07 OGOS 2026','07 OGOS 2026','KB / GKMP',''],
  ['M29','Minggu 29','10 OGOS - 14 OGOS 2026','14 OGOS 2026','Pengetua',''],['M30','Minggu 30','17 OGOS - 21 OGOS 2026','21 OGOS 2026','PKPA / PKS',''],
  ['M31','Minggu 31','24 OGOS - 28 OGOS 2026','28 OGOS 2026','KB / GKMP',''],['M32','Minggu 32','07 SEPT - 11 SEPT 2026','11 SEPT 2026','Pengetua',''],
  ['M33','Minggu 33','14 SEPT - 18 SEPT 2026','18 SEPT 2026','PKPA / PKS',''],['M34','Minggu 34','21 SEPT - 25 SEPT 2026','25 SEPT 2026','KB / GKMP',''],
  ['M35','Minggu 35','28 SEPT - 02 OKT 2026','02 OKT 2026','Pengetua',''],['M36','Minggu 36','05 OKT - 09 OKT 2026','09 OKT 2026','PKPA / PKS',''],
  ['M37','Minggu 37','12 OKT - 16 OKT 2026','16 OKT 2026','KB / GKMP',''],['M38','Minggu 38','19 OKT - 23 OKT 2026','23 OKT 2026','Pengetua',''],
  ['M39','Minggu 39','26 OKT - 30 OKT 2026','30 OKT 2026','PKPA / PKS',''],['M40','Minggu 40','02 NOV - 06 NOV 2026','06 Nov 2026','KB / GKMP',''],
  ['M41','Minggu 41','09 NOV - 13 NOV 2026','13 Nov 2026','Pengetua',''],['M42','Minggu 42','16 NOV - 20 NOV 2026','20 Nov 2026','PKPA / PKS',''],
  ['M43','Minggu 43','23 NOV - 27 NOV 2026','27 Nov 2026','KB / GKMP',''],['M44','Minggu 44','30 NOV - 04 DIS 2026','04 DIS 2026','Pengetua',''],
];

const toWeeks = (rows: string[][]): SubmissionWeek[] =>
  rows
    .map(r => {
      const [id, week, range, submitDate, reviewer, note] = r.map(x => String(x ?? '').trim());
      const p = parseRange(range);
      return p ? { id, week, range, submitDate, reviewer, note, ...p } : null;
    })
    .filter(Boolean) as SubmissionWeek[];

/** CSV ringkas (Sheet gviz memetik setiap sel dengan ""). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

let cache: Promise<SubmissionWeek[]> | null = null;
export function loadSubmissionSchedule(): Promise<SubmissionWeek[]> {
  if (!cache) {
    cache = fetch(CSV_URL)
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(t => {
        const weeks = toWeeks(parseCsv(t).slice(1));
        if (!weeks.length) throw new Error('kosong');
        return weeks;
      })
      .catch(err => { console.warn('Jadual penghantaran: guna salinan sandaran', err); return toWeeks(FALLBACK); });
  }
  return cache;
}

/**
 * Minggu semasa: minggu yang mengandungi tarikh ini (Isnin–Ahad).
 * Jika dalam cuti panjang (tiada minggu), pulangkan minggu persekolahan yang akan datang.
 */
export function currentSubmissionWeek(weeks: SubmissionWeek[], now = new Date()): { week: SubmissionWeek; upcoming: boolean } | null {
  const inWeek = weeks.find(w => {
    const sunday = new Date(w.end); sunday.setDate(sunday.getDate() + 2);
    return now >= w.start && now <= sunday;
  });
  if (inWeek) return { week: inWeek, upcoming: false };
  const next = weeks.filter(w => w.start > now).sort((a, b) => +a.start - +b.start)[0];
  return next ? { week: next, upcoming: true } : null;
}

export const hasReviewer = (w: SubmissionWeek) => !!w.reviewer && w.reviewer !== '-';
