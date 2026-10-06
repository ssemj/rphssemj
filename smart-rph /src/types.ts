
export enum UserRole {
  GURU = 'GURU',
  ADMIN = 'ADMIN'
}

export enum ERPHStatus {
  DRAFT = 'DRAFT',
  SELESAI = 'DIHANTAR', 
  REVIEWED = 'DISEMAK'
}

export interface ScheduleSlot {
  id: string;
  teacherId: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  className: string;
  classTitle: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  designation: string;
  department: string;
  grade: string;
  photoUrl: string;
  isRegistered?: boolean;
  raw?: any;
}

export interface Resource {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileData: string; 
  targetView: string; 
  uploadedAt: string;
  uploaderId?: string;
}

export interface DskpLink {
  id: string;
  label: string;
  url: string;
}

export interface WeeklyBundle {
  timestamp: string;      // Kolum A
  teacherName: string;    // Kolum B
  week: string;           // Kolum C
  id_minggu: string;      // Kolum D
  status_proses: string;  // Kolum E
  jana_url: string;       // Kolum F
  pdfBase64?: string;     // Kolum G
  teacherId: string;      // Kolum H
  rphIds: string;         // Kolum I
  status: string;         // Alias untuk status_proses
  comment?: string;       // Kolum J
  signature?: string;     // Kolum K
  reviewedBy?: string;    // Kolum L
  reviewerDesignation?: string; // Tambahan untuk jawatan
  linkPdfSelesai?: string; // Kolum M
}

export interface PeerFeedback {
  id: string;
  reviewerId: string;
  reviewerName: string;
  comment: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'ANNOUNCEMENT' | 'MESSAGE' | 'SYSTEM';
  read?: boolean;
  recipientId?: string;
}

export interface ERPHData {
  id: string;
  teacherId: string;
  teacherName: string;
  week: number;
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  className: string; 
  classTitle: string; 
  subject: string;
  field: string; 
  title: string; 
  sk: string; 
  sp: string; 
  core: string; 
  objective: string;
  activities: string;
  bbm: string;
  reflection: string;
  language: 'BM' | 'BI' | 'JAWI';
  status: ERPHStatus;
  reviewComment?: string;
  reviewSignature?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerDesignation?: string;
  isObservation?: boolean;
  observationComment?: string;
  observationSignature?: string;
  observedBy?: string;
  observerDesignation?: string;
  observedAt?: string;
  sharedWith?: string[]; // Array of teacher IDs
  peerFeedback?: PeerFeedback[];
}

export interface ReviewerProfile {
  name: string;
  designation: string;
  signature?: string; // Base64 or URL
}

export interface MasterData {
  subjects: string[];
  hierarchy: Record<string, any>;
  classes: Record<string, string[]>;
  resources: Resource[]; 
  dskpLinks?: DskpLink[];
  bbmOptions?: string[];
  lastUpdated?: string;
}

export interface AIResponse {
  objective: string;
  activities: string;
  bbm: string;
  reflection: string;
}

export interface SignaturePadProps {
  onSign: (dataUrl: string) => void;
  initialValue?: string;
}
// ===== DSKP (Pangkalan Data Firestore) =====
export interface DskpRow {
  title: string;        // Tajuk / Unit / Tema
  field: string;        // Bidang / Kemahiran / Modul ("Umum" jika tiada)
  sk: string;           // Standard Kandungan, cth "1.1 Bahasa Seni Visual"
  sp: string;           // Standard Pembelajaran, cth "1.1.1 Mengenal pasti ..."
  core?: string;        // Teras / Elektif
  performance?: string; // Standard Prestasi (TP1–TP6) ringkas
  notes?: string;       // Catatan / cadangan aktiviti dari DSKP
}

export interface DskpDocument {
  id: string;
  subject: string;
  form: string;         // Mesti sepadan dengan kunci kelas, cth "Tingkatan 1"
  rows: DskpRow[];
  /** Senarai pilihan bebas (tidak berhierarki) untuk borang eRPH */
  options?: DskpOptions;
  sourceFile?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ===== Kalendar Akademik (Firestore: settings/academicCalendar) =====
export interface CalendarHoliday {
  name: string;   // cth "Cuti Penggal 1" / "Hari Malaysia"
  start: string;  // yyyy-mm-dd
  end: string;    // yyyy-mm-dd (termasuk)
}

export interface AcademicCalendar {
  year: string;          // cth "2026"
  week1Monday: string;   // tarikh Isnin bagi Minggu 1 (yyyy-mm-dd)
  holidays: CalendarHoliday[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface DskpOptions {
  tema?: string[];     // cth English: People and Culture, Health and Environment...
  bidang?: string[];   // Bidang / Skill: Listening, Speaking...
  tajuk?: string[];    // Tajuk / Unit
}
