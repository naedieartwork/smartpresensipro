import { supabaseService, DEFAULT_JADWAL_HARIAN } from './supabaseClient';
import { settingsService } from './settingsService';
import { INITIAL_TEMPLATES } from '../data/initialData';
import { notificationService } from '../utils/notifications';
import {
  StatusCategory,
  AttendanceLog,
  WaQueueItem,
  Student,
  Rombel,
  JadwalHari,
  KalenderPendidikan,
  Holiday,
} from '../types';

export interface AttendanceResult {
  success: boolean;
  student?: Student;
  attendance?: AttendanceLog;
  queuedItem?: WaQueueItem;
  message: string;
  variationIndex?: number;
  totalVariations?: number;
  rawTemplate?: string;
  isHoliday?: boolean;
  holidayReason?: string;
}

export interface HolidayCheckResult {
  isHoliday: boolean;
  reason: string;
  hariNama: string;
  tanggalYMD: string;
  activeJadwal?: JadwalHari;
  kalenderEvent?: KalenderPendidikan;
}

const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Format objek Date menjadi string 'YYYY-MM-DD' menggunakan zona waktu lokal perangkat (WIB)
 */
export function formatLocalYMD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mengubah string 'YYYY-MM-DD' menjadi objek Date lokal
 */
export function parseYMDToDate(dateStr: string): Date {
  const clean = dateStr.trim().slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1, 12, 0, 0);
}

/**
 * Mengubah string waktu format 'HH:mm' atau 'HH.mm' menjadi total menit (jam * 60 + menit)
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().replace('.', ':');
  const parts = normalized.split(':').map(Number);
  const hours = isNaN(parts[0]) ? 0 : parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  return hours * 60 + minutes;
}

/**
 * Mengubah kode status mentah menjadi teks yang ramah dibaca untuk pesan WhatsApp
 */
export function formatReadableStatus(status: StatusCategory | string): string {
  switch (status.toLowerCase()) {
    case 'hadir_tepat':
      return 'Hadir Tepat Waktu';
    case 'hadir_telat':
      return 'Hadir Terlambat';
    case 'pulang':
      return 'Pulang';
    case 'izin':
      return 'Izin';
    case 'sakit':
      return 'Sakit';
    default:
      return status;
  }
}

/**
 * Evaluasi sinkron apakah suatu tanggal merupakan Hari Libur berdasarkan:
 * a. Kalender Pendidikan (Libur Nasional, Libur Semester, Kegiatan Khusus) & daftar Hari Libur
 * b. Jadwal Harian Rombel / Global (aktif === false)
 */
