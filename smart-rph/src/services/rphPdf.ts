// ============================================================
// Penjana PDF RPH (vektor)
// Teks dilukis terus sebagai teks PDF (bukan gambar) → tajam bila dizum/dicetak
// dan saiz fail sangat kecil (~10–25 KB setiap muka berbanding ~150 KB+ imej).
// RPH Jawi / Pendidikan Islam (tulisan Arab) masih ditangkap sebagai imej
// resolusi tinggi kerana fon PDF standard tidak menyokong tulisan Jawi.
// ============================================================
import { jsPDF } from 'jspdf';
import { ERPHData, ERPHStatus } from '../types';
import { formatDate, formatTime } from '../constants';
import { getBranding, loadBranding } from './brandingService';

export const LOGO_URL = 'https://lh3.googleusercontent.com/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u';
const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

// ---- Ukuran (mm) ----
const PAGE_W = 210, PAGE_H = 297, M = 14;            // margin
const CONTENT_W = PAGE_W - M * 2;
const LABEL_W = 46;                                   // lajur label
const PAD = 2.6;                                      // padding sel
const FS = 9.5;                                       // saiz fon isi
const LH = FS * 0.3528 * 1.38;                        // tinggi baris (pt→mm × line-height)

// ---- Warna ----
const C_TEXT: [number, number, number] = [30, 41, 59];
const C_LABEL: [number, number, number] = [100, 116, 139];
const C_LABEL_BG: [number, number, number] = [248, 250, 252];
const C_LINE: [number, number, number] = [226, 232, 240];
const C_DARK: [number, number, number] = [15, 23, 42];

// ------------------------------------------------------------
// Logo (dimuat sekali, disimpan dalam cache sebagai dataURL)
// ------------------------------------------------------------
let logoPromise: Promise<string | null> | null = null;
export async function loadLogo(): Promise<string | null> {
  // 1) Logo yang dimuat naik Admin (Firestore) — utama
  await loadBranding().catch(() => {});
  const uploaded = getBranding().logo;
  if (uploaded) return uploaded;
  // 2) Sandaran: pautan logo lama
  if (!logoPromise) {
    logoPromise = fetch(LOGO_URL, { mode: 'cors' })
      .then(r => (r.ok ? r.blob() : Promise.reject()))
      .then(b => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); }))
      .then(dataUrl => shrinkImage(dataUrl, 240))   // kecilkan logo → jimat saiz
      .catch(() => null);
  }
  return logoPromise;
}

