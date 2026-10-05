// ============================================================
// Servis AI Gemini
//  1. extractDskp()     — baca dokumen DSKP (PDF / DOCX / teks) → baris SK/SP berstruktur
//  2. generateErphContent() — jana Objektif, Aktiviti, BBM & Refleksi berdasarkan DSKP
// Kunci API disimpan dalam localStorage ("gemini_api_key") melalui halaman Tetapan.
// ============================================================
import { GoogleGenAI, Type } from "@google/genai";
import { DskpRow } from "../types";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export const getGeminiKey = (): string =>
  localStorage.getItem("gemini_api_key") || (process.env.GEMINI_API_KEY as string) || "";

export const getGeminiModel = (): string =>
  localStorage.getItem("gemini_model") || DEFAULT_GEMINI_MODEL;

const client = () => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Kunci API Gemini belum ditetapkan. Sila masukkan di halaman Tetapan.");
  return new GoogleGenAI({ apiKey });
};

// ---------- Cuba semula + model sandaran ----------
// Model sandaran dicuba mengikut turutan bila model utama sesak (503) atau had kuota (429).
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];

const isTransient = (e: any) => {
  const msg = String(e?.message || e);
  return /\b(503|429|500|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|INTERNAL)\b/i.test(msg);
};
const isModelMissing = (e: any) => /\b(404|NOT_FOUND)\b|is not found|not supported/i.test(String(e?.message || e));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generateWithFallback(
  params: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">,
  onProgress?: (msg: string) => void
) {
  const ai = client();
  const models = Array.from(new Set([getGeminiModel(), ...FALLBACK_MODELS]));
  let lastErr: any;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model } as any);
      } catch (e: any) {
        lastErr = e;
        if (isModelMissing(e)) break;              // model tiada → terus cuba model seterusnya
        if (!isTransient(e)) throw e;              // ralat lain (cth kunci salah) → henti
        onProgress?.(`Pelayan Gemini (${model}) sesak — mencuba semula...`);
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw new Error(
    "Semua model Gemini sedang sesak buat masa ini. Sila cuba lagi dalam beberapa minit. (" +
      String(lastErr?.message || lastErr).slice(0, 160) + ")"
  );
}

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const parseJson = <T,>(text: string | undefined): T => {
  const raw = (text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Respons AI tidak lengkap atau bukan JSON yang sah. Cuba lagi, atau hadkan julat halaman.");
  }
};

// ---------- 1. EKSTRAK DSKP ----------

const DSKP_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING, description: "Nama mata pelajaran seperti tertera pada DSKP" },
    form: { type: Type.STRING, description: "Tahap/Tingkatan, cth 'Tingkatan 1'" },
    rows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Tajuk / Unit / Tema" },
          field: { type: Type.STRING, description: "Bidang / Kemahiran / Modul. 'Umum' jika tiada" },
          sk: { type: Type.STRING, description: "Standard Kandungan lengkap dengan nombor, cth '1.1 ...'" },
          sp: { type: Type.STRING, description: "Standard Pembelajaran lengkap dengan nombor, cth '1.1.1 ...'" },
          core: { type: Type.STRING, description: "'Teras' atau 'Elektif' jika dinyatakan, jika tidak 'Teras'" },
          performance: { type: Type.STRING, description: "Ringkasan Standard Prestasi TP1-TP6 bagi SK ini (boleh kosong)" },
          notes: { type: Type.STRING, description: "Catatan / cadangan aktiviti dari lajur Catatan DSKP (boleh kosong)" },
        },
        required: ["title", "field", "sk", "sp"],
      },
    },
  },
  required: ["rows"],
};