export function evaluateIsHoliday(
  targetDateInput: Date | string = new Date(),
  options: {
    student?: Student;
    rombelList?: Rombel[];
    kalenderList?: KalenderPendidikan[];
    holidayList?: Holiday[];
    selectedRombelId?: string;
  } = {}
): HolidayCheckResult {
  const dateObj =
    typeof targetDateInput === 'string' ? parseYMDToDate(targetDateInput) : targetDateInput;
  const targetYMD =
    typeof targetDateInput === 'string'
      ? targetDateInput.trim().slice(0, 10)
      : formatLocalYMD(targetDateInput);

  const dayIndex = dateObj.getDay(); // 0: Minggu, 1: Senin, ..., 6: Sabtu
  const namaHari = HARI_INDONESIA[dayIndex];

  const {
    student,
    rombelList = [],
    kalenderList = [],
    holidayList = [],
    selectedRombelId,
  } = options;

  // 0. Cek Pengecualian Jadwal (Jadwal Khusus & Pengecualian dari Pengaturan Jam & Mode Presensi)
  const sysSettings = settingsService.getSettings();
  if (
    sysSettings.special_schedule_enabled &&
    dayIndex === sysSettings.special_schedule_day &&
    sysSettings.special_schedule_mode === 'libur'
  ) {
    return {
      isHoliday: true,
      hariNama: namaHari,
      tanggalYMD: targetYMD,
      reason: 'Hari ini ditetapkan sebagai hari libur.',
    };
  }

  // 1a. Cek Kalender Pendidikan (start_date <= targetYMD <= end_date)
  for (const item of kalenderList) {
    const start = String(item.tanggal_mulai || (item as any).start_date || '').trim().slice(0, 10);
    const end = String(item.tanggal_selesai || (item as any).end_date || start).trim().slice(0, 10);
    if (start && targetYMD >= start && targetYMD <= end) {
      const jenisLabel = item.jenis || 'Libur Kalender Pendidikan';
      return {
        isHoliday: true,
        hariNama: namaHari,
        tanggalYMD: targetYMD,
        kalenderEvent: item,
        reason: `${jenisLabel}: ${item.keterangan}`,
      };
    }
  }

  // 1b. Cek daftar tabel holidays (jika ada)
  for (const h of holidayList) {
    const tgl = String(h.tanggal || '').trim().slice(0, 10);
    if (tgl && tgl === targetYMD) {
      return {
        isHoliday: true,
        hariNama: namaHari,
        tanggalYMD: targetYMD,
        reason: `Hari Libur: ${h.keterangan}`,
      };
    }
  }

  // Helper lokal cek aktif/tidaknya hari
  const isDayActive = (jadwalHari?: JadwalHari): boolean => {
    if (!jadwalHari) return false;
    if ((jadwalHari as any).is_active !== undefined) {
      return Boolean((jadwalHari as any).is_active);
    }
    return Boolean(jadwalHari.aktif);
  };

  const getJadwalForDay = (rombel?: Rombel): JadwalHari | undefined => {
    if (!rombel || !rombel.jadwal_harian) return undefined;
    return (
      rombel.jadwal_harian[namaHari] ||
      rombel.jadwal_harian[namaHari.toLowerCase()] ||
      rombel.jadwal_harian[namaHari.toUpperCase()]
    );
  };

  // 2. Cari Rombel target (dari siswa atau filter kelas yang dipilih)
  let targetRombel: Rombel | undefined;
  if (student) {
    const rmbId = String(
      student.rombel_id || student.class_id || (student as any).id_rombel || ''
    ).trim();
    const kelasName = String(student.kelas || '').trim().toLowerCase();

    targetRombel =
      rombelList.find(
        (r) =>
          (rmbId && (r.id === rmbId || r.nama_kelas.trim().toLowerCase() === rmbId.toLowerCase())) ||
          (kelasName && r.nama_kelas.trim().toLowerCase() === kelasName)
      ) || student.rombel;
  } else if (selectedRombelId && selectedRombelId !== 'all') {
    targetRombel = rombelList.find(
      (r) =>
        r.id === selectedRombelId ||
        r.nama_kelas.trim().toLowerCase() === selectedRombelId.trim().toLowerCase()
    );
  }

  // Jika Rombel spesifik ditemukan, gunakan jadwal hariannya sebagai penjaga utama
  if (targetRombel) {
    const jadwalHari = getJadwalForDay(targetRombel);
    if (jadwalHari) {
      if (!isDayActive(jadwalHari)) {
        return {
          isHoliday: true,
          hariNama: namaHari,
          tanggalYMD: targetYMD,
          reason: `Libur Jadwal Kelas ${targetRombel.nama_kelas} (Hari ${namaHari})`,
        };
      }
      return {
        isHoliday: false,
        hariNama: namaHari,
        tanggalYMD: targetYMD,
        reason: '',
        activeJadwal: jadwalHari,
      };
    }
  }

  // Jika mengecek secara umum (semua kelas / siswa belum punya rombel spesifik)
  if (rombelList.length > 0) {
    let foundAnyConfiguredDay = false;
    let foundActiveJadwal: JadwalHari | undefined;

    for (const rmb of rombelList) {
      const candidate = getJadwalForDay(rmb);
      if (candidate) {
        foundAnyConfiguredDay = true;
        if (isDayActive(candidate)) {
          foundActiveJadwal = candidate;
          break;
        }
      }
    }

    if (foundAnyConfiguredDay && !foundActiveJadwal) {
      return {
        isHoliday: true,
        hariNama: namaHari,
        tanggalYMD: targetYMD,
        reason: `Libur Akhir Pekan / Tidak Ada Jadwal Kelas Aktif (Hari ${namaHari})`,
      };
    }

    if (foundActiveJadwal) {
      return {
        isHoliday: false,
        hariNama: namaHari,
        tanggalYMD: targetYMD,
        reason: '',
        activeJadwal: foundActiveJadwal,
      };
    }
  }

  // 3. Fallback ke jadwal default mingguan sekolah
  const globalDefaultDay = DEFAULT_JADWAL_HARIAN[namaHari];
  if (globalDefaultDay && !isDayActive(globalDefaultDay)) {
    return {
      isHoliday: true,
      hariNama: namaHari,
      tanggalYMD: targetYMD,
      reason: `Libur Akhir Pekan (Hari ${namaHari})`,
    };
  }

  return {
    isHoliday: false,
    hariNama: namaHari,
    tanggalYMD: targetYMD,
    reason: '',
  };
}

