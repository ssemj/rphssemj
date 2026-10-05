// ============================================================
// Pangkalan Data DSKP (Firestore)
// Koleksi: "dskp"  — satu dokumen bagi setiap Subjek + Tingkatan
// ============================================================
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { DskpDocument, DskpOptions, DskpRow, MasterData } from "../types";

const COLLECTION = "dskp";

/** Firestore menunggu tanpa had bila luar talian — hadkan masa supaya UI tidak tersangkut. */
const withTimeout = <T,>(p: Promise<T>, ms = 20000, what = "Firestore"): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} tidak memberi respons (semak sambungan internet / Firestore Rules)`)), ms)
    ),
  ]);

/** ID dokumen yang stabil, cth: "SENI-VISUAL__TINGKATAN-1" */
export const dskpDocId = (subject: string, form: string) =>
  `${subject}__${form}`
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** Bersihkan baris: buang ruang berlebihan, isi nilai lalai, buang baris tidak lengkap & pendua. */
export const cleanRows = (rows: DskpRow[]): DskpRow[] => {
  const seen = new Set<string>();
  const out: DskpRow[] = [];
  for (const r of rows) {
    const t = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
    const row: DskpRow = {
      title: t(r.title),
      field: t(r.field) || "Umum",
      sk: t(r.sk),
      sp: t(r.sp),
      core: t(r.core) || "Teras",
      performance: t(r.performance),
      notes: t(r.notes),
    };
    if (!row.title || !row.sk || !row.sp) continue;
    const key = `${row.title}|${row.field}|${row.sk}|${row.sp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
};

export async function saveDskp(input: Omit<DskpDocument, "id" | "updatedAt">): Promise<DskpDocument> {
  const id = dskpDocId(input.subject, input.form);
  const rows = cleanRows(input.rows);
  // Nota: Firestore menolak nilai `undefined`, jadi semua medan diisi secara eksplisit.
  const payload = {
    subject: input.subject.trim(),
    form: input.form.trim(),
    sourceFile: input.sourceFile || "",
    updatedBy: input.updatedBy || "",
    rows,
    rowCount: rows.length,
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  };
  await withTimeout(setDoc(doc(db, COLLECTION, id), payload, { merge: true }));   // merge: kekalkan senarai pilihan (options)
  return { ...payload, id } as DskpDocument;
}

export async function loadAllDskp(): Promise<DskpDocument[]> {
  const snap = await withTimeout(getDocs(collection(db, COLLECTION)), 15000);
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      subject: data.subject,
      form: data.form,
      rows: Array.isArray(data.rows) ? data.rows : [],
      options: data.options || undefined,
      sourceFile: data.sourceFile,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    } as DskpDocument;
  });
}

export async function deleteDskp(id: string) {
  await withTimeout(deleteDoc(doc(db, COLLECTION, id)));
}

/**
 * Gabungkan DSKP dari Firestore ke dalam masterData.hierarchy sedia ada
 * (Subjek → Tingkatan → Tajuk → Bidang → SK → SP → Teras).
 * Data Firestore menggantikan cabang Subjek+Tingkatan yang sama.
 */
export function mergeDskpIntoMasterData(master: MasterData, docs: DskpDocument[]): MasterData {
  if (!docs.length) return master;
  const hierarchy: Record<string, any> = { ...(master.hierarchy || {}) };
  const subjects = new Set(master.subjects || []);

  for (const d of docs) {
    if (!d.subject || !d.form) continue;
    subjects.add(d.subject);
    if (!d.rows.length) continue;   // dokumen senarai pilihan sahaja → jangan ganti hierarki sedia ada
    const formBranch: Record<string, any> = {};
    for (const r of d.rows) {
      const field = r.field || "Umum";
      formBranch[r.title] ??= {};
      formBranch[r.title][field] ??= {};
      formBranch[r.title][field][r.sk] ??= {};
      formBranch[r.title][field][r.sk][r.sp] = r.core || "Teras";
    }
    hierarchy[d.subject] = { ...(hierarchy[d.subject] || {}), [d.form]: formBranch };
  }
  return { ...master, hierarchy, subjects: Array.from(subjects) };
}

/** Cari baris DSKP penuh (termasuk TP & catatan) untuk pilihan dalam borang eRPH. */
export function findDskpRows(
  docs: DskpDocument[],
  subject?: string,
  form?: string,
  title?: string,
  sks: string[] = [],
  sps: string[] = []
): DskpRow[] {
  const d = docs.find(x => x.subject === subject && x.form === form);
  if (!d) return [];
  // Hanya SK & SP yang berkait — Tajuk/Bidang bebas dipilih guru
  return d.rows.filter(r => (sks.length === 0 || sks.includes(r.sk)) && (sps.length === 0 || sps.includes(r.sp)));
}

const cleanList = (l?: string[]) => Array.from(new Set((l || []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean)));

/** Simpan senarai pilihan (Tema / Bidang / Tajuk) bagi Subjek + Tingkatan tanpa mengusik baris SK/SP. */
export async function saveDskpOptions(subject: string, form: string, options: DskpOptions, updatedBy = "") {
  const id = dskpDocId(subject, form);
  const ref = doc(db, COLLECTION, id);
  const existing = await withTimeout(getDoc(ref));
  const payload: any = {
    subject: subject.trim(), form: form.trim(),
    options: { tema: cleanList(options.tema), bidang: cleanList(options.bidang), tajuk: cleanList(options.tajuk) },
    updatedAt: new Date().toISOString(), updatedBy,
  };
  if (!existing.exists()) { payload.rows = []; payload.rowCount = 0; payload.sourceFile = ""; }
  await withTimeout(setDoc(ref, payload, { merge: true }));
}

/** Gabung pilihan bebas dengan item daripada hierarki (supaya pilihan lama tidak hilang). */
export function getFormOptions(master: MasterData, docs: DskpDocument[], subject?: string, form?: string) {
  const branch: Record<string, any> = (subject && form && master.hierarchy?.[subject]?.[form]) || {};
  const opt = docs.find(d => d.subject === subject && d.form === form)?.options || {};
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
  const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const hierTitles = Object.keys(branch).sort(natural);
  const hierFields = uniq(Object.values(branch).flatMap((t: any) => Object.keys(t || {}))).sort(natural);
  // Indeks SK → SP → Teras merentas semua tajuk/bidang
  const skIndex: Record<string, Record<string, string>> = {};
  Object.values(branch).forEach((t: any) => Object.values(t || {}).forEach((f: any) =>
    Object.entries(f || {}).forEach(([sk, sps]: [string, any]) => {
      skIndex[sk] ??= {};
      Object.entries(sps || {}).forEach(([sp, core]) => { skIndex[sk][sp] = String(core || ''); });
    })));
  return {
    tema: uniq(opt.tema || []),
    bidang: uniq([...(opt.bidang || []), ...hierFields]),
    tajuk: uniq([...(opt.tajuk || []), ...hierTitles]),
    skIndex,
    sks: Object.keys(skIndex).sort(natural),
  };
}

/** Medan "field" menyimpan Tema & Bidang bersama: "Tema | Bidang" (serasi dengan Google Sheet sedia ada). */
export const FIELD_SEP = ' | ';
export const splitField = (field?: string) => {
  const s = String(field || '');
  const i = s.indexOf(FIELD_SEP);
  return i >= 0 ? { tema: s.slice(0, i), bidang: s.slice(i + FIELD_SEP.length) } : { tema: '', bidang: s };
};
export const joinField = (tema: string, bidang: string) => (tema ? `${tema}${FIELD_SEP}${bidang}` : bidang);
