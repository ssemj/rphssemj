import { MasterData, UserProfile, UserRole, ReviewerProfile } from './types';

// Source of Truth for Google Apps Script URL
export const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwGJAP9ArsX18LFevK6zCbcVHM6lAK8VZ5AoW3nTT0yiXBiyD4CBoNq0xXTurWUMCAd/exec";

export const sortSubjects = (subjects: string[]): string[] => {
  const topOrder = [
    'Lain-lain',
    'Bahasa Melayu',
    'English',
    'Sains',
    'Matematik',
    'Pendidikan Islam',
    'Pendidikan Moral',
    'Pendidikan Jasmani',
    'Pendidikan Kesihatan',
    'Sejarah',
    'Seni Muzik',
    'Seni Tari',
    'Seni Teater',
    'Seni Visual',
    'Alat Muzik Utama',
    'Muzik Komputer',
    'Aural & Teori',
    'Koreografi tari',
    'Tarian',
    'Aspresiasi tari',
    'Sinografi',
    'Penulisan Skrip',
    'Lakonan'
  ].map(s => s.toUpperCase());

  const bottomGroup = [
    'CUTI',
    'CUTI UMUM',
    'PENGURUSAN',
    'SERLAHAN SENI'
  ];

  return [...subjects].sort((a, b) => {
    const ua = a.toUpperCase().trim();
    const ub = b.toUpperCase().trim();

    // Check bottom group
    const isBottomA = bottomGroup.includes(ua) || ua.startsWith('PEPERIKSAAN');
    const isBottomB = bottomGroup.includes(ub) || ub.startsWith('PEPERIKSAAN');

    if (isBottomA && !isBottomB) return 1;
    if (!isBottomA && isBottomB) return -1;
    if (isBottomA && isBottomB) {
      if (ua.startsWith('PEPERIKSAAN') && ub.startsWith('PEPERIKSAAN')) return ua.localeCompare(ub);
      if (ua.startsWith('PEPERIKSAAN')) return 1;
      if (ub.startsWith('PEPERIKSAAN')) return -1;
      return bottomGroup.indexOf(ua) - bottomGroup.indexOf(ub);
    }

    // Check top order
    const indexA = topOrder.findIndex(s => ua.includes(s) || s.includes(ua));
    const indexB = topOrder.findIndex(s => ub.includes(s) || s.includes(ub));

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return ua.localeCompare(ub);
  });
};

// Google Sheet URL for Master Data
export const DATA_SOURCE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1k55_iBUkppl1zQwx8cwP517uDdJonp-bczXLBnMQgco/edit?gid=1427123325#gid=1427123325";

export const OFFICIAL_REVIEWERS: ReviewerProfile[] = [
  { name: 'TEE TIAM CHAI', designation: 'PENGETUA SSEMJ' },
  { name: 'SITI JAUHARA BINTI JAMIAN', designation: 'PKPA SSEMJ' },
  { name: 'KHAIRINA BT WAHLED @ WALID', designation: 'PK HEM SSEMJ' },
  { name: 'MUHAMAD SAFIDZAN BIN SALMAN', designation: 'PK KOKURIKULUM SSEMJ' },
  { name: 'MAH NYUK YING', designation: 'PK SENI SSEMJ' },
  { name: 'NUREMELIA BINTI MOHAMAD RAWAN', designation: 'GKMP SAINS& MATEMATIK SSEMJ' },
  { name: 'SARAVANAN A/L PALANISAMY', designation: 'GKMP BAHASA SSEMJ' },
  { name: 'MOHD FIRDAUS BIN MOHD JALIL', designation: 'GKMP SAINS KEMASYARAKATAN SSEMJ' },
  { name: 'AHMAD NAZRI BIN NORDIN', designation: 'KB SENI MUZIK SSEMJ' },
  { name: 'MOHD FAUZI BIN AHMAD SELO', designation: 'KB SENI TARI SSEMJ' },
  { name: 'IZU HANA ZILZA BINTI IMRAN', designation: 'KB SENI TEATER SSEMJ' },
  { name: 'FAEZAH BINTI BAHARI', designation: 'KB SENI VISUAL SSEMJ' },
];

export const GUEST_USER: UserProfile = {
  id: "GUEST_SSEMJ",
  name: "GURU SSEMJ",
  email: "guru@ssemj.edu.my",
  phone: "+60123456789",
  role: UserRole.GURU,
  designation: "Guru Akademik",
  department: "Bidang Kesenian",
  grade: "DG41",
  photoUrl: "",
  isRegistered: true
};

export const DEFAULT_MASTER_DATA: MasterData = {
  subjects: sortSubjects([
    'Pendidikan Seni Visual', 
    'Bahasa Melayu', 
    'Seni Tari', 
    'Seni Muzik', 
    'Seni Teater', 
    'Seni Reka'
  ]),
  hierarchy: {
    'Pendidikan Seni Visual': {
      'Tingkatan 1': {
        'ASAS SENI REKA': {
          'Unsur Seni': {
            '1.1 Garisan': {
              '1.1.1 Mengenal pasti jenis garisan': 'Kemahiran Melukis',
              '1.1.2 Menghasilkan lukisan garisan': 'Kreativiti'
            }
          }
        }
      }
    }
  },
  classes: {}, 
  resources: [], 
  bbmOptions: [
    'Buku Teks',
    'Nota',
    'Latihan',
    'Slide',
    'Komputer',
    'Lain-lain (nyatakan)'
  ],
  lastUpdated: new Date().toLocaleString()
};

export const WEEKS = Array.from({ length: 55 }, (_, i) => i + 1);
export const DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'];
export const LANGUAGES = [
  { label: 'Bahasa Melayu', value: 'BM' },
  { label: 'English', value: 'BI' },
  { label: 'Jawi', value: 'JAWI' }
];

export const TARGET_VIEWS = [
  { id: 'TAKWIM', label: 'Takwim Sekolah' },
  { id: 'PENGURUSAN', label: 'Manual Pengurusan' },
  { id: 'DSKP', label: 'Koleksi DSKP' },
  { id: 'RPT', label: 'Koleksi RPT' },
  { id: 'TEXTBOOKS', label: 'Buku Teks Digital' }
];

export const PRESET_COMMENTS = [
  "RPH disediakan dengan lengkap dan mengikut format yang ditetapkan.",
  "Objektif pembelajaran tercapai dan aktiviti yang dirancang sesuai.",
  "Tahniah, teruskan usaha dalam mempelbagaikan aktiviti PAK-21.",
  "Sila pastikan refleksi ditulis selepas sesi PdP berakhir.",
  "RPH yang sangat baik dan kreatif.",
  "Perlu penambahbaikan dalam bahagian aktiviti pengukuhan."
];

export const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

export const formatTime = (timeStr: string | undefined): string => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  }
  return timeStr;
};
