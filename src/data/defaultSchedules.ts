import { JadwalPelajaran } from '../types';

export interface DummyScheduleItem {
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  guru_pengampu: string;
}

// Jadwal Pelajaran Dummy Standar Kelas 1A (Senin s.d. Jumat)
export const DEFAULT_SCHEDULE_1A: DummyScheduleItem[] = [
  // SENIN
  { hari: 'Senin', jam_mulai: '07:00', jam_selesai: '07:45', mata_pelajaran: 'Upacara Bendera', guru_pengampu: 'Drs. Supriyanto' },
  { hari: 'Senin', jam_mulai: '07:45', jam_selesai: '09:05', mata_pelajaran: 'Pendidikan Agama Islam', guru_pengampu: 'H. Abdullah, S.Ag' },
  { hari: 'Senin', jam_mulai: '09:05', jam_selesai: '09:30', mata_pelajaran: 'Istirahat Pagi', guru_pengampu: 'Guru Piket' },
  { hari: 'Senin', jam_mulai: '09:30', jam_selesai: '11:30', mata_pelajaran: 'Bahasa Indonesia', guru_pengampu: 'Siti Aminah, M.Pd.' },

  // SELASA
  { hari: 'Selasa', jam_mulai: '07:15', jam_selesai: '08:45', mata_pelajaran: 'Matematika Dasar', guru_pengampu: 'Budi Santoso, S.Pd.' },
  { hari: 'Selasa', jam_mulai: '08:45', jam_selesai: '09:15', mata_pelajaran: 'Istirahat Pagi', guru_pengampu: 'Guru Piket' },
  { hari: 'Selasa', jam_mulai: '09:15', jam_selesai: '10:45', mata_pelajaran: 'Pendidikan Pancasila (PPKn)', guru_pengampu: 'Nurul Hidayati, S.Pd.' },
  { hari: 'Selasa', jam_mulai: '10:45', jam_selesai: '12:00', mata_pelajaran: 'Seni Budaya & Prakarya', guru_pengampu: 'Ratna Dewi, S.Pd.' },

  // RABU
  { hari: 'Rabu', jam_mulai: '07:15', jam_selesai: '09:00', mata_pelajaran: 'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)', guru_pengampu: 'Coach Hendra, M.Or' },
  { hari: 'Rabu', jam_mulai: '09:00', jam_selesai: '09:30', mata_pelajaran: 'Istirahat Pagi', guru_pengampu: 'Guru Piket' },
  { hari: 'Rabu', jam_mulai: '09:30', jam_selesai: '11:00', mata_pelajaran: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', guru_pengampu: 'Dr. Rahmat Hidayat' },
  { hari: 'Rabu', jam_mulai: '11:00', jam_selesai: '12:00', mata_pelajaran: 'Bahasa Inggris', guru_pengampu: 'Maya Anggraini, S.Pd.' },

  // KAMIS
  { hari: 'Kamis', jam_mulai: '07:15', jam_selesai: '08:45', mata_pelajaran: 'Literasi & Numerasi', guru_pengampu: 'Siti Aminah, M.Pd.' },
  { hari: 'Kamis', jam_mulai: '08:45', jam_selesai: '09:15', mata_pelajaran: 'Istirahat Pagi', guru_pengampu: 'Guru Piket' },
  { hari: 'Kamis', jam_mulai: '09:15', jam_selesai: '10:45', mata_pelajaran: 'Matematika Dasar', guru_pengampu: 'Budi Santoso, S.Pd.' },
  { hari: 'Kamis', jam_mulai: '10:45', jam_selesai: '12:00', mata_pelajaran: 'Bahasa Daerah / Muatan Lokal', guru_pengampu: 'Joko Prabowo, S.Pd.' },

  // JUMAT
  { hari: 'Jumat', jam_mulai: '07:00', jam_selesai: '07:45', mata_pelajaran: 'Senam Pagi & Pembiasaan Karakter', guru_pengampu: 'Coach Hendra, M.Or' },
  { hari: 'Jumat', jam_mulai: '07:45', jam_selesai: '09:15', mata_pelajaran: 'Pendidikan Agama & Budi Pekerti', guru_pengampu: 'H. Abdullah, S.Ag' },
  { hari: 'Jumat', jam_mulai: '09:15', jam_selesai: '09:45', mata_pelajaran: 'Istirahat Pagi', guru_pengampu: 'Guru Piket' },
  { hari: 'Jumat', jam_mulai: '09:45', jam_selesai: '11:15', mata_pelajaran: 'Projek Penguatan Profil Pelajar Pancasila (P5)', guru_pengampu: 'Tim Guru Kelas 1' },
];
