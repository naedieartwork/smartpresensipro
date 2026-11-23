export const SUPABASE_SQL_SCHEMA = `-- ================================================================
-- PORTAL PRESENSI SEKOLAH (SMART PRESENSI) & WHATSAPP GATEWAY (SIDOBE API)
-- FOKUS: Anti-Spam (Queue Worker Delay 15 Detik & Spintax 20 Template)
-- Target Database: Supabase (PostgreSQL)
-- ================================================================

-- 1. EXTENSION UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 2. TABEL: rombel (Data Kelas & Aturan Jadwal Harian JSONB)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.rombel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kelas VARCHAR(50) NOT NULL UNIQUE,
    nama_wali_kelas VARCHAR(150) NOT NULL,
    jadwal_harian JSONB NOT NULL DEFAULT '{"Senin": {"aktif": true, "masuk": "07:00", "telat": "07:15", "pulang": "14:00"}, "Selasa": {"aktif": true, "masuk": "07:00", "telat": "07:15", "pulang": "14:00"}, "Rabu": {"aktif": true, "masuk": "07:00", "telat": "07:15", "pulang": "14:00"}, "Kamis": {"aktif": true, "masuk": "07:00", "telat": "07:15", "pulang": "14:00"}, "Jumat": {"aktif": true, "masuk": "07:00", "telat": "07:15", "pulang": "11:30"}, "Sabtu": {"aktif": false, "masuk": "07:00", "telat": "07:15", "pulang": "12:00"}, "Minggu": {"aktif": false, "masuk": "07:00", "telat": "07:15", "pulang": "12:00"}}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rombel_nama_kelas ON public.rombel (nama_kelas);

-- ================================================================
-- 3. TABEL: holidays (Manajemen Hari Libur Sekolah)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE UNIQUE NOT NULL,
    keterangan VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holidays_tanggal ON public.holidays (tanggal);

-- ================================================================
-- 4. TABEL: kalender_pendidikan (Kalender Pendidikan & Libur Operasional)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.kalender_pendidikan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    keterangan VARCHAR(255) NOT NULL,
    jenis VARCHAR(50) NOT NULL CHECK (jenis IN ('Libur Nasional', 'Libur Semester', 'Kegiatan Khusus')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_tanggal ON public.kalender_pendidikan (tanggal_mulai, tanggal_selesai);

-- ================================================================
-- 5. TABEL: jadwal_pelajaran (Jadwal KBM Per Rombel/Kelas)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.jadwal_pelajaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rombel_id UUID REFERENCES public.rombel(id) ON DELETE CASCADE NOT NULL,
    hari VARCHAR(20) NOT NULL,
    jam_mulai VARCHAR(10) NOT NULL,
    jam_selesai VARCHAR(10) NOT NULL,
    mata_pelajaran VARCHAR(150) NOT NULL,
    guru_pengampu VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jadwal_pelajaran_rombel ON public.jadwal_pelajaran (rombel_id, hari);

-- ================================================================
-- 6. TABEL: students (Data Siswa - Hybrid QR / RFID)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid_kartu VARCHAR(50) NOT NULL UNIQUE,
    nisn VARCHAR(50) UNIQUE,
    nama VARCHAR(150) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('Laki-laki', 'Perempuan') OR gender IS NULL OR gender = ''),
    no_wa_wali VARCHAR(25) NOT NULL,
    avatar_url TEXT,
    class_id UUID REFERENCES public.rombel(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_students_uid_kartu ON public.students (uid_kartu);
CREATE INDEX IF NOT EXISTS idx_students_nisn ON public.students (nisn);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students (class_id);

-- ================================================================
-- 7. TABEL: users & app_users (Data Operator Aplikasi)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    nip VARCHAR(50),
    gender VARCHAR(20) CHECK (gender IN ('Laki-laki', 'Perempuan') OR gender IS NULL OR gender = ''),
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Operator Presensi' CHECK (role IN ('Administrator', 'Operator Presensi', 'Guru Piket')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_nip ON public.users (nip);

-- ================================================================
-- 8. TABEL: attendance_log (Riwayat Tap Presensi QR/RFID)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.attendance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid_kartu VARCHAR(50) NOT NULL,
    status_kehadiran VARCHAR(30) NOT NULL CHECK (status_kehadiran IN ('hadir_tepat', 'hadir_telat', 'pulang', 'izin', 'sakit')),
    waktu TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_log_uid_waktu ON public.attendance_log (uid_kartu, waktu DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_log_waktu ON public.attendance_log (waktu DESC);

-- ================================================================
-- 9. TABEL: message_templates (20 Template Pesan Spintax)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_category VARCHAR(30) NOT NULL CHECK (status_category IN ('hadir_tepat', 'hadir_telat', 'pulang', 'izin', 'sakit')),
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_templates_cat ON public.message_templates (status_category);

-- ================================================================
-- 10. TABEL: wa_queue (Antrean Pengiriman Anti-Spam)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.wa_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_wa_tujuan VARCHAR(25) NOT NULL,
    isi_pesan TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_wa_queue_fifo ON public.wa_queue (status, created_at ASC);

-- ================================================================
-- 10b. TABEL: leave_requests (Pengajuan Izin & Sakit Siswa)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    uid_kartu VARCHAR(50) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    student_kelas VARCHAR(50) NOT NULL DEFAULT 'Umum',
    jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('izin', 'sakit')),
    tanggal DATE NOT NULL,
    alasan TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status_created ON public.leave_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student_id ON public.leave_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_uid_kartu ON public.leave_requests (uid_kartu);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tanggal ON public.leave_requests (tanggal DESC);

-- ================================================================
-- 11. REALTIME REPLICATION (Supabase Realtime)
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rombel;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holidays;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kalender_pendidikan;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jadwal_pelajaran;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;

-- ================================================================
-- 12. ROW LEVEL SECURITY (RLS) & PUBLIC POLICIES
-- ================================================================
ALTER TABLE public.rombel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalender_pendidikan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write on rombel" ON public.rombel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on holidays" ON public.holidays FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on kalender_pendidikan" ON public.kalender_pendidikan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on jadwal_pelajaran" ON public.jadwal_pelajaran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on attendance_log" ON public.attendance_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on wa_queue" ON public.wa_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on leave_requests" ON public.leave_requests FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- 13. SEED DATA DEFAULT: rombel (Data Kelas Awal)
-- ================================================================
INSERT INTO public.rombel (id, nama_kelas, nama_wali_kelas)
VALUES
('00000000-0000-0000-0000-00000000000a', '1A', 'Siti Aminah, M.Pd.'),
('00000000-0000-0000-0000-000000000001', 'X RPL 1', 'Drs. Bambang Sutrisno, M.Pd.'),
('00000000-0000-0000-0000-000000000002', 'X RPL 2', 'Siti Aminah, S.Kom.'),
('00000000-0000-0000-0000-000000000003', 'XI TKJ 1', 'Ahmad Fauzi, S.T.'),
('00000000-0000-0000-0000-000000000004', 'XI TKJ 2', 'Nurul Hidayati, S.Pd.'),
('00000000-0000-0000-0000-000000000005', 'XII SIJA 1', 'Hendra Kurniawan, M.Kom.'),
('00000000-0000-0000-0000-000000000006', 'XII SIJA 2', 'Ratna Dewi, S.Pd.')
ON CONFLICT (nama_kelas) DO NOTHING;

-- ================================================================
-- 14. SEED DATA DEFAULT: kalender_pendidikan (Agenda & Libur)
-- ================================================================
INSERT INTO public.kalender_pendidikan (tanggal_mulai, tanggal_selesai, keterangan, jenis)
VALUES
('2026-03-20', '2026-03-25', 'Libur Hari Raya Idul Fitri 1447 H', 'Libur Nasional'),
('2026-06-20', '2026-07-05', 'Libur Semester Genap T.A. 2025/2026', 'Libur Semester')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 15. SEED DATA DEFAULT: jadwal_pelajaran (Jadwal KBM Kelas 1A & X RPL 1)
-- ================================================================
INSERT INTO public.jadwal_pelajaran (rombel_id, hari, jam_mulai, jam_selesai, mata_pelajaran, guru_pengampu)
VALUES
-- KELAS 1A
('00000000-0000-0000-0000-00000000000a', 'Senin', '07:00', '07:45', 'Upacara Bendera', 'Drs. Supriyanto'),
('00000000-0000-0000-0000-00000000000a', 'Senin', '07:45', '09:05', 'Pendidikan Agama Islam', 'H. Abdullah, S.Ag'),
('00000000-0000-0000-0000-00000000000a', 'Senin', '09:05', '09:30', 'Istirahat Pagi', 'Guru Piket'),
('00000000-0000-0000-0000-00000000000a', 'Senin', '09:30', '11:30', 'Bahasa Indonesia', 'Siti Aminah, M.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Selasa', '07:15', '08:45', 'Matematika Dasar', 'Budi Santoso, S.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Selasa', '08:45', '09:15', 'Istirahat Pagi', 'Guru Piket'),
('00000000-0000-0000-0000-00000000000a', 'Selasa', '09:15', '10:45', 'Pendidikan Pancasila (PPKn)', 'Nurul Hidayati, S.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Selasa', '10:45', '12:00', 'Seni Budaya & Prakarya', 'Ratna Dewi, S.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Rabu', '07:15', '09:00', 'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)', 'Coach Hendra, M.Or'),
('00000000-0000-0000-0000-00000000000a', 'Rabu', '09:00', '09:30', 'Istirahat Pagi', 'Guru Piket'),
('00000000-0000-0000-0000-00000000000a', 'Rabu', '09:30', '11:00', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', 'Dr. Rahmat Hidayat'),
('00000000-0000-0000-0000-00000000000a', 'Rabu', '11:00', '12:00', 'Bahasa Inggris', 'Maya Anggraini, S.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Kamis', '07:15', '08:45', 'Literasi & Numerasi', 'Siti Aminah, M.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Kamis', '08:45', '09:15', 'Istirahat Pagi', 'Guru Piket'),
('00000000-0000-0000-0000-00000000000a', 'Kamis', '09:15', '10:45', 'Matematika Dasar', 'Budi Santoso, S.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Kamis', '10:45', '12:00', 'Bahasa Daerah / Muatan Lokal', 'Joko Prabowo, S.Pd.'),
('00000000-0000-0000-0000-00000000000a', 'Jumat', '07:00', '07:45', 'Senam Pagi & Pembiasaan Karakter', 'Coach Hendra, M.Or'),
('00000000-0000-0000-0000-00000000000a', 'Jumat', '07:45', '09:15', 'Pendidikan Agama & Budi Pekerti', 'H. Abdullah, S.Ag'),
('00000000-0000-0000-0000-00000000000a', 'Jumat', '09:15', '09:45', 'Istirahat Pagi', 'Guru Piket'),
('00000000-0000-0000-0000-00000000000a', 'Jumat', '09:45', '11:15', 'Projek Penguatan Profil Pelajar Pancasila (P5)', 'Tim Guru Kelas 1'),
-- KELAS X RPL 1
('00000000-0000-0000-0000-000000000001', 'Senin', '07:15', '08:45', 'Matematika Peminatan', 'Drs. Supriyanto'),
('00000000-0000-0000-0000-000000000001', 'Senin', '08:45', '10:15', 'Fisika Terapan', 'Budi Santoso, M.Si'),
('00000000-0000-0000-0000-000000000001', 'Selasa', '07:15', '08:45', 'Kimia Dasar', 'Dr. Rahmat Hidayat'),
('00000000-0000-0000-0000-000000000001', 'Rabu', '07:15', '08:45', 'Pendidikan Agama Islam', 'H. Abdullah, S.Ag'),
('00000000-0000-0000-0000-000000000001', 'Kamis', '07:15', '08:45', 'Sejarah Indonesia', 'Drs. Joko Widodo'),
('00000000-0000-0000-0000-000000000001', 'Jumat', '07:15', '09:00', 'Pendidikan Jasmani & Kesehatan', 'Coach Hendra, M.Or')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 16. SEED DATA DEFAULT: users (Operator Sistem)
-- ================================================================
INSERT INTO public.users (username, password_hash, role)
VALUES
('admin_utama', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator'),
('operator_pagi', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operator Presensi'),
('guru_piket', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Guru Piket')
ON CONFLICT (username) DO NOTHING;

-- ================================================================
-- 17. SEED DATA DEFAULT: students (Data Siswa & class_id FK)
-- ================================================================
INSERT INTO public.students (uid_kartu, nama, no_wa_wali, class_id)
VALUES
('E2000019', 'Muhammad Rizky Pratama', '6281234567890', '00000000-0000-0000-0000-000000000001'),
('A1045F20', 'Aisyah Putri Rahmadani', '6281398765432', '00000000-0000-0000-0000-000000000001'),
('B3092C11', 'Dimas Bagus Wicaksono', '6285712345678', '00000000-0000-0000-0000-000000000002'),
('C4081D33', 'Nabila Zahra Kirana', '6287890123456', '00000000-0000-0000-0000-000000000003'),
('D5073E44', 'Fajar Nugraha Saputra', '6282133445566', '00000000-0000-0000-0000-000000000004'),
('F6064A55', 'Siti Nurhaliza Azzahra', '6289655443322', '00000000-0000-0000-0000-000000000005'),
('77F1290C', 'Bima Satria Wijaya', '6281223344551', '00000000-0000-0000-0000-000000000006'),
('90DA561B', 'Tiara Amanda Kusuma', '6285211998877', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (uid_kartu) DO NOTHING;

-- ================================================================
-- 18. SEED DATA DEFAULT: 20 BARIS DATA TEMPLATE (5 KATEGORI X 4 VARIASI)
-- ================================================================
INSERT INTO public.message_templates (status_category, message_text)
VALUES
('hadir_tepat', 'Assalamu''alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari *[NAMA]*. Diberitahukan bahwa ananda telah tiba dan melakukan presensi kehadiran tepat waktu di sekolah pada pukul *[WAKTU]* WIB.'),
('hadir_tepat', 'Selamat pagi Bapak/Ibu Wali Murid. Kami mengonfirmasi ananda *[NAMA]* telah hadir di sekolah dengan status HADIR TEPAT WAKTU pada jam *[WAKTU]* WIB.'),
('hadir_tepat', 'Info Presensi Sekolah: Ananda *[NAMA]* telah tiba di gerbang sekolah dengan selamat dan tercatat hadir tepat waktu pukul *[WAKTU]* WIB.'),
('hadir_tepat', 'Yth. Orang tua dari ananda *[NAMA]*, sistem kartu RFID sekolah mencatat kehadiran ananda pada pukul *[WAKTU]* WIB (Kategori: Tepat Waktu).'),
('hadir_telat', 'Pemberitahuan Presensi: Yth. Orang tua dari ananda *[NAMA]*, ananda tercatat tiba di sekolah pada pukul *[WAKTU]* WIB dan tercatat TERLAMBAT.'),
('hadir_telat', 'Assalamu''alaikum Wr. Wb. Kami menginformasikan bahwa ananda *[NAMA]* tiba di sekolah pukul *[WAKTU]* WIB melewati batas toleransi jam masuk (Terlambat).'),
('hadir_telat', 'Laporan Kehadiran: Ananda *[NAMA]* telah memasuki lingkungan sekolah pada jam *[WAKTU]* WIB dengan status Terlambat.'),
('hadir_telat', 'Yth. Bapak/Ibu Wali dari *[NAMA]*, ananda telah melakukan presensi di gerbang pada pukul *[WAKTU]* WIB (Status: Terlambat).'),
('pulang', 'Assalamu''alaikum Wr. Wb. Kegiatan belajar mengajar telah selesai. Ananda *[NAMA]* telah melakukan presensi PULANG sekolah pada pukul *[WAKTU]* WIB.'),
('pulang', 'Info Kepulangan Siswa: Ananda *[NAMA]* telah meninggalkan area sekolah pada jam *[WAKTU]* WIB. Mohon dipantau perjalanan ananda kembali ke rumah.'),
('pulang', 'Yth. Orang tua dari *[NAMA]*, jam pelajaran sekolah hari ini telah usai. Ananda tercatat melakukan tap kartu kepulangan pada pukul *[WAKTU]* WIB.'),
('pulang', 'Pemberitahuan Presensi Pulang: Ananda *[NAMA]* telah selesai beraktivitas di sekolah dan tercatat pulang pada *[WAKTU]* WIB.'),
('izin', 'Konfirmasi Presensi: Surat atau pemberitahuan izin untuk ananda *[NAMA]* telah kami terima dan tercatat di sistem presensi pada pukul *[WAKTU]* WIB (Status: IZIN).'),
('izin', 'Yth. Bapak/Ibu Wali Murid, laporan izin tidak hadir untuk ananda *[NAMA]* telah berhasil divalidasi oleh piket sekolah pada jam *[WAKTU]* WIB.'),
('izin', 'Info Kehadiran: Status kehadiran ananda *[NAMA]* hari ini tercatat dengan keterangan ''IZIN'' per pukul *[WAKTU]* WIB.'),
('izin', 'Catatan Presensi Sekolah: Ananda *[NAMA]* terdata berstatus Izin pada pukul *[WAKTU]* WIB.'),
('sakit', 'Konfirmasi Kesehatan: Pemberitahuan sakit untuk ananda *[NAMA]* telah tercatat di sistem presensi sekolah pada pukul *[WAKTU]* WIB. Lekas sembuh.'),
('sakit', 'Yth. Orang tua *[NAMA]*, konfirmasi bahwa ananda sedang sakit dan beristirahat telah kami catat pada jam *[WAKTU]* WIB.'),
('sakit', 'Info Ketidakhadiran: Ananda *[NAMA]* tercatat tidak masuk sekolah dengan status ''SAKIT'' pada pukul *[WAKTU]* WIB.'),
('sakit', 'Pemberitahuan Sekolah: Data izin sakit ananda *[NAMA]* telah masuk ke jurnal kelas per pukul *[WAKTU]* WIB.');
`;