/**
 * Fungsi Pengecekan Hari Libur Terpadu (Async - mengambil data terbaru dari Supabase)
 */
export async function checkIsHoliday(
  targetDate: Date | string = new Date(),
  student?: Student,
  selectedRombelId?: string
): Promise<HolidayCheckResult> {
  try {
    const [rombelList, kalenderList, holidayList] = await Promise.all([
      supabaseService.getRombel(),
      supabaseService.getKalenderPendidikan(),
      supabaseService.getHolidays(),
    ]);

    return evaluateIsHoliday(targetDate, {
      student,
      rombelList,
      kalenderList,
      holidayList,
      selectedRombelId,
    });
  } catch (err) {
    console.warn('Error saat mengecek checkIsHoliday:', err);
    return evaluateIsHoliday(targetDate, { student, selectedRombelId });
  }
}

export class AttendanceService {
  /**
   * Format jam ke format WIB (misal: "04:28")
   */
  public static formatTime(date: Date = new Date()): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Guard Clause Utama: Mengecek apakah suatu tanggal (default: hari ini) adalah Hari Libur
   * berdasarkan Kalender Pendidikan maupun Jadwal Harian Rombel/Sekolah.
   */
  public static async checkHolidayStatus(
    student?: Student,
    now: Date = new Date(),
    selectedRombelId?: string
  ): Promise<HolidayCheckResult> {
    return checkIsHoliday(now, student, selectedRombelId);
  }

  /**
   * Alias langsung untuk checkIsHoliday pada class AttendanceService
   */
  public static async checkIsHoliday(
    targetDate: Date | string = new Date(),
    student?: Student,
    selectedRombelId?: string
  ): Promise<HolidayCheckResult> {
    return checkIsHoliday(targetDate, student, selectedRombelId);
  }

  /**
   * Menentukan status kehadiran otomatis berdasarkan:
   * 1. Jadwal Harian Rombel siswa pada hari ini jika aktif
   * 2. Pengaturan global dari settingsService sebagai fallback HANYA jika jadwal rombel tidak ada dan bukan hari libur
   */
  public static async determineStudentAutoStatus(
    student?: Student,
    now: Date = new Date()
  ): Promise<StatusCategory> {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const settings = settingsService.getSettings();

    // Cek apakah hari ini cocok dengan Pengecualian Jadwal mode 'pulang_awal'
    const isSpecialPulangAwalActive =
      settings.special_schedule_enabled &&
      now.getDay() === settings.special_schedule_day &&
      settings.special_schedule_mode === 'pulang_awal';
    const specialPulangStr = settings.special_schedule_time || '10:00';
    const specialPulangMinutes = timeToMinutes(specialPulangStr);

    // Aturan Mutlak: Jika siswa tap pada/setelah jam pulang khusus ini, WAJIB tercatat sebagai "pulang" ("Pulang" normal)
    if (isSpecialPulangAwalActive && nowMinutes >= specialPulangMinutes) {
      return 'pulang';
    }

    const holidayCheck = await AttendanceService.checkHolidayStatus(student, now);
    if (holidayCheck.activeJadwal) {
      const jadwalHari = holidayCheck.activeJadwal;
      const batasTelatStr = (jadwalHari as any).batas_telat || jadwalHari.telat || '07:15';
      const pulangStr = isSpecialPulangAwalActive
        ? specialPulangStr
        : (jadwalHari as any).jam_pulang || jadwalHari.pulang || '14:00';

      const batasTelatMinutes = timeToMinutes(batasTelatStr);
      const pulangMinutes = timeToMinutes(pulangStr);

      if (nowMinutes >= pulangMinutes) {
        return 'pulang';
      }
      if (nowMinutes <= batasTelatMinutes) {
        return 'hadir_tepat';
      }
      return 'hadir_telat';
    }

    // Fallback ke pengaturan global settingsService hanya jika bukan hari libur dan jadwal rombel tidak ada
    const batasTelatMinutes = timeToMinutes(settings.timeRanges.tepat.end || '07:15');
    const pulangMinutes = isSpecialPulangAwalActive
      ? specialPulangMinutes
      : timeToMinutes(
          settings.timeRanges.pulangCepat?.start || settings.timeRanges.pulang.start || '12:00'
        );

    if (nowMinutes >= pulangMinutes) {
      return 'pulang';
    }
    if (nowMinutes <= batasTelatMinutes) {
      return 'hadir_tepat';
    }
    return 'hadir_telat';
  }