/** Kecilkan imej (cth logo / tandatangan) ke lebar maksimum, kekal PNG lut sinar. */
function shrinkImage(dataUrl: string, maxW: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ------------------------------------------------------------
// Pengesanan halaman yang perlu guna imej (Jawi / aksara bukan Latin)
// ------------------------------------------------------------
// Aksara yang tidak disokong fon PDF standard (WinAnsi): selain Latin asas/Latin-1/Latin Extended & tanda baca biasa
const UNSUPPORTED = /[^\u0000-ɏ‐-‧‰-›€™←-⇿•]/;
const TEXT_FIELDS: (keyof ERPHData)[] = ['teacherName', 'subject', 'className', 'classTitle', 'field', 'title', 'sk', 'sp', 'objective', 'activities', 'bbm', 'reflection', 'observationComment', 'reviewComment'];

export function needsImageFallback(e: ERPHData): boolean {
  if (/pendidikan\s*islam|اسلام/i.test(String(e.subject || '')) || e.language === 'JAWI') return true;
  return TEXT_FIELDS.some(f => {
    const v = String((e as any)[f] ?? '');
    return UNSUPPORTED.test(v) || v.trim().startsWith('<div');
  });
}

const clean = (v: any) =>
  String(v ?? '')
    .replace(/\r/g, '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/–|—/g, '-').replace(/…/g, '...')
    .replace(/\t/g, '  ');

// ------------------------------------------------------------
// Primitif lukisan
// ------------------------------------------------------------
interface Cursor { y: number }

function drawHeader(pdf: jsPDF, title: string, logo: string | null, cur: Cursor) {
  const top = M;
  const logoSize = 20;
  if (logo) {
    try { pdf.addImage(logo, 'PNG', M, top, logoSize, logoSize, 'logo', 'FAST'); } catch { /* abaikan */ }
  }
  pdf.setTextColor(...C_DARK);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
  pdf.text(clean(getBranding().schoolName || 'SEKOLAH SENI MALAYSIA JOHOR').toUpperCase(), PAGE_W / 2 + (logo ? 6 : 0), top + 8.5, { align: 'center' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(71, 85, 105);
  pdf.text(title.toUpperCase(), PAGE_W / 2 + (logo ? 6 : 0), top + 15, { align: 'center' });
  pdf.setDrawColor(...C_DARK); pdf.setLineWidth(1.1);
  pdf.line(M, top + logoSize + 3, PAGE_W - M, top + logoSize + 3);
  pdf.setLineWidth(0.2);
  cur.y = top + logoSize + 7;
}

type Cell = { text: string; label?: boolean; w: number; bold?: boolean; upper?: boolean };

/** Lukis satu baris jadual (sel berlabel). Pecah ke muka baharu jika teks panjang. */
function drawRow(pdf: jsPDF, cells: Cell[], cur: Cursor, onNewPage: () => void) {
  // Sediakan baris teks bagi setiap sel
  const prepared = cells.map(c => {
    pdf.setFont('helvetica', c.label || c.bold ? 'bold' : 'normal');
    pdf.setFontSize(c.label ? 8 : FS);
    const raw = clean(c.text);
    const t = c.upper ? raw.toUpperCase() : raw;
    const lines: string[] = t ? pdf.splitTextToSize(t, c.w - PAD * 2) : [''];
    return { ...c, lines };
  });

  let start = 0;   // indeks baris yang belum dilukis (untuk sel nilai yang panjang)
  const maxLines = Math.max(...prepared.map(p => p.lines.length));
  while (start < maxLines) {
    const avail = PAGE_H - M - 6 - cur.y;
    let fit = Math.floor((avail - PAD * 2) / LH);
    if (fit < 2 && start === 0 && maxLines > 1) { onNewPage(); continue; }   // terlalu sedikit ruang → muka baharu
    if (fit < 1) { onNewPage(); continue; }
    const take = Math.min(fit, maxLines - start);
    const h = take * LH + PAD * 2;

    let x = M;
    prepared.forEach(p => {
      if (p.label) { pdf.setFillColor(...C_LABEL_BG); pdf.rect(x, cur.y, p.w, h, 'F'); }
      pdf.setFont('helvetica', p.label || p.bold ? 'bold' : 'normal');
      pdf.setFontSize(p.label ? 8 : FS);
      pdf.setTextColor(...(p.label ? C_LABEL : C_TEXT));
      const seg = p.label ? (start === 0 ? p.lines : []) : p.lines.slice(start, start + take);
      seg.forEach((ln, i) => pdf.text(ln, x + PAD, cur.y + PAD + LH * (i + 0.78)));
      x += p.w;
    });
    pdf.setDrawColor(...C_LINE);
    pdf.line(M, cur.y + h, PAGE_W - M, cur.y + h);
    cur.y += h;
    start += take;
    if (start < maxLines) onNewPage();
  }
}

// ------------------------------------------------------------
// Halaman RPH (vektor)
// ------------------------------------------------------------
export function drawRphPage(pdf: jsPDF, e: ERPHData, logo: string | null, first: boolean) {
  if (!first) pdf.addPage();
  const cur: Cursor = { y: 0 };
  const title = `Rancangan Pengajaran Harian (M${e.week})`;
  drawHeader(pdf, title, logo, cur);
  const newPage = () => { pdf.addPage(); drawHeader(pdf, `${title} - sambungan`, logo, cur); };

  const V = CONTENT_W - LABEL_W;
  const half = (V - 26) / 2;   // untuk baris 4 lajur
  const day = e.date ? DAYS[new Date(e.date + 'T12:00:00').getDay()] : (e.day || '');

  pdf.setDrawColor(...C_LINE); pdf.line(M, cur.y, PAGE_W - M, cur.y);
  drawRow(pdf, [{ text: 'NAMA GURU', label: true, w: LABEL_W }, { text: e.teacherName, w: V, bold: true, upper: true }], cur, newPage);
  drawRow(pdf, [
    { text: 'MATA PELAJARAN', label: true, w: LABEL_W }, { text: e.subject, w: half + 6, bold: true, upper: true },
    { text: 'KELAS', label: true, w: 20 }, { text: `${e.className || ''}${e.classTitle ? ` (${e.classTitle})` : ''}`, w: half, bold: true, upper: true },
  ], cur, newPage);
  drawRow(pdf, [
    { text: 'TARIKH / HARI', label: true, w: LABEL_W }, { text: `${formatDate(e.date)} (${day})`, w: half + 6, bold: true, upper: true },
    { text: 'MASA', label: true, w: 20 }, { text: `${formatTime(e.startTime)} - ${formatTime(e.endTime)}`, w: half, bold: true },
  ], cur, newPage);
  drawRow(pdf, [{ text: 'TEMA / BIDANG / TAJUK', label: true, w: LABEL_W }, { text: [String(e.field || '').split(' | ').join(' / '), e.title].filter(Boolean).join(' / '), w: V, bold: true, upper: true }], cur, newPage);
  drawRow(pdf, [{ text: 'STANDARD KANDUNGAN', label: true, w: LABEL_W }, { text: e.sk, w: V, bold: true, upper: true }], cur, newPage);
  drawRow(pdf, [{ text: 'STANDARD PEMBELAJARAN', label: true, w: LABEL_W }, { text: e.sp, w: V, bold: true, upper: true }], cur, newPage);
  drawRow(pdf, [{ text: 'OBJEKTIF PDP', label: true, w: LABEL_W }, { text: e.objective, w: V }], cur, newPage);
  drawRow(pdf, [{ text: 'AKTIVITI PDP', label: true, w: LABEL_W }, { text: e.activities, w: V }], cur, newPage);
  drawRow(pdf, [{ text: 'BAHAN BANTU MENGAJAR', label: true, w: LABEL_W }, { text: e.bbm, w: V }], cur, newPage);
  drawRow(pdf, [{ text: 'REFLEKSI', label: true, w: LABEL_W }, { text: e.reflection, w: V }], cur, newPage);

  // Ulasan pencerapan (jika ada)
  if ((e.status === ERPHStatus.REVIEWED || e.status === ERPHStatus.SELESAI) && (e.observationComment || e.isObservation)) {
    cur.y += 3;
    drawRow(pdf, [{ text: 'ULASAN PENCERAPAN', label: true, w: LABEL_W }, { text: `"${e.observationComment || ''}"`, w: V }], cur, newPage);
    if (cur.y + 30 > PAGE_H - M) newPage();
    let y = cur.y + 4;
    if (e.observationSignature) {
      try { pdf.addImage(e.observationSignature, 'PNG', M + LABEL_W + PAD, y, 35, 14, undefined, 'FAST'); y += 15; } catch { /* abaikan */ }
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...C_TEXT);
    pdf.text(clean(e.observedBy || 'PENCERAP').toUpperCase(), M + LABEL_W + PAD, y + 3);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...C_LABEL);
    if (e.observerDesignation) pdf.text(clean(e.observerDesignation).toUpperCase(), M + LABEL_W + PAD, y + 7);
    cur.y = y + 9;
  }
}

/** Helaian pengesahan / ulasan mingguan penyemak. */
export function drawWeeklyReviewPage(pdf: jsPDF, erphs: ERPHData[], logo: string | null, first: boolean) {
  const e = erphs[0];
  if (!first) pdf.addPage();
  const cur: Cursor = { y: 0 };
  drawHeader(pdf, `Pengesahan Rancangan Pengajaran Harian (M${e.week})`, logo, cur);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(...C_TEXT);
  pdf.text('ULASAN MINGGUAN', M, cur.y + 8);
  pdf.setDrawColor(...C_LINE); pdf.line(M, cur.y + 11, PAGE_W - M, cur.y + 11);

  const boxY = cur.y + 16;
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(11);
  const lines: string[] = pdf.splitTextToSize(`"${clean(e.reviewComment || '')}"`, CONTENT_W - 12);
  const boxH = Math.max(60, lines.length * 6 + 14);
  pdf.setFillColor(...C_LABEL_BG); pdf.setDrawColor(...C_LINE);
  pdf.roundedRect(M, boxY, CONTENT_W, boxH, 3, 3, 'FD');
  pdf.setTextColor(...C_TEXT);
  lines.forEach((l, i) => pdf.text(l, M + 6, boxY + 10 + i * 6));

  // Tandatangan penyemak (kanan)
  const sx = PAGE_W - M - 75;
  let sy = boxY + boxH + 25;
  pdf.setDrawColor(...C_DARK); pdf.setLineWidth(0.6); pdf.line(M, sy - 8, PAGE_W - M, sy - 8); pdf.setLineWidth(0.2);
  if (e.reviewSignature) {
    try { pdf.addImage(e.reviewSignature, 'PNG', sx + 15, sy, 45, 20, undefined, 'FAST'); } catch { /* abaikan */ }
  }
  sy += 24;
  pdf.setDrawColor(148, 163, 184); pdf.line(sx, sy, sx + 75, sy);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...C_DARK);
  pdf.text(clean(e.reviewedBy || 'PENTADBIR').toUpperCase(), sx + 37.5, sy + 6, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...C_LABEL);
  if (e.reviewerDesignation) pdf.text(clean(e.reviewerDesignation).toUpperCase(), sx + 37.5, sy + 11, { align: 'center' });
  if (e.reviewedAt) pdf.text(`Tarikh: ${new Date(e.reviewedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`, sx + 37.5, sy + 16, { align: 'center' });
}

export const hasReviewSheet = (erphs: ERPHData[]) =>
  erphs[0]?.status === ERPHStatus.REVIEWED || erphs[0]?.status === ERPHStatus.SELESAI;

/** Tambah imej halaman (fallback Jawi) — JPEG kualiti tinggi, muat dalam A4. */
export function addImagePage(pdf: jsPDF, img: string, first: boolean) {
  const props = pdf.getImageProperties(img);
  const w = PAGE_W * 0.95;
  let h = w * (props.height / props.width);
  if (h > PAGE_H * 0.95) h = PAGE_H * 0.95;
  if (!first) pdf.addPage();
  pdf.addImage(img, 'JPEG', (PAGE_W - w) / 2, (PAGE_H - h) / 2, w, h, undefined, 'FAST');
}

/**
 * Tambah semua halaman bagi satu minggu RPH ke dalam `pdf`.
 * `renderImage(i)` dipanggil HANYA untuk halaman yang perlu imej (Jawi):
 *   i = indeks RPH, atau i = erphs.length untuk helaian ulasan mingguan.
 * Pulangkan bilangan halaman yang ditambah.
 */
export async function appendWeek(
  pdf: jsPDF,
  erphs: ERPHData[],
  opts: { first: boolean; logo: string | null; renderImage?: (index: number) => Promise<string | null> }
): Promise<void> {
  let first = opts.first;
  for (let i = 0; i < erphs.length; i++) {
    const e = erphs[i];
    if (needsImageFallback(e) && opts.renderImage) {
      const img = await opts.renderImage(i);
      if (img) { addImagePage(pdf, img, first); first = false; continue; }
    }
    drawRphPage(pdf, e, opts.logo, first);
    first = false;
  }
  if (hasReviewSheet(erphs)) {
    const jawi = UNSUPPORTED.test(String(erphs[0].reviewComment || '')) || /pendidikan\s*islam|اسلام/i.test(String(erphs[0].subject || ''));
    if (jawi && opts.renderImage) {
      const img = await opts.renderImage(erphs.length);
      if (img) { addImagePage(pdf, img, first); return; }
    }
    drawWeeklyReviewPage(pdf, erphs, opts.logo, first);
  }
}

/** Cipta jsPDF baharu dengan tetapan optimum (mampatan aktif). */
export const newRphPdf = () => new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