const extractPrompt = (hints: { subject?: string; form?: string; pages?: string }) => `
Anda ialah pakar kurikulum KPM Malaysia. Dokumen ini ialah Dokumen Standard Kurikulum dan Pentaksiran (DSKP).
Ekstrak SEMUA baris Standard Pembelajaran (SP) daripada jadual "Standard Kandungan | Standard Pembelajaran | Catatan".

Peraturan:
- Satu objek bagi setiap SP. Ulang 'title', 'field' dan 'sk' bagi setiap SP di bawah SK yang sama.
- Kekalkan nombor (cth "1.1", "1.1.1") dan ayat asal DSKP. JANGAN ringkaskan atau ubah perkataan SK/SP.
- 'title' = Tajuk/Unit/Tema; 'field' = Bidang/Kemahiran/Modul (guna "Umum" jika tiada).
- 'performance' = ringkasan Standard Prestasi (TP1–TP6) yang berkaitan dengan SK tersebut, dalam satu baris (cth "TP1: ...; TP2: ...").
- 'notes' = isi lajur Catatan / cadangan aktiviti, jika ada.
- Abaikan halaman kulit, rukun negara, falsafah, pengenalan dan glosari.
${hints.subject ? `- Mata pelajaran: ${hints.subject}.` : ""}
${hints.form ? `- Ekstrak HANYA bahagian untuk ${hints.form} (jika dokumen merangkumi beberapa tingkatan/tahun).` : ""}
${hints.pages ? `- Fokus pada halaman ${hints.pages} sahaja.` : ""}
Pulangkan JSON sahaja.`;

export interface DskpExtraction {
  subject?: string;
  form?: string;
  rows: DskpRow[];
}

/**
 * Ekstrak DSKP dari fail.
 * - PDF dihantar terus ke Gemini (Gemini boleh baca jadual dalam PDF).
 * - DOCX ditukar ke HTML (jadual dikekalkan) menggunakan mammoth, kemudian dihantar sebagai teks.
 */
export async function extractDskp(
  file: File,
  hints: { subject?: string; form?: string; pages?: string } = {},
  onProgress?: (msg: string) => void
): Promise<DskpExtraction> {
  const ai = client();
  const ext = file.name.split(".").pop()?.toLowerCase();
  const parts: any[] = [];

  if (ext === "pdf") {
    if (file.size > 15 * 1024 * 1024) {
      onProgress?.("Fail besar — memuat naik ke Gemini Files API...");
      const uploaded = await ai.files.upload({ file, config: { mimeType: "application/pdf" } });
      parts.push({ fileData: { fileUri: uploaded.uri, mimeType: "application/pdf" } });
    } else {
      onProgress?.("Membaca PDF...");
      parts.push({ inlineData: { mimeType: "application/pdf", data: await fileToBase64(file) } });
    }
  } else if (ext === "docx") {
    onProgress?.("Menukar dokumen Word...");
    const mammoth = await import("mammoth");
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    parts.push({ text: `KANDUNGAN DSKP (HTML):\n${html}` });
  } else {
    throw new Error("Format tidak disokong untuk ekstrak AI. Guna PDF atau DOCX.");
  }

  parts.push({ text: extractPrompt(hints) });
  onProgress?.("AI sedang mengekstrak SK, SP dan Standard Prestasi... (boleh ambil masa 1–3 minit)");

  const res = await generateWithFallback({
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: DSKP_SCHEMA,
      temperature: 0,
      maxOutputTokens: 65536,
    },
  }, onProgress);

  const data = parseJson<DskpExtraction>(res.text);
  return { subject: data.subject, form: data.form, rows: Array.isArray(data.rows) ? data.rows : [] };
}

// ---------- 2. JANA KANDUNGAN eRPH ----------

/** Bahasa penulisan ikut subjek: Pendidikan Islam → Jawi, English → Bahasa Inggeris. */
export function subjectLanguage(subject?: string): 'BI' | 'JAWI' | null {
  const s = String(subject || '').trim();
  if (/pendidikan\s*islam|ڤنديديقن\s*اسلام|\bislam\b|اسلام/i.test(s)) return 'JAWI';
  if (/\benglish\b|bahasa\s*inggeris|\binggeris\b|literature in english/i.test(s)) return 'BI';
  return null;
}

/** Bahasa berkesan untuk penjanaan AI: ikut subjek dahulu, jika tidak ikut pilihan guru. */
export const effectiveLanguage = (subject: string | undefined, chosen: string | undefined): 'BM' | 'BI' | 'JAWI' =>
  subjectLanguage(subject) || (chosen === 'BI' || chosen === 'JAWI' ? chosen : 'BM');

