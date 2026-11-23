import { Student, MessageTemplate, AttendanceLog, WaQueueItem, StatusCategory, Rombel, AppUser } from '../types';

export const INITIAL_ROMBEL: Rombel[] = [];

export const INITIAL_USERS: AppUser[] = [
  { id: 'usr-master', username: 'naedie', password: 'password123', nama_lengkap: 'Naedie (Master Owner)', role: 'Super Admin', status: 'Aktif', is_master: true, created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 'usr-1', username: 'admin_utama', password: 'password123', nama_lengkap: 'Budi Darmawan, S.Kom.', role: 'Admin', status: 'Aktif', is_master: false, created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 'usr-2', username: 'operator_pagi', password: 'password123', nama_lengkap: 'Maya Anggraini, A.Md.', role: 'Operator', status: 'Aktif', is_master: false, created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
  { id: 'usr-3', username: 'wali_kelas', password: 'password123', nama_lengkap: 'Hesti Supriyani, S.Pd.I', nip: '19880412 201503 2 004', role: 'Wali Kelas', status: 'Aktif', is_master: false, assignedClass: '1A', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'std-1',
    uid_kartu: 'E2000019',
    rfid_uid: 'E2000019',
    nama: 'Muhammad Rizky Pratama',
    no_wa_wali: '6281234567890',
    class_id: 'rmb-1',
    kelas: 'X RPL 1',
    nis: '20241001',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'std-2',
    uid_kartu: 'A1045F20',
    rfid_uid: 'A1045F20',
    nama: 'Aisyah Putri Rahmadani',
    no_wa_wali: '6281398765432',
    class_id: 'rmb-1',
    kelas: 'X RPL 1',
    nis: '20241002',
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    id: 'std-3',
    uid_kartu: 'B3092C11',
    rfid_uid: 'B3092C11',
    nama: 'Dimas Bagus Wicaksono',
    no_wa_wali: '6285712345678',
    class_id: 'rmb-2',
    kelas: 'X RPL 2',
    nis: '20241003',
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'std-4',
    uid_kartu: 'C4081D33',
    rfid_uid: 'C4081D33',
    nama: 'Nabila Zahra Kirana',
    no_wa_wali: '6287890123456',
    class_id: 'rmb-3',
    kelas: 'XI TKJ 1',
    nis: '20231015',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'std-5',
    uid_kartu: 'D5073E44',
    rfid_uid: 'D5073E44',
    nama: 'Fajar Nugraha Saputra',
    no_wa_wali: '6282133445566',
    class_id: 'rmb-4',
    kelas: 'XI TKJ 2',
    nis: '20231022',
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'std-6',
    uid_kartu: 'F6064A55',
    rfid_uid: 'F6064A55',
    nama: 'Siti Nurhaliza Azzahra',
    no_wa_wali: '6289655443322',
    class_id: 'rmb-5',
    kelas: 'XII SIJA 1',
    nis: '20221008',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'std-7',
    uid_kartu: '77F1290C',
    rfid_uid: '77F1290C',
    nama: 'Bima Satria Wijaya',
    no_wa_wali: '6281223344551',
    class_id: 'rmb-6',
    kelas: 'XII SIJA 2',
    nis: '20221033',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'std-8',
    uid_kartu: '90DA561B',
    rfid_uid: '90DA561B',
    nama: 'Tiara Amanda Kusuma',
    no_wa_wali: '6285211998877',
    class_id: 'rmb-2',
    kelas: 'X RPL 2',
    nis: '20241018',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

// 20 Baris Data: 5 Kategori Status x 4 Variasi Teks Berbeda memuat [NAMA] dan [WAKTU]
export const INITIAL_TEMPLATES: MessageTemplate[] = [
  // --- KATEGORI: hadir_tepat (4 Variasi) ---
  {
    id: 'tmpl-ht-1',
    status_category: 'hadir_tepat',
    variation_number: 1,
    message_text: `Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari *[NAMA]*. Diberitahukan bahwa ananda telah tiba dan melakukan presensi kehadiran tepat waktu di sekolah pada pukul *[WAKTU]* WIB. Semoga proses belajar ananda hari ini lancar dan menyenangkan. Terima kasih atas kerja samanya.`,
  },
  {
    id: 'tmpl-ht-2',
    status_category: 'hadir_tepat',
    variation_number: 2,
    message_text: `Selamat pagi Bapak/Ibu Wali Murid. Kami mengonfirmasi ananda *[NAMA]* telah hadir di sekolah dengan status HADIR TEPAT WAKTU pada jam *[WAKTU]* WIB. Terima kasih atas kedisiplinan ananda dalam mematuhi jadwal sekolah.`,
  },
  {
    id: 'tmpl-ht-3',
    status_category: 'hadir_tepat',
    variation_number: 3,
    message_text: `Info Presensi Sekolah: Ananda *[NAMA]* telah tiba di gerbang sekolah dengan selamat dan tercatat hadir tepat waktu pukul *[WAKTU]* WIB. Selamat beraktivitas untuk Bapak/Ibu sekalian. Salam hangat dari pihak sekolah.`,
  },
  {
    id: 'tmpl-ht-4',
    status_category: 'hadir_tepat',
    variation_number: 4,
    message_text: `Yth. Orang tua dari ananda *[NAMA]*, sistem kartu RFID sekolah mencatat kehadiran ananda pada pukul *[WAKTU]* WIB (Kategori: Tepat Waktu). Terima kasih telah mendukung ananda berangkat pagi ke sekolah.`,
  },

  // --- KATEGORI: hadir_telat (4 Variasi) ---
  {
    id: 'tmpl-tl-1',
    status_category: 'hadir_telat',
    variation_number: 1,
    message_text: `Pemberitahuan Presensi: Yth. Orang tua dari ananda *[NAMA]*, ananda tercatat tiba di sekolah pada pukul *[WAKTU]* WIB dan tercatat TERLAMBAT. Mohon dapat memberikan pendampingan agar ananda dapat berangkat lebih awal esok hari.`,
  },
  {
    id: 'tmpl-tl-2',
    status_category: 'hadir_telat',
    variation_number: 2,
    message_text: `Assalamu'alaikum Wr. Wb. Kami menginformasikan bahwa ananda *[NAMA]* tiba di sekolah pukul *[WAKTU]* WIB melewati batas toleransi jam masuk (Terlambat). Terima kasih atas perhatian dan kerja samanya.`,
  },
  {
    id: 'tmpl-tl-3',
    status_category: 'hadir_telat',
    variation_number: 3,
    message_text: `Laporan Kehadiran: Ananda *[NAMA]* telah memasuki lingkungan sekolah pada jam *[WAKTU]* WIB dengan status Terlambat. Mohon kerja sama Bapak/Ibu untuk mengevaluasi waktu keberangkatan dari rumah.`,
  },
  {
    id: 'tmpl-tl-4',
    status_category: 'hadir_telat',
    variation_number: 4,
    message_text: `Yth. Bapak/Ibu Wali dari *[NAMA]*, ananda telah melakukan presensi di gerbang pada pukul *[WAKTU]* WIB (Status: Terlambat). Semoga di hari berikutnya ananda bisa hadir tepat waktu. Terima kasih.`,
  },

  // --- KATEGORI: pulang (4 Variasi) ---
  {
    id: 'tmpl-pl-1',
    status_category: 'pulang',
    variation_number: 1,
    message_text: `Assalamu'alaikum Wr. Wb. Kegiatan belajar mengajar telah selesai. Ananda *[NAMA]* telah melakukan presensi PULANG sekolah pada pukul *[WAKTU]* WIB. Semoga ananda sampai di rumah dengan selamat dan sehat walafiat.`,
  },
  {
    id: 'tmpl-pl-2',
    status_category: 'pulang',
    variation_number: 2,
    message_text: `Info Kepulangan Siswa: Ananda *[NAMA]* telah meninggalkan area sekolah pada jam *[WAKTU]* WIB. Mohon dipantau perjalanan ananda kembali ke rumah. Terima kasih atas perhatiannya.`,
  },
  {
    id: 'tmpl-pl-3',
    status_category: 'pulang',
    variation_number: 3,
    message_text: `Yth. Orang tua dari *[NAMA]*, jam pelajaran sekolah hari ini telah usai. Ananda tercatat melakukan tap kartu kepulangan pada pukul *[WAKTU]* WIB. Hati-hati di jalan untuk ananda tercinta.`,
  },
  {
    id: 'tmpl-pl-4',
    status_category: 'pulang',
    variation_number: 4,
    message_text: `Pemberitahuan Presensi Pulang: Ananda *[NAMA]* telah selesai beraktivitas di sekolah dan tercatat pulang pada *[WAKTU]* WIB. Selamat beristirahat bersama keluarga di rumah.`,
  },

  // --- KATEGORI: izin (4 Variasi) ---
  {
    id: 'tmpl-iz-1',
    status_category: 'izin',
    variation_number: 1,
    message_text: `Konfirmasi Presensi: Surat atau pemberitahuan izin untuk ananda *[NAMA]* telah kami terima dan tercatat di sistem presensi sekolah pada pukul *[WAKTU]* WIB (Status: IZIN). Terima kasih atas konfirmasinya.`,
  },
  {
    id: 'tmpl-iz-2',
    status_category: 'izin',
    variation_number: 2,
    message_text: `Yth. Bapak/Ibu Wali Murid, laporan izin tidak hadir untuk ananda *[NAMA]* telah berhasil divalidasi oleh piket sekolah pada jam *[WAKTU]* WIB. Terima kasih atas kerja sama Bapak/Ibu.`,
  },
  {
    id: 'tmpl-iz-3',
    status_category: 'izin',
    variation_number: 3,
    message_text: `Info Kehadiran: Status kehadiran ananda *[NAMA]* hari ini tercatat dengan keterangan 'IZIN' per pukul *[WAKTU]* WIB. Terima kasih telah mengabari pihak sekolah.`,
  },
  {
    id: 'tmpl-iz-4',
    status_category: 'izin',
    variation_number: 4,
    message_text: `Catatan Presensi Sekolah: Ananda *[NAMA]* terdata berstatus Izin pada pukul *[WAKTU]* WIB. Semoga urusan dan keperluan ananda sekeluarga berjalan lancar.`,
  },

  // --- KATEGORI: sakit (4 Variasi) ---
  {
    id: 'tmpl-sk-1',
    status_category: 'sakit',
    variation_number: 1,
    message_text: `Konfirmasi Kesehatan: Pemberitahuan sakit untuk ananda *[NAMA]* telah tercatat di sistem presensi sekolah pada pukul *[WAKTU]* WIB. Segenap bapak/ibu guru mendoakan semoga ananda lekas sembuh dan pulih kembali.`,
  },
  {
    id: 'tmpl-sk-2',
    status_category: 'sakit',
    variation_number: 2,
    message_text: `Yth. Orang tua *[NAMA]*, konfirmasi bahwa ananda sedang sakit dan beristirahat telah kami catat pada jam *[WAKTU]* WIB. Semoga ananda segera sembuh dan dapat beraktivitas kembali.`,
  },
  {
    id: 'tmpl-sk-3',
    status_category: 'sakit',
    variation_number: 3,
    message_text: `Info Ketidakhadiran: Ananda *[NAMA]* tercatat tidak masuk sekolah dengan status 'SAKIT' pada pukul *[WAKTU]* WIB. Istirahat yang cukup untuk ananda tercinta.`,
  },
  {
    id: 'tmpl-sk-4',
    status_category: 'sakit',
    variation_number: 4,
    message_text: `Pemberitahuan Sekolah: Data izin sakit ananda *[NAMA]* telah masuk ke jurnal kelas per pukul *[WAKTU]* WIB. Lekas sembuh untuk ananda. Terima kasih atas pemberitahuan Bapak/Ibu.`,
  },
];

export const INITIAL_ATTENDANCE: AttendanceLog[] = [
  {
    id: 'att-1',
    uid_kartu: 'E2000019',
    rfid_uid: 'E2000019',
    student_name: 'Muhammad Rizky Pratama',
    waktu: new Date(Date.now() - 3600000 * 2).toISOString(),
    status_kehadiran: 'hadir_tepat',
    metode: 'Hybrid',
  },
  {
    id: 'att-2',
    uid_kartu: 'A1045F20',
    rfid_uid: 'A1045F20',
    student_name: 'Aisyah Putri Rahmadani',
    waktu: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    status_kehadiran: 'hadir_tepat',
    metode: 'QR',
  },
  {
    id: 'att-3',
    uid_kartu: 'B3092C11',
    rfid_uid: 'B3092C11',
    student_name: 'Dimas Bagus Wicaksono',
    waktu: new Date(Date.now() - 3600000 * 1).toISOString(),
    status_kehadiran: 'hadir_telat',
    metode: 'RFID',
  },
];

export const INITIAL_QUEUE: WaQueueItem[] = [
  {
    id: 'wq-1',
    no_wa_tujuan: '6281234567890',
    isi_pesan: `Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari *Muhammad Rizky Pratama*. Diberitahukan bahwa ananda telah tiba dan melakukan presensi kehadiran tepat waktu di sekolah pada pukul *06:45* WIB. Semoga proses belajar ananda hari ini lancar dan menyenangkan. Terima kasih atas kerja samanya.`,
    status: 'sent',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    sent_at: new Date(Date.now() - 3600000 * 2 + 15000).toISOString(),
    student_name: 'Muhammad Rizky Pratama',
    status_category: 'hadir_tepat',
    variation_chosen: 1,
  },
  {
    id: 'wq-2',
    no_wa_tujuan: '6281398765432',
    isi_pesan: `Selamat pagi Bapak/Ibu Wali Murid. Kami mengonfirmasi ananda *Aisyah Putri Rahmadani* telah hadir di sekolah dengan status HADIR TEPAT WAKTU pada jam *06:52* WIB. Terima kasih atas kedisiplinan ananda dalam mematuhi jadwal sekolah.`,
    status: 'sent',
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    sent_at: new Date(Date.now() - 3600000 * 1.5 + 15000).toISOString(),
    student_name: 'Aisyah Putri Rahmadani',
    status_category: 'hadir_tepat',
    variation_chosen: 2,
  },
  {
    id: 'wq-3',
    no_wa_tujuan: '6285712345678',
    isi_pesan: `Pemberitahuan Presensi: Yth. Orang tua dari ananda *Dimas Bagus Wicaksono*, ananda tercatat tiba di sekolah pada pukul *07:20* WIB dan tercatat TERLAMBAT. Mohon dapat memberikan pendampingan agar ananda dapat berangkat lebih awal esok hari.`,
    status: 'pending',
    created_at: new Date(Date.now() - 60000 * 2).toISOString(),
    student_name: 'Dimas Bagus Wicaksono',
    status_category: 'hadir_telat',
    variation_chosen: 1,
  },
];
