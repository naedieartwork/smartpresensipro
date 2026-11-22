import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Users,
  UserCheck,
  UserX,
  FileText,
  Check,
  X,
  Bell,
  BellRing,
} from 'lucide-react';
import { Student, StatusCategory, AttendanceLog, LeaveRequest } from '../types';
import { supabaseService } from '../services/supabaseClient';
import {
  AttendanceService,
  formatReadableStatus,
  formatLocalYMD,
} from '../services/attendanceService';
import { sound } from '../utils/audio';
import { notificationService } from '../utils/notifications';
import { ModernQrScanner } from './ModernQrScanner';
import { settingsService } from '../services/settingsService';

interface AttendanceTerminalProps {
  onQueueUpdated?: () => void;
  onNavigateToQueue: () => void;
}

type PresensiSubMenu = 'kehadiran' | 'tidak_hadir';
type KehadiranStatus = 'hadir_tepat' | 'hadir_telat' | 'pulang';
type TidakHadirStatus = 'izin' | 'sakit';

export const AttendanceTerminal: React.FC<AttendanceTerminalProps> = ({
  onQueueUpdated,
  onNavigateToQueue,
}) => {
  const [activeSubMenu, setActiveSubMenu] = useState<PresensiSubMenu>('kehadiran');

  const [students, setStudents] = useState<Student[]>([]);
  const [rfidInput, setRfidInput] = useState<string>('');
  const [selectedKehadiranStatus, setSelectedKehadiranStatus] =
    useState<KehadiranStatus>('hadir_tepat');
  const [autoStatusPreview, setAutoStatusPreview] =
    useState<StatusCategory>('hadir_tepat');

  // State khusus Sub-Menu Tidak Hadir (Izin / Sakit)
  const [selectedAbsenceStatus, setSelectedAbsenceStatus] =
    useState<TidakHadirStatus>('izin');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [manualAbsenceReason, setManualAbsenceReason] = useState<string>('');

  // Antrean pengajuan Izin/Sakit dari Portal Wali Murid
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );

  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [absencePage, setAbsencePage] = useState<number>(1);
  const itemsPerPage = 10;
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => notificationService.getPermission());

  const handleRequestNotifPermission = async () => {
    const res = await notificationService.requestPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      void notificationService.triggerScanSuccessNotification({
        studentName: 'Notifikasi Lokal Aktif',
        studentClass: 'Sistem Presensi',
        statusLabel: 'Siap Digunakan',
        timeStr: AttendanceService.formatTime(),
        method: 'PWA Local Notification',
      });
    }
  };

  const rfidInputRef = useRef<HTMLInputElement>(null);

  const [lastResult, setLastResult] = useState<{
    type: 'success' | 'error';
    title: string;
    description: string;
    studentName?: string;
    waNumber?: string;
    status?: string;
    time?: string;
    variationChosen?: number;
    totalVariations?: number;
    renderedMessage?: string;
    method?: string;
  } | null>(null);

  const [systemSettings, setSystemSettings] = useState(
    settingsService.getSettings()
  );
  const [holidayInfo, setHolidayInfo] = useState<{
    isHoliday: boolean;
    hariNama: string;
    reason: string;
  }>({
    isHoliday: false,
    hariNama: '',
    reason: '',
  });

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const reqs = await supabaseService.getLeaveRequests();
      setLeaveRequests(reqs);
    } catch (err) {
      console.error('Gagal memuat pengajuan izin/sakit:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    const [stds, logs, reqs] = await Promise.all([
      supabaseService.getStudents(),
      supabaseService.getAttendanceLogs(),
      supabaseService.getLeaveRequests(),
    ]);
    setStudents(stds);
    setRecentLogs(logs);
    setLeaveRequests(reqs);

    const hCheck = await AttendanceService.checkHolidayStatus();
    setHolidayInfo({
      isHoliday: hCheck.isHoliday,
      hariNama: hCheck.hariNama,
      reason: hCheck.reason,
    });
    const currentAuto = await AttendanceService.determineStudentAutoStatus();
    setAutoStatusPreview(currentAuto);
  }, []);

  // Real-time Listener khusus untuk Pengajuan Izin/Sakit (Supabase Realtime + LocalStorage/CustomEvent Fallback)
  useEffect(() => {
    fetchLeaveRequests();

    const supabase = supabaseService.getClient();
    const channel = supabase
      .channel('terminal-leave-requests-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leave_requests' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .subscribe();

    window.addEventListener('leave_requests_updated', fetchLeaveRequests);
    window.addEventListener('storage', fetchLeaveRequests);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('smart_presensi_leave_requests_channel');
        bc.onmessage = () => {
          fetchLeaveRequests();
        };
      } catch {
        bc = null;
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLeaveRequests();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollInterval = setInterval(() => {
      fetchLeaveRequests();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('leave_requests_updated', fetchLeaveRequests);
      window.removeEventListener('storage', fetchLeaveRequests);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (bc) {
        bc.close();
      }
      clearInterval(pollInterval);
    };
  }, [fetchLeaveRequests]);

  useEffect(() => {
    loadData();
    if (activeSubMenu === 'kehadiran') {
      rfidInputRef.current?.focus();
    }
    const unsubSupabase = supabaseService.subscribe(loadData);
    const unsubSettings = settingsService.subscribe(() => {
      setSystemSettings(settingsService.getSettings());
      loadData();
    });

    const timer = setInterval(async () => {
      const hCheck = await AttendanceService.checkHolidayStatus();
      setHolidayInfo({
        isHoliday: hCheck.isHoliday,
        hariNama: hCheck.hariNama,
        reason: hCheck.reason,
      });
      const currentAuto = await AttendanceService.determineStudentAutoStatus();
      setAutoStatusPreview(currentAuto);
    }, 10000);
    return () => {
      unsubSupabase();
      unsubSettings();
      clearInterval(timer);
    };
  }, [activeSubMenu, loadData]);

  const handleSwitchSubMenu = (nextMenu: PresensiSubMenu) => {
    if (nextMenu === 'tidak_hadir' && isCameraActive) {
      setIsCameraActive(false);
    }
    setActiveSubMenu(nextMenu);
    setLastResult(null);
  };

  const handleProcessUid = async (
    rawUid: string,
    method: 'QR' | 'RFID' | 'Manual' = 'RFID'
  ) => {
    if (!rawUid.trim() || isSubmitting) return;

    const cleanUid = rawUid.trim().toUpperCase();
    setIsSubmitting(true);
    setLastScannedCode(cleanUid);

    const statusToPass = systemSettings.isAutomaticMode
      ? 'AUTO'
      : selectedKehadiranStatus;
    const isManualOverride = !systemSettings.isAutomaticMode;

    const result = await AttendanceService.processHybridScan(
      cleanUid,
      statusToPass,
      method,
      isManualOverride
    );

    if (result.success && result.student) {
      const finalStatus =
        result.attendance?.status_kehadiran || autoStatusPreview;
      const readableStatus = formatReadableStatus(finalStatus);
      sound.playSuccess();
      setLastResult({
        type: 'success',
        title: `Presensi Berhasil via ${method} (${readableStatus})!`,
        description: `UID Kartu [${cleanUid}] terverifikasi dengan status ${readableStatus}. Notifikasi pesan WhatsApp otomatis dimasukkan ke antrean pengiriman.`,
        studentName: result.student.nama,
        waNumber: result.student.no_wa_wali,
        status: finalStatus,
        time: AttendanceService.formatTime(),
        variationChosen: result.variationIndex,
        totalVariations: result.totalVariations,
        renderedMessage: result.queuedItem?.isi_pesan,
        method,
      });
      setRfidInput('');
      setCurrentPage(1);
      if (onQueueUpdated) onQueueUpdated();
    } else {
      sound.playAlert();
      const isHolidayReject =
        result.isHoliday ||
        result.message.toLowerCase().includes('hari libur') ||
        result.message.includes('Presensi Ditolak');
      setLastResult({
        type: 'error',
        title: isHolidayReject
          ? 'Presensi Ditolak (Hari Libur)'
          : `${method} Tidak Dikenali`,
        description: result.message,
        method,
      });
      setRfidInput('');
    }

    setIsSubmitting(false);
    loadData();
    setTimeout(() => rfidInputRef.current?.focus(), 50);
  };

  const handleRfidSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rfidInput.trim()) return;
    if (notificationService.getPermission() === 'default') {
      const perm = await notificationService.requestPermission();
      setNotifPermission(perm);
    }
    await handleProcessUid(rfidInput, 'RFID');
  };

  // Konfirmasi Pengajuan Izin / Sakit dari Portal Wali Murid (Setujui)
  const handleApproveLeaveRequest = async (req: LeaveRequest) => {
    setProcessingRequestId(req.id);
    try {
      const matchedStudent =
        students.find(
          (s) =>
            s.id === req.student_id ||
            (req.uid_kartu &&
              (s.uid_kartu?.toLowerCase() === req.uid_kartu.toLowerCase() ||
                s.rfid_uid?.toLowerCase() === req.uid_kartu.toLowerCase()))
        ) || null;

      if (matchedStudent) {
        const result = await AttendanceService.recordStudentAttendance(
          matchedStudent,
          req.jenis,
          'Manual',
          true,
          req.alasan
        );
        // Jika hari ini libur di kalender, tetap catat di attendance_log agar sah disetujui
        if (!result.success) {
          await supabaseService.recordAttendanceLog(
            req.uid_kartu || matchedStudent.uid_kartu || matchedStudent.id,
            matchedStudent.nama,
            req.jenis,
            'Manual',
            req.alasan
          );
        }
      } else {
        await supabaseService.recordAttendanceLog(
          req.uid_kartu || req.student_id,
          req.student_name,
          req.jenis,
          'Manual',
          req.alasan
        );
      }

      await supabaseService.updateLeaveRequestStatus(req.id, 'approved');
      sound.playSuccess();
      setLastResult({
        type: 'success',
        title: `Pengajuan ${req.jenis === 'sakit' ? 'Sakit' : 'Izin'} Disetujui!`,
        description: `Pengajuan dari wali murid atas nama ${req.student_name} (${req.student_kelas}) telah disahkan ke dalam catatan presensi hari ini dan status di portal wali murid diperbarui menjadi 'Disetujui'.`,
        studentName: req.student_name,
        status: req.jenis,
        time: AttendanceService.formatTime(),
      });
      if (onQueueUpdated) onQueueUpdated();
      await loadData();
    } catch (err: any) {
      sound.playAlert();
      setLastResult({
        type: 'error',
        title: 'Gagal Menyetujui Pengajuan',
        description: err?.message || String(err),
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Konfirmasi Pengajuan Izin / Sakit dari Portal Wali Murid (Tolak)
  const handleRejectLeaveRequest = async (req: LeaveRequest) => {
    setProcessingRequestId(req.id);
    try {
      await supabaseService.updateLeaveRequestStatus(req.id, 'rejected');
      sound.playAlert();
      setLastResult({
        type: 'error',
        title: `Pengajuan ${req.jenis === 'sakit' ? 'Sakit' : 'Izin'} Ditolak`,
        description: `Pengajuan dari wali murid atas nama ${req.student_name} (${req.student_kelas}) telah ditolak. Status di portal wali murid diperbarui menjadi 'Ditolak'.`,
      });
      await loadData();
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Simpan Ketidakhadiran Manual (Oleh Guru / Admin)
  const handleManualAbsenceSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStudentId) {
      alert('Silakan cari dan pilih salah satu siswa terlebih dahulu.');
      return;
    }
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    const cleanNote =
      manualAbsenceReason.trim() ||
      (selectedAbsenceStatus === 'sakit'
        ? 'Keterangan sakit (dicatat manual oleh guru/admin)'
        : 'Keterangan izin (dicatat manual oleh guru/admin)');

    setIsSubmitting(true);
    try {
      const result = await AttendanceService.recordStudentAttendance(
        student,
        selectedAbsenceStatus,
        'Manual',
        true,
        cleanNote
      );

      if (result.success) {
        const readableStatus = formatReadableStatus(selectedAbsenceStatus);
        sound.playSuccess();
        setLastResult({
          type: 'success',
          title: `Ketidakhadiran (${readableStatus}) Berhasil Dicatat!`,
          description: `Data ${readableStatus} untuk ${student.nama} (${student.kelas || 'Umum'}) berhasil disimpan dengan keterangan: "${cleanNote}".`,
          studentName: student.nama,
          waNumber: student.no_wa_wali,
          status: selectedAbsenceStatus,
          time: AttendanceService.formatTime(),
          variationChosen: result.variationIndex,
          totalVariations: result.totalVariations,
          renderedMessage: result.queuedItem?.isi_pesan,
        });
        setSelectedStudentId('');
        setSearchQuery('');
        setManualAbsenceReason('');
        setIsDropdownOpen(false);
        setAbsencePage(1);
        if (onQueueUpdated) onQueueUpdated();
      } else {
        sound.playAlert();
        setLastResult({
          type: 'error',
          title: result.isHoliday
            ? 'Pencatatan Ditolak (Hari Libur)'
            : 'Gagal Mencatat Ketidakhadiran',
          description: result.message,
          method: 'Manual',
        });
      }
    } finally {
      setIsSubmitting(false);
      loadData();
    }
  };

  // 3 Kategori khusus Sub-Menu Kehadiran
  const kehadiranCategories: {
    label: KehadiranStatus;
    name: string;
    desc: string;
  }[] = [
    { label: 'hadir_tepat', name: 'Hadir Tepat', desc: 'Datang tepat waktu' },
    { label: 'hadir_telat', name: 'Hadir Telat', desc: 'Lewat jam masuk' },
    { label: 'pulang', name: 'Pulang', desc: 'Presensi jam pulang' },
  ];

  // 2 Kategori khusus Sub-Menu Tidak Hadir
  const tidakHadirCategories: {
    label: TidakHadirStatus;
    name: string;
    desc: string;
  }[] = [
    { label: 'izin', name: 'Izin', desc: 'Konfirmasi izin wali' },
    { label: 'sakit', name: 'Sakit', desc: 'Keterangan medis/sakit' },
  ];

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const filteredStudents =
    searchQuery.trim() === ''
      ? []
      : students.filter(
          (s) =>
            s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.nisn && s.nisn.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (s.rfid_uid &&
              s.rfid_uid.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (s.uid_kartu &&
              s.uid_kartu.toLowerCase().includes(searchQuery.toLowerCase()))
        );

  const displayedActiveKehadiranStatus = systemSettings.isAutomaticMode
    ? autoStatusPreview === 'izin' || autoStatusPreview === 'sakit'
      ? 'hadir_tepat'
      : autoStatusPreview
    : selectedKehadiranStatus;

  // Filter pengajuan izin/sakit yang masih berstatus pending
  const pendingLeaveRequests = leaveRequests.filter(
    (r) => r.status === 'pending'
  );

  // Filter catatan presensi untuk Sub-Menu Kehadiran (hanya hadir_tepat, hadir_telat, pulang)
  const kehadiranLogs = recentLogs.filter(
    (l) =>
      l.status_kehadiran === 'hadir_tepat' ||
      l.status_kehadiran === 'hadir_telat' ||
      l.status_kehadiran === 'pulang'
  );
  const totalKehadiranLogs = kehadiranLogs.length;
  const totalKehadiranPages = Math.max(
    1,
    Math.ceil(totalKehadiranLogs / itemsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalKehadiranPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalKehadiranLogs);
  const paginatedKehadiranLogs = kehadiranLogs.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Filter Daftar Siswa Tidak Hadir Hari Ini (Bagian C: status 'izin' atau 'sakit' pada hari ini)
  const todayYMD = formatLocalYMD(new Date());
  const todayAbsenceLogs = recentLogs.filter((l) => {
    const isAbsence =
      l.status_kehadiran === 'izin' || l.status_kehadiran === 'sakit';
    if (!isAbsence) return false;
    if (!l.waktu) return true;
    const logDateYMD = formatLocalYMD(new Date(l.waktu));
    return logDateYMD === todayYMD;
  });

  const totalAbsenceLogs = todayAbsenceLogs.length;
  const totalAbsencePages = Math.max(
    1,
    Math.ceil(totalAbsenceLogs / itemsPerPage)
  );
  const safeAbsencePage = Math.min(absencePage, totalAbsencePages);
  const startAbsenceIdx = (safeAbsencePage - 1) * itemsPerPage;
  const endAbsenceIdx = Math.min(
    startAbsenceIdx + itemsPerPage,
    totalAbsenceLogs
  );
  const paginatedAbsenceLogs = todayAbsenceLogs.slice(
    startAbsenceIdx,
    startAbsenceIdx + itemsPerPage
  );

  const formatBadgeStatusLabel = (status: string): string => {
    const normalized = (status || '').toLowerCase().trim();
    if (normalized === 'hadir_tepat') return 'Hadir Tepat';
    if (normalized === 'hadir_telat') return 'Terlambat';
    if (normalized === 'pulang') return 'Pulang';
    if (normalized === 'izin') return 'Izin';
    if (normalized === 'sakit') return 'Sakit';
    if (normalized === 'alpa' || normalized === 'alpha') return 'Alpa';
    return normalized
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="space-y-5">
      {/* =================================================================
          1. NAVIGASI SUB-MENU DI BAGIAN ATAS HALAMAN PRESENSI
             - Kehadiran (Presensi Fisik Masuk & Pulang)
             - Tidak Hadir (Manajemen Izin & Sakit + Badge Merah Pending)
         ================================================================= */}
      <div className="bg-white border border-slate-200 shadow-2xs rounded-2xl p-1.5 w-full grid grid-cols-2 md:w-fit md:inline-flex gap-1.5">
        <button
          type="button"
          onClick={() => handleSwitchSubMenu('kehadiran')}
          className={`px-4 md:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-2 ${
            activeSubMenu === 'kehadiran'
              ? 'bg-cyan-500 text-white shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>Kehadiran</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchSubMenu('tidak_hadir')}
          className={`px-4 md:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-2 relative ${
            activeSubMenu === 'tidak_hadir'
              ? 'bg-cyan-500 text-white shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserX className="w-4 h-4 shrink-0" />
          <span>Tidak Hadir</span>
          {pendingLeaveRequests.length > 0 && (
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono leading-none flex items-center justify-center shadow-2xs ${
                activeSubMenu === 'tidak_hadir'
                  ? 'bg-rose-600 text-white ring-2 ring-white'
                  : 'bg-rose-500 text-white animate-pulse'
              }`}
              title={`${pendingLeaveRequests.length} pengajuan izin/sakit menunggu konfirmasi`}
            >
              {pendingLeaveRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* =================================================================
          2. ISI & ALUR LOGIKA SUB-MENU: KEHADIRAN
             - 3 Kotak Status: Hadir Tepat, Hadir Telat, Pulang
             - Modern QR Camera Scanner & USB RFID Reader
             - Catatan Presensi Harian (Hadir / Pulang)
         ================================================================= */}
      {activeSubMenu === 'kehadiran' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Category Selection Bar (3 Kotak: Hadir Tepat, Hadir Telat, Pulang) */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <div className="space-y-1">
                {systemSettings.isAutomaticMode && (
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold tracking-wide">
                      🤖 Mode Otomatis (Jadwal Rombel)
                    </span>
                  </div>
                )}
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                  <UserCheck className="w-5 h-5 text-cyan-600 shrink-0" />
                  <span>Kategori Kehadiran</span>
                </h2>
                <p className="text-xs text-gray-500">
                  {systemSettings.isAutomaticMode
                    ? 'Status hadir tepat, terlambat, atau pulang ditentukan otomatis sesuai jadwal kelas siswa.'
                    : 'Pilih kategori status kehadiran untuk pencatatan scan kartu QR/RFID.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {notifPermission !== 'unsupported' &&
                  (notifPermission === 'granted' ? (
                    <span
                      title="Notifikasi lokal perangkat aktif saat Scan Presensi berhasil"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl whitespace-nowrap"
                    >
                      <BellRing className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Notif Lokal Aktif</span>
                    </span>
                  ) : notifPermission === 'default' ? (
                    <button
                      type="button"
                      onClick={handleRequestNotifPermission}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary-accent-text)] px-2.5 py-1 bg-[var(--primary-accent-light)] hover:opacity-90 border border-[var(--primary-accent-border)] rounded-xl transition active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 shrink-0" />
                      <span>Aktifkan Notif Lokal</span>
                    </button>
                  ) : null)}

                {holidayInfo.isHoliday ? (
                  <span className="text-xs font-mono font-bold text-rose-700 px-3 py-1 bg-rose-50 border border-rose-200 rounded-xl">
                    ⛔ {holidayInfo.reason || `Hari Libur (${holidayInfo.hariNama})`}
                  </span>
                ) : (
                  <span className="text-xs font-mono font-bold text-cyan-700 px-3 py-1 bg-cyan-50 border border-cyan-200 rounded-xl">
                    Status: {formatReadableStatus(displayedActiveKehadiranStatus)}
                  </span>
                )}
              </div>
            </div>

            <div
              className={`grid grid-cols-3 gap-2.5 ${
                systemSettings.isAutomaticMode
                  ? 'opacity-60 pointer-events-none'
                  : ''
              }`}
            >
              {kehadiranCategories.map((opt) => {
                const isSelected = displayedActiveKehadiranStatus === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() =>
                      !systemSettings.isAutomaticMode &&
                      setSelectedKehadiranStatus(opt.label)
                    }
                    className={`py-3 px-3 rounded-xl text-left transition-all relative overflow-hidden border ${
                      isSelected
                        ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-7 h-7 bg-white/20 rounded-bl-full flex items-start justify-end p-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isSelected ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {opt.name}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        isSelected ? 'text-cyan-100' : 'text-gray-500'
                      }`}
                    >
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Modern QR Camera Scanner & USB RFID Reader */}
            <div className="lg:col-span-7 space-y-6">
              <ModernQrScanner
                isActive={isCameraActive}
                onToggleActive={async (nextActive) => {
                  if (nextActive && notificationService.getPermission() === 'default') {
                    const perm = await notificationService.requestPermission();
                    setNotifPermission(perm);
                  }
                  setIsCameraActive(nextActive);
                }}
                onScan={(text) => handleProcessUid(text, 'QR')}
              />

              {/* USB RFID Reader Card */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 relative overflow-hidden space-y-3">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="whitespace-nowrap text-base sm:text-lg font-bold text-gray-900">
                      USB RFID Reader (Keyboard HID)
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Tempelkan kartu RFID pada scanner USB (mengetik otomatis + Enter)
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRfidSubmit} className="flex gap-2">
                  <input
                    ref={rfidInputRef}
                    autoFocus
                    type="text"
                    value={rfidInput}
                    onChange={(e) => setRfidInput(e.target.value)}
                    placeholder="Scan kartu RFID USB / Ketik UID (contoh: E2000019)..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 font-mono focus:outline-none focus:border-cyan-500 shadow-sm uppercase"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !rfidInput.trim()}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-5 py-3 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 shadow-sm shrink-0"
                  >
                    {isSubmitting ? 'Memproses...' : 'Tap Kartu'}
                  </button>
                </form>

                <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 pt-1">
                  <span className="flex items-center gap-1.5 text-cyan-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                    Kolom teks selalu aktif menerima scan USB reader
                  </span>
                  {lastScannedCode && (
                    <span className="text-gray-900 font-bold">
                      Terakhir: {lastScannedCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Notification Result & Catatan Presensi Harian (Hadir / Pulang) */}
            <div className="lg:col-span-5 space-y-6">
              {lastResult && (
                <div
                  className={`p-4 rounded-2xl border transition-all shadow-sm ${
                    lastResult.type === 'success'
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {lastResult.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900">
                        {lastResult.title}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {lastResult.description}
                      </p>

                      {lastResult.studentName && (
                        <div className="mt-3 p-3 bg-white rounded-xl border border-gray-200 text-xs space-y-2 shadow-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Siswa:</span>
                            <span className="font-bold text-gray-900">
                              {lastResult.studentName}
                            </span>
                          </div>
                          {lastResult.waNumber && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Nomor WA Wali:</span>
                              <span className="font-mono text-cyan-600 font-semibold">
                                {lastResult.waNumber}
                              </span>
                            </div>
                          )}
                          {lastResult.variationChosen && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">Variasi Pesan:</span>
                              <span className="font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                Variasi #{lastResult.variationChosen} dari{' '}
                                {lastResult.totalVariations}
                              </span>
                            </div>
                          )}
                          {lastResult.renderedMessage && (
                            <div className="mt-2 pt-2 border-t border-gray-100 font-mono text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 p-2.5 rounded-lg">
                              {lastResult.renderedMessage}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={onNavigateToQueue}
                          className="text-xs text-cyan-600 hover:text-cyan-700 underline font-semibold flex items-center gap-1"
                        >
                          <span>Lihat Antrean WA</span>
                          <Send className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLastResult(null)}
                          className="text-xs text-gray-500 hover:text-gray-800 font-medium"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Catatan Presensi Harian (Khusus Status Hadir Tepat, Terlambat, Pulang) */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                    <Clock className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>Catatan Presensi (Hadir / Pulang)</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 font-mono whitespace-nowrap shrink-0">
                    {totalKehadiranLogs} Entri
                  </span>
                </div>

                <div className="space-y-2">
                  {totalKehadiranLogs === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400">
                      Belum ada catatan kehadiran / kepulangan siswa.
                    </div>
                  ) : (
                    paginatedKehadiranLogs.map((log) => {
                      let badgeBg =
                        'bg-emerald-50 text-emerald-700 border-emerald-200';
                      if (log.status_kehadiran === 'hadir_telat') {
                        badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else if (log.status_kehadiran === 'pulang') {
                        badgeBg = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                      }

                      const timeStr = new Date(log.waktu).toLocaleTimeString(
                        'id-ID',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      );

                      return (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs hover:border-cyan-300 transition shadow-sm"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="font-bold text-gray-900 truncate">
                              {log.student_name || 'Siswa'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              Kelas {log.student_kelas || 'Umum'} · UID:{' '}
                              {log.rfid_uid} · {timeStr} WIB
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap shrink-0 ${badgeBg}`}
                          >
                            {formatBadgeStatusLabel(log.status_kehadiran)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Kontrol Navigasi Paginasi (10 data per halaman) */}
                {totalKehadiranLogs > itemsPerPage && (
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="text-[11px] text-gray-500 font-medium">
                      Menampilkan{' '}
                      <span className="font-bold text-gray-800 font-mono">
                        {startIndex + 1}–{endIndex}
                      </span>{' '}
                      dari{' '}
                      <span className="font-bold text-gray-800 font-mono">
                        {totalKehadiranLogs}
                      </span>{' '}
                      entri{' '}
                      <span className="text-gray-400">
                        (Hal {safeCurrentPage} dari {totalKehadiranPages})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={safeCurrentPage <= 1}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                      >
                        &lt; Sebelumnya
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalKehadiranPages, prev + 1)
                          )
                        }
                        disabled={safeCurrentPage >= totalKehadiranPages}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                      >
                        Berikutnya &gt;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          3. ISI & ALUR LOGIKA SUB-MENU: TIDAK HADIR (IZIN & SAKIT)
             - Kategori Ketidakhadiran: 2 Kotak Pilihan (Izin & Sakit)
             - Bagian A: Antrean Konfirmasi Izin/Sakit (Dari Portal Wali Murid)
             - Bagian B: Pencatatan Izin/Sakit Manual (Oleh Guru/Admin)
             - Bagian C: Daftar Siswa Tidak Hadir Hari Ini
         ================================================================= */}
      {activeSubMenu === 'tidak_hadir' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Kategori Ketidakhadiran (2 Kotak Pilihan: Izin & Sakit) */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <UserX className="w-5 h-5 text-cyan-600 shrink-0" />
                  <span>Kategori Ketidakhadiran</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pilih jenis ketidakhadiran siswa (Izin atau Sakit) untuk pencatatan maupun verifikasi izin wali murid.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-700 px-3 py-1 bg-cyan-50 border border-cyan-200 rounded-xl self-start sm:self-auto">
                Mode Aktif: {selectedAbsenceStatus === 'izin' ? 'Izin' : 'Sakit'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {tidakHadirCategories.map((opt) => {
                const isSelected = selectedAbsenceStatus === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSelectedAbsenceStatus(opt.label)}
                    className={`py-3.5 px-4 rounded-xl text-left transition-all relative overflow-hidden border ${
                      isSelected
                        ? opt.label === 'izin'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-bold'
                          : 'bg-rose-600 text-white border-rose-600 shadow-sm font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-bl-full flex items-start justify-end p-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div
                      className={`text-sm font-bold ${
                        isSelected ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {opt.name}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        isSelected ? 'text-white/90' : 'text-gray-500'
                      }`}
                    >
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifikasi Umpan Balik Aksi */}
          {lastResult && (
            <div
              className={`p-4 rounded-2xl border transition-all shadow-sm ${
                lastResult.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {lastResult.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">{lastResult.title}</h4>
                    <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                      {lastResult.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLastResult(null)}
                  className="text-xs font-bold underline opacity-75 hover:opacity-100 shrink-0"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri (Bagian A & Bagian B) */}
            <div className="lg:col-span-7 space-y-6">
              {/* BAGIAN A: Antrean Konfirmasi Izin/Sakit (Dari Portal Wali Murid) */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900">
                        Antrean Konfirmasi Izin / Sakit (Portal Wali Murid)
                      </h3>
                      <p className="text-xs text-gray-500">
                        Verifikasi pengajuan izin atau sakit yang dikirim oleh orang tua/wali siswa.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono shrink-0 ${
                      pendingLeaveRequests.length > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {pendingLeaveRequests.length} Pending
                  </span>
                </div>

                {pendingLeaveRequests.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1">
                    <div className="text-xs font-bold text-slate-600">
                      Tidak Ada Antrean Pengajuan Pending
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Pengajuan izin/sakit baru dari Portal Wali Murid akan otomatis tampil di sini untuk dikonfirmasi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingLeaveRequests.map((req) => {
                      const isProcessing = processingRequestId === req.id;
                      const isSakit = req.jenis === 'sakit';
                      const jamPengajuan = req.created_at
                        ? new Date(req.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) + ' WIB'
                        : '-';

                      return (
                        <div
                          key={req.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white transition shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {req.student_name}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium mt-0.5">
                                <span>
                                  Kelas:{' '}
                                  <strong className="text-slate-800">
                                    {req.student_kelas || 'Umum'}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Jam Pengajuan:{' '}
                                  <strong className="font-mono text-cyan-700">
                                    {jamPengajuan}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Tanggal:{' '}
                                  <span className="font-mono font-semibold text-slate-700">
                                    {req.tanggal}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase shrink-0 ${
                                isSakit
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}
                            >
                              {isSakit ? 'Sakit' : 'Izin'}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-700 leading-relaxed">
                            <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">
                              Keterangan Alasan Wali Murid:
                            </span>
                            {req.alasan}
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleApproveLeaveRequest(req)}
                              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition"
                            >
                              <Check className="w-4 h-4 shrink-0" />
                              <span>Setujui</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleRejectLeaveRequest(req)}
                              className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                            >
                              <X className="w-4 h-4 shrink-0" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BAGIAN B: Pencatatan Izin/Sakit Manual (Oleh Guru/Admin) */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">
                      Pencatatan Izin / Sakit Manual (Oleh Guru / Admin)
                    </h3>
                    <p className="text-xs text-gray-500">
                      Catat ketidakhadiran bagi orang tua/wali yang mengabari melalui surat fisik atau telepon.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleManualAbsenceSubmit} className="space-y-4">
                  {/* 1. Pencarian Siswa (Ketik Lalu Pilih) */}
                  <div className="space-y-1.5 relative">
                    <label className="block text-xs font-bold text-gray-700">
                      1. Cari &amp; Pilih Siswa
                    </label>

                    {selectedStudent ? (
                      <div className="p-3.5 rounded-xl bg-cyan-50/80 border border-cyan-200 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-cyan-950 truncate">
                            {selectedStudent.nama}
                          </div>
                          <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                            Kelas {selectedStudent.kelas || 'Umum'} · NISN:{' '}
                            {selectedStudent.nisn || '-'} · UID:{' '}
                            {selectedStudent.rfid_uid || '-'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId('');
                            setSearchQuery('');
                            setIsDropdownOpen(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-cyan-800 border border-cyan-200 text-[11px] font-bold transition shrink-0"
                        >
                          Ubah Siswa
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          placeholder="Ketik nama siswa, NISN, atau UID kartu..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-cyan-500 shadow-2xs"
                          autoComplete="off"
                        />

                        {isDropdownOpen && searchQuery.trim() !== '' && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-gray-100">
                            {filteredStudents.length === 0 ? (
                              <div className="p-3 text-xs text-gray-400 text-center">
                                Tidak ada siswa yang cocok dengan &quot;{searchQuery}&quot;.
                              </div>
                            ) : (
                              filteredStudents.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentId(s.id);
                                    setSearchQuery('');
                                    setIsDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-50 transition flex items-center justify-between text-xs group"
                                >
                                  <div>
                                    <div className="font-bold text-gray-900 group-hover:text-cyan-900">
                                      {s.nama}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono">
                                      Kelas {s.kelas || 'Umum'} · NISN: {s.nisn || '-'} · UID:{' '}
                                      {s.rfid_uid || '-'}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold text-cyan-600 bg-cyan-50 group-hover:bg-cyan-100 px-2 py-1 rounded-lg">
                                    Pilih
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Pilihan Status (Izin / Sakit) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700">
                      2. Status Ketidakhadiran
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedAbsenceStatus('izin')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          selectedAbsenceStatus === 'izin'
                            ? 'bg-purple-50 border-purple-500 text-purple-800 ring-1 ring-purple-500'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>📋 Izin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAbsenceStatus('sakit')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          selectedAbsenceStatus === 'sakit'
                            ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>🏥 Sakit</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Input Keterangan Alasan Manual */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700">
                      3. Keterangan / Alasan Ketidakhadiran
                    </label>
                    <textarea
                      rows={2}
                      value={manualAbsenceReason}
                      onChange={(e) => setManualAbsenceReason(e.target.value)}
                      placeholder={
                        selectedAbsenceStatus === 'sakit'
                          ? 'Contoh: Demam tinggi, surat keterangan dokter / telepon wali...'
                          : 'Contoh: Acara keluarga di luar kota, surat izin tertulis orang tua...'
                      }
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-cyan-500 transition shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedStudentId}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-[0.99]"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {isSubmitting
                        ? 'Menyimpan Ketidakhadiran...'
                        : 'Simpan Ketidakhadiran'}
                    </span>
                  </button>
                </form>
              </div>
            </div>

            {/* Kolom Kanan (Bagian C: Daftar Siswa Tidak Hadir Hari Ini) */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-600 shrink-0" />
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900">
                        Daftar Siswa Tidak Hadir Hari Ini
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Rekap siswa yang tercatat Izin atau Sakit pada hari ini
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 font-mono shrink-0">
                    {totalAbsenceLogs} Siswa
                  </span>
                </div>

                <div className="space-y-2.5">
                  {totalAbsenceLogs === 0 ? (
                    <div className="text-center py-8 px-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                      Belum ada siswa yang tercatat Izin atau Sakit pada hari ini.
                    </div>
                  ) : (
                    paginatedAbsenceLogs.map((log) => {
                      const isSakit = log.status_kehadiran === 'sakit';
                      const badgeBg = isSakit
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200';

                      const timeStr = new Date(log.waktu).toLocaleTimeString(
                        'id-ID',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      );

                      return (
                        <div
                          key={log.id}
                          className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 text-xs hover:border-cyan-300 transition shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-gray-900 truncate">
                                {log.student_name || 'Siswa'}
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                Kelas {log.student_kelas || 'Umum'} · {timeStr} WIB
                              </div>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap shrink-0 ${badgeBg}`}
                            >
                              {formatBadgeStatusLabel(log.status_kehadiran)}
                            </span>
                          </div>

                          {log.keterangan && (
                            <div className="pt-2 border-t border-gray-200/70 text-[11px] text-gray-600 leading-relaxed">
                              <span className="font-semibold text-gray-700">
                                Alasan:{' '}
                              </span>
                              {log.keterangan}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Paginasi Daftar Siswa Tidak Hadir Hari Ini */}
                {totalAbsenceLogs > itemsPerPage && (
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="text-[11px] text-gray-500 font-medium">
                      Menampilkan{' '}
                      <span className="font-bold text-gray-800 font-mono">
                        {startAbsenceIdx + 1}–{endAbsenceIdx}
                      </span>{' '}
                      dari{' '}
                      <span className="font-bold text-gray-800 font-mono">
                        {totalAbsenceLogs}
                      </span>{' '}
                      siswa{' '}
                      <span className="text-gray-400">
                        (Hal {safeAbsencePage} dari {totalAbsencePages})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setAbsencePage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={safeAbsencePage <= 1}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                      >
                        &lt; Sebelumnya
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAbsencePage((prev) =>
                            Math.min(totalAbsencePages, prev + 1)
                          )
                        }
                        disabled={safeAbsencePage >= totalAbsencePages}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                      >
                        Berikutnya &gt;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