export const LANG_INSTRUCTION: Record<'BM' | 'BI' | 'JAWI', string> = {
  BM: 'Tulis semua dalam Bahasa Melayu (tulisan Rumi).',
  BI: 'Write EVERYTHING in English only. Do not use any Malay words.',
  JAWI: 'Tulis SEMUA dalam tulisan JAWI (Bahasa Melayu tulisan Jawi mengikut ejaan Jawi standard DBP). JANGAN guna tulisan Rumi kecuali nombor (1, 2, 3) dan istilah Arab/al-Quran yang memang ditulis dalam huruf Arab.',
};

export const JAWI_ACTIVITY_RULES = `Senarai bernombor (1. 2. 3. ...) 4 hingga 6 langkah, SATU langkah setiap baris, merangkumi set induksi, aktiviti utama dan penutup — DITULIS DALAM JAWI.
SETIAP langkah WAJIB dimulakan dengan perkataan "موريد" dan terus diikuti kata kerja (utamakan ayat pasif seperti دڤرتونتونكن، دبريكن، دتونجوقكن، دبيمبيڠ؛ boleh juga kata kerja aktif seperti مڠاڤليكاسيكن، منداڤت، مڠحفظ).
Penanda wacana dibenarkan sebelum "موريد" (cth "كمودين موريد...", "ستروسڽ موريد...", "اخيرڽ موريد...").
Contoh:
1. موريد دڤرتونتونكن ۏيديو برکاءيتن ...
2. كمودين موريد مڠاڤليكاسيكن ...
3. موريد دبريكن لمبرن كرجا ...`;

/** Syarat penulisan aktiviti PdPC. */
export const ACTIVITY_RULES = (isBI: boolean) => isBI
  ? `A numbered list (1., 2., 3., ...) of 4 to 6 steps, ONE step per line, covering induction, main activities and closure.
Every step MUST begin with "Pupils" followed immediately by a verb, e.g. "Pupils are shown...", "Pupils are given...", "Pupils are shown a video...", "Pupils apply...", "Pupils analyse...".
A linking word may come before "Pupils" (e.g. "Then pupils apply..."). No introduction, no headings, no sub-bullets.
Example:
1. Pupils are shown a video about ...
2. Then pupils apply ...
3. Pupils are given ...`
  : `Senarai bernombor (1., 2., 3., ...) 4 hingga 6 langkah, SATU langkah setiap baris, merangkumi set induksi, aktiviti utama dan penutup.
SETIAP langkah WAJIB dimulakan dengan perkataan "Murid" dan terus diikuti KATA KERJA — utamakan ayat pasif (dipertontonkan, diberikan, ditunjukkan, dibimbing, dibahagikan, diminta) dan boleh juga kata kerja aktif (mengaplikasikan, menganalisis, membentangkan, menghasilkan).
Penanda wacana dibenarkan sebelum "murid" (cth "Kemudian murid...", "Seterusnya murid...", "Akhirnya murid...").
JANGAN mulakan langkah dengan "Guru", JANGAN beri pengenalan, tajuk atau sub-poin.
Contoh:
1. Murid dipertontonkan video berkaitan ...
2. Kemudian murid mengaplikasikan ...
3. Murid diberikan lembaran kerja ...`;

const GURU_TO_PASSIVE: Record<string, string> = {
  menunjukkan: "ditunjukkan", memberikan: "diberikan", memberi: "diberi", membimbing: "dibimbing",
  menayangkan: "dipertontonkan", mempertontonkan: "dipertontonkan", memperlihatkan: "diperlihatkan",
  membahagikan: "dibahagikan", meminta: "diminta", menerangkan: "diterangkan", menjelaskan: "dijelaskan",
  mengedarkan: "diedarkan", memperkenalkan: "diperkenalkan", mendemonstrasikan: "didemonstrasikan",
  mengarahkan: "diarahkan", menyoal: "disoal", menguji: "diuji", mengingatkan: "diingatkan",
  memperdengarkan: "diperdengarkan", membacakan: "dibacakan", menggalakkan: "digalakkan",
  menugaskan: "ditugaskan", memantau: "dipantau", membantu: "dibantu",
};

