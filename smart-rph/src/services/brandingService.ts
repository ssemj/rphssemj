// ============================================================
// Identiti Sekolah (logo + nama) — Firestore: settings/branding
// Logo disimpan sebagai dataURL PNG yang dikecilkan (≈20–80 KB),
// jadi tidak perlu Firebase Storage. Dicache dalam localStorage
// supaya logo terus muncul walaupun sebelum Firestore dibaca.
// ============================================================
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Branding {
  logo: string | null;        // dataURL PNG
  schoolName: string;         // cth "SEKOLAH SENI MALAYSIA JOHOR"
  updatedAt?: string;
}

export const DEFAULT_SCHOOL_NAME = 'SEKOLAH SENI MALAYSIA JOHOR';
const CACHE_KEY = 'ssemj_branding_v1';
const REF = () => doc(db, 'settings', 'branding');

const readCache = (): Branding => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { logo: null, schoolName: DEFAULT_SCHOOL_NAME, ...JSON.parse(raw) };
  } catch { /* abaikan */ }
  return { logo: null, schoolName: DEFAULT_SCHOOL_NAME };
};

let current: Branding = readCache();
const listeners = new Set<(b: Branding) => void>();
const publish = (b: Branding) => {
  current = b;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(b)); } catch { /* kuota penuh — abaikan */ }
  listeners.forEach(l => l(b));
};

export const getBranding = () => current;

/** Hook React — komponen dikemas kini automatik bila logo ditukar. */
export function useBranding(): Branding {
  const [b, setB] = useState<Branding>(current);
  useEffect(() => { listeners.add(setB); return () => { listeners.delete(setB); }; }, []);
  return b;
}

let loading: Promise<void> | null = null;
export function loadBranding(): Promise<void> {
  if (!loading) {
    loading = Promise.race([
      getDoc(REF()),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
    ])
      .then(snap => {
        if (!snap.exists()) return;
        const d = snap.data() as any;
        publish({ logo: d.logo || null, schoolName: d.schoolName || DEFAULT_SCHOOL_NAME, updatedAt: d.updatedAt });
      })
      .catch(err => { console.warn('Gagal memuatkan logo sekolah:', err); loading = null; });
  }
  return loading;
}

/** Kecilkan imej ke saiz maksimum & tukar ke PNG (kekal latar lut sinar). */
export function resizeImageFile(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca fail imej.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Fail bukan imej yang sah.'));
      img.onload = () => {
        const s = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function saveBranding(b: { logo: string | null; schoolName: string }) {
  if (b.logo && b.logo.length > 900_000) throw new Error('Logo terlalu besar selepas dimampatkan. Guna imej yang lebih ringkas.');
  const data = { logo: b.logo || '', schoolName: (b.schoolName || DEFAULT_SCHOOL_NAME).trim().toUpperCase(), updatedAt: new Date().toISOString() };
  await Promise.race([
    setDoc(REF(), data),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Firestore tidak memberi respons')), 15000)),
  ]);
  publish({ logo: data.logo || null, schoolName: data.schoolName, updatedAt: data.updatedAt });
}
