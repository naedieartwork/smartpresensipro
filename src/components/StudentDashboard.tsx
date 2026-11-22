import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  QrCode,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  PieChart,
  Megaphone,
  FileText,
  Upload,
  Plus,
  X,
  Download,
  BookOpen,
  Pin,
  School,
  User,
  CalendarDays,
  RefreshCw,
  Home,
  ChevronRight,
  CreditCard,
  Radio,
  LogOut,
  ArrowLeft,
  Smartphone,
  Award,
  ShieldAlert,
  ChevronLeft,
  ChevronDown,
  Filter,
  Stethoscope,
  Coffee,
  Sparkles,
} from 'lucide-react';
import { supabaseService } from '../services/supabaseClient';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
} from '../services/settingsService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Student,
  AttendanceLog,
  Announcement,
  JadwalPelajaran,
  KalenderPendidikan,
  Rombel,
  StatusCategory,
  StudentPoint,
  LeaveRequest,
} from '../types';
import { sound } from '../utils/audio';

interface StudentDashboardProps {
  onLogout: () => void;
  initialStudent?: Student | null;
  isAdminPreview?: boolean;
  onExitAdminPreview?: () => void;
}

type StudentTab = 'beranda' | 'riwayat' | 'qr' | 'poin' | 'pengajuan' | 'akademik';

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function getTodayIndonesianDayName(): string {
  const dayIdx = new Date().getDay(); // 0 = Minggu, 1 = Senin, ...
  const map = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return map[dayIdx] || 'Senin';
}