/**
 * Kemas format aktiviti: satu langkah satu baris, bernombor semula 1, 2, 3...
 * dan pastikan setiap langkah bermula dengan "Murid"/"Pupils".
 */
export function normalizeActivities(text: string, isBI: boolean, isJawi = false): string {
  if (isJawi) {
    // Jawi: susun semula nombor sahaja; pastikan setiap langkah bermula dengan "موريد" (atau penanda wacana)
    const lines = String(text || '').replace(/\r/g, '')
      .replace(/\s+(?=\d{1,2}[.)]\s)/g, '\n').split('\n')
      .map(l => l.replace(/^\s*(?:\d{1,2}[.)]|[-*•])\s*/, '').trim()).filter(Boolean);
    return lines.map((l, i) => {
      const ok = /^(موريد|كمودين|ستروسڽ|اخيرڽ|سلڤس|لالو|ستله)/.test(l);
      return `${i + 1}. ${ok ? l : 'موريد ' + l}`;
    }).join('\n');
  }
  const subject = isBI ? "Pupils" : "Murid";
  const connectors = isBI
    ? /^(then|next|after that|subsequently|finally|lastly|later)\b[\s,]*/i
    : /^(kemudian|seterusnya|selepas itu|selepas|akhirnya|lalu|setelah itu|sebelum itu)\b[\s,]*/i;
  const steps = String(text || "")
    .replace(/\r/g, "")
    .replace(/\s+(?=\d{1,2}[.)]\s)/g, "\n")               // "1. ... 2. ..." dalam satu baris → pecah
    .split("\n")
    .map(l => l.replace(/^\s*(?:\d{1,2}[.)]|[-*•])\s*/, "").trim()) // buang nombor/bullet asal
    .filter(l => l && !/^(aktiviti|activities|langkah)\b.*:$/i.test(l));
  return steps
    .map((l, i) => {
      let body = l;
      const conn = body.match(connectors)?.[0] || "";
      let rest = body.slice(conn.length);
      // "Guru menunjukkan X" → "Murid ditunjukkan X" (kata kerja lazim sahaja)
      const g = rest.match(/^guru\s+(\S+)/i);
      if (g && !isBI) {
        const passive = GURU_TO_PASSIVE[g[1].toLowerCase()];
        if (!passive) return `${i + 1}. ${conn}${rest}`;   // tak pasti → kekalkan ayat asal
        rest = `Murid ${passive}${rest.slice(g[0].length)}`;
      } else if (/^teacher\b/i.test(rest)) {
        return `${i + 1}. ${conn}${rest}`;
      }
      if (!new RegExp(`^${subject}\\b`, "i").test(rest)) rest = `${subject.toLowerCase()} ${rest}`;
      rest = rest.replace(new RegExp(`^${subject}\\b`, "i"), conn ? subject.toLowerCase() : subject);
      const connOut = conn ? conn.trim().replace(/,$/, "") + " " : "";
      const line = (connOut ? connOut.charAt(0).toUpperCase() + connOut.slice(1) : "") + rest;
      return `${i + 1}. ${line.charAt(0).toUpperCase()}${line.slice(1)}`;
    })
    .join("\n");
}

export interface ErphAiInput {
  subject?: string;
  form?: string;
  classTitle?: string;
  title?: string;
  field?: string;
  sk?: string;
  sp?: string;
  dskpRows?: DskpRow[];   // konteks penuh dari pangkalan data (TP, catatan)
  language: "BM" | "BI" | "JAWI";
  duration?: string;      // cth "60 minit"
  extraNotes?: string;    // arahan tambahan guru
}

export interface ErphAiOutput {
  objective: string;
  activities: string;
  bbm: string;
  reflection: string;
}

const ERPH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    objective: { type: Type.STRING },
    activities: { type: Type.STRING },
    bbm: { type: Type.STRING },
    reflection: { type: Type.STRING },
  },
  required: ["objective", "activities", "bbm", "reflection"],
};