  /**
   * Logika Presensi (Spintax / Rotasi Template Acak):
   * 1. Query ke tabel message_templates berdasarkan status_category (hadir_tepat, hadir_telat, pulang, izin, sakit)
   * 2. Memilih 1 dari 4 variasi secara acak (Math.random)
   * 3. Me-replace variabel [NAMA], [WAKTU], {status}, [STATUS], dan kode mentah seperti HADIR_TEPAT / hadir_telat
   */
  public static async composeRandomMessage(
    studentName: string,
    statusCategory: StatusCategory,
    timestamp: Date = new Date(),
    studentClass: string = '1A'
  ): Promise<{ text: string; variationIndex: number; totalVariations: number; templateId?: string }> {
    let templates = await supabaseService.getTemplatesByCategory(statusCategory);

    // Fallback ke INITIAL_TEMPLATES sesuai kategori jika tabel di Supabase kosong untuk kategori tersebut
    if (!templates || templates.length === 0) {
      templates = INITIAL_TEMPLATES.filter((t) => t.status_category === statusCategory);
    }

    const waktuStr = AttendanceService.formatTime(timestamp);
    const readableStatus = formatReadableStatus(statusCategory);
    const kelasStr = (studentClass || 'Umum').trim();

    const replaceVariables = (rawText: string): string => {
      let text = rawText;
      text = text.replace(/\[NAMA\]/gi, studentName);
      text = text.replace(/\{nama\}/gi, studentName);
      text = text.replace(/\[KELAS\]/gi, kelasStr);
      text = text.replace(/\{kelas\}/gi, kelasStr);
      text = text.replace(/\[WAKTU\]/gi, waktuStr);
      text = text.replace(/\{waktu\}/gi, waktuStr);
      text = text.replace(/\[JAM\]/gi, waktuStr);
      text = text.replace(/\{jam\}/gi, waktuStr);
      text = text.replace(/\[STATUS\]/gi, readableStatus);
      text = text.replace(/\{status\}/gi, readableStatus);
      text = text.replace(/\bHADIR_TEPAT\b/gi, 'Hadir Tepat Waktu');
      text = text.replace(/\bHADIR_TELAT\b/gi, 'Hadir Terlambat');
      return text;
    };

    if (templates && templates.length > 0) {
      const randomIndex = Math.floor(Math.random() * templates.length);
      const chosenTemplate = templates[randomIndex];
      const text = replaceVariables(chosenTemplate.message_text);

      return {
        text,
        variationIndex: randomIndex + 1,
        totalVariations: templates.length,
        templateId: chosenTemplate.id,
      };
    }

    const defaultText = `Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari *${studentName}* (Kelas ${kelasStr}), ananda tercatat presensi dengan status *${readableStatus}* pada pukul *${waktuStr}* WIB. Terima kasih.`;
    return {
      text: defaultText,
      variationIndex: 1,
      totalVariations: 1,
    };
  }

