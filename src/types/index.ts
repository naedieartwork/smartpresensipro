export type StatusCategory = 'hadir_tepat' | 'hadir_telat' | 'pulang' | 'izin' | 'sakit';

export type SpecialScheduleMode = 'pulang_awal' | 'libur';

export interface SpecialScheduleSettings {
  special_schedule_enabled: boolean;
  special_schedule_day: number; // 0 (Minggu) - 6 (Sabtu), default: 5 (Jumat)
  special_schedule_mode: SpecialScheduleMode;
  special_schedule_time: string; // HH:mm, default: "10:00"
}

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed';

export type Gender = 'Laki-laki' | 'Perempuan' | '';

export interface Student {
  id: string;
  uid_kartu: string;
  rfid_uid?: string;
  nama: string;
  gender?: Gender;
  nama_wali?: string;
  no_wa_wali: string;
  rombel_id?: string;
  class_id?: string;
  kelas?: string;
  nis?: string;
  nisn?: string;
  avatar_url?: string;
  created_at?: string;
  rombel?: Rombel;
}

export interface JadwalHari {
  aktif: boolean;
  masuk: string;
  telat: string;
  pulang: string;
}

export interface Rombel {
  id: string;
  nama_kelas: string;
  nama_wali_kelas: string;
  jadwal_harian?: Record<string, JadwalHari>;
  created_at?: string;
}

export interface Holiday {
  id: string;
  tanggal: string; // YYYY-MM-DD
  keterangan: string;
  created_at?: string;
}

export interface KalenderPendidikan {
  id: string;
  tanggal_mulai: string; // YYYY-MM-DD
  tanggal_selesai: string; // YYYY-MM-DD
  keterangan: string;
  jenis: 'Libur Nasional' | 'Libur Semester' | 'Kegiatan Khusus';
  created_at?: string;
}

export interface JadwalPelajaran {
  id: string;
  rombel_id: string;
  hari: string; // 'Senin', 'Selasa', dll
  jam_mulai: string; // '07:15'
  jam_selesai: string; // '08:45'
  mata_pelajaran: string;
  guru_pengampu: string;
  created_at?: string;
}

export type AnnouncementCategory = 'Penting' | 'Akademik' | 'Kegiatan';

export interface Announcement {
  id: string;
  judul: string;
  isi: string;
  kategori: AnnouncementCategory;
  target_rombel: string; // 'Semua Kelas' atau nama kelas spesifik (misal '1A')
  tanggal: string; // YYYY-MM-DD
  is_pinned: boolean;
  broadcast_wa: boolean;
  created_at?: string;
}

export type UserRole = 'Super Admin' | 'Admin' | 'Wali Kelas' | 'Operator';

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  password_hash?: string;
  nama_lengkap?: string;
  gender?: Gender;
  nip?: string;
  role: UserRole;
  status?: 'Aktif' | 'Nonaktif';
  is_master?: boolean;
  assignedClass?: string;
  assigned_class?: string;
  rombel?: string;
  avatar_url?: string;
  avatarUrl?: string;
  avatarColor?: string;
  created_at?: string;
}

export interface AttendanceLog {
  id: string;
  uid_kartu: string;
  rfid_uid?: string;
  student_name?: string;
  student_kelas?: string;
  status_kehadiran: StatusCategory;
  waktu: string;
  metode?: 'QR' | 'RFID' | 'Manual' | 'Hybrid';
  keterangan?: string;
}

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  student_id: string;
  uid_kartu: string;
  student_name: string;
  student_kelas: string;
  jenis: 'izin' | 'sakit';
  tanggal: string; // YYYY-MM-DD
  alasan: string;
  status: LeaveRequestStatus;
  created_at: string;
  reviewed_at?: string;
}

export interface MessageTemplate {
  id: string;
  status_category: StatusCategory;
  variation_number?: number; // 1 to 4
  message_text: string;
  created_at?: string;
}

export interface WaQueueItem {
  id: string;
  no_wa_tujuan: string;
  isi_pesan: string;
  status: QueueStatus;
  created_at: string;
  sent_at?: string;
  error_message?: string;
  student_name?: string;
  status_category?: StatusCategory;
  variation_chosen?: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected: boolean;
}

export interface SidobeConfig {
  apiUrl: string;
  apiToken: string;
  senderPhone: string;
  simulateHttp: boolean;
}

export interface WorkerState {
  isRunning: boolean;
  isPaused: boolean;
  currentProcessingId: string | null;
  countdownSeconds: number; // 15s to 0s
  totalSent: number;
  totalFailed: number;
  lastRunTimestamp: string | null;
  lastLog: string;
}

export type PointActionType = 'Pelanggaran' | 'Prestasi';

export interface StudentPoint {
  id: string;
  student_id: string;
  jenis: PointActionType;
  keterangan: string;
  poin: number;
  pencatat: string;
  created_at: string;
  students?: {
    nama?: string;
    nis?: string;
    nisn?: string;
    rombel_id?: string;
    uid_kartu?: string;
    rfid_uid?: string;
  } | null;
  student_name?: string;
  student_nisn?: string;
  student_uid?: string;
  student_kelas?: string;
  rombel_id?: string;
}