export async function generateErphContent(input: ErphAiInput): Promise<ErphAiOutput> {
  const lang = effectiveLanguage(input.subject, input.language);
  const isBI = lang === "BI", isJawi = lang === "JAWI";
  const objStart = isBI ? "At the end of the lesson, pupils will be able to" : isJawi ? "دأخير ڤڠاجرن، موريد داڤت" : "Di akhir PdPC, murid dapat";
  const actStart = isBI ? "Pupils are" : isJawi ? "موريد" : "Murid";
  const refStart = isBI ? "___ out of ___ pupils were able to" : isJawi ? "___ درڤد ___ اورڠ موريد داڤت" : "___ daripada ___ orang murid dapat";

  const context = (input.dskpRows || [])
    .map(r => `- SK ${r.sk}\n  SP ${r.sp}${r.performance ? `\n  Standard Prestasi: ${r.performance}` : ""}${r.notes ? `\n  Catatan DSKP: ${r.notes}` : ""}`)
    .join("\n");

  const prompt = `
Anda ialah guru pakar di sekolah menengah Malaysia. Sediakan kandungan Rancangan Pengajaran Harian (RPH).

MAKLUMAT PdPC
- Mata pelajaran: ${input.subject || "-"}
- Tingkatan/Kelas: ${input.form || "-"} ${input.classTitle || ""}
- Tajuk: ${input.title || "-"}
- Bidang: ${input.field || "-"}
- Standard Kandungan: ${input.sk || "-"}
- Standard Pembelajaran: ${input.sp || "-"}
${input.duration ? `- Masa: ${input.duration}` : ""}
${context ? `\nKONTEKS DSKP RASMI:\n${context}` : ""}
${input.extraNotes ? `\nARAHAN TAMBAHAN GURU: ${input.extraNotes}` : ""}

FORMAT WAJIB
1. objective: SATU objektif boleh diukur, bermula "${objStart}", guna kata kerja aras Bloom yang selari dengan SP dan Standard Prestasi.
2. activities: ${isJawi ? JAWI_ACTIVITY_RULES : ACTIVITY_RULES(isBI)} Selaraskan dengan Catatan DSKP jika ada.
3. bbm: maksimum 5 Bahan Bantu Mengajar, dipisahkan koma, nama sahaja.
4. reflection: satu ayat bermula "${refStart}" diikuti isi objektif.
${LANG_INSTRUCTION[lang]}
${isBI ? "Return JSON only. All JSON values must be in English." : isJawi ? "Pulangkan JSON sahaja. SEMUA nilai JSON (objective, activities, bbm, reflection) mesti dalam tulisan Jawi." : "Pulangkan JSON sahaja."}`;

  const res = await generateWithFallback({
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: ERPH_SCHEMA, temperature: 0.6 },
  });
  const out = parseJson<ErphAiOutput>(res.text);
  return { ...out, activities: normalizeActivities(out.activities, isBI, isJawi) };
}

// ---------- 3. TUKAR RUMI → JAWI ----------
export async function convertToJawi(input: { objective: string; activities: string; reflection: string; bbm: string }): Promise<{ objective: string; activities: string; reflection: string; bbm: string }> {
  const prompt = `Anda pakar penulisan Jawi Pendidikan Islam KPM. Tukar teks Rumi di bawah kepada tulisan Jawi yang 100% tepat (ejaan Jawi standard DBP).

PERATURAN:
1. Tiada huruf Rumi (a-z) dalam output, kecuali tiada padanan langsung.
2. Hanya Unicode Jawi/Arab yang sah — tiada simbol pelik atau huruf bahasa lain.
3. Imbuhan 'di-' dan 'ke-' bersambung (دبتاچ، كماءنسيأن). Istilah syarak: القرءان، اية، سورة، آل عمران.
4. Kekalkan nombor senarai (1. 2. 3.) dan baris baharu seperti asal. Setiap langkah aktiviti dimulakan dengan "موريد".
5. Tiada markdown (**, *, \`\`\`).

Teks Rumi:
objective: ${input.objective}
activities: ${input.activities}
reflection: ${input.reflection}
bbm: ${input.bbm}

Pulangkan JSON sahaja dengan kunci objective, activities, reflection, bbm.`;
  const res = await generateWithFallback({
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: ERPH_SCHEMA, temperature: 0.2 },
  });
  const out = parseJson<{ objective: string; activities: string; reflection: string; bbm: string }>(res.text);
  return { ...out, activities: normalizeActivities(out.activities, false, true) };
}
