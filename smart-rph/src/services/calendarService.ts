// ============================================================
// Kalendar Akademik — tarikh setiap minggu persekolahan
// Disimpan di Firestore: settings/academicCalendar (dikongsi semua guru)
// Nombor minggu dikira berterusan (minggu cuti juga diberi nombor).
// ============================================================
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { AcademicCalendar, CalendarHoliday } from "../types";

const REF = () => doc(db, "settings", "academicCalendar");

const withTimeout = <T,>(p: Promise<T>, ms = 15000): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Firestore tidak memberi respons")), ms))]);

// ---- Utiliti tarikh (tengah hari untuk elak isu zon masa) ----
export const parseDate = (s: string) => new Date(`${s}T12:00:00`);
export const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (s: string, n: number) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
export const mondayOf = (s: string) => { const d = parseDate(s); const wd = d.getDay() || 7; d.setDate(d.getDate() - (wd - 1)); return fmtDate(d); };
export const todayStr = () => fmtDate(new Date());

/** Tarikh Isnin bagi minggu ke-N. */
export const weekToMonday = (cal: AcademicCalendar, week: number) => addDays(mondayOf(cal.week1Monday), (week - 1) * 7);

/** Nombor minggu bagi sesuatu tarikh (boleh < 1 jika sebelum Minggu 1). */
export const dateToWeek = (cal: AcademicCalendar, date: string) => {
  const diff = Math.round((parseDate(mondayOf(date)).getTime() - parseDate(mondayOf(cal.week1Monday)).getTime()) / 86400000);
  return Math.floor(diff / 7) + 1;
};

/** Nama cuti jika tarikh berada dalam julat cuti, jika tidak null. */
export const holidayOn = (cal: AcademicCalendar | null | undefined, date: string): CalendarHoliday | null =>
  cal?.holidays?.find(h => h.start && h.end && date >= h.start && date <= h.end) || null;

export async function loadCalendar(): Promise<AcademicCalendar | null> {
  const snap = await withTimeout(getDoc(REF()));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  if (!d.week1Monday) return null;
  return { year: d.year || "", week1Monday: d.week1Monday, holidays: Array.isArray(d.holidays) ? d.holidays : [], updatedAt: d.updatedAt, updatedBy: d.updatedBy };
}

export async function saveCalendar(cal: AcademicCalendar, updatedBy = ""): Promise<void> {
  const clean: AcademicCalendar = {
    year: cal.year || "",
    week1Monday: mondayOf(cal.week1Monday),
    holidays: (cal.holidays || [])
      .filter(h => h.start && h.end && h.name.trim())
      .map(h => ({ name: h.name.trim(), start: h.start, end: h.end < h.start ? h.start : h.end }))
      .sort((a, b) => a.start.localeCompare(b.start)),
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await withTimeout(setDoc(REF(), clean));
}