function getStudentInitials(fullName?: string): string {
  if (!fullName || !fullName.trim()) return 'SW';
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onLogout,
  initialStudent,
  isAdminPreview = false,
  onExitAdminPreview,
}) => {
  const [activeTab, setActiveTab] = useState<StudentTab>('beranda');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(initialStudent || null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classSchedule, setClassSchedule] = useState<JadwalPelajaran[]>([]);
  const [kalenderList, setKalenderList] = useState<KalenderPendidikan[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(getTodayIndonesianDayName);
  // Filter Status, Periode Waktu & Paginasi untuk Halaman Riwayat Presensi
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'hadir' | 'sakit' | 'izin' | 'ditolak'>('all');
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const HISTORY_ITEMS_PER_PAGE = 8;
  const [studentPoints, setStudentPoints] = useState<StudentPoint[]>([]);
  // Filter Waktu & Kategori pada Halaman Mandiri Poin (Default: Bulan Ini, Kategori toggle: null = Semua)
  const [pointTimeFilter, setPointTimeFilter] = useState<'week' | 'month' | 'year'>('month');
  const [pointCategoryFilter, setPointCategoryFilter] = useState<'Prestasi' | 'Pelanggaran' | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Real-time time ticker untuk status kartu jadwal pelajaran (update setiap 30 detik)
  const [currentNow, setCurrentNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Modal / Bottom Sheet Profil Siswa (Muncul saat Avatar Inisial di Kanan Atas diklik)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);

  // Identitas Instansi Dinamis (public.app_settings id = 1)
  const [brandConfig, setBrandConfig] = useState(() => {
    const s = settingsService.getSettings();
    return {
      appLogo: s.appLogo || '',
      appTitle: s.appTitle || DEFAULT_APP_TITLE,
      appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
    };
  });
  const [portalLogoError, setPortalLogoError] = useState(false);

  // PWA Install Hook
  const {
    isInstalled,
    isIOS,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
  } = usePWAInstall();

  // Sub-tab Akademik ('jadwal' | 'kaldik')
  const [akademikSubTab, setAkademikSubTab] = useState<'jadwal' | 'kaldik'>('jadwal');

  // Modal / Tampilan Khusus Info & Pengumuman Sekolah (Header Megafon)
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

  // State Formulir Pengajuan Izin / Sakit
  const [leaveReason, setLeaveReason] = useState<'sakit' | 'izin'>('sakit');
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveNote, setLeaveNote] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveSubmitSuccess, setLeaveSubmitSuccess] = useState(false);

  useEffect(() => {
    const syncBrand = () => {
      const s = settingsService.getSettings();
      setBrandConfig({
        appLogo: s.appLogo || '',
        appTitle: s.appTitle || DEFAULT_APP_TITLE,
        appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
      });
      setPortalLogoError(false);
    };
    syncBrand();
    const unsub = settingsService.subscribe(syncBrand);
    return () => unsub();
  }, []);

  const loadStudentPortalData = useCallback(
    async (targetStudent?: Student | null, silent = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const [studentsList, rombelList, allAnnouncements, allKalender] = await Promise.all([
          supabaseService.getStudents(),
          supabaseService.getRombel(),
          supabaseService.getAnnouncements(),
          supabaseService.getKalenderPendidikan(),
        ]);

        setAllStudents(studentsList);
        setKalenderList(allKalender);

        // Tentukan siswa yang sedang aktif
        let currentStudent: Student | null = targetStudent || initialStudent || null;
        if (currentStudent) {
          const freshMatch = studentsList.find(
            (s) =>
              s.id === currentStudent!.id ||
              (currentStudent!.nisn && s.nisn === currentStudent!.nisn) ||
              (currentStudent!.uid_kartu && s.uid_kartu === currentStudent!.uid_kartu)
          );
          if (freshMatch) {
            currentStudent = freshMatch;
            if (!isAdminPreview) {
              try {
                if (localStorage.getItem('smart_presensi_active_student_v1')) {
                  localStorage.setItem(
                    'smart_presensi_active_student_v1',
                    JSON.stringify(freshMatch)
                  );
                }
              } catch {
                // ignore storage error
              }
            }
          }
        } else if (studentsList.length > 0) {
          currentStudent = studentsList[0];
        }

        setStudent(currentStudent);

        if (currentStudent) {
          // 1. Ambil Riwayat Kehadiran Real-Time dari public.attendance_log, Catatan Poin, & Pengajuan Izin/Sakit
          const [myLogs, myPoints, myLeaveRequests] = await Promise.all([
            supabaseService.getStudentAttendanceLogs(currentStudent),
            supabaseService.getStudentPoints(currentStudent.id),
            supabaseService.getLeaveRequests(currentStudent.id),
          ]);
          setLogs(myLogs);
          setStudentPoints(myPoints);
          setLeaveRequests(myLeaveRequests);

          // 2. Cari Rombel / Kelas Siswa
          const studentClassName = String(
            currentStudent.kelas ||
              (typeof currentStudent.rombel === 'object' && currentStudent.rombel
                ? currentStudent.rombel.nama_kelas
                : '') ||
              ''
          ).trim();
          const studentRombelId = String(
            currentStudent.rombel_id ||
              currentStudent.class_id ||
              (typeof currentStudent.rombel === 'object' && currentStudent.rombel
                ? currentStudent.rombel.id
                : '') ||
              ''
          ).trim();

          const matchedRombel: Rombel | undefined = rombelList.find(
            (r) =>
              (studentRombelId && r.id === studentRombelId) ||
              (studentClassName &&
                r.nama_kelas.trim().toLowerCase() === studentClassName.toLowerCase())
          );

          // 3. Filter Pengumuman dari public.announcements (HANYA 'Semua Kelas' ATAU kelas siswa yang sedang login)
          const classCandidates = [
            studentClassName.toLowerCase(),
            studentRombelId.toLowerCase(),
            matchedRombel?.nama_kelas?.trim().toLowerCase() || '',
            matchedRombel?.id?.trim().toLowerCase() || '',
          ].filter(Boolean);

          const relevantAnnouncements = allAnnouncements.filter((a) => {
            const target = String(a.target_rombel || 'Semua Kelas').trim().toLowerCase();
            if (!target || target === 'semua kelas' || target === 'all') return true;
            return classCandidates.includes(target);
          });
          setAnnouncements(relevantAnnouncements);

          // 4. Ambil Jadwal Pelajaran Sesuai Kelas Siswa dari menu Akademik & Info
          const resolvedRombelId = matchedRombel?.id || studentRombelId;
          const is1A =
            studentClassName.toLowerCase() === '1a' ||
            (matchedRombel && matchedRombel.nama_kelas.trim().toLowerCase() === '1a');

          let allJadwal = await supabaseService.getJadwalPelajaran();
          let myJadwal = allJadwal.filter((j) => {
            const jRombel = String(j.rombel_id || '').trim().toLowerCase();
            if (resolvedRombelId && jRombel === resolvedRombelId.toLowerCase()) return true;
            if (studentClassName && jRombel === studentClassName.toLowerCase()) return true;
            return false;
          });

          // Jika siswa kelas 1A dan jadwal belum terisi, seed otomatis
          if (is1A && myJadwal.length === 0) {
            myJadwal = await supabaseService.ensure1AScheduleSeeded(resolvedRombelId || 'rmb-1a');
          }

          setClassSchedule(myJadwal);
        } else {
          setAnnouncements(
            allAnnouncements.filter(
              (a) =>
                String(a.target_rombel || 'Semua Kelas').trim().toLowerCase() === 'semua kelas'
            )
          );
        }
      } catch (error) {
        console.error('Gagal memuat data Portal Siswa:', error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [initialStudent]
  );

  useEffect(() => {
    loadStudentPortalData(initialStudent || null, false);
  }, [initialStudent, loadStudentPortalData]);

  useEffect(() => {
    const handleUpdate = () => {
      loadStudentPortalData(student, true);
    };
    const unsub = supabaseService.subscribe(handleUpdate);

    const supabase = supabaseService.getClient();
    const channel = supabase
      .channel('student-dashboard-leave-requests-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          handleUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        () => {
          handleUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        () => {
          handleUpdate();
        }
      )
      .subscribe();

    window.addEventListener('leave_requests_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('smart_presensi_leave_requests_channel');
        bc.onmessage = () => {
          handleUpdate();
        };
      } catch {
        bc = null;
      }
    }

    return () => {
      unsub();
      supabase.removeChannel(channel);
      window.removeEventListener('leave_requests_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (bc) {
        bc.close();
      }
    };
  }, [student, loadStudentPortalData]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setIsSubmittingLeave(true);
    setLeaveSubmitSuccess(false);
    try {
      const cardCode = student.uid_kartu || student.rfid_uid || student.nisn || student.id;
      const kelasName =
        student.kelas ||
        (typeof student.rombel === 'object' && student.rombel ? student.rombel.nama_kelas : '') ||
        'Umum';

      await supabaseService.submitLeaveRequest({
        student_id: student.id,
        uid_kartu: cardCode,
        student_name: student.nama,
        student_kelas: kelasName,
        jenis: leaveReason,
        tanggal: leaveDate,
        alasan: leaveNote.trim() || (leaveReason === 'sakit' ? 'Keterangan sakit dari wali murid' : 'Keterangan izin dari wali murid'),
      });
      sound.playSuccess();
      setLeaveNote('');
      setLeaveSubmitSuccess(true);
      await loadStudentPortalData(student, true);
    } catch (err: any) {
      alert('Gagal mengirim pengajuan izin/sakit: ' + (err?.message || String(err)));
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const studentInitials = getStudentInitials(student?.nama);
  const qrData = student ? student.uid_kartu || student.rfid_uid || student.nisn || student.id : '';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    qrData || ''
  )}&margin=10`;

  // Ringkasan Real-Time dari public.attendance_log (Hadir Tepat, Terlambat, Izin, Sakit, Pulang)
  const totalHadirTepat = logs.filter((l) => l.status_kehadiran === 'hadir_tepat').length;
  const totalTelat = logs.filter((l) => l.status_kehadiran === 'hadir_telat').length;
  const totalIzin = logs.filter((l) => l.status_kehadiran === 'izin').length;
  const totalSakit = logs.filter((l) => l.status_kehadiran === 'sakit').length;
  const totalPulang = logs.filter((l) => l.status_kehadiran === 'pulang').length;

  // Ringkasan Poin Kedisiplinan & Prestasi Siswa dari public.student_points
  const totalPoinPlus = studentPoints.reduce((acc, pt) => {
    const val = Number(pt.poin) || 0;
    return pt.jenis === 'Prestasi' || val > 0 ? acc + Math.abs(val) : acc;
  }, 0);
  const totalPoinMinus = studentPoints.reduce((acc, pt) => {
    const val = Number(pt.poin) || 0;
    return pt.jenis === 'Pelanggaran' || val < 0 ? acc - Math.abs(val) : acc;
  }, 0);
  const totalAkumulasiPoin = totalPoinPlus + totalPoinMinus;

  // Pengumuman Pinned untuk baris teratas halaman Beranda (atau fallback pengumuman terbaru jika belum ada yang disematkan)
  const pinnedAnnouncement =
    announcements.find((a) => Boolean(a.is_pinned)) || announcements[0] || null;

  const dayScheduleItems = classSchedule
    .filter((j) => j.hari.toLowerCase() === selectedDay.toLowerCase())
    .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));

  const displayHistoryItems = useMemo(() => {
    type HistoryItem =
      | { type: 'leave'; data: (typeof leaveRequests)[number] }
      | { type: 'log'; data: (typeof logs)[number] };

    const items: HistoryItem[] = [];

    // 1. Evaluasi & masukkan pengajuan (leaveRequests)
    leaveRequests.forEach((req) => {
      // Status filter matching
      if (historyStatusFilter === 'all') {
        // Pending atau rejected tampil sebagai item tersendiri (yang approved sudah ada di logs)
        if (req.status === 'pending' || req.status === 'rejected') {
          items.push({ type: 'leave', data: req });
        }
      } else if (historyStatusFilter === 'ditolak') {
        if (req.status === 'rejected') {
          items.push({ type: 'leave', data: req });
        }
      } else if (historyStatusFilter === 'sakit') {
        if (req.jenis === 'sakit' && req.status === 'pending') {
          items.push({ type: 'leave', data: req });
        }
      } else if (historyStatusFilter === 'izin') {
        if (req.jenis === 'izin' && req.status === 'pending') {
          items.push({ type: 'leave', data: req });
        }
      }
      // Untuk historyStatusFilter === 'hadir', permohonan leave tidak diikutsertakan
    });

    // 2. Evaluasi & masukkan attendance logs
    logs.forEach((log) => {
      if (historyStatusFilter === 'all') {
        items.push({ type: 'log', data: log });
      } else if (historyStatusFilter === 'hadir') {
        // Hadir Tepat Waktu, Hadir Terlambat, Pulang
        if (
          log.status_kehadiran === 'hadir_tepat' ||
          log.status_kehadiran === 'hadir_telat' ||
          log.status_kehadiran === 'pulang'
        ) {
          items.push({ type: 'log', data: log });
        }
      } else if (historyStatusFilter === 'sakit') {
        if (log.status_kehadiran === 'sakit') {
          items.push({ type: 'log', data: log });
        }
      } else if (historyStatusFilter === 'izin') {
        if (log.status_kehadiran === 'izin') {
          items.push({ type: 'log', data: log });
        }
      }
      // Untuk historyStatusFilter === 'ditolak', logs kehadiran normal tidak diikutsertakan
    });

    // 3. Urutkan berdasarkan waktu descending
    const sorted = items.sort((a, b) => {
      const timeA =
        a.type === 'leave'
          ? new Date(a.data.created_at).getTime()
          : new Date(a.data.waktu).getTime();
      const timeB =
        b.type === 'leave'
          ? new Date(b.data.created_at).getTime()
          : new Date(b.data.waktu).getTime();
      return timeB - timeA;
    });

    // 4. Filter berdasarkan Periode Waktu (historyTimeFilter: 'today' | 'week' | 'month' | 'year' | 'all')
    if (historyTimeFilter === 'all') return sorted;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Awal minggu ini (dimulai hari Senin)
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return sorted.filter((item) => {
      const itemDateStr =
        item.type === 'leave'
          ? item.data.tanggal || (item.data.created_at ? item.data.created_at.slice(0, 10) : '')
          : (item.data.waktu ? item.data.waktu.slice(0, 10) : '');

      const itemTimestamp =
        item.type === 'leave'
          ? new Date(item.data.created_at).getTime()
          : new Date(item.data.waktu).getTime();

      const itemDate = new Date(itemTimestamp);

      if (historyTimeFilter === 'today') {
        return itemDateStr === todayStr;
      }
      if (historyTimeFilter === 'week') {
        return !isNaN(itemTimestamp) && itemDate >= startOfWeek;
      }
      if (historyTimeFilter === 'month') {
        return (
          !isNaN(itemTimestamp) &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      }
      if (historyTimeFilter === 'year') {
        return !isNaN(itemTimestamp) && itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [leaveRequests, logs, historyStatusFilter, historyTimeFilter]);

  // Paginasi Halaman Riwayat Presensi
  const totalHistoryPages = Math.max(1, Math.ceil(displayHistoryItems.length / HISTORY_ITEMS_PER_PAGE));
  const currentHistoryPage = Math.min(Math.max(1, historyPage), totalHistoryPages);
  const paginatedHistoryItems = useMemo(() => {
    const startIndex = (currentHistoryPage - 1) * HISTORY_ITEMS_PER_PAGE;
    return displayHistoryItems.slice(startIndex, startIndex + HISTORY_ITEMS_PER_PAGE);
  }, [displayHistoryItems, currentHistoryPage, HISTORY_ITEMS_PER_PAGE]);

  // Data Poin Siswa Terfilter untuk Halaman Mandiri Poin
  const filteredStudentPoints = useMemo(() => {
    const now = new Date();
    // Awal minggu ini (dimulai hari Senin)
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return studentPoints.filter((pt) => {
      // 1. Filter Kategori
      if (pointCategoryFilter === 'Prestasi' && pt.jenis !== 'Prestasi' && pt.poin <= 0) {
        return false;
      }
      if (pointCategoryFilter === 'Pelanggaran' && pt.jenis !== 'Pelanggaran' && pt.poin > 0) {
        return false;
      }

      // 2. Filter Waktu ('week' | 'month' | 'year')
      const ptDate = new Date(pt.created_at);
      if (isNaN(ptDate.getTime())) return true;

      if (pointTimeFilter === 'week') {
        return ptDate >= startOfWeek;
      }
      if (pointTimeFilter === 'month') {
        return (
          ptDate.getMonth() === now.getMonth() &&
          ptDate.getFullYear() === now.getFullYear()
        );
      }
      if (pointTimeFilter === 'year') {
        return ptDate.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [studentPoints, pointTimeFilter, pointCategoryFilter]);

  const getCategoryBadgeStyle = (kategori: Announcement['kategori']) => {
    switch (kategori) {
      case 'Penting':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Kegiatan':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Akademik':
      default:
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
  };

  const renderAttendanceSummaryCard = (interactiveFilter = false) => (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-cyan-600" />
          <span>Ringkasan Kehadiran Real-Time</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadStudentPortalData(student, true)}
            title="Segarkan Data Kehadiran"
            className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-cyan-600 transition active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-600' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setHistoryStatusFilter('hadir');
            setHistoryPage(1);
            setActiveTab('riwayat');
          }}
          className="p-3 rounded-2xl border text-center transition active:scale-95 bg-emerald-50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-100/70"
        >
          <div className="text-xl font-bold text-emerald-700 font-mono">{totalHadirTepat}</div>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
            Hadir Tepat
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setHistoryStatusFilter('hadir');
            setHistoryPage(1);
            setActiveTab('riwayat');
          }}
          className="p-3 rounded-2xl border text-center transition active:scale-95 bg-amber-50 border-amber-100 hover:border-amber-300 hover:bg-amber-100/70"
        >
          <div className="text-xl font-bold text-amber-700 font-mono">{totalTelat}</div>
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1">
            Terlambat
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setHistoryStatusFilter('izin');
            setHistoryPage(1);
            setActiveTab('riwayat');
          }}
          className="p-3 rounded-2xl border text-center transition active:scale-95 bg-sky-50 border-sky-100 hover:border-sky-300 hover:bg-sky-100/70"
        >
          <div className="text-xl font-bold text-sky-700 font-mono">{totalIzin}</div>
          <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mt-1">
            Izin
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setHistoryStatusFilter('sakit');
            setHistoryPage(1);
            setActiveTab('riwayat');
          }}
          className="p-3 rounded-2xl border text-center transition active:scale-95 bg-rose-50 border-rose-100 hover:border-rose-300 hover:bg-rose-100/70"
        >
          <div className="text-xl font-bold text-rose-700 font-mono">{totalSakit}</div>
          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">
            Sakit
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setHistoryStatusFilter('hadir');
            setHistoryPage(1);
            setActiveTab('riwayat');
          }}
          className="col-span-2 sm:col-span-1 p-3 rounded-2xl border text-center transition active:scale-95 bg-indigo-50 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-100/70"
        >
          <div className="text-xl font-bold text-indigo-700 font-mono">{totalPulang}</div>
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mt-1">
            Pulang
          </div>
        </button>
      </div>
    </div>
  );

  const renderDisciplineSummaryCard = () => (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-cyan-600" />
          <span>Poin &amp; Kedisiplinan Siswa</span>
        </h3>
        <button
          type="button"
          onClick={() => setActiveTab('poin')}
          className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 hover:underline"
        >
          <span>Buka Poin ({studentPoints.length})</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3 Kotak Ringkasan: Poin Plus Hijau, Poin Minus Merah, dan Total Akumulasi Poin */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
          <div className="text-lg sm:text-xl font-bold text-emerald-700 font-mono tabular-nums">
            +{totalPoinPlus}
          </div>
          <div className="text-[10px] font-bold text-emerald-700 mt-1">
            Prestasi (+)
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-center">
          <div className="text-lg sm:text-xl font-bold text-rose-700 font-mono tabular-nums">
            {totalPoinMinus}
          </div>
          <div className="text-[10px] font-bold text-rose-700 mt-1">
            Pelanggaran (-)
          </div>
        </div>

        <div
          className={`p-3 rounded-2xl border text-center ${
            totalAkumulasiPoin > 0
              ? 'bg-cyan-50 border-cyan-200'
              : totalAkumulasiPoin < 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${
              totalAkumulasiPoin > 0
                ? 'text-cyan-700'
                : totalAkumulasiPoin < 0
                ? 'text-rose-700'
                : 'text-slate-700'
            }`}
          >
            {totalAkumulasiPoin > 0 ? `+${totalAkumulasiPoin}` : totalAkumulasiPoin}
          </div>
          <div className="text-[10px] font-bold text-slate-600 mt-1">
            Total Poin
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      {/* =========================================================
          HEADER ATAS SEDERHANA & TOMBOL AVATAR PROFIL INISIAL
         ========================================================= */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Zone Dinamis (public.app_settings) */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {brandConfig.appLogo && !portalLogoError ? (
              <img
                src={brandConfig.appLogo}
                alt={brandConfig.appTitle}
                onError={() => setPortalLogoError(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl shrink-0"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-2xs shrink-0">
                <Radio className="w-5 h-5 text-white animate-pulse" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-cyan-700 block truncate">
                {brandConfig.appTitle || DEFAULT_APP_TITLE}
              </span>
              <p className="text-[11px] sm:text-xs text-cyan-600/80 font-semibold block truncate">
                {brandConfig.appSubtitle || DEFAULT_APP_SUBTITLE}
              </p>
            </div>
          </div>

          {/* Kanan Atas: Tombol Kembali (Khusus Pratinjau Admin) & Tombol Avatar Inisial Lingkaran */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdminPreview && onExitAdminPreview && (
              <button
                type="button"
                onClick={onExitAdminPreview}
                title="Kembali ke Dashboard Admin"
                className="text-xs font-bold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition active:scale-95 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            {/* Tombol Akses Pengumuman / Info dengan Badge Merah */}
            <button
              type="button"
              onClick={() => setIsAnnouncementOpen(true)}
              title="Pengumuman & Informasi Sekolah"
              aria-label="Pengumuman dan Informasi Sekolah"
              className="relative w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 flex items-center justify-center transition active:scale-95 shrink-0"
            >
              <Megaphone className="w-5 h-5 text-cyan-600" />
              {announcements.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-xs ring-2 ring-white">
                  {announcements.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsProfileSheetOpen(true)}
              title={student ? `Profil ${student.nama}` : 'Profil Siswa & Akun'}
              className="w-10 h-10 rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold text-xs sm:text-sm flex items-center justify-center shadow-sm overflow-hidden transition transform active:scale-95 shrink-0"
            >
              {student?.avatar_url ? (
                <img
                  src={student.avatar_url}
                  alt={student.nama}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{studentInitials}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          CONTAINER UTAMA PORTAL SISWA
         ========================================================= */}
      <main className="max-w-2xl mx-auto pt-4 px-4 sm:px-6 pb-24 sm:pb-8 space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 font-mono text-sm animate-pulse">
            Memuat Portal Dashboard Siswa &amp; Wali Murid...
          </div>
        ) : !student ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-gray-200 shadow-xs">
            <p className="text-rose-500 font-bold text-sm">
              Data siswa tidak ditemukan di database.
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 px-4 py-2 bg-cyan-500 text-white font-bold rounded-xl text-xs"
            >
              Kembali ke Halaman Login
            </button>
          </div>
        ) : (
          <>
            {/* Bar Pemilih Siswa (Khusus Saat Pratinjau Admin / Super Admin) */}
            {isAdminPreview && allStudents.length > 1 && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-amber-900 font-bold">
                  👁️ Pratinjau Siswa:
                </span>
                <select
                  value={student.id}
                  onChange={(e) => {
                    const found = allStudents.find((s) => s.id === e.target.value);
                    if (found) loadStudentPortalData(found, true);
                  }}
                  className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-cyan-500"
                >
                  {allStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nama} — Kelas {st.kelas || 'Umum'} ({st.nisn || st.uid_kartu})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* =========================================================
                HALAMAN PENUH DEDIKASI: INFO & PENGUMUMAN SEKOLAH
               ========================================================= */}
            {isAnnouncementOpen ? (
              <div key="page-announcements" className="space-y-4 animate-in fade-in duration-200">
                {/* Header Info & Pengumuman Sekolah dengan Hierarki Vertikal 3 Baris:
                    Baris 1 (Paling Atas Kiri): Tombol ← Kembali (w-fit)
                    Baris 2 (Di Bawah Tombol Kembali): Ikon megafon, Judul, dan Badge Jumlah Pengumuman
                    Baris 3: Teks Sub-Judul Deskripsi
                */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-3.5">
                  {/* Baris 1: Tombol ← Kembali di Kiri dan Badge Jumlah Info di Kanan */}
                  <div className="flex items-center justify-between w-full">
                    <button
                      type="button"
                      onClick={() => setIsAnnouncementOpen(false)}
                      className="w-fit px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                      title="Kembali ke Halaman Sebelumnya"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>

                    <span className="text-xs font-bold px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-full font-mono shrink-0">
                      {announcements.length} Info
                    </span>
                  </div>

                  {/* Baris Judul & Deskripsi: Ikon Megafon, Judul, dan Teks Deskripsi Rapat */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0 text-cyan-600">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight truncate">
                        Info &amp; Pengumuman Sekolah
                      </h2>
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed">
                      Informasi resmi sekolah untuk Semua Kelas &amp; Kelas {student.kelas || 'Umum'}
                    </p>
                  </div>
                </div>

                {/* Konten Daftar Kartu Pengumuman */}
                {announcements.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-dashed border-gray-200 shadow-sm">
                    <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-gray-700">Belum Ada Pengumuman</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Belum ada pengumuman aktif untuk Kelas {student.kelas || 'Umum'}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {announcements.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-white rounded-3xl p-5 sm:p-6 shadow-sm border transition space-y-3 ${
                          item.is_pinned
                            ? 'border-cyan-300 ring-2 ring-cyan-100/70 bg-gradient-to-b from-cyan-50/30 to-white'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.is_pinned && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Pin className="w-3 h-3 fill-current" />
                                <span>Disematkan</span>
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeStyle(
                                item.kategori
                              )}`}
                            >
                              {item.kategori}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white text-gray-700 border border-gray-200 flex items-center gap-1">
                              <School className="w-3 h-3 text-cyan-600" />
                              <span>{item.target_rombel}</span>
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-gray-400">
                            {item.tanggal}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-gray-900 leading-snug">
                          {item.judul}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {item.isi}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key={activeTab} className="ios-tab-transition space-y-4">
                {/* =========================================================
                    TAB 1: BERANDA (<Home /> - Fokus ke Pengumuman Pinned, Ringkasan Kehadiran, & Aksi Cepat)
                   ========================================================= */}
                {activeTab === 'beranda' && (
                  <div key="tab-beranda" className="space-y-4">
                {/* 1. Baris Teratas: Banner Biru Pengumuman Disematkan (Pinned) - Klik membuka halaman Info */}
                {pinnedAnnouncement ? (
                  <button
                    type="button"
                    onClick={() => setIsAnnouncementOpen(true)}
                    className="w-full text-left bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl p-5 shadow-md text-white flex items-start sm:items-center justify-between gap-3 relative overflow-hidden group transition active:scale-[0.99]"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex items-start gap-3.5 relative z-10 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs border border-white/20 mt-0.5">
                        <Megaphone className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pinnedAnnouncement.is_pinned && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-400/95 text-slate-950 text-[10px] font-bold flex items-center gap-1">
                              <Pin className="w-3 h-3 fill-current" />
                              <span>Disematkan</span>
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-bold uppercase tracking-wider">
                            {pinnedAnnouncement.kategori} • {pinnedAnnouncement.target_rombel}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm sm:text-base mt-1.5 truncate">
                          {pinnedAnnouncement.judul}
                        </h3>
                        <p className="text-xs text-blue-50 mt-0.5 line-clamp-2 leading-relaxed">
                          {pinnedAnnouncement.isi}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/80 group-hover:translate-x-0.5 transition shrink-0 self-center relative z-10" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAnnouncementOpen(true)}
                    className="w-full text-left bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl p-5 shadow-md text-white flex items-center justify-between gap-3 transition active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
                        <Megaphone className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm">Papan Pengumuman Sekolah</h3>
                        <p className="text-xs text-blue-100 mt-0.5 truncate">
                          Belum ada pengumuman terbaru untuk Kelas {student.kelas || 'Umum'}.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
                  </button>
                )}

                {/* 2. Kartu Ringkasan Kehadiran Real-Time */}
                {renderAttendanceSummaryCard(false)}

                {/* 3. Kartu Ringkasan Poin & Kedisiplinan Siswa */}
                {renderDisciplineSummaryCard()}
              </div>
            )}

            {/* =========================================================
                TAB 2: RIWAYAT (<Clock />)
               ========================================================= */}
            {activeTab === 'riwayat' && (
              <div key="tab-riwayat" className="space-y-4 animate-in fade-in duration-200">
                {/* 1. Kartu Riwayat Presensi Anak (Tampil di Urutan Paling Atas) */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
                  {/* Header Riwayat: Judul & Subteks */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Riwayat Presensi Anak</h3>
                        <p className="text-[11px] text-gray-500">
                          {displayHistoryItems.length} total catatan ditemukan
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dua Dropdown Filter dalam 1 Baris Sejajar (Side-by-Side Grid 2 Kolom) */}
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {/* 1. Dropdown Filter Periode Waktu */}
                    <div className="relative flex items-center w-full min-w-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none shrink-0" />
                      <select
                        value={historyTimeFilter}
                        onChange={(e) => {
                          setHistoryTimeFilter(e.target.value as typeof historyTimeFilter);
                          setHistoryPage(1); // Reset ke halaman 1 saat filter diubah
                        }}
                        className="w-full pl-8 pr-7 py-2 text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 transition cursor-pointer appearance-none truncate shadow-2xs"
                      >
                        <option value="today">Hari Ini</option>
                        <option value="week">Minggu Ini</option>
                        <option value="month">Bulan Ini</option>
                        <option value="year">Tahun Ini</option>
                        <option value="all">Semua Waktu</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none shrink-0" />
                    </div>

                    {/* 2. Dropdown Filter Status Kehadiran / Pengajuan */}
                    <div className="relative flex items-center w-full min-w-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none shrink-0" />
                      <select
                        value={historyStatusFilter}
                        onChange={(e) => {
                          setHistoryStatusFilter(e.target.value as typeof historyStatusFilter);
                          setHistoryPage(1); // Reset ke halaman 1 saat filter diubah
                        }}
                        className="w-full pl-8 pr-7 py-2 text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 transition cursor-pointer appearance-none truncate shadow-2xs"
                      >
                        <option value="all">Semua Status</option>
                        <option value="hadir">Hadir (Tepat &amp; Telat)</option>
                        <option value="sakit">Sakit</option>
                        <option value="izin">Izin</option>
                        <option value="ditolak">Ditolak</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none shrink-0" />
                    </div>
                  </div>

                  {/* Daftar Item Riwayat Presensi (Paginated) */}
                  <div className="space-y-3">
                    {displayHistoryItems.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50/70 rounded-2xl border border-dashed border-gray-200">
                        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2.5" />
                        <p className="text-xs font-semibold text-gray-500">
                          Belum ada catatan kehadiran pada periode ini.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryTimeFilter('all');
                            setHistoryPage(1);
                          }}
                          className="mt-2 text-[11px] font-bold text-cyan-700 hover:underline"
                        >
                          Tampilkan Semua Riwayat
                        </button>
                      </div>
                    ) : (
                      paginatedHistoryItems.map((item) => {
                        if (item.type === 'leave') {
                          const req = item.data;
                          const isPending = req.status === 'pending';
                          const isSakit = req.jenis === 'sakit';
                          const badgeBg = isPending
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200';
                          const badgeText = isPending
                            ? '⏳ Menunggu Konfirmasi'
                            : '✕ Ditolak';
                          const Icon = isPending ? AlertCircle : X;
                          const iconColor = isPending ? 'text-amber-500' : 'text-rose-500';
                          const statusLabel = isSakit ? 'Pengajuan Sakit' : 'Pengajuan Izin';
                          const jamStr = req.created_at
                            ? new Date(req.created_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) + ' WIB'
                            : '-';

                          return (
                            <div
                              key={req.id}
                              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isPending
                                  ? 'bg-amber-50/50 border-amber-200/90 hover:bg-amber-50/80'
                                  : 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50/60'
                              }`}
                            >
                              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                <div
                                  className={`p-2.5 rounded-xl bg-white shadow-xs border border-gray-100 ${iconColor} shrink-0 mt-0.5 sm:mt-0`}
                                >
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] text-gray-500 font-medium mb-0.5">
                                    Tanggal: {req.tanggal} · Diajukan {jamStr}
                                  </div>
                                  <div className="text-sm font-bold text-gray-900 truncate">
                                    {statusLabel}
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 italic">
                                    &ldquo;{req.alasan}&rdquo;
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 self-start sm:self-center ${badgeBg}`}
                              >
                                {badgeText}
                              </div>
                            </div>
                          );
                        }

                        const log = item.data;
                        let badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                        let Icon = CheckCircle2;
                        let iconColor = 'text-emerald-500';
                        let statusLabel = 'Hadir Tepat Waktu';
                        let badgeText = 'QR / RFID';

                        if (log.status_kehadiran === 'hadir_telat') {
                          badgeBg = 'bg-amber-50 text-amber-700 border border-amber-200';
                          Icon = AlertCircle;
                          iconColor = 'text-amber-500';
                          statusLabel = 'Hadir Terlambat';
                          badgeText = 'Terlambat';
                        } else if (log.status_kehadiran === 'pulang') {
                          badgeBg = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                          statusLabel = 'Pulang Sekolah';
                          badgeText = 'Pulang';
                        } else if (log.status_kehadiran === 'izin') {
                          badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                          Icon = FileText;
                          iconColor = 'text-emerald-600';
                          statusLabel = 'Izin Tidak Hadir';
                          badgeText = '✓ Disetujui Guru';
                        } else if (log.status_kehadiran === 'sakit') {
                          badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                          Icon = FileText;
                          iconColor = 'text-emerald-600';
                          statusLabel = 'Sakit';
                          badgeText = '✓ Disetujui Guru';
                        }

                        const timeStr = new Date(log.waktu).toLocaleString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <div
                            key={log.id}
                            className="p-4 rounded-2xl bg-gray-50/80 hover:bg-white border border-gray-100 hover:border-cyan-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <div
                                className={`p-2.5 rounded-xl bg-white shadow-xs border border-gray-100 ${iconColor} shrink-0`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] text-gray-500 font-medium mb-0.5">
                                  {timeStr} WIB
                                </div>
                                <div className="text-sm font-bold text-gray-900 truncate">
                                  {statusLabel}
                                </div>
                                {log.keterangan && (
                                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1 italic">
                                    Keterangan: &ldquo;{log.keterangan}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>
                            <div
                              className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 self-start sm:self-center ${badgeBg}`}
                            >
                              {badgeText}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Sistem Paginasi Sederhana */}
                  {displayHistoryItems.length > HISTORY_ITEMS_PER_PAGE && (
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={currentHistoryPage <= 1}
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          currentHistoryPage <= 1
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:scale-98 shadow-2xs'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sebelumnya</span>
                      </button>

                      <div className="text-[11px] font-semibold text-slate-600">
                        Halaman <span className="text-cyan-700 font-bold">{currentHistoryPage}</span> dari {totalHistoryPages}
                      </div>

                      <button
                        type="button"
                        disabled={currentHistoryPage >= totalHistoryPages}
                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          currentHistoryPage >= totalHistoryPages
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:scale-98 shadow-2xs'
                        }`}
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 3: KARTU QR (<QrCode /> - Eksklusif & Fokus di Tengah Layar)
               ========================================================= */}
            {activeTab === 'qr' && (
              <div
                key="tab-qr"
                className="py-2 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="w-full max-w-sm bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 rounded-[32px] p-1.5 shadow-xl shadow-cyan-500/15">
                  <div className="bg-white/95 backdrop-blur-xl rounded-[27px] p-6 sm:p-8 text-center flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-700 text-[11px] font-bold uppercase tracking-wider mb-4">
                      <QrCode className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Kartu Presensi Digital</span>
                    </div>

                    {/* Avatar & Informasi Nama & Kelas Siswa di dalam Kartu */}
                    <div className="mb-2.5">
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={student.nama}
                          className="w-14 h-14 rounded-full object-cover border-2 border-[var(--primary-accent-border)] shadow-sm mx-auto"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold text-base flex items-center justify-center shadow-sm mx-auto">
                          {studentInitials}
                        </div>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                      {student.nama}
                    </h2>
                    <div className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <span>Kelas {student.kelas || 'Umum'}</span>
                      <span>•</span>
                      <span className="font-mono">NIS: {student.nisn || '-'}</span>
                    </div>

                    {/* Area QR Code Proporsional & Fokus untuk Kamera Scanner */}
                    <div className="my-6 bg-white p-4 rounded-3xl shadow-md border-4 border-cyan-50 inline-block">
                      <img
                        src={qrImageUrl}
                        alt={`QR Code ${student.nama}`}
                        className="w-56 h-56 sm:w-60 sm:h-60 object-contain rounded-xl"
                      />
                    </div>

                    {/* Badge Nomor UID / ID Kartu */}
                    <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-2.5 px-4 mb-4 flex items-center justify-center gap-2">
                      <CreditCard className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span className="text-xs font-mono font-bold text-slate-800 tracking-wider">
                        ID KARTU: {qrData}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
                      Arahkan kode QR ini ke kamera pemindai (scanner) di gerbang sekolah untuk mencatat kehadiran masuk maupun pulang.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 4: POIN & KEDISIPLINAN (<Award /> - Halaman Mandiri Prestasi & Pelanggaran)
               ========================================================= */}
            {activeTab === 'poin' && (
              <div key="tab-poin" className="space-y-4 animate-in fade-in duration-200">
                {/* 1. Header Pengantar & Ringkasan Akumulasi Poin */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">
                        Poin &amp; Kedisiplinan Siswa
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Rekapitulasi akumulasi poin penghargaan prestasi dan catatan kedisiplinan ananda.
                      </p>
                    </div>
                  </div>

                  {/* 3 Kotak Ringkasan Akumulasi Poin */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-100 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                        +{totalPoinPlus}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-700 mt-1">
                        Prestasi (+)
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-100 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-rose-700 font-mono tabular-nums">
                        {totalPoinMinus}
                      </div>
                      <div className="text-[11px] font-bold text-rose-700 mt-1">
                        Pelanggaran (-)
                      </div>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl border text-center ${
                        totalAkumulasiPoin > 0
                          ? 'bg-cyan-50/90 border-cyan-200'
                          : totalAkumulasiPoin < 0
                          ? 'bg-amber-50/90 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div
                        className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                          totalAkumulasiPoin > 0
                            ? 'text-cyan-700'
                            : totalAkumulasiPoin < 0
                            ? 'text-rose-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {totalAkumulasiPoin > 0 ? `+${totalAkumulasiPoin}` : totalAkumulasiPoin}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        Total Poin
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Kartu Kontrol Filter Waktu & Kategori */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 space-y-3">
                  {/* Filter Waktu: Minggu Ini, Bulan Ini, Tahun Ini (Bulan Ini default) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Periode Waktu
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        {pointTimeFilter === 'week' ? '7 hari terakhir' : pointTimeFilter === 'month' ? 'Bulan berjalan' : 'Tahun berjalan'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80">
                      {[
                        { key: 'week', label: 'Minggu Ini' },
                        { key: 'month', label: 'Bulan Ini' },
                        { key: 'year', label: 'Tahun Ini' },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setPointTimeFilter(t.key as typeof pointTimeFilter)}
                          className={`py-2 px-1 text-center text-xs font-bold rounded-xl transition ${
                            pointTimeFilter === t.key
                              ? 'bg-white text-cyan-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter Kategori: Prestasi (+) dan Pelanggaran (-) dengan toggle switch */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Kategori Poin
                      </div>
                      {pointCategoryFilter ? (
                        <button
                          type="button"
                          onClick={() => setPointCategoryFilter(null)}
                          className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                        >
                          Tampilkan Semua (Reset)
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Menampilkan Semua
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80">
                      {[
                        { key: 'Prestasi', label: 'Prestasi (+)', icon: Award, activeClass: 'bg-emerald-600 text-white shadow-xs', normalIconColor: 'text-emerald-600' },
                        { key: 'Pelanggaran', label: 'Pelanggaran (-)', icon: ShieldAlert, activeClass: 'bg-rose-600 text-white shadow-xs', normalIconColor: 'text-rose-600' },
                      ].map((c) => {
                        const isActive = pointCategoryFilter === c.key;
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() =>
                              setPointCategoryFilter((prev) => (prev === c.key ? null : (c.key as 'Prestasi' | 'Pelanggaran')))
                            }
                            className={`py-2 px-2 text-center text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                              isActive
                                ? c.activeClass
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : c.normalIconColor}`} />
                            <span>{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Daftar Kartu Catatan Detail Poin */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 text-xs font-bold text-gray-700">
                    <span>Riwayat Catatan Prestasi &amp; Pelanggaran</span>
                    <span className="text-[11px] font-mono text-gray-500">
                      {filteredStudentPoints.length} catatan ditemukan
                    </span>
                  </div>

                  {filteredStudentPoints.length === 0 ? (
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 text-center border border-dashed border-gray-200 shadow-sm space-y-2">
                      <Award className="w-10 h-10 text-gray-300 mx-auto" />
                      <h4 className="text-sm font-bold text-gray-700">Tidak Ada Catatan</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Belum ada catatan prestasi maupun pelanggaran pada periode atau filter yang dipilih.
                      </p>
                    </div>
                  ) : (
                    filteredStudentPoints.map((pt) => {
                      const isPrestasi = pt.jenis === 'Prestasi' || pt.poin > 0;
                      const ptDate = new Date(pt.created_at);
                      const dayOfMonth = ptDate.getDate();
                      const weekOfMonth = Math.ceil(dayOfMonth / 7);
                      const monthName = ptDate.toLocaleString('id-ID', { month: 'long' });
                      const year = ptDate.getFullYear();
                      const dateFormatted = ptDate.toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                      const timeFormatted = ptDate.toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }) + ' WIB';

                      return (
                        <div
                          key={pt.id}
                          className={`bg-white/95 backdrop-blur-xl rounded-3xl p-5 shadow-sm border transition space-y-3 ${
                            isPrestasi
                              ? 'border-emerald-200/90 hover:border-emerald-300'
                              : 'border-rose-200/90 hover:border-rose-300'
                          }`}
                        >
                          {/* Header: Jenis, Periode Minggu/Bulan/Tahun, dan Bobot Poin */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                                  isPrestasi
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {isPrestasi ? (
                                  <Award className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                                )}
                                <span>{isPrestasi ? 'Prestasi' : 'Pelanggaran'}</span>
                              </span>

                              {/* Informasi Detail: Minggu keberapa, Bulan, Tahun */}
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Minggu ke-{weekOfMonth} · {monthName} {year}
                              </span>
                            </div>

                            {/* Bobot Poin */}
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                                isPrestasi
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPrestasi ? `+${pt.poin} Poin` : `${pt.poin} Poin`}
                            </div>
                          </div>

                          {/* Deskripsi Catatan */}
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 leading-snug">
                              {pt.keterangan}
                            </h4>
                            <p className="text-[11px] text-gray-400 mt-1 font-mono">
                              {dateFormatted} · {timeFormatted}
                            </p>
                          </div>

                          {/* Footer: Guru / Petugas Pencatat */}
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                            <span className="text-[11px]">Dicatat oleh:</span>
                            <span className="font-semibold text-gray-800 text-[11px]">
                              {pt.pencatat || 'Guru BK / Wali Kelas'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 5: PENGAJUAN (<FileText /> - Formulir & Status Izin/Sakit Terpadu)
               ========================================================= */}
            {activeTab === 'pengajuan' && (
              <div key="tab-pengajuan" className="space-y-4 animate-in fade-in duration-200">
                {/* 1. Header Pengantar Halaman */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">
                        Pengajuan Izin &amp; Sakit
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Kirimkan surat atau permohonan ketidakhadiran ananda untuk diverifikasi dan disahkan oleh pihak sekolah.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notifikasi Sukses Pengiriman */}
                {leaveSubmitSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start justify-between gap-3 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-emerald-900">
                          Pengajuan Berhasil Dikirim!
                        </span>
                        <span className="text-emerald-700 leading-relaxed">
                          Permohonan izin atau surat sakit ananda telah masuk ke antrean verifikasi guru/sekolah dengan status <strong>Menunggu Konfirmasi</strong>.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeaveSubmitSuccess(false)}
                      className="text-emerald-600 hover:text-emerald-900 font-bold text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* 2. Formulir Pengajuan (Dedicated View Penuh) */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
                  {/* Judul Formulir 1 Baris Penuh & Info Siswa di Bawahnya */}
                  <div className="pb-3 border-b border-gray-100 space-y-2">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span>Formulir Pengajuan Baru</span>
                    </h3>
                    <div className="flex items-center gap-2.5">
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={student.nama}
                          className="w-7 h-7 rounded-full object-cover border border-[var(--primary-accent-border)] shadow-2xs shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold text-[10px] flex items-center justify-center shrink-0">
                          {studentInitials}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 font-medium">
                        Siswa: <strong className="text-slate-800">{student.nama}</strong> ({student.kelas || 'Umum'})
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleLeaveSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-2">
                        Kategori Pengajuan
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setLeaveReason('sakit')}
                          className={`p-3.5 rounded-2xl border text-sm font-bold transition flex items-center justify-center gap-2 ${
                            leaveReason === 'sakit'
                              ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs'
                              : 'bg-gray-50/70 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Stethoscope className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>Sakit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLeaveReason('izin')}
                          className={`p-3.5 rounded-2xl border text-sm font-bold transition flex items-center justify-center gap-2 ${
                            leaveReason === 'izin'
                              ? 'bg-purple-50 border-purple-400 text-purple-700 shadow-xs'
                              : 'bg-gray-50/70 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0 text-purple-600" />
                          <span>Izin</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1.5">
                        Tanggal Tidak Hadir
                      </label>
                      <input
                        type="date"
                        value={leaveDate}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1.5">
                        Keterangan / Alasan Lengkap
                      </label>
                      <textarea
                        rows={3}
                        value={leaveNote}
                        onChange={(e) => setLeaveNote(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition leading-relaxed"
                        placeholder="Jelaskan alasan izin atau sakit secara rinci..."
                        required
                      ></textarea>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1.5">
                        Unggah Bukti Foto / Surat (Opsional)
                      </label>
                      <div className="border-2 border-dashed border-gray-200 hover:border-cyan-400 rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-gray-50/50 hover:bg-cyan-50/20 transition cursor-pointer">
                        <Upload className="w-6 h-6 text-gray-400 mb-1.5" />
                        <span className="text-xs text-gray-600 font-semibold">
                          Lampirkan Foto Surat Dokter atau Surat Izin Wali
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          Format: JPG, PNG, atau PDF (Maksimal 5MB)
                        </span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={isSubmittingLeave}
                        className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-md shadow-cyan-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isSubmittingLeave ? 'Mengirim Pengajuan...' : 'Kirim & Catat Pengajuan'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 3. Kartu Status Pengajuan Izin/Sakit (Pindahan dari Beranda, Terletak di Bawah Form) */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-3.5">
                  <div className="pb-3 border-b border-gray-100 space-y-1.5">
                    {/* Badge Jumlah diletakkan di atas judul */}
                    <div className="flex items-center">
                      <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-100 px-2.5 py-0.5 rounded-full">
                        {leaveRequests.length} Pengajuan
                      </span>
                    </div>
                    {/* Judul Utama 1 Baris */}
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span>Status Pengajuan Izin / Sakit</span>
                    </h3>
                  </div>

                  {leaveRequests.length === 0 ? (
                    <div className="py-8 px-4 text-center rounded-2xl bg-gray-50/70 border border-dashed border-gray-200 space-y-1">
                      <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-600">
                        Belum Ada Pengajuan Izin / Sakit
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Pengajuan izin atau sakit yang Anda kirimkan melalui form di atas akan dipantau status persetujuannya di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {leaveRequests.map((req) => {
                        const isPending = req.status === 'pending';
                        const isApproved = req.status === 'approved';
                        const statusText = isPending
                          ? '⏳ Menunggu Konfirmasi'
                          : isApproved
                          ? '✓ Disetujui Guru'
                          : '✕ Ditolak';
                        const statusBadgeStyle = isPending
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200';

                        const jamStr = req.created_at
                          ? new Date(req.created_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) + ' WIB'
                          : '-';

                        return (
                          <div
                            key={req.id}
                            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                    req.jenis === 'sakit'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}
                                >
                                  {req.jenis === 'sakit' ? 'Sakit' : 'Izin'}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500">
                                  Tanggal: {req.tanggal}
                                </span>
                                <span className="text-[11px] text-slate-400">•</span>
                                <span className="text-[11px] font-mono text-slate-500">
                                  Diajukan: {jamStr}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-800 leading-snug">
                                {req.alasan}
                              </p>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 self-start sm:self-center ${statusBadgeStyle}`}
                            >
                              {statusText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =========================================================
            {/* =========================================================
                TAB 5: AKADEMIK (<BookOpen /> - Jadwal Mapel & Kaldik)
               ========================================================= */}
            {activeTab === 'akademik' && (
              <div key="tab-akademik" className="space-y-4 animate-in fade-in duration-200">
                {/* Navigasi Sub-Tab Segmented Control (Grid 2 Kolom Ramping) */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setAkademikSubTab('jadwal')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      akademikSubTab === 'jadwal'
                        ? 'bg-white text-cyan-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span>Mapel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAkademikSubTab('kaldik')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      akademikSubTab === 'kaldik'
                        ? 'bg-white text-cyan-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>Kaldik</span>
                  </button>
                </div>

                {/* Sub-tab 1: Jadwal Pelajaran Interaktif Berbasis Waktu Real-Time */}
                {akademikSubTab === 'jadwal' && (
                  <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <span>Jadwal Pelajaran ({student.kelas || 'Umum'})</span>
                            {selectedDay === getTodayIndonesianDayName() && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                Hari Ini
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            Waktu saat ini: <strong className="font-mono text-cyan-800">{currentNow.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</strong>
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-100 px-3 py-1 rounded-full font-bold self-start sm:self-auto">
                        {dayScheduleItems.length} Sesi Pelajaran
                      </span>
                    </div>

                    {/* Tab Hari Senin s/d Minggu */}
                    <div className="grid grid-cols-7 gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200">
                      {HARI_LIST.map((hari) => {
                        const active = selectedDay === hari;
                        const isToday = getTodayIndonesianDayName() === hari;
                        const isWeekend = hari === 'Sabtu' || hari === 'Minggu';

                        return (
                          <button
                            key={hari}
                            type="button"
                            onClick={() => setSelectedDay(hari)}
                            className={`relative py-2 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition text-center truncate ${
                              active
                                ? 'bg-cyan-500 text-white shadow-xs'
                                : isToday
                                ? 'bg-white text-cyan-700 font-extrabold shadow-2xs'
                                : isWeekend
                                ? 'text-rose-500 hover:text-rose-700'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <span>{hari.slice(0, 3)}</span>
                            {isToday && !active && (
                              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-600"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Status Khusus Akhir Pekan (Sabtu & Minggu: Libur Sekolah) */}
                    {(selectedDay === 'Sabtu' || selectedDay === 'Minggu') && dayScheduleItems.length === 0 ? (
                      <div className="p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 text-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl shadow-xs">
                          🏖️
                        </div>
                        <h4 className="text-sm font-bold text-amber-950">
                          Hari {selectedDay} — Libur Sekolah
                        </h4>
                        <p className="text-xs text-amber-800 max-w-sm mx-auto leading-relaxed">
                          Tidak ada kegiatan belajar mengajar (KBM) reguler pada akhir pekan. Selamat beristirahat dan berkumpul bersama keluarga!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dayScheduleItems.length === 0 ? (
                          <div className="p-8 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-500">
                            Belum ada jadwal pelajaran hari <strong>{selectedDay}</strong> untuk kelas{' '}
                            <strong>{student.kelas || 'Umum'}</strong>.
                          </div>
                        ) : (
                          dayScheduleItems.map((item) => {
                            const isToday = selectedDay.toLowerCase() === getTodayIndonesianDayName().toLowerCase();

                            // Kalkulasi Status Berbasis Waktu Real-Time
                            let status: 'ongoing' | 'finished' | 'upcoming' | 'general' = 'general';
                            let remainingMinutes = 0;

                            if (isToday) {
                              const [mulaiH, mulaiM] = item.jam_mulai.split(':').map(Number);
                              const [selesaiH, selesaiM] = item.jam_selesai.split(':').map(Number);

                              const startMin = mulaiH * 60 + mulaiM;
                              const endMin = selesaiH * 60 + selesaiM;
                              const nowMin = currentNow.getHours() * 60 + currentNow.getMinutes();

                              if (nowMin >= startMin && nowMin < endMin) {
                                status = 'ongoing';
                                remainingMinutes = endMin - nowMin;
                              } else if (nowMin >= endMin) {
                                status = 'finished';
                              } else {
                                status = 'upcoming';
                              }
                            }

                            const isBreak =
                              item.mata_pelajaran.toLowerCase().includes('istirahat') ||
                              item.guru_pengampu.toLowerCase().includes('guru piket');

                            return (
                              <div
                                key={item.id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  status === 'ongoing'
                                    ? 'bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 border-cyan-400 ring-2 ring-cyan-400/40 shadow-md animate-pulse duration-1000'
                                    : status === 'finished'
                                    ? 'bg-slate-50/70 border-slate-200/60 opacity-60 hover:opacity-90'
                                    : status === 'upcoming'
                                    ? 'bg-white border-slate-200 hover:border-cyan-300 shadow-2xs'
                                    : 'bg-white border-gray-100 shadow-xs'
                                }`}
                              >
                                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                  {/* Jam Pelajaran Badge */}
                                  <div
                                    className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold text-center shrink-0 border ${
                                      status === 'ongoing'
                                        ? 'bg-cyan-500 text-white border-cyan-600 shadow-xs'
                                        : status === 'finished'
                                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                                        : 'bg-cyan-50 text-cyan-800 border-cyan-100'
                                    }`}
                                  >
                                    <div>{item.jam_mulai}</div>
                                    <div className="text-[10px] opacity-75 leading-none mt-0.5">s.d.</div>
                                    <div>{item.jam_selesai}</div>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      {/* Indikator Status Interaktif Real-Time */}
                                      {status === 'ongoing' && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-xs">
                                          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                                          🔴 Sedang Berlangsung ({remainingMinutes} mnt tersisa)
                                        </span>
                                      )}
                                      {status === 'finished' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                                          ✅ Selesai
                                        </span>
                                      )}
                                      {status === 'upcoming' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                                          ⏳ Akan Datang
                                        </span>
                                      )}
                                      {isBreak && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                          <Coffee className="w-3 h-3" />
                                          Jeda Istirahat
                                        </span>
                                      )}
                                    </div>

                                    <h4
                                      title={item.mata_pelajaran}
                                      className={`text-sm sm:text-base font-bold truncate ${
                                        status === 'ongoing'
                                          ? 'text-cyan-950'
                                          : status === 'finished'
                                          ? 'text-slate-600 line-through decoration-slate-400'
                                          : 'text-gray-900'
                                      }`}
                                    >
                                      {item.mata_pelajaran}
                                    </h4>

                                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 truncate">
                                      <User className={`w-3.5 h-3.5 shrink-0 ${status === 'ongoing' ? 'text-cyan-600' : 'text-gray-400'}`} />
                                      <span title={item.guru_pengampu} className={`truncate ${status === 'ongoing' ? 'font-semibold text-cyan-900' : ''}`}>
                                        {item.guru_pengampu}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 3: Kalender Pendidikan */}
                {akademikSubTab === 'kaldik' && (
                  <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-cyan-600" />
                        <span>Kalender Pendidikan</span>
                      </h3>
                      <span className="text-[11px] font-mono text-gray-500">
                        {kalenderList.length} Agenda
                      </span>
                    </div>

                    {kalenderList.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-500">
                        Belum ada agenda libur atau kegiatan akademik terjadwal.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {kalenderList.map((kal) => {
                          const badgeStyle =
                            kal.jenis === 'Libur Nasional'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : kal.jenis === 'Libur Semester'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-cyan-50 text-cyan-700 border-cyan-200';
                          return (
                            <div
                              key={kal.id}
                              className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="font-bold text-gray-900">{kal.keterangan}</div>
                                <div className="font-mono text-[11px] text-gray-500">
                                  {kal.tanggal_mulai}
                                  {kal.tanggal_selesai && kal.tanggal_selesai !== kal.tanggal_mulai
                                    ? ` s.d. ${kal.tanggal_selesai}`
                                    : ''}
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badgeStyle}`}
                              >
                                {kal.jenis}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
              </div>
            )}
          </>
        )}
      </main>

      {/* =========================================================
          BOTTOM NAVIGATION BAR (6 MENU KOMPAK SEJAJAR - SOLID THEME COLOR)
         ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--primary-accent)] px-1 sm:px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div className="max-w-md sm:max-w-lg mx-auto grid grid-cols-6 items-center gap-0.5">
          {/* 1. Beranda */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('beranda');
              setIsAnnouncementOpen(false);
            }}
            className={`group flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === 'beranda' && !isAnnouncementOpen
                ? 'text-white font-bold'
                : 'text-white/60 hover:text-white/90 font-medium'
            }`}
          >
            <div className="flex items-center justify-center">
              <Home
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-out ${
                  activeTab === 'beranda' && !isAnnouncementOpen
                    ? 'ios-icon-active text-white'
                    : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                }`}
              />
            </div>
            <span className="text-[10px] leading-tight truncate transition-all duration-300">Beranda</span>
          </button>

          {/* 2. Riwayat */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('riwayat');
              setIsAnnouncementOpen(false);
            }}
            className={`group flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === 'riwayat' && !isAnnouncementOpen
                ? 'text-white font-bold'
                : 'text-white/60 hover:text-white/90 font-medium'
            }`}
          >
            <div className="flex items-center justify-center">
              <Clock
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-out ${
                  activeTab === 'riwayat' && !isAnnouncementOpen
                    ? 'ios-icon-active text-white'
                    : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                }`}
              />
            </div>
            <span className="text-[10px] leading-tight truncate transition-all duration-300">Riwayat</span>
          </button>

          {/* 3. Pengajuan */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pengajuan');
              setIsAnnouncementOpen(false);
            }}
            className={`group relative flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === 'pengajuan' && !isAnnouncementOpen
                ? 'text-white font-bold'
                : 'text-white/60 hover:text-white/90 font-medium'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <FileText
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-out ${
                  activeTab === 'pengajuan' && !isAnnouncementOpen
                    ? 'ios-icon-active text-white'
                    : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                }`}
              />
              {leaveRequests.some((r) => r.status === 'pending') && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white"></span>
              )}
            </div>
            <span className="text-[10px] leading-tight truncate transition-all duration-300">Pengajuan</span>
          </button>

          {/* 4. Akademik */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('akademik');
              setIsAnnouncementOpen(false);
            }}
            className={`group flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === 'akademik' && !isAnnouncementOpen
                ? 'text-white font-bold'
                : 'text-white/60 hover:text-white/90 font-medium'
            }`}
          >
            <div className="flex items-center justify-center">
              <BookOpen
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-out ${
                  activeTab === 'akademik' && !isAnnouncementOpen
                    ? 'ios-icon-active text-white'
                    : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                }`}
              />
            </div>
            <span className="text-[10px] leading-tight truncate transition-all duration-300">Akademik</span>
          </button>

          {/* 5. Poin */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('poin');
              setIsAnnouncementOpen(false);
            }}
            className={`group flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === 'poin' && !isAnnouncementOpen
                ? 'text-white font-bold'
                : 'text-white/60 hover:text-white/90 font-medium'
            }`}
          >
            <div className="flex items-center justify-center">
              <Award
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-out ${
                  activeTab === 'poin' && !isAnnouncementOpen
                    ? 'ios-icon-active text-white'
                    : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                }`}
              />
            </div>
            <span className="text-[10px] leading-tight truncate transition-all duration-300">Poin</span>
          </button>

          {/* 6. Kartu QR */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('qr');
              setIsAnnouncementOpen(false);
            }}
            title="Tampilkan Kartu QR Presensi"
            className={`group flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === 'qr' && !isAnnouncementOpen
                ? 'text-white font-bold'
                : 'text-white/60 hover:text-white/90 font-medium'
            }`}
          >
            <div className="flex items-center justify-center">
              <QrCode
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-out ${
                  activeTab === 'qr' && !isAnnouncementOpen
                    ? 'ios-icon-active text-white'
                    : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                }`}
              />
            </div>
            <span className="text-[10px] leading-tight truncate transition-all duration-300">Kartu QR</span>
          </button>
        </div>
      </nav>

      {/* =========================================================
          POP-UP MODAL / BOTTOM SHEET PROFIL SISWA & AKSI AKUN
         ========================================================= */}
      {isProfileSheetOpen && student && (
        <div
          onClick={() => setIsProfileSheetOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border-t sm:border border-gray-100 space-y-5 animate-in slide-in-from-bottom-4 duration-200"
          >
            {/* Handle Bar untuk Mobile Bottom Sheet */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto sm:hidden -mt-1 mb-1"></div>

            {/* Header Profil Siswa */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                {student.avatar_url ? (
                  <img
                    src={student.avatar_url}
                    alt={student.nama}
                    className="w-14 h-14 rounded-full object-cover border border-[var(--primary-accent-border)] shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold text-lg flex items-center justify-center shadow-md shrink-0">
                    {studentInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Siswa Aktif</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                    {student.nama}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProfileSheetOpen(false)}
                className="p-1.5 rounded-full bg-gray-100 text-gray-400 hover:text-gray-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Informasi Kartu Siswa (NIS, UID, Kelas) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white border border-gray-100">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Kelas
                </div>
                <div className="text-xs sm:text-sm font-bold text-cyan-700 mt-0.5">
                  {student.kelas || 'Umum'}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white border border-gray-100">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  NIS / NISN
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-gray-800 mt-0.5 truncate">
                  {student.nisn || '-'}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white border border-gray-100">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  UID Kartu
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-gray-800 mt-0.5 truncate">
                  {student.uid_kartu || student.rfid_uid || '-'}
                </div>
              </div>
            </div>

            {/* Tombol Aksi Akun */}
            <div className="space-y-2.5 pt-1">
              {!isInstalled && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileSheetOpen(false);
                    triggerInstall();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98"
                >
                  <span className="text-base leading-none">📲</span>
                  <span>Install Aplikasi ke Layar Utama</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsProfileSheetOpen(false);
                  onLogout();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  {isAdminPreview ? 'Kembali ke Dashboard Admin' : '🚪 Keluar / Ganti Akun'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANDUAN SINGKAT INSTALL PWA */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    📲 Pasang Portal Siswa di Layar Utama HP
                  </h3>
                  <p className="text-xs text-gray-500">
                    {brandConfig.appTitle || DEFAULT_APP_TITLE}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-cyan-50/70 border border-cyan-100 rounded-xl p-3.5 text-xs text-slate-700 space-y-2">
              {isIOS ? (
                <>
                  <p className="font-bold text-cyan-900">Cara Pasang di iPhone / iPad (Safari):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.</li>
                    <li>Pilih menu <strong>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</strong>.</li>
                    <li>Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-bold text-cyan-900">Cara Pasang di Android (Chrome / Browser):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Ketuk ikon menu browser <strong>⋮</strong> di pojok kanan atas.</li>
                    <li>Pilih <strong>&quot;Install Aplikasi&quot;</strong> atau <strong>&quot;Tambahkan ke Layar Utama&quot;</strong>.</li>
                  </ol>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};