  /**
   * Mencatat data presensi siswa:
   * 1. GUARD CLAUSE: Cek apakah hari ini adalah Hari Libur (Kalender Pendidikan / Jadwal Rombel). Jika Libur, tolak tegas!
   * 2. Hitung status kehadiran berdasarkan Jadwal Harian Rombel (jika mode AUTO / scan kartu)
   * 3. Simpan/perbarui ke tabel attendance_log menggunakan waktu tap terbaru
   * 4. Rangkai pesan acak (Spintax) sesuai kategori status terbaru & jam tap terbaru
   * 5. Masukkan ke tabel wa_queue dengan status 'pending'
   */
  public static async recordStudentAttendance(
    student: Student,
    status?: StatusCategory | 'AUTO',
    metode: 'QR' | 'RFID' | 'Manual' | 'Hybrid' = 'Hybrid',
    isManualOverride: boolean = false,
    keterangan?: string
  ): Promise<AttendanceResult> {
    try {
      const now = new Date();

      // 1. PENJAGA UTAMA (GUARD CLAUSE): Cek Status Hari Libur (kecuali override manual izin/sakit)
      const holidayCheck = await checkIsHoliday(now, student);
      if (
        holidayCheck.isHoliday &&
        !(isManualOverride && (status === 'izin' || status === 'sakit'))
      ) {
        const isSpecialHoliday =
          holidayCheck.reason === 'Hari ini ditetapkan sebagai hari libur.';
        return {
          success: false,
          student,
          isHoliday: true,
          holidayReason: holidayCheck.reason,
          message: isSpecialHoliday
            ? 'Hari ini ditetapkan sebagai hari libur.'
            : `Presensi Ditolak: Hari ini (${holidayCheck.hariNama}, ${holidayCheck.tanggalYMD}) adalah Hari Libur — ${holidayCheck.reason}.`,
        };
      }

      const cardUid = student.uid_kartu || student.rfid_uid || student.nisn || '';

      let finalStatus: StatusCategory;
      const isAutoSettings = settingsService.getSettings().isAutomaticMode;

      if (
        status &&
        status !== 'AUTO' &&
        (status === 'izin' || status === 'sakit' || isManualOverride || !isAutoSettings)
      ) {
        finalStatus = status;
      } else {
        finalStatus = await AttendanceService.determineStudentAutoStatus(student, now);
      }

      // 2. Catat atau perbarui ke tabel attendance_log dengan waktu & status terbaru
      const attendance = await supabaseService.recordAttendanceLog(
        cardUid,
        student.nama,
        finalStatus,
        metode,
        keterangan
      );

      // 3. Rangkai pesan Spintax acak sesuai finalStatus dan waktu tap terbaru
      const resolvedClass =
        student.kelas ||
        (typeof student.rombel === 'object' && student.rombel !== null
          ? student.rombel.nama_kelas
          : typeof student.rombel === 'string'
          ? student.rombel
          : 'Umum');

      const { text: isiPesan, variationIndex, totalVariations } =
        await AttendanceService.composeRandomMessage(
          student.nama,
          finalStatus,
          now,
          resolvedClass
        );

      // 4. Masukkan ke tabel wa_queue dengan status 'pending'
      const queuedItem = await supabaseService.enqueueMessage(
        student.no_wa_wali,
        isiPesan
      );

      const readableStatus = formatReadableStatus(finalStatus);
      const formattedTime = AttendanceService.formatTime(now);

      // 5. Picu Notifikasi Lokal (Local Notifications API) pada perangkat PWA
      void notificationService.triggerScanSuccessNotification({
        studentName: student.nama,
        studentClass: resolvedClass,
        statusLabel: readableStatus,
        timeStr: formattedTime,
        method: metode,
        cardUid,
      });

      return {
        success: true,
        student,
        attendance,
        queuedItem,
        variationIndex,
        totalVariations,
        message: `Presensi ${readableStatus} (${finalStatus}) berhasil via ${metode} pada pukul ${formattedTime} WIB! Menggunakan Template Variasi #${variationIndex} dari ${totalVariations} dan masuk ke wa_queue (pending).`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Gagal mencatat presensi: ${msg}`,
      };
    }
  }

  /**
   * Catat presensi hybrid (Kamera QR / USB RFID Reader)
   */
  public static async processHybridScan(
    cardUid: string,
    defaultStatus?: StatusCategory | 'AUTO',
    metode: 'QR' | 'RFID' | 'Hybrid' | 'Manual' = 'Hybrid',
    isManualOverride: boolean = false
  ): Promise<AttendanceResult> {
    const student = await supabaseService.getStudentByRfid(cardUid);
    if (!student) {
      return {
        success: false,
        message: `Kartu / QR Code UID [${cardUid.toUpperCase()}] tidak ditemukan di database. Pastikan siswa telah terdaftar.`,
      };
    }

    return await AttendanceService.recordStudentAttendance(
      student,
      defaultStatus,
      metode,
      isManualOverride
    );
  }

  /**
   * Alias untuk backward compatibility
   */
  public static async processRfidScan(
    rfidUid: string,
    defaultStatus?: StatusCategory | 'AUTO',
    metode: 'RFID' | 'QR' | 'Hybrid' = 'RFID'
  ): Promise<AttendanceResult> {
    return this.processHybridScan(rfidUid, defaultStatus, metode);
  }
}
