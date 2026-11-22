import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Award,
  ShieldAlert,
  Plus,
  Search,
  Trash2,
  Pencil,
  Download,
  Printer,
  Calendar,
  FileText,
  Building2,
  Camera,
  RefreshCw,
  X,
  UserCheck,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Sliders,
  Zap,
  ShieldCheck,
  Lock,
  Save,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import jsQR from 'jsqr';
import {
  Student,
  Rombel,
  AppUser,
  StudentPoint,
  PointActionType,
} from '../types';
import { supabaseService } from '../services/supabaseClient';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
  PointRulesSettings,
  defaultPointRules,
  defaultDocumentSignatories,
} from '../services/settingsService';
import { sound } from '../utils/audio';

export type PointSubView = 'history' | 'balance' | 'analytics' | 'rules';

interface DisciplineManagerProps {
  currentUser?: AppUser | null;
}

const PRESET_DESCRIPTIONS: Record<PointActionType, { label: string; poin: number }[]> = {
  Pelanggaran: [
    { label: 'Terlambat upacara karena ban motor bocor', poin: -5 },
    { label: 'Atribut seragam sekolah tidak lengkap saat apel pagi', poin: -10 },
    { label: 'Meninggalkan kelas tanpa izin guru piket', poin: -15 },
    { label: 'Tidak mengumpulkan tugas mata pelajaran tepat waktu', poin: -5 },
  ],
  Prestasi: [
    { label: 'Menemukan dompet tertinggal dan mengembalikannya', poin: 25 },
    { label: 'Juara lomba akademik / olimpiade tingkat sekolah', poin: 50 },
    { label: 'Aktif membantu kegiatan kebersihan & ketertiban sekolah', poin: 15 },
    { label: 'Kehadiran 100% tepat waktu selama satu bulan penuh', poin: 30 },
  ],
};

export const DisciplineManager: React.FC<DisciplineManagerProps> = ({ currentUser }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [rombelList, setRombelList] = useState<Rombel[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [pointsList, setPointsList] = useState<StudentPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search States
  const [selectedRombelFilter, setSelectedRombelFilter] = useState<string>('ALL');
  const [selectedJenisFilter, setSelectedJenisFilter] = useState<'ALL' | PointActionType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubView, setActiveSubView] = useState<PointSubView>('history');
  const [analyticsMonthsRange, setAnalyticsMonthsRange] = useState<6 | 12>(6);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [balancePage, setBalancePage] = useState<number>(1);
  const itemsPerPage = 10;

  // Accordion Expandable state for Mobile Points History Cards
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);

  // State Pengaturan Aturan & Otomatisasi Poin
  const [pointRulesState, setPointRulesState] = useState<PointRulesSettings>(() => {
    const s = settingsService.getSettings();
    return s.pointRules || defaultPointRules;
  });
  const [isSavingRules, setIsSavingRules] = useState<boolean>(false);

  const isSuperAdmin = useMemo(() => {
    if (!currentUser) return true;
    return currentUser.role === 'Super Admin' || Boolean(currentUser.is_master);
  }, [currentUser]);

  const isWaliKelas = currentUser?.role === 'Wali Kelas';
  const waliAssignedClass = useMemo(() => {
    if (!isWaliKelas) return '';
    return String(currentUser?.assignedClass || currentUser?.assigned_class || '1A')
      .trim()
      .replace(/^kelas\s+/i, '');
  }, [isWaliKelas, currentUser]);

  // Toast feedback & RLS warning helper
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rlsWarning, setRlsWarning] = useState<boolean>(false);
  const [copiedRlsSql, setCopiedRlsSql] = useState<boolean>(false);

  // Modal Input Manual States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [formJenis, setFormJenis] = useState<PointActionType>('Pelanggaran');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formPoin, setFormPoin] = useState<string>('-10');
  const [formPencatat, setFormPencatat] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Edit Catatan Poin States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPointItem, setEditingPointItem] = useState<StudentPoint | null>(null);
  const [editJenis, setEditJenis] = useState<PointActionType>('Pelanggaran');
  const [editKeterangan, setEditKeterangan] = useState<string>('');
  const [editPoin, setEditPoin] = useState<string>('-10');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Modal Konfirmasi Hapus Catatan Poin States
  const [deletingPointItem, setDeletingPointItem] = useState<StudentPoint | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Pusat Cetak & Unduh Laporan Kedisiplinan States
  const [schoolSettings, setSchoolSettings] = useState(() => settingsService.getSettings());
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [reportScope, setReportScope] = useState<'rombel' | 'student'>('rombel');
  const [reportStudentSearch, setReportStudentSearch] = useState<string>('');
  const [reportSelectedStudentId, setReportSelectedStudentId] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  const [reportDatePreset, setReportDatePreset] = useState<
    'all' | 'today' | 'this_week' | 'this_month' | 'custom'
  >('all');
  const [reportRombelFilter, setReportRombelFilter] = useState<string>('ALL');
  const [reportJenisFilter, setReportJenisFilter] = useState<'ALL' | PointActionType>('ALL');
  const [kotaCetak, setKotaCetak] = useState<string>(
    () =>
      settingsService.getSettings().documentSignatories?.kotaCetak ??
      defaultDocumentSignatories.kotaCetak
  );
  const [kepalaSekolahName, setKepalaSekolahName] = useState<string>(
    () =>
      settingsService.getSettings().documentSignatories?.kepalaSekolahName ??
      defaultDocumentSignatories.kepalaSekolahName
  );
  const [kepalaSekolahNip, setKepalaSekolahNip] = useState<string>(
    () =>
      settingsService.getSettings().documentSignatories?.kepalaSekolahNip ??
      defaultDocumentSignatories.kepalaSekolahNip
  );
  const [petugasBkName, setPetugasBkName] = useState<string>(
    () =>
      settingsService.getSettings().documentSignatories?.petugasBkName ??
      defaultDocumentSignatories.petugasBkName
  );
  const [petugasBkNip, setPetugasBkNip] = useState<string>(
    () =>
      settingsService.getSettings().documentSignatories?.petugasBkNip ??
      defaultDocumentSignatories.petugasBkNip
  );
  const [waliKelasName, setWaliKelasName] = useState<string>('Hesti Supriyani, S.Pd.I');
  const [waliKelasNip, setWaliKelasNip] = useState<string>('NIP. 19880412 201503 2 004');
  const [waliMuridSignName, setWaliMuridSignName] = useState<string>('Orang Tua / Wali Siswa');
  const [isSavingSignatories, setIsSavingSignatories] = useState<boolean>(false);

  const canEditSignatories = useMemo(() => {
    if (isWaliKelas) return false;
    if (!currentUser) return true;
    return (
      currentUser.role === 'Super Admin' ||
      currentUser.role === 'Admin' ||
      Boolean(currentUser.is_master)
    );
  }, [isWaliKelas, currentUser]);

  useEffect(() => {
    if (isWaliKelas && waliAssignedClass) {
      const matched = rombelList.find(
        (r) => r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
      );
      const targetClass = matched ? matched.nama_kelas : waliAssignedClass;
      if (selectedRombelFilter !== targetClass) {
        setSelectedRombelFilter(targetClass);
      }
      if (reportRombelFilter !== targetClass) {
        setReportRombelFilter(targetClass);
      }
    }
  }, [isWaliKelas, waliAssignedClass, rombelList, selectedRombelFilter, reportRombelFilter]);

  // Camera QR/Barcode Scanner inside Modal Pilih Siswa
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCameraFacing, setScannerCameraFacing] = useState<'environment' | 'user'>('environment');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerAnimRef = useRef<number | null>(null);
  const hasScannedRef = useRef(false);

  const defaultPencatatName = useMemo(() => {
    if (!currentUser) return 'Admin Sekolah';
    return currentUser.nama_lengkap || currentUser.username || 'Admin Sekolah';
  }, [currentUser]);

  // Auto-populate Nama Wali Kelas & NIP Wali Kelas mengikuti kelas/rombel yang dipilih atau akun Wali Kelas
  useEffect(() => {
    const selectedStd = reportSelectedStudentId
      ? students.find(
          (s) => String(s.id).toLowerCase() === String(reportSelectedStudentId).toLowerCase()
        )
      : null;

    const rawTargetClass = isWaliKelas
      ? waliAssignedClass || '1A'
      : reportScope === 'student' && selectedStd?.kelas
      ? selectedStd.kelas
      : reportRombelFilter !== 'ALL'
      ? reportRombelFilter
      : selectedRombelFilter !== 'ALL'
      ? selectedRombelFilter
      : '1A';

    const normTarget = String(rawTargetClass || '1A')
      .trim()
      .toLowerCase()
      .replace(/^kelas\s+/i, '');

    const matchedWaliUser = appUsers.find((u) => {
      if (u.role !== 'Wali Kelas') return false;
      const uClass = String(u.assignedClass || u.assigned_class || '1A')
        .trim()
        .toLowerCase()
        .replace(/^kelas\s+/i, '');
      return uClass === normTarget;
    });

    const matchedRombel = rombelList.find(
      (r) =>
        r.nama_kelas.trim().toLowerCase().replace(/^kelas\s+/i, '') === normTarget
    );

    const isDirectWaliLogin =
      isWaliKelas &&
      currentUser &&
      !currentUser.is_master &&
      currentUser.role === 'Wali Kelas' &&
      Boolean(currentUser.nama_lengkap);

    const resolvedName = isDirectWaliLogin
      ? currentUser!.nama_lengkap!
      : matchedWaliUser?.nama_lengkap ||
        matchedRombel?.nama_wali_kelas ||
        'Hesti Supriyani, S.Pd.I';

    const rawNip =
      (isDirectWaliLogin && currentUser?.nip ? currentUser.nip : '') ||
      matchedWaliUser?.nip ||
      (normTarget === '1a' ? '19880412 201503 2 004' : '');

    const resolvedNip = rawNip
      ? rawNip.trim().toUpperCase().startsWith('NIP')
        ? rawNip.trim()
        : `NIP. ${rawNip.trim()}`
      : 'NIP. .................................';

    setWaliKelasName(resolvedName);
    setWaliKelasNip(resolvedNip);
  }, [
    isWaliKelas,
    waliAssignedClass,
    reportScope,
    reportSelectedStudentId,
    reportRombelFilter,
    selectedRombelFilter,
    students,
    rombelList,
    appUsers,
    currentUser,
  ]);

  const handleUpdateMasterSignatory = (
    field: 'kotaCetak' | 'kepalaSekolahName' | 'kepalaSekolahNip' | 'petugasBkName' | 'petugasBkNip',
    value: string
  ) => {
    if (!canEditSignatories) return;
    if (field === 'kotaCetak') setKotaCetak(value);
    if (field === 'kepalaSekolahName') setKepalaSekolahName(value);
    if (field === 'kepalaSekolahNip') setKepalaSekolahNip(value);
    if (field === 'petugasBkName') setPetugasBkName(value);
    if (field === 'petugasBkNip') setPetugasBkNip(value);

    const currentDoc = settingsService.getSettings().documentSignatories || defaultDocumentSignatories;
    settingsService.saveSettings({
      documentSignatories: {
        ...currentDoc,
        [field]: value,
      },
    });
  };

  const handleSaveMasterSignatoriesToCloud = async () => {
    if (!canEditSignatories) return;
    setIsSavingSignatories(true);
    try {
      await settingsService.saveDocumentSignatories({
        kotaCetak,
        kepalaSekolahName,
        kepalaSekolahNip,
        petugasBkName,
        petugasBkNip,
      });
      sound.playSuccess();
      showToast('Data master Identitas Penandatangan berhasil disimpan untuk seluruh akun!');
    } catch {
      sound.playAlert();
      showToast('Tersimpan di perangkat lokal.');
    } finally {
      setIsSavingSignatories(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [stdData, rmbData, ptsData, usrData] = await Promise.all([
        supabaseService.getStudents(),
        supabaseService.getRombel(),
        supabaseService.getStudentPoints(),
        supabaseService.getAppUsers(),
      ]);
      setStudents(stdData);
      setRombelList(rmbData);
      setPointsList(ptsData);
      setAppUsers(usrData);
      setRlsWarning(supabaseService.hasStudentPointsRlsWarning());
    } catch (err) {
      console.warn('Gagal memuat data poin kedisiplinan:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
    settingsService.loadFromSupabase().then((loaded) => {
      setSchoolSettings(loaded);
      if (loaded.pointRules) {
        setPointRulesState(loaded.pointRules);
      }
      if (loaded.documentSignatories) {
        setKotaCetak(loaded.documentSignatories.kotaCetak);
        setKepalaSekolahName(loaded.documentSignatories.kepalaSekolahName);
        setKepalaSekolahNip(loaded.documentSignatories.kepalaSekolahNip);
        setPetugasBkName(loaded.documentSignatories.petugasBkName);
        setPetugasBkNip(loaded.documentSignatories.petugasBkNip);
      }
    });
    const unsub = supabaseService.subscribe(() => loadData(true));
    const unsubSettings = settingsService.subscribe(() => {
      const current = settingsService.getSettings();
      setSchoolSettings(current);
      if (current.pointRules) {
        setPointRulesState(current.pointRules);
      }
      if (current.documentSignatories) {
        setKotaCetak(current.documentSignatories.kotaCetak);
        setKepalaSekolahName(current.documentSignatories.kepalaSekolahName);
        setKepalaSekolahNip(current.documentSignatories.kepalaSekolahNip);
        setPetugasBkName(current.documentSignatories.petugasBkName);
        setPetugasBkNip(current.documentSignatories.petugasBkNip);
      }
    });
    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  const handleSavePointRules = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSuperAdmin) {
      sound.playAlert();
      showToast('🔒 Akses Ditolak: Hanya Super Admin / Master Owner yang diizinkan mengubah aturan poin.');
      return;
    }
    setIsSavingRules(true);
    try {
      const currentSettings = settingsService.getSettings();
      settingsService.saveSettings({
        pointRules: pointRulesState,
      });

      const res = await settingsService.saveToSupabase({
        appTitle: currentSettings.appTitle,
        appSubtitle: currentSettings.appSubtitle,
        appLogo: currentSettings.appLogo,
        primaryAccent: currentSettings.primaryAccent,
        academicYear: currentSettings.academicYear,
        semester: currentSettings.semester,
        waApiToken: '',
        isAutomaticMode: currentSettings.isAutomaticMode,
        timeRanges: currentSettings.timeRanges,
        pointRules: pointRulesState,
      });

      if (res.error) {
        console.warn('Sync pointRules error:', res.error);
      }

      sound.playSuccess();
      showToast('Aturan poin & otomatisasi kedisiplinan berhasil disimpan!');
    } catch (err: any) {
      sound.playAlert();
      showToast('Gagal menyimpan aturan poin: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingRules(false);
    }
  };

  // Peta Akumulasi Poin per Siswa (student_id -> { plus, minus, total, count })
  const studentBalanceMap = useMemo(() => {
    const map = new Map<
      string,
      { plus: number; minus: number; total: number; count: number; lastUpdated?: string }
    >();

    pointsList.forEach((pt) => {
      const key = String(pt.student_id || '').toLowerCase();
      if (!key) return;
      const prev = map.get(key) || { plus: 0, minus: 0, total: 0, count: 0 };
      const val = Number(pt.poin) || 0;
      if (pt.jenis === 'Prestasi' || val > 0) {
        prev.plus += Math.abs(val);
        prev.total += Math.abs(val);
      } else {
        prev.minus -= Math.abs(val);
        prev.total -= Math.abs(val);
      }
      prev.count += 1;
      if (!prev.lastUpdated || pt.created_at > prev.lastUpdated) {
        prev.lastUpdated = pt.created_at;
      }
      map.set(key, prev);
    });

    return map;
  }, [pointsList]);

  // Statistik Global
  const globalStats = useMemo(() => {
    let totalPlus = 0;
    let totalMinus = 0;
    let countPrestasi = 0;
    let countPelanggaran = 0;

    pointsList.forEach((pt) => {
      const val = Number(pt.poin) || 0;
      if (pt.jenis === 'Prestasi' || val > 0) {
        totalPlus += Math.abs(val);
        countPrestasi += 1;
      } else {
        totalMinus -= Math.abs(val);
        countPelanggaran += 1;
      }
    });

    return {
      totalRecords: pointsList.length,
      totalPlus,
      totalMinus,
      countPrestasi,
      countPelanggaran,
      uniqueStudentsCount: studentBalanceMap.size,
    };
  }, [pointsList, studentBalanceMap]);

  // Buka Modal Catat Baru (opsional langsung pilih siswa tertentu)
  const handleOpenAddModal = (preselectedStudent?: Student, defaultJenis: PointActionType = 'Pelanggaran') => {
    setFormJenis(defaultJenis);
    setFormKeterangan('');
    setFormPoin(defaultJenis === 'Pelanggaran' ? '-10' : '25');
    setFormPencatat(defaultPencatatName);
    if (preselectedStudent) {
      setSelectedStudentId(preselectedStudent.id);
      setStudentSearchInput(
        `${preselectedStudent.nama} (${preselectedStudent.nisn || preselectedStudent.uid_kartu || '-'})`
      );
    } else {
      setSelectedStudentId('');
      setStudentSearchInput('');
    }
    setIsAddModalOpen(true);
  };

  // Ubah Jenis Tindakan (Pelanggaran <-> Prestasi) dan sesuaikan tanda +/- pada input poin
  const handleSwitchJenis = (nextJenis: PointActionType) => {
    setFormJenis(nextJenis);
    const numeric = Math.abs(parseInt(formPoin, 10) || (nextJenis === 'Pelanggaran' ? 10 : 25));
    setFormPoin(nextJenis === 'Pelanggaran' ? String(-numeric) : String(numeric));
  };

  // Cari / Pilih Siswa berdasarkan input pencarian atau hasil scan RFID/QR (Hanya tampil saat mengetik)
  const filteredStudentsForModal = useMemo(() => {
    const q = studentSearchInput.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => {
        if (isWaliKelas && waliAssignedClass) {
          const sKelas = String(s.kelas || '').trim().toLowerCase().replace(/^kelas\s+/i, '');
          if (sKelas !== waliAssignedClass.toLowerCase()) return false;
        }
        return (
          s.nama.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.toLowerCase().includes(q)) ||
          (s.nis && s.nis.toLowerCase().includes(q)) ||
          (s.uid_kartu && s.uid_kartu.toLowerCase().includes(q)) ||
          (s.rfid_uid && s.rfid_uid.toLowerCase().includes(q)) ||
          (s.kelas && s.kelas.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [students, studentSearchInput, isWaliKelas, waliAssignedClass]);

  const selectedStudentObj = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  // Jika user tap kartu USB RFID pada kolom pencarian siswa (mengirimkan Enter di akhir)
  const handleStudentSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = studentSearchInput.trim().toLowerCase();
      if (!q) return;
      const exactMatch = students.find(
        (s) =>
          (s.uid_kartu && s.uid_kartu.toLowerCase() === q) ||
          (s.rfid_uid && s.rfid_uid.toLowerCase() === q) ||
          (s.nisn && s.nisn.toLowerCase() === q) ||
          s.nama.toLowerCase() === q
      );
      const bestMatch = exactMatch || filteredStudentsForModal[0];
      if (bestMatch) {
        setSelectedStudentId(bestMatch.id);
        setStudentSearchInput(`${bestMatch.nama} (${bestMatch.nisn || bestMatch.uid_kartu})`);
        sound.playSuccess();
        showToast(`Siswa terpilih: ${bestMatch.nama} (${bestMatch.kelas || 'Umum'})`);
      } else {
        sound.playAlert();
        showToast(`Siswa dengan kode/nama "${studentSearchInput}" tidak ditemukan.`);
      }
    }
  };

  // Kamera Pemindai QR / Barcode untuk memilih siswa di Modal Catat Poin
  useEffect(() => {
    const stopStream = () => {
      if (scannerAnimRef.current) {
        cancelAnimationFrame(scannerAnimRef.current);
        scannerAnimRef.current = null;
      }
      if (scannerVideoRef.current && scannerVideoRef.current.srcObject) {
        const stream = scannerVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        scannerVideoRef.current.srcObject = null;
      }
    };

    if (!isScannerOpen) {
      stopStream();
      return;
    }

    let isCancelled = false;
    hasScannedRef.current = false;
    setScannerError(null);
    setIsScannerStarting(true);

    let barcodeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        barcodeDetector = new BarcodeDetectorClass({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'itf', 'codabar'],
        });
      } catch {
        barcodeDetector = null;
      }
    }

    const handleCodeDetected = (rawCode: string) => {
      if (hasScannedRef.current || isCancelled) return;
      const cleanCode = rawCode.trim();
      if (!cleanCode) return;

      hasScannedRef.current = true;
      const q = cleanCode.toLowerCase();
      const matched = students.find(
        (s) =>
          (s.uid_kartu && s.uid_kartu.toLowerCase() === q) ||
          (s.rfid_uid && s.rfid_uid.toLowerCase() === q) ||
          (s.nisn && s.nisn.toLowerCase() === q) ||
          s.id.toLowerCase() === q
      );

      if (matched) {
        setSelectedStudentId(matched.id);
        setStudentSearchInput(`${matched.nama} (${matched.nisn || matched.uid_kartu})`);
        sound.playSuccess();
        showToast(`Kartu siswa "${matched.nama}" berhasil dipindai!`);
      } else {
        setStudentSearchInput(cleanCode.toUpperCase());
        sound.playAlert();
        showToast(`Kode "${cleanCode}" dipindai, silakan pilih siswa yang sesuai.`);
      }

      stopStream();
      setIsScannerOpen(false);
    };

    const scanFrame = async () => {
      if (isCancelled || hasScannedRef.current) return;
      const video = scannerVideoRef.current;
      const canvas = scannerCanvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleCodeDetected(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (qrResult && qrResult.data) {
            handleCodeDetected(qrResult.data);
            return;
          }
        }
      }

      if (!isCancelled && !hasScannedRef.current) {
        scannerAnimRef.current = requestAnimationFrame(scanFrame);
      }
    };

    const startCamera = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: scannerCameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (scannerVideoRef.current) {
          scannerVideoRef.current.srcObject = stream;
          scannerVideoRef.current.setAttribute('playsinline', 'true');
          await scannerVideoRef.current.play();
          setIsScannerStarting(false);
          scannerAnimRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setIsScannerStarting(false);
          setScannerError(
            'Gagal mengakses kamera: ' +
              (err?.message || 'Pastikan izin kamera diberikan pada browser.')
          );
        }
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      stopStream();
    };
  }, [isScannerOpen, scannerCameraFacing, students]);

  // Simpan Catatan Pelanggaran / Prestasi Baru
  const handleSubmitPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert('Silakan pilih siswa terlebih dahulu (ketik Nama / NISN atau Scan Kartu RFID/QR)!');
      return;
    }
    if (!formKeterangan.trim()) {
      alert('Keterangan / deskripsi tindakan wajib diisi!');
      return;
    }
    const rawNum = parseInt(formPoin, 10);
    if (isNaN(rawNum) || rawNum === 0) {
      alert('Jumlah bobot poin harus berupa angka bulat selain 0 (misal -10 atau 25)!');
      return;
    }

    const finalPoin = formJenis === 'Pelanggaran' ? -Math.abs(rawNum) : Math.abs(rawNum);
    setIsSubmitting(true);
    try {
      const res = await supabaseService.addStudentPoint({
        student_id: selectedStudentId,
        jenis: formJenis,
        keterangan: formKeterangan.trim(),
        poin: finalPoin,
        pencatat: formPencatat.trim() || defaultPencatatName,
      });

      setRlsWarning(res.rlsWarning || supabaseService.hasStudentPointsRlsWarning());
      sound.playSuccess();
      const targetName = selectedStudentObj?.nama || 'Siswa';
      showToast(
        `Catatan ${formJenis} (${finalPoin > 0 ? `+${finalPoin}` : finalPoin} Poin) untuk "${targetName}" berhasil disimpan!`
      );
      setIsAddModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      alert('Gagal menyimpan catatan poin: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buka Modal Edit Catatan dengan data pre-filled dari baris yang dipilih
  const handleOpenEditModal = (item: StudentPoint) => {
    const resolvedJenis: PointActionType =
      item.jenis === 'Prestasi' || item.poin > 0 ? 'Prestasi' : 'Pelanggaran';
    const absPoin = Math.abs(Number(item.poin) || (resolvedJenis === 'Pelanggaran' ? 10 : 25));
    const formattedPoin = resolvedJenis === 'Pelanggaran' ? -absPoin : absPoin;

    setEditingPointItem(item);
    setEditJenis(resolvedJenis);
    setEditKeterangan(item.keterangan || '');
    setEditPoin(String(formattedPoin));
    setIsEditModalOpen(true);
  };

  // Ubah Jenis Tindakan pada Modal Edit (Pelanggaran <-> Prestasi) dan sesuaikan tanda +/- poin
  const handleSwitchEditJenis = (nextJenis: PointActionType) => {
    setEditJenis(nextJenis);
    const numeric = Math.abs(parseInt(editPoin, 10) || (nextJenis === 'Pelanggaran' ? 10 : 25));
    setEditPoin(nextJenis === 'Pelanggaran' ? String(-numeric) : String(numeric));
  };

  // Simpan Perubahan Edit Catatan Poin ke Supabase
  const handleUpdatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPointItem) return;
    if (!editKeterangan.trim()) {
      showToast('Keterangan / deskripsi tindakan wajib diisi!');
      return;
    }
    const rawNum = parseInt(editPoin, 10);
    if (isNaN(rawNum) || rawNum === 0) {
      showToast('Jumlah bobot poin harus berupa angka bulat selain 0 (misal -10 atau 25)!');
      return;
    }

    const finalPoin = editJenis === 'Pelanggaran' ? -Math.abs(rawNum) : Math.abs(rawNum);
    setIsUpdating(true);
    try {
      const res = await supabaseService.updateStudentPoint(editingPointItem.id, {
        jenis: editJenis,
        keterangan: editKeterangan.trim(),
        poin: finalPoin,
      });

      setRlsWarning(res.rlsWarning || supabaseService.hasStudentPointsRlsWarning());
      sound.playSuccess();
      const studentLabel =
        editingPointItem.students?.nama || editingPointItem.student_name || 'Siswa';
      showToast(
        `Catatan poin "${studentLabel}" berhasil diperbarui (${
          finalPoin > 0 ? `+${finalPoin}` : finalPoin
        } Poin)!`
      );
      setIsEditModalOpen(false);
      setEditingPointItem(null);
      await loadData(true);
    } catch (err: any) {
      showToast('Gagal memperbarui catatan poin: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  // Buka Modal Konfirmasi Hapus Catatan Poin
  const handleDeletePoint = (item: StudentPoint) => {
    setDeletingPointItem(item);
  };

  // Eksekusi Hapus Catatan Poin setelah dikonfirmasi
  const handleConfirmDeletePoint = async () => {
    if (!deletingPointItem) return;
    setIsDeleting(true);
    try {
      await supabaseService.deleteStudentPoint(deletingPointItem.id);
      setRlsWarning(supabaseService.hasStudentPointsRlsWarning());
      sound.playAlert();
      const studentLabel =
        deletingPointItem.students?.nama || deletingPointItem.student_name || 'Siswa';
      showToast(`Catatan poin milik "${studentLabel}" berhasil dihapus.`);
      setDeletingPointItem(null);
      await loadData(true);
    } catch (err: any) {
      showToast('Gagal menghapus catatan: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter daftar riwayat catatan poin
  const filteredPointsHistory = useMemo(() => {
    return pointsList.filter((item) => {
      if (selectedJenisFilter !== 'ALL' && item.jenis !== selectedJenisFilter) {
        return false;
      }
      if (selectedRombelFilter !== 'ALL') {
        const matchRombel =
          item.rombel_id === selectedRombelFilter ||
          (item.student_kelas &&
            item.student_kelas.trim().toLowerCase() === selectedRombelFilter.trim().toLowerCase());
        if (!matchRombel) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inName = (item.student_name || '').toLowerCase().includes(q);
        const inNisn = (item.student_nisn || '').toLowerCase().includes(q);
        const inUid = (item.student_uid || '').toLowerCase().includes(q);
        const inKet = (item.keterangan || '').toLowerCase().includes(q);
        const inPencatat = (item.pencatat || '').toLowerCase().includes(q);
        if (!inName && !inNisn && !inUid && !inKet && !inPencatat) return false;
      }
      return true;
    });
  }, [pointsList, selectedJenisFilter, selectedRombelFilter, searchQuery]);

  // Filter daftar rekap akumulasi poin per siswa
  const filteredStudentBalances = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedRombelFilter !== 'ALL') {
          const matchClass =
            s.rombel_id === selectedRombelFilter ||
            (s.kelas && s.kelas.trim().toLowerCase() === selectedRombelFilter.trim().toLowerCase());
          if (!matchClass) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const inName = s.nama.toLowerCase().includes(q);
          const inNisn = (s.nisn || '').toLowerCase().includes(q);
          const inUid = (s.uid_kartu || '').toLowerCase().includes(q);
          if (!inName && !inNisn && !inUid) return false;
        }
        return true;
      })
      .map((s) => {
        const bal = studentBalanceMap.get(String(s.id).toLowerCase()) || {
          plus: 0,
          minus: 0,
          total: 0,
          count: 0,
        };
        return {
          student: s,
          ...bal,
        };
      })
      .filter((row) => {
        if (selectedJenisFilter === 'Pelanggaran') return row.minus < 0;
        if (selectedJenisFilter === 'Prestasi') return row.plus > 0;
        return true;
      })
      .sort((a, b) => b.count - a.count || a.student.nama.localeCompare(b.student.nama));
  }, [students, studentBalanceMap, selectedRombelFilter, selectedJenisFilter, searchQuery]);

  // Reset halaman paginasi ke 1 saat filter/pencarian berubah
  useEffect(() => {
    setHistoryPage(1);
    setBalancePage(1);
  }, [selectedRombelFilter, selectedJenisFilter, searchQuery]);

  // Paginasi Sub-Tab Riwayat (10 item per halaman)
  const totalHistoryItems = filteredPointsHistory.length;
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryItems / itemsPerPage));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const historyStartIndex = (safeHistoryPage - 1) * itemsPerPage;
  const historyEndIndex = Math.min(historyStartIndex + itemsPerPage, totalHistoryItems);
  const paginatedPointsHistory = filteredPointsHistory.slice(
    historyStartIndex,
    historyStartIndex + itemsPerPage
  );

  // Paginasi Sub-Tab Rekap Siswa (10 item per halaman)
  const totalBalanceItems = filteredStudentBalances.length;
  const totalBalancePages = Math.max(1, Math.ceil(totalBalanceItems / itemsPerPage));
  const safeBalancePage = Math.min(balancePage, totalBalancePages);
  const balanceStartIndex = (safeBalancePage - 1) * itemsPerPage;
  const balanceEndIndex = Math.min(balanceStartIndex + itemsPerPage, totalBalanceItems);
  const paginatedStudentBalances = filteredStudentBalances.slice(
    balanceStartIndex,
    balanceStartIndex + itemsPerPage
  );

  // Data Visualisasi Analitik Bulanan (Recharts: Pelanggaran vs Prestasi)
  const monthlyAnalyticsData = useMemo(() => {
    const monthNamesShort = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];

    // Gunakan bulan terbaru dari data catatan poin jika ada, atau tanggal hari ini
    let anchorDate = new Date();
    if (pointsList.length > 0) {
      const timestamps = pointsList
        .map((p) => new Date(p.created_at).getTime())
        .filter((t) => !Number.isNaN(t));
      if (timestamps.length > 0) {
        const maxTs = Math.max(...timestamps);
        anchorDate = new Date(maxTs);
      }
    }

    const buckets: {
      key: string;
      monthLabel: string;
      fullMonthLabel: string;
      prestasi: number;
      pelanggaran: number;
      countPrestasi: number;
      countPelanggaran: number;
    }[] = [];

    const bucketMap = new Map<
      string,
      {
        key: string;
        monthLabel: string;
        fullMonthLabel: string;
        prestasi: number;
        pelanggaran: number;
        countPrestasi: number;
        countPelanggaran: number;
      }
    >();

    for (let i = analyticsMonthsRange - 1; i >= 0; i--) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const shortYear = String(y).slice(-2);
      const entry = {
        key,
        monthLabel: `${monthNamesShort[m]} '${shortYear}`,
        fullMonthLabel: `${monthNamesShort[m]} ${y}`,
        prestasi: 0,
        pelanggaran: 0,
        countPrestasi: 0,
        countPelanggaran: 0,
      };
      buckets.push(entry);
      bucketMap.set(key, entry);
    }

    pointsList.forEach((item) => {
      // Sesuaikan otomatis dengan filter Kelas (Rombel) yang sedang dipilih
      if (selectedRombelFilter !== 'ALL') {
        const matchRombel =
          item.rombel_id === selectedRombelFilter ||
          (item.student_kelas &&
            item.student_kelas.trim().toLowerCase() === selectedRombelFilter.trim().toLowerCase());
        if (!matchRombel) return;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inName = (item.student_name || '').toLowerCase().includes(q);
        const inNisn = (item.student_nisn || '').toLowerCase().includes(q);
        const inKet = (item.keterangan || '').toLowerCase().includes(q);
        if (!inName && !inNisn && !inKet) return;
      }

      const dt = new Date(item.created_at);
      if (Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = bucketMap.get(key);
      if (!bucket) return;

      const val = Math.abs(Number(item.poin) || 0);
      if (item.jenis === 'Prestasi' || Number(item.poin) > 0) {
        bucket.prestasi += val;
        bucket.countPrestasi += 1;
      } else {
        // Ditampilkan sebagai nilai absolut positif pada sumbu Y agar mudah dibandingkan tingginya
        bucket.pelanggaran += val;
        bucket.countPelanggaran += 1;
      }
    });

    return buckets;
  }, [pointsList, selectedRombelFilter, searchQuery, analyticsMonthsRange]);

  // Kartu Insight Pendamping Grafik: Top 3 Prestasi Tertinggi & Top 3 Pembinaan Khusus
  const analyticsTopInsights = useMemo(() => {
    const allowedMonthKeys = new Set(monthlyAnalyticsData.map((m) => m.key));
    const perStudent = new Map<
      string,
      {
        studentId: string;
        nama: string;
        kelas: string;
        nisn: string;
        uid: string;
        plus: number;
        minus: number;
        absMinus: number;
        total: number;
        countPrestasi: number;
        countPelanggaran: number;
        studentObj?: Student;
      }
    >();

    const studentLookup = new Map<string, Student>();
    students.forEach((s) => studentLookup.set(String(s.id).toLowerCase(), s));

    pointsList.forEach((item) => {
      if (selectedRombelFilter !== 'ALL') {
        const matchRombel =
          item.rombel_id === selectedRombelFilter ||
          (item.student_kelas &&
            item.student_kelas.trim().toLowerCase() === selectedRombelFilter.trim().toLowerCase());
        if (!matchRombel) return;
      }

      const dt = new Date(item.created_at);
      if (!Number.isNaN(dt.getTime())) {
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!allowedMonthKeys.has(key)) return;
      }

      const sid = String(item.student_id || '').toLowerCase();
      if (!sid) return;

      const matchedStudent = studentLookup.get(sid);
      const existing = perStudent.get(sid) || {
        studentId: item.student_id,
        nama: item.students?.nama || item.student_name || matchedStudent?.nama || 'Siswa',
        kelas: item.student_kelas || matchedStudent?.kelas || 'Umum',
        nisn:
          item.students?.nis ||
          item.students?.nisn ||
          item.student_nisn ||
          matchedStudent?.nisn ||
          '-',
        uid: item.student_uid || matchedStudent?.uid_kartu || '-',
        plus: 0,
        minus: 0,
        absMinus: 0,
        total: 0,
        countPrestasi: 0,
        countPelanggaran: 0,
        studentObj: matchedStudent,
      };

      const absVal = Math.abs(Number(item.poin) || 0);
      if (item.jenis === 'Prestasi' || Number(item.poin) > 0) {
        existing.plus += absVal;
        existing.total += absVal;
        existing.countPrestasi += 1;
      } else {
        existing.minus -= absVal;
        existing.absMinus += absVal;
        existing.total -= absVal;
        existing.countPelanggaran += 1;
      }

      perStudent.set(sid, existing);
    });

    const allRows = Array.from(perStudent.values());

    const topPrestasi = allRows
      .filter((r) => r.plus > 0)
      .sort((a, b) => b.plus - a.plus || b.total - a.total || b.countPrestasi - a.countPrestasi)
      .slice(0, 3);

    const topPembinaan = allRows
      .filter((r) => r.absMinus > 0)
      .sort(
        (a, b) =>
          b.absMinus - a.absMinus || a.total - b.total || b.countPelanggaran - a.countPelanggaran
      )
      .slice(0, 3);

    const periodTotals = monthlyAnalyticsData.reduce(
      (acc, cur) => {
        acc.prestasi += cur.prestasi;
        acc.pelanggaran += cur.pelanggaran;
        acc.countPrestasi += cur.countPrestasi;
        acc.countPelanggaran += cur.countPelanggaran;
        return acc;
      },
      { prestasi: 0, pelanggaran: 0, countPrestasi: 0, countPelanggaran: 0 }
    );

    return {
      topPrestasi,
      topPembinaan,
      periodTotals,
    };
  }, [pointsList, students, selectedRombelFilter, monthlyAnalyticsData]);

  // Ekspor CSV Riwayat Poin Kedisiplinan (dari tampilan tabel aktif atau dari modal filter laporan)
  const exportPointsToCsv = (dataset: StudentPoint[], suffixLabel = '') => {
    if (dataset.length === 0) {
      showToast('Tidak ada data catatan poin yang sesuai filter untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'Waktu Kejadian',
      'Nama Siswa',
      'NIS / NISN',
      'Kelas',
      'Jenis Tindakan',
      'Rincian Keterangan',
      'Bobot Poin',
      'Akumulasi Poin Siswa',
      'Nama Pencatat',
    ];

    const rows = dataset.map((pt, idx) => {
      const bal = studentBalanceMap.get(String(pt.student_id).toLowerCase())?.total ?? pt.poin;
      const waktuStr = new Date(pt.created_at).toLocaleString('id-ID');
      const resolvedName = pt.students?.nama || pt.student_name || 'Siswa';
      const resolvedNis = pt.students?.nis || pt.students?.nisn || pt.student_nisn || '-';
      return [
        idx + 1,
        `"${waktuStr}"`,
        `"${resolvedName.replace(/"/g, '""')}"`,
        `"${resolvedNis}"`,
        `"${pt.student_kelas || 'Umum'}"`,
        `"${pt.jenis}"`,
        `"${(pt.keterangan || '').replace(/"/g, '""')}"`,
        pt.poin,
        bal,
        `"${(pt.pencatat || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanSuffix = suffixLabel ? `_${suffixLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    a.download = `Laporan_Kedisiplinan_Siswa${cleanSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sound.playSuccess();
    showToast('File Spreadsheet (CSV / Excel) berhasil diunduh!');
  };

  const handleExportCsv = () => {
    exportPointsToCsv(filteredPointsHistory);
  };

  // Siswa yang dipilih pada Mode Cetak Detail Per Siswa
  const reportSelectedStudentObj = useMemo(() => {
    if (!reportSelectedStudentId) return null;
    return (
      students.find(
        (s) => String(s.id).toLowerCase() === String(reportSelectedStudentId).toLowerCase()
      ) || null
    );
  }, [students, reportSelectedStudentId]);

  // Daftar pencarian siswa untuk Pusat Cetak Laporan (Mode Per Siswa - Hanya tampil saat mengetik)
  const filteredStudentsForReport = useMemo(() => {
    const q = reportStudentSearch.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => {
        if (isWaliKelas && waliAssignedClass) {
          const sKelas = String(s.kelas || '').trim().toLowerCase().replace(/^kelas\s+/i, '');
          if (sKelas !== waliAssignedClass.toLowerCase()) return false;
        }
        return (
          s.nama.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.toLowerCase().includes(q)) ||
          (s.nis && s.nis.toLowerCase().includes(q)) ||
          (s.uid_kartu && s.uid_kartu.toLowerCase().includes(q)) ||
          (s.rfid_uid && s.rfid_uid.toLowerCase().includes(q)) ||
          (s.kelas && s.kelas.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [students, reportStudentSearch, isWaliKelas, waliAssignedClass]);

  // Filter khusus untuk Pusat Cetak & Unduh Laporan Kedisiplinan (Rekap Rombel vs Detail Per Siswa)
  const reportFilteredPoints = useMemo(() => {
    return pointsList.filter((item) => {
      // 0. Jika Cakupan = Cetak Detail Per Siswa, wajib cocokkan student_id siswa terpilih
      if (reportScope === 'student') {
        if (!reportSelectedStudentId) return false;
        if (
          String(item.student_id || '').toLowerCase() !==
          String(reportSelectedStudentId).toLowerCase()
        ) {
          return false;
        }
      } else {
        // Jika Cakupan = Cetak Rekap Kelas (Rombel), terapkan filter kelas
        if (reportRombelFilter !== 'ALL') {
          const matchRombel =
            item.rombel_id === reportRombelFilter ||
            (item.student_kelas &&
              item.student_kelas.trim().toLowerCase() === reportRombelFilter.trim().toLowerCase());
          if (!matchRombel) return false;
        }
      }

      // 1. Filter Jenis Laporan (Semua Tindakan, Khusus Pelanggaran, Khusus Prestasi)
      if (reportJenisFilter !== 'ALL' && item.jenis !== reportJenisFilter) {
        return false;
      }

      // 2. Filter Rentang Tanggal (Dari tanggal ... sampai tanggal ...)
      if (reportStartDate || reportEndDate) {
        const itemDateObj = new Date(item.created_at);
        const yyyy = itemDateObj.getFullYear();
        const mm = String(itemDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(itemDateObj.getDate()).padStart(2, '0');
        const itemYmd = `${yyyy}-${mm}-${dd}`;

        if (reportStartDate && itemYmd < reportStartDate) return false;
        if (reportEndDate && itemYmd > reportEndDate) return false;
      }

      return true;
    });
  }, [
    pointsList,
    reportScope,
    reportSelectedStudentId,
    reportJenisFilter,
    reportRombelFilter,
    reportStartDate,
    reportEndDate,
  ]);

  // Ringkasan Statistik untuk Laporan Resmi
  const reportSummaryStats = useMemo(() => {
    let totalPlus = 0;
    let totalMinus = 0;
    let countPrestasi = 0;
    let countPelanggaran = 0;
    const studentSet = new Set<string>();

    reportFilteredPoints.forEach((pt) => {
      const val = Number(pt.poin) || 0;
      if (pt.student_id) studentSet.add(String(pt.student_id).toLowerCase());
      if (pt.jenis === 'Prestasi' || val > 0) {
        totalPlus += Math.abs(val);
        countPrestasi += 1;
      } else {
        totalMinus -= Math.abs(val);
        countPelanggaran += 1;
      }
    });

    return {
      totalRecords: reportFilteredPoints.length,
      totalPlus,
      totalMinus,
      netPoints: totalPlus + totalMinus,
      countPrestasi,
      countPelanggaran,
      uniqueStudents: studentSet.size,
    };
  }, [reportFilteredPoints]);

  // Preset Rentang Tanggal Cepat di Pusat Cetak Laporan
  const handleApplyDatePreset = (
    preset: 'all' | 'today' | 'this_week' | 'this_month' | 'week' | 'month'
  ) => {
    const now = new Date();
    const toLocalYmd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'all') {
      setReportDatePreset('all');
      setReportStartDate('');
      setReportEndDate('');
    } else if (preset === 'today') {
      setReportDatePreset('today');
      const todayStr = toLocalYmd(now);
      setReportStartDate(todayStr);
      setReportEndDate(todayStr);
    } else if (preset === 'this_week' || preset === 'week') {
      setReportDatePreset('this_week');
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Senin awal minggu
      startOfWeek.setDate(now.getDate() + diff);
      setReportStartDate(toLocalYmd(startOfWeek));
      setReportEndDate(toLocalYmd(now));
    } else if (preset === 'this_month' || preset === 'month') {
      setReportDatePreset('this_month');
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setReportStartDate(toLocalYmd(startOfMonth));
      setReportEndDate(toLocalYmd(now));
    }
  };

  // Format Label Periode untuk Kop Laporan
  const formattedPeriodLabel = useMemo(() => {
    const fmt = (ymd: string) => {
      if (!ymd) return '';
      const [y, m, d] = ymd.split('-').map(Number);
      if (!y || !m || !d) return ymd;
      return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    };
    if (reportStartDate && reportEndDate) {
      if (reportStartDate === reportEndDate) return fmt(reportStartDate);
      return `${fmt(reportStartDate)} s/d ${fmt(reportEndDate)}`;
    }
    if (reportStartDate) return `Mulai ${fmt(reportStartDate)}`;
    if (reportEndDate) return `Sampai ${fmt(reportEndDate)}`;
    return 'Semua Periode';
  }, [reportStartDate, reportEndDate]);

  // Cetak Dokumen Resmi Kertas A4 (Mendukung Mode Rekap Kelas & Mode Detail Per Siswa)
  const handlePrintOfficialA4 = () => {
    const schoolTitle = (schoolSettings.appTitle || DEFAULT_APP_TITLE).toUpperCase();
    const schoolSubtitle = schoolSettings.appSubtitle || DEFAULT_APP_SUBTITLE;
    const schoolLogo = schoolSettings.appLogo || '';
    const isIndividualMode = reportScope === 'student' && Boolean(reportSelectedStudentObj);
    const jenisLabel =
      reportJenisFilter === 'ALL'
        ? 'Semua Tindakan (Pelanggaran & Prestasi)'
        : reportJenisFilter === 'Pelanggaran'
        ? 'Khusus Pelanggaran (-)'
        : 'Khusus Prestasi (+)';
    const kelasLabel =
      reportRombelFilter === 'ALL' ? 'Semua Kelas (Rombel)' : `Kelas ${reportRombelFilter}`;
    const tanggalCetakFormatted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const tableRowsHtml = isIndividualMode
      ? reportFilteredPoints.length === 0
        ? `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#64748b;">Belum ada riwayat catatan kedisiplinan / prestasi untuk siswa ini pada periode yang dipilih.</td></tr>`
        : reportFilteredPoints
            .map((item, idx) => {
              const isPrestasi = item.jenis === 'Prestasi' || item.poin > 0;
              const waktuFormatted = new Date(item.created_at).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td style="white-space:nowrap;">${escapeHtml(waktuFormatted)}</td>
                  <td style="text-align:center; font-weight:700; color:${
                    isPrestasi ? '#047857' : '#be123c'
                  };">${escapeHtml(item.jenis)}</td>
                  <td>${escapeHtml(item.keterangan)}</td>
                  <td style="text-align:right; font-family:monospace; font-weight:700; color:${
                    isPrestasi ? '#047857' : '#be123c'
                  };">${item.poin > 0 ? `+${item.poin}` : item.poin} Poin</td>
                  <td>${escapeHtml(item.pencatat || 'Admin Sekolah')}</td>
                </tr>
              `;
            })
            .join('')
      : reportFilteredPoints.length === 0
      ? `<tr><td colspan="10" style="text-align:center; padding: 24px; color:#64748b;">Tidak ada catatan poin kedisiplinan pada filter yang dipilih.</td></tr>`
      : reportFilteredPoints
          .map((item, idx) => {
            const isPrestasi = item.jenis === 'Prestasi' || item.poin > 0;
            const studentName = item.students?.nama || item.student_name || 'Siswa';
            const studentNis =
              item.students?.nis || item.students?.nisn || item.student_nisn || '-';
            const studentBal =
              studentBalanceMap.get(String(item.student_id).toLowerCase())?.total ?? item.poin;
            const waktuFormatted = new Date(item.created_at).toLocaleString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td style="white-space:nowrap;">${escapeHtml(waktuFormatted)}</td>
                <td><strong>${escapeHtml(studentName)}</strong></td>
                <td style="text-align:center; font-family:monospace;">${escapeHtml(studentNis)}</td>
                <td style="text-align:center;">${escapeHtml(item.student_kelas || 'Umum')}</td>
                <td style="text-align:center; font-weight:700; color:${
                  isPrestasi ? '#047857' : '#be123c'
                };">${escapeHtml(item.jenis)}</td>
                <td>${escapeHtml(item.keterangan)}</td>
                <td style="text-align:right; font-family:monospace; font-weight:700; color:${
                  isPrestasi ? '#047857' : '#be123c'
                };">${item.poin > 0 ? `+${item.poin}` : item.poin}</td>
                <td style="text-align:right; font-family:monospace; font-weight:700;">${
                  studentBal > 0 ? `+${studentBal}` : studentBal
                }</td>
                <td>${escapeHtml(item.pencatat || 'Admin Sekolah')}</td>
              </tr>
            `;
          })
          .join('');

    const stdNis =
      reportSelectedStudentObj?.nisn || reportSelectedStudentObj?.nis || '-';
    const stdKelas = reportSelectedStudentObj?.kelas || 'Umum';
    const stdUid =
      reportSelectedStudentObj?.uid_kartu || reportSelectedStudentObj?.rfid_uid || '-';

    const htmlDocument = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>${
          isIndividualMode
            ? `Lembar Profil & Rekam Jejak Kedisiplinan Siswa - ${escapeHtml(
                reportSelectedStudentObj?.nama || ''
              )}`
            : `Laporan Resmi Rekapitulasi Kedisiplinan & Prestasi Siswa - ${escapeHtml(schoolTitle)}`
        }</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 14mm 14mm 16mm 14mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Times New Roman', Times, Georgia, serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }
          .letterhead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px double #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .letterhead-logo {
            width: 68px;
            height: 68px;
            object-fit: contain;
          }
          .letterhead-logo-placeholder {
            width: 64px;
            height: 64px;
            border: 2px solid #0f172a;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18pt;
            font-family: Arial, sans-serif;
          }
          .letterhead-center {
            flex: 1;
            text-align: center;
            padding: 0 14px;
          }
          .letterhead-title {
            font-size: 16pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin: 0;
            text-transform: uppercase;
          }
          .letterhead-subtitle {
            font-size: 10pt;
            color: #334155;
            margin: 4px 0 0 0;
          }
          .letterhead-doccode {
            font-size: 8.5pt;
            color: #475569;
            margin-top: 3px;
            font-family: Arial, sans-serif;
          }
          .report-heading {
            text-align: center;
            margin-bottom: 14px;
          }
          .report-heading h2 {
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            text-decoration: underline;
            margin: 0 0 4px 0;
          }
          .report-heading p {
            font-size: 9.5pt;
            margin: 0;
            color: #334155;
            font-family: Arial, sans-serif;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 24px;
            font-family: Arial, sans-serif;
            font-size: 9.5pt;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 12px;
          }
          .summary-boxes {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            font-family: Arial, sans-serif;
            margin-bottom: 14px;
          }
          .summary-box {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 10px;
            text-align: center;
          }
          .summary-box .label {
            font-size: 8pt;
            color: #475569;
            text-transform: uppercase;
            font-weight: 600;
          }
          .summary-box .val {
            font-size: 12pt;
            font-weight: 800;
            margin-top: 2px;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            font-size: 8.5pt;
            margin-bottom: 22px;
          }
          table.report-table th,
          table.report-table td {
            border: 1px solid #64748b;
            padding: 5px 6px;
            vertical-align: top;
          }
          table.report-table th {
            background-color: #f1f5f9;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8pt;
            color: #0f172a;
          }
          .signatures-two {
            display: flex;
            justify-content: space-between;
            margin-top: 26px;
            page-break-inside: avoid;
            font-size: 10pt;
          }
          .signatures-two .sig-block {
            width: 44%;
            text-align: center;
          }
          .signatures-three {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-top: 26px;
            page-break-inside: avoid;
            font-size: 9.5pt;
          }
          .signatures-three .sig-block {
            width: 32%;
            text-align: center;
          }
          .signatures-four {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-top: 26px;
            page-break-inside: avoid;
            font-size: 9pt;
          }
          .signatures-four .sig-block {
            width: 24%;
            text-align: center;
          }
          .sig-space {
            height: 60px;
          }
          .sig-name {
            font-weight: bold;
            text-decoration: underline;
          }
          .sig-nip {
            font-size: 8.5pt;
            color: #334155;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <div>
            ${
              schoolLogo
                ? `<img src="${schoolLogo}" class="letterhead-logo" alt="Logo Sekolah" />`
                : `<div class="letterhead-logo-placeholder">${escapeHtml(schoolTitle.slice(0, 2))}</div>`
            }
          </div>
          <div class="letterhead-center">
            <h1 class="letterhead-title">${escapeHtml(schoolTitle)}</h1>
            <p class="letterhead-subtitle">${escapeHtml(schoolSubtitle)}</p>
            <div class="letterhead-doccode">DOKUMEN RESMI BIDANG KESISWAAN &amp; BIMBINGAN KONSELING (BK)</div>
          </div>
          <div style="width:68px;"></div>
        </div>

        <div class="report-heading">
          <h2>${
            isIndividualMode
              ? 'LEMBAR PROFIL &amp; REKAM JEJAK KEDISIPLINAN SISWA'
              : 'LAPORAN RESMI REKAPITULASI KEDISIPLINAN &amp; PRESTASI SISWA'
          }</h2>
          <p>Periode Rekam Jejak: <strong>${escapeHtml(formattedPeriodLabel)}</strong> · Filter: <strong>${escapeHtml(jenisLabel)}</strong></p>
        </div>

        ${
          isIndividualMode && reportSelectedStudentObj
            ? `
          <div class="meta-grid">
            <div><strong>Nama Lengkap Siswa:</strong> ${escapeHtml(reportSelectedStudentObj.nama)}</div>
            <div><strong>Kelas / Rombel:</strong> Kelas ${escapeHtml(stdKelas)}</div>
            <div><strong>NIS / NISN:</strong> ${escapeHtml(stdNis)}</div>
            <div><strong>UID Kartu RFID:</strong> ${escapeHtml(stdUid)}</div>
            <div><strong>Tanggal Cetak:</strong> ${escapeHtml(tanggalCetakFormatted)}</div>
            <div><strong>Petugas Kesiswaan / BK:</strong> ${escapeHtml(petugasBkName || defaultPencatatName)}</div>
          </div>

          <div class="summary-boxes">
            <div class="summary-box">
              <div class="label">Total Catatan</div>
              <div class="val">${reportSummaryStats.totalRecords} Riwayat</div>
            </div>
            <div class="summary-box">
              <div class="label">Poin Prestasi (+)</div>
              <div class="val" style="color:#047857;">+${reportSummaryStats.totalPlus} (${reportSummaryStats.countPrestasi}x)</div>
            </div>
            <div class="summary-box">
              <div class="label">Poin Pelanggaran (-)</div>
              <div class="val" style="color:#be123c;">${reportSummaryStats.totalMinus} (${reportSummaryStats.countPelanggaran}x)</div>
            </div>
            <div class="summary-box">
              <div class="label">Total Akumulasi Poin</div>
              <div class="val" style="color:${
                reportSummaryStats.netPoints > 0
                  ? '#047857'
                  : reportSummaryStats.netPoints < 0
                  ? '#be123c'
                  : '#0f172a'
              };">${
                reportSummaryStats.netPoints > 0
                  ? `+${reportSummaryStats.netPoints}`
                  : reportSummaryStats.netPoints
              } Poin</div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width:32px; text-align:center;">No</th>
                <th style="width:110px;">Tanggal &amp; Waktu</th>
                <th style="width:95px; text-align:center;">Jenis Tindakan</th>
                <th>Rincian Keterangan / Deskripsi Kejadian</th>
                <th style="width:76px; text-align:right;">Bobot Poin</th>
                <th style="width:115px;">Guru / Pencatat</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="signatures-four">
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div><strong>Orang Tua / Wali Murid</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(waliMuridSignName || 'Orang Tua / Wali Siswa')}</div>
              <div class="sig-nip">Wali dari ${escapeHtml(reportSelectedStudentObj.nama)}</div>
            </div>
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div><strong>Kepala Sekolah</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(kepalaSekolahName || 'Kepala Sekolah')}</div>
              <div class="sig-nip">${escapeHtml(kepalaSekolahNip || 'NIP. -')}</div>
            </div>
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div><strong>Petugas Kesiswaan / Guru BK</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(petugasBkName || 'Guru BK / Kesiswaan')}</div>
              <div class="sig-nip">${escapeHtml(petugasBkNip || 'NIP. -')}</div>
            </div>
            <div class="sig-block">
              <div>${escapeHtml(kotaCetak || 'Jakarta')}, ${escapeHtml(tanggalCetakFormatted)}</div>
              <div><strong>Wali Kelas ${escapeHtml(stdKelas)}</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(waliKelasName || 'Hesti Supriyani, S.Pd.I')}</div>
              <div class="sig-nip">${escapeHtml(waliKelasNip || 'NIP. -')}</div>
            </div>
          </div>
        `
            : `
          <div class="meta-grid">
            <div><strong>Filter Kelas / Rombel:</strong> ${escapeHtml(kelasLabel)}</div>
            <div><strong>Jenis Laporan:</strong> ${escapeHtml(jenisLabel)}</div>
            <div><strong>Tanggal Cetak:</strong> ${escapeHtml(tanggalCetakFormatted)}</div>
            <div><strong>Wali Kelas / Pencetak:</strong> ${escapeHtml(
              isWaliKelas ? waliKelasName : petugasBkName || defaultPencatatName
            )}</div>
          </div>

          <div class="summary-boxes">
            <div class="summary-box">
              <div class="label">Total Catatan</div>
              <div class="val">${reportSummaryStats.totalRecords} Data</div>
            </div>
            <div class="summary-box">
              <div class="label">Total Poin Prestasi (+)</div>
              <div class="val" style="color:#047857;">+${reportSummaryStats.totalPlus} (${reportSummaryStats.countPrestasi}x)</div>
            </div>
            <div class="summary-box">
              <div class="label">Total Poin Pelanggaran (-)</div>
              <div class="val" style="color:#be123c;">${reportSummaryStats.totalMinus} (${reportSummaryStats.countPelanggaran}x)</div>
            </div>
            <div class="summary-box">
              <div class="label">Siswa Tercatat</div>
              <div class="val">${reportSummaryStats.uniqueStudents} Siswa</div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width:28px; text-align:center;">No</th>
                <th style="width:92px;">Waktu</th>
                <th style="width:120px;">Nama Siswa</th>
                <th style="width:70px; text-align:center;">NIS</th>
                <th style="width:52px; text-align:center;">Kelas</th>
                <th style="width:76px; text-align:center;">Jenis</th>
                <th>Rincian Keterangan</th>
                <th style="width:54px; text-align:right;">Bobot</th>
                <th style="width:62px; text-align:right;">Akumulasi</th>
                <th style="width:90px;">Pencatat</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="signatures-three">
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div><strong>Kepala Sekolah</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(kepalaSekolahName || 'Kepala Sekolah')}</div>
              <div class="sig-nip">${escapeHtml(kepalaSekolahNip || 'NIP. -')}</div>
            </div>
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div><strong>Petugas Kesiswaan / Guru BK</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(petugasBkName || 'Guru BK / Kesiswaan')}</div>
              <div class="sig-nip">${escapeHtml(petugasBkNip || 'NIP. -')}</div>
            </div>
            <div class="sig-block">
              <div>${escapeHtml(kotaCetak || 'Jakarta')}, ${escapeHtml(tanggalCetakFormatted)}</div>
              <div><strong>Wali Kelas${
                reportRombelFilter !== 'ALL' ? ` ${escapeHtml(reportRombelFilter)}` : ''
              }</strong></div>
              <div class="sig-space"></div>
              <div class="sig-name">${escapeHtml(waliKelasName || 'Hesti Supriyani, S.Pd.I')}</div>
              <div class="sig-nip">${escapeHtml(waliKelasNip || 'NIP. -')}</div>
            </div>
          </div>
        `
        }
      </body>
      </html>
    `;

    try {
      const existingIframe = document.getElementById('discipline-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'discipline-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlDocument);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 350);
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  useEffect(() => {
    if ((isReportModalOpen || isAddModalOpen) && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isReportModalOpen, isAddModalOpen]);

  return (
    <div className="space-y-6">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {!isReportModalOpen && !isAddModalOpen ? (
        <>
          {/* HEADER UTAMA & TOMBOL AKSI (+ Catat Pelanggaran / Prestasi Baru) */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              Poin &amp; Kedisiplinan Siswa (Pelanggaran &amp; Prestasi)
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Pencatatan real-time poin penghargaan prestasi (+) dan pembinaan pelanggaran (-) yang terintegrasi langsung ke Portal Wali Murid.
            </p>
          </div>
        </div>

        <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          {/* Baris Atas Mobile: 2 Kolom Sejajar (Unduh Excel & Cetak Laporan) */}
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap transition active:scale-95"
            >
              <span>📥 Unduh Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReportRombelFilter(selectedRombelFilter);
                setReportJenisFilter(selectedJenisFilter);
                setIsReportModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap transition active:scale-95"
            >
              <span>🖨️ Cetak Laporan</span>
            </button>
          </div>

          {/* Baris Bawah Mobile: Tombol Utama Penuh (+ Catat Poin) */}
          <button
            type="button"
            onClick={() => handleOpenAddModal(undefined, 'Pelanggaran')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap transition active:scale-95"
          >
            <span>+ Catat Poin</span>
          </button>
        </div>
      </div>

      {/* BANNER PANDUAN BUKA RLS JIKA TABEL student_points MASIH TERKUNCI RLS (ERROR 42501) */}
      {rlsWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold">
                Sinkronisasi Cadangan Aktif — Row-Level Security (RLS) pada tabel <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">public.student_points</code> masih terkunci
              </p>
              <p className="text-amber-800/90 leading-relaxed">
                Catatan poin Anda tetap tersimpan dan langsung tampil di Admin &amp; Portal Wali Murid. Agar data masuk ke tabel cloud Supabase secara permanen, jalankan perintah SQL berikut di <strong>Supabase SQL Editor</strong> (data tertunda akan otomatis dikirim ke Supabase):
              </p>
              <code className="block font-mono text-[11px] bg-white/90 border border-amber-200 text-slate-800 px-2.5 py-1.5 rounded-lg mt-1 select-all">
                ALTER TABLE public.student_points DISABLE ROW LEVEL SECURITY;
              </code>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(
                'ALTER TABLE public.student_points DISABLE ROW LEVEL SECURITY;'
              );
              setCopiedRlsSql(true);
              showToast('Perintah SQL pembuka RLS berhasil disalin!');
              setTimeout(() => setCopiedRlsSql(false), 2500);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition active:scale-95 self-start sm:self-center"
          >
            {copiedRlsSql ? '✓ SQL Tersalin' : 'Salin SQL Buka RLS'}
          </button>
        </div>
      )}

      {/* RINGKASAN METRIK POIN KEDISIPLINAN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-500 block">
              Total Catatan Kedisiplinan
            </span>
            <span className="text-2xl font-bold text-gray-900 font-mono tabular-nums mt-1 block">
              {globalStats.totalRecords}
            </span>
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              {globalStats.countPrestasi} Prestasi · {globalStats.countPelanggaran} Pelanggaran
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 block">
              Total Poin Prestasi (+)
            </span>
            <span className="text-2xl font-bold text-emerald-600 font-mono tabular-nums mt-1 block">
              +{globalStats.totalPlus}
            </span>
            <span className="text-[11px] text-emerald-600/80 mt-0.5 block">
              {globalStats.countPrestasi} catatan penghargaan
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-700 block">
              Total Poin Pelanggaran (-)
            </span>
            <span className="text-2xl font-bold text-rose-600 font-mono tabular-nums mt-1 block">
              {globalStats.totalMinus}
            </span>
            <span className="text-[11px] text-rose-600/80 mt-0.5 block">
              {globalStats.countPelanggaran} catatan pembinaan
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-cyan-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-cyan-700 block">
              Siswa Memiliki Catatan
            </span>
            <span className="text-2xl font-bold text-cyan-700 font-mono tabular-nums mt-1 block">
              {globalStats.uniqueStudentsCount}{' '}
              <span className="text-xs font-normal text-gray-400">/ {students.length}</span>
            </span>
            <span className="text-[11px] text-cyan-600/80 mt-0.5 block">
              Tersinkron ke Portal Wali
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* PANEL UTAMA: FILTER, TABEL RIWAYAT & AKUMULASI POIN SISWA */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        {/* Baris Kontrol Tab & Filter (2 Baris Vertikal / Stacked) */}
        <div className="pb-4 border-b border-slate-100">
          {/* Baris Pertama: Navigasi 3 Sub-Menu Responsif (Mobile 3 Kolom vs Desktop Lengkap) */}
          {/* Baris Pertama: Navigasi 4 Sub-Menu Responsif (Mobile 4 Kolom vs Desktop Lengkap) */}
          {/* MOBILE & TABLET SUB-MENU: 4 Kolom Proporsional Responsif (md:hidden) */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-2xl w-full md:hidden">
            <button
              type="button"
              onClick={() => setActiveSubView('history')}
              className={`px-1 sm:px-2 py-2 rounded-xl text-[11px] sm:text-xs transition-all duration-300 ease-out active:scale-95 text-center flex items-center justify-center leading-tight ${
                activeSubView === 'history'
                  ? 'bg-cyan-500 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <span>Riwayat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('balance')}
              className={`px-1 sm:px-2 py-2 rounded-xl text-[11px] sm:text-xs transition-all duration-300 ease-out active:scale-95 text-center flex items-center justify-center leading-tight ${
                activeSubView === 'balance'
                  ? 'bg-cyan-500 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <span className="sm:hidden">Rekapan</span>
              <span className="hidden sm:inline">Rekap Siswa</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('analytics')}
              className={`px-1 sm:px-2 py-2 rounded-xl text-[11px] sm:text-xs transition-all duration-300 ease-out active:scale-95 text-center flex items-center justify-center leading-tight ${
                activeSubView === 'analytics'
                  ? 'bg-cyan-500 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <span>Analitik</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('rules')}
              className={`px-1 sm:px-2 py-2 rounded-xl text-[11px] sm:text-xs transition-all duration-300 ease-out active:scale-95 text-center flex items-center justify-center leading-tight ${
                activeSubView === 'rules'
                  ? 'bg-cyan-500 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <span className="sm:hidden">Atur Poin</span>
              <span className="hidden sm:inline">Aturan Poin</span>
            </button>
          </div>

          {/* DESKTOP SUB-MENU: Label Lengkap Beserta Indikator Jumlah (hidden md:flex) */}
          <div className="hidden md:flex w-full overflow-x-auto">
            <div className="inline-flex flex-nowrap items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200/80 rounded-xl overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveSubView('history')}
                className={`px-3.5 py-2 rounded-lg text-xs transition-all duration-300 ease-out active:scale-95 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  activeSubView === 'history'
                    ? 'bg-cyan-500 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
                }`}
              >
                <span>Riwayat Catatan &amp; Akumulasi</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                    activeSubView === 'history'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {filteredPointsHistory.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('balance')}
                className={`px-3.5 py-2 rounded-lg text-xs transition-all duration-300 ease-out active:scale-95 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  activeSubView === 'balance'
                    ? 'bg-cyan-500 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
                }`}
              >
                <span>Rekap Akumulasi per Siswa</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                    activeSubView === 'balance'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {filteredStudentBalances.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('analytics')}
                className={`px-3.5 py-2 rounded-lg text-xs transition-all duration-300 ease-out active:scale-95 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  activeSubView === 'analytics'
                    ? 'bg-cyan-500 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
                }`}
              >
                <span>📊 Analitik &amp; Grafik Bulanan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('rules')}
                className={`px-3.5 py-2 rounded-lg text-xs transition-all duration-300 ease-out active:scale-95 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  activeSubView === 'rules'
                    ? 'bg-cyan-500 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
                }`}
              >
                <span>⚙️ Aturan &amp; Otomatisasi Poin</span>
              </button>
            </div>
          </div>

          {/* Baris Kedua: Bilah Filter & Pencarian di Bawah Sub-Menu */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Sisi Kiri Baris Filter: Grid 2 Kolom Dropdown (Semua Jenis Poin & Semua Kelas Rombel) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto">
              {/* Filter Jenis Poin (Dropdown Select Pill) */}
              <div className="relative flex items-center w-full">
                <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 pointer-events-none" />
                <select
                  value={selectedJenisFilter}
                  onChange={(e) =>
                    setSelectedJenisFilter(e.target.value as 'ALL' | PointActionType)
                  }
                  className="w-full sm:min-w-[195px] bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
                >
                  <option value="ALL">Semua Jenis Poin</option>
                  <option value="Pelanggaran">Pelanggaran (-)</option>
                  <option value="Prestasi">Prestasi (+)</option>
                </select>
              </div>

              {/* Filter Kelas (Rombel) */}
              <div className="relative flex items-center w-full">
                {isWaliKelas ? (
                  <Lock className="w-3.5 h-3.5 text-emerald-600 absolute left-3.5 pointer-events-none" />
                ) : (
                  <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 pointer-events-none" />
                )}
                <select
                  value={selectedRombelFilter}
                  onChange={(e) => {
                    if (!isWaliKelas) setSelectedRombelFilter(e.target.value);
                  }}
                  disabled={isWaliKelas}
                  className={`w-full sm:min-w-[195px] rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold focus:outline-none transition ${
                    isWaliKelas
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold cursor-not-allowed'
                      : 'bg-slate-50 border border-slate-200 text-gray-800 focus:bg-white focus:border-cyan-500'
                  }`}
                >
                  {!isWaliKelas && <option value="ALL">Semua Kelas (Rombel)</option>}
                  {rombelList
                    .filter((r) => {
                      if (!isWaliKelas) return true;
                      return (
                        r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase() ||
                        r.nama_kelas === selectedRombelFilter
                      );
                    })
                    .map((r) => (
                      <option key={r.id} value={r.nama_kelas}>
                        {isWaliKelas ? `Kelas Binaan: ${r.nama_kelas}` : `Kelas ${r.nama_kelas}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Sisi Kanan Baris Filter: Kolom Input Pencarian yang Lega */}
            <div className="relative w-full lg:flex-1 lg:max-w-md">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa, NISN, keterangan..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>
        </div>

        {/* SUB-VIEW 1: RIWAYAT CATATAN KEDISIPLINAN TERBARU + AKUMULASI POIN */}
        {activeSubView === 'history' ? (
          isLoading ? (
            <div className="py-12 text-center text-xs text-gray-500 font-mono animate-pulse">
              Memuat data riwayat poin &amp; kedisiplinan siswa...
            </div>
          ) : filteredPointsHistory.length === 0 ? (
            <div className="py-14 px-4 text-center bg-gray-50/70 rounded-2xl border border-dashed border-gray-200 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto space-y-1">
                <h3 className="text-sm font-bold text-gray-900">
                  Belum Ada Catatan Kedisiplinan / Prestasi
                </h3>
                <p className="text-xs text-gray-500">
                  Klik tombol <strong>+ Catat Poin</strong> di kanan atas untuk mulai mencatat riwayat poin siswa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddModal(undefined, 'Pelanggaran')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Poin Pertama</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* MOBILE EXPANDABLE LIST TILE (ACCORDION CARD): SUB-TAB RIWAYAT (md:hidden) */}
              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {paginatedPointsHistory.map((item) => {
                  const isPrestasi = item.jenis === 'Prestasi' || item.poin > 0;
                  const studentBal =
                    studentBalanceMap.get(String(item.student_id).toLowerCase())?.total ?? item.poin;
                  const displayStudentName =
                    item.students?.nama || item.student_name || 'Siswa';
                  const displayStudentNis =
                    item.students?.nis || item.students?.nisn || item.student_nisn || '-';
                  const rawKelas = String(item.student_kelas || 'Umum').trim();
                  const formattedClassLabel = /^kelas\s+/i.test(rawKelas)
                    ? rawKelas
                    : `Kelas ${rawKelas}`;
                  const formattedDate = new Date(item.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isExpanded = expandedPointId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-all duration-300 ${
                        isExpanded
                          ? 'border-cyan-200 bg-white shadow-md'
                          : 'border-slate-200/90 bg-white/80 backdrop-blur-md shadow-2xs hover:bg-white'
                      }`}
                    >
                      {/* Header (Kondisi Ringkas / Collapsed) - Eyebrow Layout Clickable Hit-Area */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPointId((prev) => (prev === item.id ? null : item.id))
                        }
                        className="w-full p-3.5 flex items-start justify-between gap-2.5 text-left select-none"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Baris 1: Eyebrow (Badge Status Poin: Prestasi / Pelanggaran) */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border leading-tight whitespace-nowrap ${
                                isPrestasi
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {isPrestasi ? (
                                <Award className="w-3 h-3 text-emerald-600 shrink-0" />
                              ) : (
                                <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                              )}
                              <span>{item.jenis}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono truncate">
                              NIS: {displayStudentNis}
                            </span>
                          </div>

                          {/* Baris 2: Data Utama (Nama Siswa) */}
                          <div className="w-full font-bold text-slate-800 text-[13px] sm:text-sm leading-snug line-clamp-2">
                            {displayStudentName}
                          </div>

                          {/* Baris 3: Info Sekunder Sejajar (Badge Kelas & Bobot Poin) */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] leading-tight whitespace-nowrap">
                              {formattedClassLabel}
                            </span>
                            <span
                              className={`font-mono font-bold text-[11px] whitespace-nowrap ${
                                isPrestasi ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {item.poin > 0 ? `+${item.poin}` : item.poin} Poin
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0 pt-1">
                          <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                              isExpanded ? 'rotate-180 text-cyan-600' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Body (Kondisi Terbuka / Expanded) */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 space-y-2.5">
                          {/* Keterangan Detail Kegiatan */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Keterangan Detail Kegiatan
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed break-words font-medium">
                              {item.keterangan}
                            </p>
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 text-[11px]">Akumulasi Poin:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    studentBal > 0
                                      ? 'text-emerald-700'
                                      : studentBal < 0
                                      ? 'text-rose-700'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  {studentBal > 0 ? `+${studentBal}` : studentBal} Poin
                                </span>
                              </div>
                              {item.pencatat && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  Oleh: <span className="font-semibold text-slate-700">{item.pencatat}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Waktu Pencatatan */}
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 bg-slate-50/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
                            <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            <span>Dicatat: {formattedDate}</span>
                          </div>

                          {/* Tombol Aksi: Edit & Hapus */}
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="flex-1 py-2 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition active:scale-95"
                              title="Edit Catatan Poin"
                            >
                              <Pencil className="w-3.5 h-3.5 text-cyan-600" />
                              <span>Edit Catatan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePoint(item)}
                              className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition active:scale-95"
                              title="Hapus Catatan Poin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW: SUB-TAB RIWAYAT (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50/60">
                      <th className="py-3 px-3.5 rounded-tl-xl">Waktu</th>
                      <th className="py-3 px-3.5">Nama Siswa &amp; Kelas</th>
                      <th className="py-3 px-3.5">Jenis Tindakan</th>
                      <th className="py-3 px-3.5">Keterangan / Deskripsi</th>
                      <th className="py-3 px-3.5 text-right">Bobot Poin</th>
                      <th className="py-3 px-3.5 text-right">Akumulasi Poin</th>
                      <th className="py-3 px-3.5">Pencatat</th>
                      <th className="py-3 px-3.5 text-right rounded-tr-xl">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {paginatedPointsHistory.map((item) => {
                      const isPrestasi = item.jenis === 'Prestasi' || item.poin > 0;
                      const studentBal =
                        studentBalanceMap.get(String(item.student_id).toLowerCase())?.total ??
                        item.poin;
                      const displayStudentName =
                        item.students?.nama || item.student_name || 'Siswa';
                      const displayStudentNis =
                        item.students?.nis || item.students?.nisn || item.student_nisn || '-';
                      const formattedDate = new Date(item.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-3.5 font-mono text-[11px] text-gray-500 whitespace-nowrap tabular-nums">
                            {formattedDate}
                          </td>
                          <td className="py-3.5 px-3.5">
                            <div className="font-bold text-gray-900">{displayStudentName}</div>
                            <div className="text-[11px] text-gray-500">
                              Kelas {item.student_kelas || 'Umum'} · NIS: {displayStudentNis}
                            </div>
                          </td>
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                isPrestasi ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isPrestasi ? (
                                <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              )}
                              <span>{item.jenis}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 text-gray-700 max-w-md leading-relaxed">
                            {item.keterangan}
                          </td>
                          <td className="py-3.5 px-3.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                            <span className={isPrestasi ? 'text-emerald-600' : 'text-rose-600'}>
                              {item.poin > 0 ? `+${item.poin}` : item.poin}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                            <span
                              className={
                                studentBal > 0
                                  ? 'text-emerald-700'
                                  : studentBal < 0
                                  ? 'text-rose-700'
                                  : 'text-gray-700'
                              }
                            >
                              {studentBal > 0 ? `+${studentBal}` : studentBal} Poin
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 text-gray-600 whitespace-nowrap">
                            {item.pencatat}
                          </td>
                          <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                title="Edit Catatan Poin"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-700 hover:bg-cyan-50 transition"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePoint(item)}
                                title="Hapus Catatan Poin"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINASI SUB-TAB RIWAYAT (10 item per halaman) */}
              {totalHistoryItems > itemsPerPage && (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="text-[11px] text-slate-500 font-medium">
                    Menampilkan{' '}
                    <span className="font-bold text-slate-800 font-mono">
                      {historyStartIndex + 1}–{historyEndIndex}
                    </span>{' '}
                    dari <span className="font-bold text-slate-800 font-mono">{totalHistoryItems}</span>{' '}
                    catatan{' '}
                    <span className="text-slate-400 font-mono">
                      (Hal {safeHistoryPage} dari {totalHistoryPages})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeHistoryPage <= 1}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                    >
                      &lt; Sebelumnya
                    </button>
                    <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold whitespace-nowrap">
                      Hal {safeHistoryPage} dari {totalHistoryPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                      disabled={safeHistoryPage >= totalHistoryPages}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                    >
                      Berikutnya &gt;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : activeSubView === 'balance' ? (
          /* SUB-VIEW 2: REKAP AKUMULASI POIN PER SISWA (MOBILE CARDS + DESKTOP TABLE) */
          <div className="space-y-4">
            {/* MOBILE CARD VIEW: SUB-TAB REKAP SISWA (md:hidden) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {paginatedStudentBalances.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-slate-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  Tidak ada data rekap siswa yang cocok dengan filter saat ini.
                </div>
              ) : (
                paginatedStudentBalances.map(({ student, plus, minus, total, count }) => {
                  const rawKelas = String(student.kelas || 'Umum').trim();
                  const formattedClassLabel = /^kelas\s+/i.test(rawKelas)
                    ? rawKelas
                    : `Kelas ${rawKelas}`;

                  return (
                    <div
                      key={student.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3"
                    >
                      {/* Header Kartu: Nama Siswa & Kelas di Kiri, Badge Total Akumulasi Poin Akhir di Kanan */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 text-base leading-snug truncate">
                            {student.nama}
                          </div>
                          <div className="flex items-center flex-wrap gap-1.5 mt-1 text-xs text-slate-500">
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-xs font-semibold">
                              {formattedClassLabel}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono text-[11px]">
                              NISN: {student.nisn || '-'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px]">{count} catatan</span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border whitespace-nowrap shrink-0 ${
                            total > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : total < 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {total > 0 ? `+${total}` : total} Poin
                        </span>
                      </div>

                      {/* Bagian Tengah: Grid Ringkasan Poin Prestasi (+), Pelanggaran (-), & Akumulasi Poin Akhir */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-center">
                          <div className="text-[10px] font-semibold text-emerald-700">
                            Prestasi (+)
                          </div>
                          <div className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
                            +{plus}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80 text-center">
                          <div className="text-[10px] font-semibold text-rose-700">
                            Pelanggaran (-)
                          </div>
                          <div className="text-sm font-bold font-mono text-rose-600 mt-0.5">
                            {minus}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <div className="text-[10px] font-semibold text-slate-600">
                            Akumulasi Akhir
                          </div>
                          <div
                            className={`text-sm font-bold font-mono mt-0.5 ${
                              total > 0
                                ? 'text-emerald-700'
                                : total < 0
                                ? 'text-rose-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {total > 0 ? `+${total}` : total}
                          </div>
                        </div>
                      </div>

                      {/* Bagian Bawah: Tombol Aksi Cepat */}
                      <div className="border-t border-slate-100 pt-2.5 grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(student, 'Pelanggaran')}
                          className="px-2 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] text-center transition whitespace-nowrap"
                        >
                          - Pelanggaran
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(student, 'Prestasi')}
                          className="px-2 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] text-center transition whitespace-nowrap"
                        >
                          + Prestasi
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReportScope('student');
                            setReportSelectedStudentId(student.id);
                            setReportStudentSearch(
                              `${student.nama} (${student.nisn || student.uid_kartu || '-'})`
                            );
                            setIsReportModalOpen(true);
                          }}
                          className="px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-[11px] inline-flex items-center justify-center gap-1 transition whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span>Rapor</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW: SUB-TAB REKAP SISWA (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50/60">
                    <th className="py-3 px-3.5 rounded-tl-xl">Nama Siswa</th>
                    <th className="py-3 px-3.5">Kelas</th>
                    <th className="py-3 px-3.5">NISN / UID Kartu</th>
                    <th className="py-3 px-3.5 text-right">Total Prestasi (+)</th>
                    <th className="py-3 px-3.5 text-right">Total Pelanggaran (-)</th>
                    <th className="py-3 px-3.5 text-right">Total Akumulasi Poin</th>
                    <th className="py-3 px-3.5 text-right rounded-tr-xl">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {paginatedStudentBalances.map(({ student, plus, minus, total, count }) => (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-gray-900">{student.nama}</div>
                        <div className="text-[11px] text-gray-400">{count} catatan tercatat</div>
                      </td>
                      <td className="py-3.5 px-3.5 font-semibold text-gray-700">
                        {student.kelas || 'Umum'}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[11px] text-gray-500 tabular-nums">
                        {student.nisn || '-'} · {student.uid_kartu || '-'}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold text-emerald-600 tabular-nums">
                        +{plus}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold text-rose-600 tabular-nums">
                        {minus}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold tabular-nums">
                        <span
                          className={
                            total > 0
                              ? 'text-emerald-700'
                              : total < 0
                              ? 'text-rose-700'
                              : 'text-gray-600'
                          }
                        >
                          {total > 0 ? `+${total}` : total} Poin
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(student, 'Pelanggaran')}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition"
                          >
                            - Pelanggaran
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(student, 'Prestasi')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] transition"
                          >
                            + Prestasi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReportScope('student');
                              setReportSelectedStudentId(student.id);
                              setReportStudentSearch(
                                `${student.nama} (${student.nisn || student.uid_kartu || '-'})`
                              );
                              setIsReportModalOpen(true);
                            }}
                            title="Cetak Rapor / Rekam Jejak Kedisiplinan Siswa Ini"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <Printer className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Rapor</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINASI SUB-TAB REKAP SISWA (10 item per halaman) */}
            {totalBalanceItems > itemsPerPage && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-[11px] text-slate-500 font-medium">
                  Menampilkan{' '}
                  <span className="font-bold text-slate-800 font-mono">
                    {balanceStartIndex + 1}–{balanceEndIndex}
                  </span>{' '}
                  dari <span className="font-bold text-slate-800 font-mono">{totalBalanceItems}</span>{' '}
                  siswa{' '}
                  <span className="text-slate-400 font-mono">
                    (Hal {safeBalancePage} dari {totalBalancePages})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setBalancePage((prev) => Math.max(1, prev - 1))}
                    disabled={safeBalancePage <= 1}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                  >
                    &lt; Sebelumnya
                  </button>
                  <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold whitespace-nowrap">
                    Hal {safeBalancePage} dari {totalBalancePages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBalancePage((prev) => Math.min(totalBalancePages, prev + 1))}
                    disabled={safeBalancePage >= totalBalancePages}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                  >
                    Berikutnya &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeSubView === 'analytics' ? (
          /* SUB-VIEW 3: ANALITIK & GRAFIK BULANAN (RECHARTS + TOP 3 INSIGHT SISWA) */
          <div className="space-y-5">
            {/* Sub-header Analitik & Pilihan Rentang Bulan */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Ringkasan Poin Bulanan (Prestasi vs Pelanggaran)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Perbandingan nilai absolut poin bulanan untuk{' '}
                    <span className="font-semibold text-gray-800">
                      {selectedRombelFilter === 'ALL'
                        ? 'Semua Kelas (Rombel)'
                        : `Kelas ${selectedRombelFilter}`}
                    </span>{' '}
                    · Sumbu Y menampilkan nilai positif agar tinggi batang mudah dibandingkan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-gray-200 p-1 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAnalyticsMonthsRange(6)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    analyticsMonthsRange === 6
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  6 Bulan Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsMonthsRange(12)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    analyticsMonthsRange === 12
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  12 Bulan (1 Tahun)
                </button>
              </div>
            </div>

            {/* Grid 2 Kolom Desktop: Grafik Recharts (Kiri) & Kartu Insight Top 3 (Kanan) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* KOLOM KIRI: VISUALISASI RECHARTS BARCHART */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Grafik Tren Bulanan ({analyticsMonthsRange} Bulan)
                    </h4>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block" />
                      +{analyticsTopInsights.periodTotals.prestasi} Poin (
                      {analyticsTopInsights.periodTotals.countPrestasi}x)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-rose-700">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#f43f5e] inline-block" />
                      -{analyticsTopInsights.periodTotals.pelanggaran} Poin (
                      {analyticsTopInsights.periodTotals.countPelanggaran}x)
                    </span>
                  </div>
                </div>

                <div className="w-full h-80 sm:h-88 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyAnalyticsData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
                      barGap={6}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#e2e8f0',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
                        }}
                        formatter={(value: any, name: any, props: any) => {
                          const num = Number(value) || 0;
                          const payload = props?.payload;
                          if (String(name).includes('Prestasi')) {
                            return [
                              `+${num} Poin (${payload?.countPrestasi || 0} catatan)`,
                              'Total Poin Prestasi (+)',
                            ];
                          }
                          return [
                            `-${num} Poin [Absolut: ${num}] (${payload?.countPelanggaran || 0} catatan)`,
                            'Total Poin Pelanggaran (-)',
                          ];
                        }}
                        labelFormatter={(label: any, payload: any) => {
                          const full = payload?.[0]?.payload?.fullMonthLabel || label;
                          return `Periode: ${full}`;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }}
                      />
                      <Bar
                        dataKey="prestasi"
                        name="Total Poin Prestasi (+)"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                      <Bar
                        dataKey="pelanggaran"
                        name="Total Poin Pelanggaran (-)"
                        fill="#f43f5e"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Baris Ringkasan Bawah Grafik */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
                    <span className="text-[11px] font-semibold text-emerald-800 block">
                      Total Prestasi Periode Ini
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                      +{analyticsTopInsights.periodTotals.prestasi} Poin
                    </span>
                  </div>
                  <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3">
                    <span className="text-[11px] font-semibold text-rose-800 block">
                      Total Pelanggaran (Nilai Absolut)
                    </span>
                    <span className="text-lg font-bold font-mono text-rose-700 tabular-nums">
                      {analyticsTopInsights.periodTotals.pelanggaran} Poin (
                      -{analyticsTopInsights.periodTotals.pelanggaran})
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[11px] font-semibold text-slate-600 block">
                      Selisih Akumulasi Bersih
                    </span>
                    <span
                      className={`text-lg font-bold font-mono tabular-nums ${
                        analyticsTopInsights.periodTotals.prestasi -
                          analyticsTopInsights.periodTotals.pelanggaran >=
                        0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {analyticsTopInsights.periodTotals.prestasi -
                        analyticsTopInsights.periodTotals.pelanggaran >
                      0
                        ? `+${
                            analyticsTopInsights.periodTotals.prestasi -
                            analyticsTopInsights.periodTotals.pelanggaran
                          }`
                        : analyticsTopInsights.periodTotals.prestasi -
                          analyticsTopInsights.periodTotals.pelanggaran}{' '}
                      Poin
                    </span>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN: KARTU INSIGHT PENDAMPING GRAFIK (TOP 3 PRESTASI & TOP 3 PEMBINAAN) */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                {/* KARTU 1: TOP 3 SISWA POIN PRESTASI TERTINGGI */}
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">
                          Top 3 Siswa Poin Prestasi Tertinggi
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {selectedRombelFilter === 'ALL'
                            ? 'Semua Kelas'
                            : `Kelas ${selectedRombelFilter}`}{' '}
                          · {analyticsMonthsRange} bulan terakhir
                        </p>
                      </div>
                    </div>
                  </div>

                  {analyticsTopInsights.topPrestasi.length === 0 ? (
                    <div className="py-6 px-3 text-center bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200 text-xs text-gray-500">
                      Belum ada catatan poin prestasi pada periode/kelas ini.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {analyticsTopInsights.topPrestasi.map((item, idx) => (
                        <div
                          key={item.studentId}
                          className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-100 hover:bg-emerald-50/80 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                                idx === 0
                                  ? 'bg-emerald-600 text-white'
                                  : idx === 1
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 truncate">
                                {item.nama}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate">
                                Kelas {item.kelas} · {item.countPrestasi} prestasi
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-emerald-700 block tabular-nums">
                                +{item.plus} Poin
                              </span>
                              <span className="text-[10px] font-mono text-gray-500 block tabular-nums">
                                Akumulasi: {item.total > 0 ? `+${item.total}` : item.total}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setReportScope('student');
                                setReportSelectedStudentId(item.studentId);
                                setReportStudentSearch(`${item.nama} (${item.nisn})`);
                                setIsReportModalOpen(true);
                              }}
                              title="Cetak Rapor / Rekam Jejak Siswa Ini"
                              className="p-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* KARTU 2: TOP 3 SISWA YANG MEMBUTUHKAN PEMBINAAN KHUSUS */}
                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-rose-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">
                          Top 3 Siswa Membutuhkan Pembinaan Khusus
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Berdasarkan total poin pelanggaran terbanyak
                        </p>
                      </div>
                    </div>
                  </div>

                  {analyticsTopInsights.topPembinaan.length === 0 ? (
                    <div className="py-6 px-3 text-center bg-rose-50/40 rounded-xl border border-dashed border-rose-200 text-xs text-gray-500">
                      Tidak ada siswa dengan catatan pelanggaran pada periode/kelas ini.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {analyticsTopInsights.topPembinaan.map((item, idx) => (
                        <div
                          key={item.studentId}
                          className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-rose-50/40 border border-rose-100 hover:bg-rose-50/80 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                                idx === 0
                                  ? 'bg-rose-600 text-white'
                                  : idx === 1
                                  ? 'bg-rose-200 text-rose-900'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 truncate">
                                {item.nama}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate">
                                Kelas {item.kelas} · {item.countPelanggaran} pelanggaran
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-rose-700 block tabular-nums">
                                {item.minus} Poin
                              </span>
                              <span className="text-[10px] font-mono text-gray-500 block tabular-nums">
                                Akumulasi: {item.total > 0 ? `+${item.total}` : item.total}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setReportScope('student');
                                setReportSelectedStudentId(item.studentId);
                                setReportStudentSearch(`${item.nama} (${item.nisn})`);
                                setIsReportModalOpen(true);
                              }}
                              title="Cetak Lembar Profil & Pembinaan Siswa Ini"
                              className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SUB-VIEW 4: ATURAN & OTOMATISASI POIN (3 KARTU KONFIGURASI MANDIRI) */
          <div className="space-y-6">
            {/* Banner Mode Lihat / Hak Akses */}
            {!isSuperAdmin && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-2xs">
                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>🔒 Mode Lihat (Read-Only)</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono text-[10px] font-bold">
                      Khusus Super Admin
                    </span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Pengaturan aturan poin, bobot pengurangan presensi otomatis, dan ambang batas SP dikunci untuk role Admin/Operator. Perubahan konfigurasi global ini hanya dapat disimpan oleh Master Owner / Super Admin.
                  </p>
                </div>
              </div>
            )}

            {/* Sub-Header Judul Aturan Poin & Status Access */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Pengaturan Aturan Poin &amp; Otomatisasi Kedisiplinan
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Kelola skor kredit awal, otomatisasi presensi, dan ambang batas Surat Peringatan (SP).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 ${
                    isSuperAdmin
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {isSuperAdmin ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Hak Akses Penuh (Super Admin)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Mode Read-Only</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePointRules} className="space-y-6">
              {/* KARTU 1: SKOR KREDIT AWAL SISWA */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">
                      1. Skor Kredit Awal Siswa
                    </h4>
                    <p className="text-xs text-slate-500">
                      Poin dasar yang diterima setiap siswa pada awal tahun ajaran baru.
                    </p>
                  </div>
                </div>

                <div className="max-w-md space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Poin Kredit Dasar Awal (Tahun Ajaran Baru)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={pointRulesState.initialCreditPoints}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          initialCreditPoints: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3.5 text-xs font-bold text-slate-400 pointer-events-none">
                      Poin
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Setiap siswa akan mengawali catatan dengan nilai poin ini sebelum ditambah poin prestasi (+) atau dikurangi poin pelanggaran (-).
                  </p>
                </div>
              </div>

              {/* KARTU 2: OTOMATISASI INTEGRASI PRESENSI */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        2. Otomatisasi Integrasi Presensi (QR / RFID)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Pengurangan poin otomatis dari hasil scan presensi harian siswa.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch Integration */}
                  <label className="inline-flex items-center gap-3 cursor-pointer self-start sm:self-center">
                    <span className="text-xs font-bold text-slate-700">
                      {pointRulesState.enableAutoDeduction ? 'Otomatisasi Aktif' : 'Otomatisasi Nonaktif'}
                    </span>
                    <input
                      type="checkbox"
                      disabled={!isSuperAdmin}
                      checked={pointRulesState.enableAutoDeduction}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          enableAutoDeduction: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 relative disabled:opacity-50" />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Field Pengurangan Terlambat */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Bobot Pengurangan Status "Terlambat"</span>
                      </label>
                      <span className="text-[10px] font-bold font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        Poin Minus (-)
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        disabled={!isSuperAdmin || !pointRulesState.enableAutoDeduction}
                        value={pointRulesState.lateDeductionPoints}
                        onChange={(e) =>
                          setPointRulesState((prev) => ({
                            ...prev,
                            lateDeductionPoints: Math.max(0, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                        className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3.5 text-xs font-bold text-amber-600 pointer-events-none">
                        Poin / Kejadian
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Otomatis mengurangi <strong className="font-mono">-{pointRulesState.lateDeductionPoints} poin</strong> saat presensi QR tercatat Terlambat.
                    </p>
                  </div>

                  {/* Field Pengurangan Alpa */}
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Bobot Pengurangan Status "Alpa"</span>
                      </label>
                      <span className="text-[10px] font-bold font-mono text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                        Poin Minus (-)
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        disabled={!isSuperAdmin || !pointRulesState.enableAutoDeduction}
                        value={pointRulesState.alpaDeductionPoints}
                        onChange={(e) =>
                          setPointRulesState((prev) => ({
                            ...prev,
                            alpaDeductionPoints: Math.max(0, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                        className="w-full bg-white border border-rose-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3.5 text-xs font-bold text-rose-600 pointer-events-none">
                        Poin / Hari
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Otomatis mengurangi <strong className="font-mono">-{pointRulesState.alpaDeductionPoints} poin</strong> saat siswa tidak hadir tanpa keterangan (Alpa).
                    </p>
                  </div>
                </div>
              </div>

              {/* KARTU 3: AMBANG BATAS PERINGATAN (THRESHOLD SP) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        3. Ambang Batas Peringatan &amp; SP (Threshold Poin)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Pengaturan batas skor poin untuk penetapan status kedisiplinan dan Surat Peringatan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {/* Status Aman */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                    <div className="flex items-center">
                      <span className="text-xs sm:text-sm font-bold text-emerald-800 flex items-center gap-1.5 leading-snug">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Status Aman</span>
                      </span>
                    </div>
                    <label className="text-[11px] text-slate-600 block">Min. Skor Poin:</label>
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={pointRulesState.thresholds.amanMin}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            amanMin: parseInt(e.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                    />
                    <p className="text-[10px] text-emerald-700">Skor ≥ {pointRulesState.thresholds.amanMin} poin</p>
                  </div>

                  {/* Peringatan Lisan */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-yellow-50/70 border border-yellow-200 space-y-1.5">
                    <div className="flex items-center">
                      <span className="text-xs sm:text-sm font-bold text-yellow-800 flex items-center gap-1.5 leading-snug">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                        <span>Peringatan Lisan</span>
                      </span>
                    </div>
                    <label className="text-[11px] text-slate-600 block">Min. Skor Poin:</label>
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={pointRulesState.thresholds.peringatanLisanMin}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            peringatanLisanMin: parseInt(e.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-full bg-white border border-yellow-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-yellow-500 disabled:opacity-60"
                    />
                    <p className="text-[10px] text-yellow-800">
                      Skor {pointRulesState.thresholds.peringatanLisanMin} – {pointRulesState.thresholds.amanMin - 1} poin
                    </p>
                  </div>

                  {/* SP 1 */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                    <div className="flex items-center">
                      <span className="text-xs sm:text-sm font-bold text-amber-800 flex items-center gap-1.5 leading-snug">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>SP 1 (Surat Peringatan)</span>
                      </span>
                    </div>
                    <label className="text-[11px] text-slate-600 block">Min. Skor Poin:</label>
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={pointRulesState.thresholds.sp1Min}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            sp1Min: parseInt(e.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    />
                    <p className="text-[10px] text-amber-800">
                      Skor {pointRulesState.thresholds.sp1Min} – {pointRulesState.thresholds.peringatanLisanMin - 1} poin
                    </p>
                  </div>

                  {/* SP 2 */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-1.5">
                    <div className="flex items-center">
                      <span className="text-xs sm:text-sm font-bold text-orange-800 flex items-center gap-1.5 leading-snug">
                        <ShieldAlert className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span>SP 2 (Surat Peringatan)</span>
                      </span>
                    </div>
                    <label className="text-[11px] text-slate-600 block">Min. Skor Poin:</label>
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={pointRulesState.thresholds.sp2Min}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            sp2Min: parseInt(e.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-full bg-white border border-orange-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                    />
                    <p className="text-[10px] text-orange-800">
                      Skor {pointRulesState.thresholds.sp2Min} – {pointRulesState.thresholds.sp1Min - 1} poin
                    </p>
                  </div>

                  {/* SP 3 / Panggilan Ortu */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                    <div className="flex items-center">
                      <span className="text-xs sm:text-sm font-bold text-rose-900 flex items-center gap-1.5 leading-snug">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>SP 3 / Panggilan Ortu</span>
                      </span>
                    </div>
                    <label className="text-[11px] text-slate-600 block">Min. Skor Poin:</label>
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={pointRulesState.thresholds.sp3Min}
                      onChange={(e) =>
                        setPointRulesState((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            sp3Min: parseInt(e.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500 disabled:opacity-60"
                    />
                    <p className="text-[10px] text-rose-800">
                      Skor &lt; {pointRulesState.thresholds.sp2Min} poin
                    </p>
                  </div>
                </div>
              </div>

              {/* Tombol Simpan Mandiri Aturan Poin */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <div className="text-xs text-slate-500">
                  {isSuperAdmin
                    ? 'Perubahan aturan poin akan tersimpan secara otomatis dan berlaku langsung untuk seluruh sistem.'
                    : '🔒 Perubahan aturan dikunci untuk role Admin biasa. Silakan login sebagai Super Admin / Master Owner.'}
                </div>

                <button
                  type="submit"
                  disabled={!isSuperAdmin || isSavingRules}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[var(--primary-accent)] hover:opacity-95 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingRules ? 'Menyimpan...' : 'Simpan Aturan Poin'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
        </>
      ) : isAddModalOpen ? (
        /* =====================================================================
           HALAMAN KHUSUS (FULL VIEW): CATAT PELANGGARAN / PRESTASI SISWA
           ===================================================================== */
        <div className="space-y-6">
          {/* Baris Navigasi Atas & Tombol Kembali */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-bold text-xs sm:text-sm shadow-2xs transition active:scale-95 self-start"
            >
              <span>← Kembali ke Manajemen Poin</span>
            </button>

            <div className="text-xs text-slate-500 font-medium">
              Mode Halaman Penuh · Formulir Pencatatan Poin Kedisiplinan &amp; Prestasi Siswa
            </div>
          </div>

          {/* Kartu Utama Formulir Catat Pelanggaran / Prestasi Siswa */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 space-y-6 shadow-xs">
            {/* Header Formulir */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0 transition-colors ${
                    formJenis === 'Pelanggaran' ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                >
                  {formJenis === 'Pelanggaran' ? (
                    <ShieldAlert className="w-6 h-6" />
                  ) : (
                    <Award className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                    Catat Pelanggaran / Prestasi Siswa
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Tersimpan ke tabel <code className="font-mono text-slate-700">student_points</code> &amp; langsung tampil real-time di Portal Wali Murid
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border self-start sm:self-center shrink-0 ${
                  formJenis === 'Pelanggaran'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                {formJenis === 'Pelanggaran' ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Mode Pembinaan Pelanggaran (-)</span>
                  </>
                ) : (
                  <>
                    <Award className="w-3.5 h-3.5" />
                    <span>Mode Penghargaan Prestasi (+)</span>
                  </>
                )}
              </span>
            </div>

            <form onSubmit={handleSubmitPoint} className="space-y-6 text-xs sm:text-sm">
              {/* 1. PILIH SISWA (Nama, NIS/NISN, atau Scan Kartu RFID/QR) */}
              <div className="space-y-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-6">
                <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                  <Users className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>1. Pilih Siswa (Cari Nama / NISN atau Scan Kartu RFID/QR) *</span>
                </label>

                {/* Wrapper Input Pencarian + Dropdown Hasil Melayang */}
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={studentSearchInput}
                      onChange={(e) => {
                        setStudentSearchInput(e.target.value);
                        if (selectedStudentId) setSelectedStudentId('');
                      }}
                      onKeyDown={handleStudentSearchKeyDown}
                      placeholder="Ketik Nama, NISN, atau Tap Kartu USB RFID..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-32 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                    />
                    {studentSearchInput && !selectedStudentObj && (
                      <button
                        type="button"
                        onClick={() => {
                          setStudentSearchInput('');
                          setSelectedStudentId('');
                        }}
                        title="Bersihkan pencarian"
                        className="absolute right-24 p-1 rounded-md text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      title="Scan QR Code / Barcode Kartu Siswa"
                      className="absolute right-2 px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span>Scan QR</span>
                    </button>
                  </div>

                  {/* Dropdown Hasil Pencarian Melayang (Hanya muncul saat operator mengetik & belum memilih siswa) */}
                  {!selectedStudentObj && studentSearchInput.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-30 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-xl">
                      {filteredStudentsForModal.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          Siswa dengan kata kunci &ldquo;{studentSearchInput}&rdquo; tidak ditemukan. Coba nama/NISN lain atau scan kartu.
                        </div>
                      ) : (
                        filteredStudentsForModal.map((s) => {
                          const bal =
                            studentBalanceMap.get(String(s.id).toLowerCase())?.total ?? 0;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setStudentSearchInput(
                                  `${s.nama} (${s.nisn || s.uid_kartu || '-'})`
                                );
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-cyan-50/80 flex items-center justify-between gap-3 transition"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                                  {s.nama}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono block truncate">
                                  Kelas {s.kelas || 'Umum'} · NISN: {s.nisn || '-'} · UID:{' '}
                                  {s.uid_kartu || '-'}
                                </span>
                              </div>
                              <span
                                className={`font-mono text-xs font-bold tabular-nums shrink-0 px-2.5 py-1 rounded-full border ${
                                  bal > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : bal < 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {bal > 0 ? `+${bal}` : bal} Poin
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Kartu Detail Siswa Terpilih (Hanya tampil setelah siswa dipilih) */}
                {selectedStudentObj && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-cyan-50/80 border border-cyan-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {selectedStudentObj.nama}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-600 font-mono truncate">
                          Kelas {selectedStudentObj.kelas || 'Umum'} · NISN:{' '}
                          {selectedStudentObj.nisn || '-'} · UID:{' '}
                          {selectedStudentObj.uid_kartu || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Akumulasi Saat Ini</span>
                        <span className="font-mono font-bold text-xs sm:text-sm tabular-nums text-slate-900">
                          {(() => {
                            const bal =
                              studentBalanceMap.get(String(selectedStudentObj.id).toLowerCase())
                                ?.total ?? 0;
                            return bal > 0 ? `+${bal} Poin` : `${bal} Poin`;
                          })()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentId('');
                          setStudentSearchInput('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-cyan-200 text-cyan-700 font-bold text-xs hover:bg-cyan-100 shrink-0 transition active:scale-95"
                      >
                        Ubah / Ganti Siswa
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. JENIS TINDAKAN (Toggle Pill: Pelanggaran [-] vs Prestasi [+]) */}
              <div className="space-y-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-6">
                <label className="text-slate-800 font-bold block text-xs sm:text-sm">
                  2. Jenis Tindakan Kedisiplinan / Prestasi *
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => handleSwitchJenis('Pelanggaran')}
                    className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                      formJenis === 'Pelanggaran'
                        ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-600'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="truncate">Pelanggaran (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchJenis('Prestasi')}
                    className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                      formJenis === 'Prestasi'
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <Award className="w-4 h-4 shrink-0" />
                    <span className="truncate">Prestasi (+)</span>
                  </button>
                </div>
              </div>

              {/* 3. KETERANGAN / DESKRIPSI MANUAL */}
              <div className="space-y-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-6">
                <label className="text-slate-800 font-bold block text-xs sm:text-sm">
                  3. Keterangan / Deskripsi Kejadian (Manual) *
                </label>

                {/* Dropdown Pilihan Cepat Deskripsi (Auto-Fill Deskripsi & Bobot Poin) */}
                <div>
                  <select
                    aria-label="Pilih cepat deskripsi kejadian"
                    value={
                      PRESET_DESCRIPTIONS[formJenis].some((p) => p.label === formKeterangan)
                        ? formKeterangan
                        : ''
                    }
                    onChange={(e) => {
                      const selectedLabel = e.target.value;
                      if (!selectedLabel) return;
                      const matched = PRESET_DESCRIPTIONS[formJenis].find(
                        (p) => p.label === selectedLabel
                      );
                      if (matched) {
                        setFormKeterangan(matched.label);
                        setFormPoin(String(matched.poin));
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:border-cyan-500 shadow-2xs transition"
                  >
                    <option value="">
                      ⚡ Pilih cepat deskripsi (otomatis isi bobot poin)...
                    </option>
                    {PRESET_DESCRIPTIONS[formJenis].map((preset, idx) => (
                      <option key={idx} value={preset.label}>
                        {preset.label} ({preset.poin > 0 ? `+${preset.poin}` : preset.poin})
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder={
                    formJenis === 'Pelanggaran'
                      ? 'Contoh: Terlambat upacara karena ban motor bocor'
                      : 'Contoh: Menemukan dompet tertinggal dan mengembalikannya'
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                  required
                />
              </div>

              {/* 4. JUMLAH BOBOT POIN & PENCATAT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <label className="text-slate-800 font-bold block text-xs sm:text-sm">
                    4. Jumlah Bobot Poin ({formJenis === 'Pelanggaran' ? 'Minus' : 'Plus'}) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formPoin}
                    onChange={(e) => setFormPoin(e.target.value)}
                    placeholder={formJenis === 'Pelanggaran' ? '-10' : '25'}
                    className={`w-full bg-white border rounded-xl px-3.5 py-3 text-xs sm:text-sm font-mono font-bold tabular-nums focus:outline-none shadow-2xs ${
                      formJenis === 'Pelanggaran'
                        ? 'border-rose-200 text-rose-700 focus:border-rose-500'
                        : 'border-emerald-200 text-emerald-700 focus:border-emerald-500'
                    }`}
                    required
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 font-semibold">Bobot cepat:</span>
                    {(formJenis === 'Pelanggaran' ? [-5, -10, -25, -50] : [10, 25, 50, 100]).map(
                      (val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormPoin(String(val))}
                          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold tabular-nums border transition ${
                            String(val) === String(formPoin)
                              ? val > 0
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {val > 0 ? `+${val}` : val} Poin
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <label className="text-slate-800 font-bold block text-xs sm:text-sm">
                    5. Guru / Admin Pencatat *
                  </label>
                  <input
                    type="text"
                    value={formPencatat}
                    onChange={(e) => setFormPencatat(e.target.value)}
                    placeholder="Nama Guru / Admin Piket"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Nama petugas atau guru piket yang bertanggung jawab mencatat tindakan ini.
                  </p>
                </div>
              </div>

              {/* Bagian Bawah: Tombol Aksi Konfirmasi (Aman dari Navigasi Bawah) */}
              <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition active:scale-95 text-center"
                >
                  ← Kembali ke Manajemen Poin
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto px-6 py-3.5 rounded-xl text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 ${
                    formJenis === 'Pelanggaran'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {formJenis === 'Pelanggaran' ? (
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                  ) : (
                    <Award className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Menyimpan Catatan...'
                      : `Simpan Catatan Poin (${formJenis})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* =====================================================================
           HALAMAN KHUSUS (FULL VIEW): PUSAT CETAK & UNDUH LAPORAN KEDISIPLINAN
           ===================================================================== */
        <div className="space-y-6">
          {/* Baris Navigasi Atas & Tombol Kembali */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-bold text-xs sm:text-sm shadow-2xs transition active:scale-95 self-start"
            >
              <span>← Kembali ke Manajemen Poin</span>
            </button>

            <div className="text-xs text-slate-500 font-medium">
              Mode Halaman Penuh · Konfigurasi Cetak &amp; Unduh Dokumen Resmi A4
            </div>
          </div>

          {/* Kartu Utama Formulir Pusat Cetak & Unduh Laporan */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 space-y-6 shadow-xs">
            {/* Header Halaman Pusat Cetak */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-cyan-400 flex items-center justify-center shadow-sm shrink-0">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                    Pusat Cetak &amp; Unduh Laporan Kedisiplinan Resmi
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Konfigurasi filter rentang tanggal, kelas (rombel), dan jenis laporan untuk Bidang Kesiswaan &amp; Guru BK
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold self-start sm:self-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-cyan-600" />
                <span>Standar Kertas A4 &amp; Excel</span>
              </span>
            </div>

            <div className="space-y-6 text-xs sm:text-sm">
              {/* 0. PILIHAN CAKUPAN LAPORAN (REKAP PER KELAS VS REKAP PER SISWA) */}
              <div className="space-y-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-6">
                <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                  <Users className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>Cakupan Laporan (Mode Cetak) *</span>
                </label>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setReportScope('rombel')}
                    className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                      reportScope === 'rombel'
                        ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Building2
                      className={`w-4 h-4 shrink-0 ${
                        reportScope === 'rombel' ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="md:hidden">Per Kelas</span>
                    <span className="hidden md:inline">Cetak Rekap Kelas (Rombel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReportScope('student');
                    }}
                    className={`py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                      reportScope === 'student'
                        ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck
                      className={`w-4 h-4 shrink-0 ${
                        reportScope === 'student' ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="md:hidden">Per Siswa</span>
                    <span className="hidden md:inline">Cetak Detail Per Siswa (Individual)</span>
                  </button>
                </div>

                {/* FILTER PENCARIAN SISWA (JIKA MODE PER SISWA DIPILIH) */}
                {reportScope === 'student' && (
                  <div className="pt-2 space-y-3">
                    <label className="text-slate-700 font-bold block text-xs sm:text-sm">
                      Pilih Siswa Spesifik (Ketik Nama atau NIS / NISN) *
                    </label>
                    <div className="relative">
                      <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                        <input
                          type="text"
                          value={reportStudentSearch}
                          onChange={(e) => {
                            setReportStudentSearch(e.target.value);
                            if (reportSelectedStudentId) setReportSelectedStudentId('');
                          }}
                          placeholder="Ketik Nama Siswa atau NIS (cth: Muhammad Rizky Utama)..."
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                        />
                        {reportStudentSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setReportStudentSearch('');
                              setReportSelectedStudentId('');
                            }}
                            className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-700"
                            title="Bersihkan pencarian"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Hasil Pencarian Melayang (Hanya muncul saat mengetik & belum ada siswa terpilih) */}
                      {!reportSelectedStudentObj && reportStudentSearch.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-30 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-xl">
                          {filteredStudentsForReport.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs">
                              Siswa tidak ditemukan. Ketik nama atau NIS lain.
                            </div>
                          ) : (
                            filteredStudentsForReport.map((s) => {
                              const bal =
                                studentBalanceMap.get(String(s.id).toLowerCase())?.total ?? 0;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setReportSelectedStudentId(s.id);
                                    setReportStudentSearch(
                                      `${s.nama} (${s.nisn || s.uid_kartu || '-'})`
                                    );
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-cyan-50/80 flex items-center justify-between gap-2 transition"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                                      {s.nama}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      Kelas {s.kelas || 'Umum'} · NIS: {s.nisn || '-'} · UID:{' '}
                                      {s.uid_kartu || '-'}
                                    </span>
                                  </div>
                                  <span className="font-mono text-xs font-bold text-slate-600 tabular-nums shrink-0">
                                    {bal > 0 ? `+${bal}` : bal} Poin
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {reportSelectedStudentObj && (
                      <div className="p-3.5 sm:p-4 rounded-2xl bg-cyan-50/80 border border-cyan-200 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {reportSelectedStudentObj.nama}
                            </div>
                            <div className="text-[11px] sm:text-xs text-slate-600 font-mono truncate">
                              Kelas {reportSelectedStudentObj.kelas || 'Umum'} · NIS/NISN:{' '}
                              {reportSelectedStudentObj.nisn ||
                                reportSelectedStudentObj.nis ||
                                '-'}{' '}
                              · UID: {reportSelectedStudentObj.uid_kartu || '-'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReportSelectedStudentId('');
                            setReportStudentSearch('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-cyan-200 text-cyan-700 font-bold text-xs hover:bg-cyan-100 shrink-0 transition active:scale-95"
                        >
                          Ubah / Ganti Siswa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 1. PILIHAN RENTANG TANGGAL */}
              <div className="space-y-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                    <Calendar className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>1. Pilihan Rentang Tanggal Laporan</span>
                  </label>

                  {/* Tampilan Mobile (md:hidden): Dropdown <select> tunggal yang ringkas */}
                  <div className="w-full md:hidden">
                    <select
                      aria-label="Pilih Periode Laporan"
                      value={reportDatePreset}
                      onChange={(e) => {
                        const val = e.target.value as
                          | 'all'
                          | 'today'
                          | 'this_week'
                          | 'this_month';
                        if (
                          val === 'all' ||
                          val === 'today' ||
                          val === 'this_week' ||
                          val === 'this_month'
                        ) {
                          handleApplyDatePreset(val);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      <option value="" disabled>
                        Pilih Periode Laporan
                      </option>
                      <option value="all">Semua Periode</option>
                      <option value="today">Hari Ini</option>
                      <option value="this_week">Minggu Ini</option>
                      <option value="this_month">Bulan Ini</option>
                      {reportDatePreset === 'custom' && (
                        <option value="custom">Rentang Tanggal Kustom</option>
                      )}
                    </select>
                  </div>

                  {/* Tampilan Desktop (hidden md:flex): Deretan Tombol Berjajar (Pills Layout) */}
                  <div className="hidden md:flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyDatePreset('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        reportDatePreset === 'all'
                          ? 'bg-cyan-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Semua Periode
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyDatePreset('today')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        reportDatePreset === 'today'
                          ? 'bg-cyan-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyDatePreset('this_week')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        reportDatePreset === 'this_week'
                          ? 'bg-cyan-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Minggu Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyDatePreset('this_month')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        reportDatePreset === 'this_month'
                          ? 'bg-cyan-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block mb-1.5">
                      Dari Tanggal:
                    </span>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setReportStartDate(nextStart);
                        setReportDatePreset(!nextStart && !reportEndDate ? 'all' : 'custom');
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block mb-1.5">
                      Sampai Tanggal:
                    </span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        setReportEndDate(nextEnd);
                        setReportDatePreset(!reportStartDate && !nextEnd ? 'all' : 'custom');
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. PILIHAN FILTER KELAS (ROMBEL) & 3. PILIHAN JENIS LAPORAN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {reportScope === 'rombel' ? (
                  <div className="space-y-2 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5">
                    <label className="text-slate-800 font-bold flex items-center justify-between gap-2 text-xs sm:text-sm">
                      <span className="flex items-center gap-2">
                        {isWaliKelas ? (
                          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Building2 className="w-4 h-4 text-cyan-600 shrink-0" />
                        )}
                        <span>2. Filter Kelas (Rombel)</span>
                      </span>
                      {isWaliKelas && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Kelas Binaan
                        </span>
                      )}
                    </label>
                    <select
                      value={reportRombelFilter}
                      onChange={(e) => {
                        if (!isWaliKelas) setReportRombelFilter(e.target.value);
                      }}
                      disabled={isWaliKelas}
                      className={`w-full rounded-xl px-3.5 py-3 text-xs sm:text-sm font-semibold focus:outline-none ${
                        isWaliKelas
                          ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                          : 'bg-white border border-slate-200 text-slate-900 focus:border-cyan-500'
                      }`}
                    >
                      {!isWaliKelas && <option value="ALL">Semua Kelas (Seluruh Rombel)</option>}
                      {rombelList
                        .filter((r) => {
                          if (!isWaliKelas) return true;
                          return (
                            r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase() ||
                            r.nama_kelas === reportRombelFilter
                          );
                        })
                        .map((r) => (
                          <option key={r.id} value={r.nama_kelas}>
                            Kelas {r.nama_kelas} — Wali: {r.nama_wali_kelas || waliKelasName || '-'}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5">
                    <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                      <Users className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span>2. Nama Orang Tua / Wali (Kolom Tanda Tangan)</span>
                    </label>
                    <input
                      type="text"
                      value={waliMuridSignName}
                      onChange={(e) => setWaliMuridSignName(e.target.value)}
                      placeholder="Orang Tua / Wali Siswa"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                <div className="space-y-2 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                    <FileText className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>3. Pilihan Jenis Laporan</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-200/70 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setReportJenisFilter('ALL')}
                      className={`py-2.5 px-2 rounded-lg font-bold text-xs transition ${
                        reportJenisFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua Tindakan
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportJenisFilter('Pelanggaran')}
                      className={`py-2.5 px-2 rounded-lg font-bold text-xs transition ${
                        reportJenisFilter === 'Pelanggaran'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      Pelanggaran (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportJenisFilter('Prestasi')}
                      className={`py-2.5 px-2 rounded-lg font-bold text-xs transition ${
                        reportJenisFilter === 'Prestasi'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Prestasi (+)
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. PENGATURAN PENANDATANGAN DOKUMEN RESMI (KEPALA SEKOLAH, PETUGAS KESISWAAN/BK & WALI KELAS) */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    4. Identitas Penandatangan Dokumen Resmi (Bagian Bawah Laporan A4)
                  </span>
                  {isWaliKelas ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 border border-slate-300 text-[11px] font-bold text-slate-700">
                      🔒 Terkunci (Diatur oleh Admin)
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Opsional disesuaikan</span>
                      {canEditSignatories && (
                        <button
                          type="button"
                          onClick={handleSaveMasterSignatoriesToCloud}
                          disabled={isSavingSignatories}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-[11px] font-bold text-cyan-700 transition active:scale-95 disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" />
                          <span>{isSavingSignatories ? 'Menyimpan...' : 'Simpan Master'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      Kota / Tempat Cetak
                    </label>
                    <input
                      type="text"
                      value={kotaCetak}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) => handleUpdateMasterSignatory('kotaCetak', e.target.value)}
                      placeholder="Contoh: Jakarta"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      Nama Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={kepalaSekolahName}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) =>
                        handleUpdateMasterSignatory('kepalaSekolahName', e.target.value)
                      }
                      placeholder="Nama Kepala Sekolah"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={kepalaSekolahNip}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) =>
                        handleUpdateMasterSignatory('kepalaSekolahNip', e.target.value)
                      }
                      placeholder="NIP Kepala Sekolah"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      Petugas Kesiswaan / Guru BK
                    </label>
                    <input
                      type="text"
                      value={petugasBkName}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) =>
                        handleUpdateMasterSignatory('petugasBkName', e.target.value)
                      }
                      placeholder="Nama Petugas Kesiswaan / BK"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      NIP Petugas Kesiswaan / Guru BK
                    </label>
                    <input
                      type="text"
                      value={petugasBkNip}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) =>
                        handleUpdateMasterSignatory('petugasBkNip', e.target.value)
                      }
                      placeholder="NIP Petugas Kesiswaan / BK"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-200/70">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      Nama Wali Kelas
                    </label>
                    <input
                      type="text"
                      value={waliKelasName}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) => {
                        if (canEditSignatories) setWaliKelasName(e.target.value);
                      }}
                      placeholder="Nama Wali Kelas"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      NIP Wali Kelas
                    </label>
                    <input
                      type="text"
                      value={waliKelasNip}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) => {
                        if (canEditSignatories) setWaliKelasNip(e.target.value);
                      }}
                      placeholder="NIP Wali Kelas"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* RINGKASAN HASIL FILTER REAL-TIME */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cyan-50/60 border border-cyan-200 rounded-2xl p-4 sm:p-5 text-center">
                <div className="p-2 rounded-xl bg-white/80 border border-cyan-100">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Data Terfilter
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5 block">
                    {reportSummaryStats.totalRecords} Catatan
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 border border-emerald-100">
                  <span className="text-[11px] font-semibold text-emerald-700 block">
                    Total Prestasi (+)
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-emerald-600 font-mono tabular-nums mt-0.5 block">
                    +{reportSummaryStats.totalPlus} ({reportSummaryStats.countPrestasi}x)
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 border border-rose-100">
                  <span className="text-[11px] font-semibold text-rose-700 block">
                    Total Pelanggaran (-)
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-rose-600 font-mono tabular-nums mt-0.5 block">
                    {reportSummaryStats.totalMinus} ({reportSummaryStats.countPelanggaran}x)
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 border border-cyan-100">
                  <span className="text-[11px] font-semibold text-cyan-700 block">
                    {reportScope === 'student' ? 'Total Akumulasi Poin' : 'Siswa Tercatat'}
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-cyan-700 font-mono tabular-nums mt-0.5 block">
                    {reportScope === 'student'
                      ? `${
                          reportSummaryStats.netPoints > 0
                            ? `+${reportSummaryStats.netPoints}`
                            : reportSummaryStats.netPoints
                        } Poin`
                      : `${reportSummaryStats.uniqueStudents} Siswa`}
                  </span>
                </div>
              </div>
            </div>

            {/* Bagian Bawah: Tombol Aksi Cetak & Unduh (Aman dari Navigasi Bawah) */}
            <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition active:scale-95 text-center"
              >
                ← Kembali ke Manajemen Poin
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (reportScope === 'student' && !reportSelectedStudentObj) {
                      showToast('Silakan pilih siswa terlebih dahulu pada kolom pencarian siswa!');
                      return;
                    }
                    exportPointsToCsv(
                      reportFilteredPoints,
                      reportScope === 'student' && reportSelectedStudentObj
                        ? reportSelectedStudentObj.nama
                        : `${reportRombelFilter}_${reportJenisFilter}`
                    );
                  }}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Download className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>📥 Unduh CSV / Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (reportScope === 'student' && !reportSelectedStudentObj) {
                      showToast('Silakan pilih siswa terlebih dahulu untuk mencetak rapor individual!');
                      return;
                    }
                    setIsPrintPreviewOpen(true);
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <span>🖨️ Cetak / Unduh Laporan Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER KAMERA QR / BARCODE UNTUK PILIH SISWA */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border border-gray-200 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500 text-white flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Scan Kartu Siswa (QR / Barcode)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Arahkan kamera ke kartu siswa untuk memilih otomatis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scannerError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{scannerError}</span>
              </div>
            )}

            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 min-h-[240px] flex items-center justify-center">
              <video
                ref={scannerVideoRef}
                className="w-full h-full object-cover max-h-[260px]"
                muted
                playsInline
              />
              <canvas ref={scannerCanvasRef} className="hidden" />
              {isScannerStarting && !scannerError && (
                <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center gap-2 text-white text-xs">
                  <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                  <span>Mengaktifkan kamera...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setScannerCameraFacing((prev) =>
                    prev === 'environment' ? 'user' : 'environment'
                  )
                }
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ganti Kamera</span>
              </button>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL EDIT CATATAN POIN (PRE-FILLED)
         ===================================================================== */}
      {isEditModalOpen && editingPointItem && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center pb-28 sm:pb-8 pt-4 px-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[82vh] sm:max-h-[88vh] overflow-y-auto overscroll-contain p-5 sm:p-6 border border-gray-200 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                    editJenis === 'Pelanggaran' ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Edit Catatan Poin &amp; Kedisiplinan
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Perbarui jenis tindakan, deskripsi keterangan, atau bobot poin siswa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPointItem(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Siswa (Read-only) */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 truncate">
                    {editingPointItem.students?.nama || editingPointItem.student_name || 'Siswa'}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono truncate">
                    Kelas {editingPointItem.student_kelas || 'Umum'} · NIS:{' '}
                    {editingPointItem.students?.nis ||
                      editingPointItem.students?.nisn ||
                      editingPointItem.student_nisn ||
                      '-'}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-gray-500 block">Pencatat</span>
                <span className="font-semibold text-[11px] text-gray-800">
                  {editingPointItem.pencatat || 'Admin Sekolah'}
                </span>
              </div>
            </div>

            <form onSubmit={handleUpdatePoint} className="space-y-4 text-xs">
              {/* 1. JENIS TINDAKAN (Pelanggaran vs Prestasi) */}
              <div className="space-y-1.5">
                <label className="text-gray-700 font-bold block">1. Jenis Tindakan *</label>
                <div className="grid grid-cols-2 gap-2.5 p-1 bg-gray-100 border border-gray-200 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleSwitchEditJenis('Pelanggaran')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                      editJenis === 'Pelanggaran'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Pelanggaran (-) [Poin Minus]</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchEditJenis('Prestasi')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                      editJenis === 'Prestasi'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Award className="w-4 h-4 shrink-0" />
                    <span>Prestasi (+) [Poin Plus]</span>
                  </button>
                </div>
              </div>

              {/* 2. KETERANGAN / DESKRIPSI KEJADIAN */}
              <div className="space-y-2">
                <label className="text-gray-700 font-bold block">
                  2. Keterangan / Deskripsi Kejadian *
                </label>

                <select
                  aria-label="Pilih cepat deskripsi kejadian"
                  value={
                    PRESET_DESCRIPTIONS[editJenis].some((p) => p.label === editKeterangan)
                      ? editKeterangan
                      : ''
                  }
                  onChange={(e) => {
                    const selectedLabel = e.target.value;
                    if (!selectedLabel) return;
                    const matched = PRESET_DESCRIPTIONS[editJenis].find(
                      (p) => p.label === selectedLabel
                    );
                    if (matched) {
                      setEditKeterangan(matched.label);
                      setEditPoin(String(matched.poin));
                    }
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-cyan-500 shadow-2xs"
                >
                  <option value="">
                    ⚡ Pilih cepat deskripsi (otomatis isi bobot poin)...
                  </option>
                  {PRESET_DESCRIPTIONS[editJenis].map((preset, idx) => (
                    <option key={idx} value={preset.label}>
                      {preset.label} ({preset.poin > 0 ? `+${preset.poin}` : preset.poin})
                    </option>
                  ))}
                </select>

                <textarea
                  rows={3}
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  placeholder="Masukkan keterangan pelanggaran atau prestasi..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                  required
                />
              </div>

              {/* 3. JUMLAH BOBOT POIN */}
              <div>
                <label className="text-gray-700 font-bold block mb-1">
                  3. Jumlah Bobot Poin ({editJenis === 'Pelanggaran' ? 'Minus' : 'Plus'}) *
                </label>
                <input
                  type="number"
                  step="1"
                  value={editPoin}
                  onChange={(e) => setEditPoin(e.target.value)}
                  placeholder={editJenis === 'Pelanggaran' ? '-10' : '25'}
                  className={`w-full bg-gray-50 border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tabular-nums focus:outline-none shadow-2xs ${
                    editJenis === 'Pelanggaran'
                      ? 'border-rose-200 text-rose-700 focus:border-rose-500'
                      : 'border-emerald-200 text-emerald-700 focus:border-emerald-500'
                  }`}
                  required
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  {(editJenis === 'Pelanggaran' ? [-5, -10, -25, -50] : [10, 25, 50, 100]).map(
                    (val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setEditPoin(String(val))}
                        className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-mono text-[10px] font-bold tabular-nums"
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingPointItem(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 ${
                    editJenis === 'Pelanggaran'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL KONFIRMASI HAPUS CATATAN POIN
         ===================================================================== */}
      {deletingPointItem && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center pb-28 sm:pb-8 pt-4 px-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[82vh] overflow-y-auto overscroll-contain p-5 sm:p-6 border border-gray-200 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900">
                  Hapus Catatan Poin &amp; Kedisiplinan?
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus catatan{' '}
                  <strong
                    className={
                      deletingPointItem.jenis === 'Prestasi' || deletingPointItem.poin > 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }
                  >
                    {deletingPointItem.jenis} (
                    {deletingPointItem.poin > 0
                      ? `+${deletingPointItem.poin}`
                      : deletingPointItem.poin}{' '}
                    Poin)
                  </strong>{' '}
                  milik{' '}
                  <strong>
                    {deletingPointItem.students?.nama ||
                      deletingPointItem.student_name ||
                      'Siswa'}
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-1">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Keterangan Kejadian:
              </div>
              <div className="font-medium text-gray-900">"{deletingPointItem.keterangan}"</div>
            </div>

            <p className="text-[11px] text-gray-500">
              Data akan dihapus dari tabel <code className="font-mono">student_points</code> dan total akumulasi poin siswa akan langsung disesuaikan secara otomatis.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingPointItem(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeletePoint}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Catatan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: PRATINJAU CETAK RESMI KERTAS A4 (PRINTABLE REPORT PREVIEW)
         ===================================================================== */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start pb-28 sm:pb-8 pt-3 px-3 sm:p-6 overflow-y-auto">
          {/* Toolbar Kontrol Atas Pratinjau A4 */}
          <div className="w-full max-w-4xl bg-slate-900 text-white border border-slate-700 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xl sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold">
                  {reportScope === 'student' && reportSelectedStudentObj
                    ? `Pratinjau Cetak Individual — ${reportSelectedStudentObj.nama}`
                    : 'Pratinjau Cetak Resmi — Kertas Standar A4'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {reportSummaryStats.totalRecords} catatan · {formattedPeriodLabel} ·{' '}
                  {reportScope === 'student' && reportSelectedStudentObj
                    ? `Kelas ${reportSelectedStudentObj.kelas || 'Umum'} (NIS: ${
                        reportSelectedStudentObj.nisn || reportSelectedStudentObj.nis || '-'
                      })`
                    : reportRombelFilter === 'ALL'
                    ? 'Semua Kelas'
                    : `Kelas ${reportRombelFilter}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPrintPreviewOpen(false);
                  setIsReportModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
              >
                Ubah Filter / Siswa
              </button>

              <button
                type="button"
                onClick={() =>
                  exportPointsToCsv(
                    reportFilteredPoints,
                    reportScope === 'student' && reportSelectedStudentObj
                      ? reportSelectedStudentObj.nama
                      : `${reportRombelFilter}_${reportJenisFilter}`
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Unduh CSV / Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePrintOfficialA4}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ Cetak Sekarang / Simpan PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                title="Tutup Pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lembar Dokumen Kertas A4 */}
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl border border-gray-300 p-6 sm:p-10 md:p-12 my-auto font-serif">
            {/* KOP SURAT INSTANSI RESMI (DARI public.app_settings) */}
            <div className="flex items-center justify-between gap-4 border-b-4 border-double border-slate-900 pb-4 mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                {schoolSettings.appLogo ? (
                  <img
                    src={schoolSettings.appLogo}
                    alt={schoolSettings.appTitle}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl border-2 border-slate-900 flex items-center justify-center font-sans font-extrabold text-xl text-slate-900">
                    {(schoolSettings.appTitle || DEFAULT_APP_TITLE).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="text-center flex-1 px-2">
                <h1 className="text-lg sm:text-2xl font-extrabold uppercase tracking-wide text-slate-900">
                  {schoolSettings.appTitle || DEFAULT_APP_TITLE}
                </h1>
                <p className="text-xs sm:text-sm text-slate-700 mt-1">
                  {schoolSettings.appSubtitle || DEFAULT_APP_SUBTITLE}
                </p>
                <p className="text-[10px] sm:text-[11px] font-sans font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                  Dokumen Resmi Bidang Kesiswaan &amp; Bimbingan Konseling (BK)
                </p>
              </div>

              <div className="w-16 sm:w-20 shrink-0 hidden sm:block" />
            </div>

            {/* JUDUL LAPORAN RESMI (MENYESUAIKAN MODE PER SISWA VS REKAP KELAS) */}
            <div className="text-center mb-6">
              <h2 className="text-sm sm:text-base font-bold uppercase underline tracking-wide text-slate-900">
                {reportScope === 'student' && reportSelectedStudentObj
                  ? 'LEMBAR PROFIL & REKAM JEJAK KEDISIPLINAN SISWA'
                  : 'LAPORAN RESMI REKAPITULASI KEDISIPLINAN & PRESTASI SISWA'}
              </h2>
              <p className="text-xs font-sans text-slate-600 mt-1">
                Periode Rekam Jejak: <strong>{formattedPeriodLabel}</strong> · Filter:{' '}
                <strong>
                  {reportJenisFilter === 'ALL'
                    ? 'Semua Tindakan (Pelanggaran & Prestasi)'
                    : reportJenisFilter === 'Pelanggaran'
                    ? 'Khusus Pelanggaran (-)'
                    : 'Khusus Prestasi (+)'}
                </strong>
              </p>
            </div>

            {/* METADATA IDENTITAS SISWA (MODE PER SISWA) ATAU METADATA KELAS (MODE REKAP ROMBEL) */}
            {reportScope === 'student' && reportSelectedStudentObj ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 border border-slate-300 rounded-lg p-3.5 mb-4 font-sans text-xs">
                <div>
                  <span className="text-slate-500">Nama Lengkap Siswa:</span>{' '}
                  <strong className="text-slate-900">{reportSelectedStudentObj.nama}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Kelas / Rombel:</span>{' '}
                  <strong className="text-slate-900">
                    Kelas {reportSelectedStudentObj.kelas || 'Umum'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">NIS / NISN:</span>{' '}
                  <strong className="text-slate-900 font-mono">
                    {reportSelectedStudentObj.nisn || reportSelectedStudentObj.nis || '-'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">UID Kartu RFID:</span>{' '}
                  <strong className="text-slate-900 font-mono">
                    {reportSelectedStudentObj.uid_kartu ||
                      reportSelectedStudentObj.rfid_uid ||
                      '-'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Tanggal Cetak:</span>{' '}
                  <strong className="text-slate-900">
                    {new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Petugas Kesiswaan / BK:</span>{' '}
                  <strong className="text-slate-900">
                    {petugasBkName || defaultPencatatName}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4 font-sans text-xs">
                <div>
                  <span className="text-slate-500">Filter Kelas / Rombel:</span>{' '}
                  <strong className="text-slate-900">
                    {reportRombelFilter === 'ALL'
                      ? 'Semua Kelas (Seluruh Rombel)'
                      : `Kelas ${reportRombelFilter}`}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Jenis Laporan:</span>{' '}
                  <strong className="text-slate-900">
                    {reportJenisFilter === 'ALL'
                      ? 'Semua Tindakan (Pelanggaran & Prestasi)'
                      : reportJenisFilter === 'Pelanggaran'
                      ? 'Khusus Pelanggaran (-)'
                      : 'Khusus Prestasi (+)'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Tanggal Cetak:</span>{' '}
                  <strong className="text-slate-900">
                    {new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Petugas Pencetak:</span>{' '}
                  <strong className="text-slate-900">
                    {petugasBkName || defaultPencatatName}
                  </strong>
                </div>
              </div>
            )}

            {/* KOTAK RINGKASAN STATISTIK */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 font-sans text-center">
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-500">
                  Total Catatan
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  {reportSummaryStats.totalRecords} Riwayat
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Poin Prestasi (+)
                </div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono mt-0.5">
                  +{reportSummaryStats.totalPlus} ({reportSummaryStats.countPrestasi}x)
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-rose-700">
                  Poin Pelanggaran (-)
                </div>
                <div className="text-sm sm:text-base font-extrabold text-rose-700 font-mono mt-0.5">
                  {reportSummaryStats.totalMinus} ({reportSummaryStats.countPelanggaran}x)
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-600">
                  {reportScope === 'student' ? 'Total Akumulasi Poin' : 'Siswa Tercatat'}
                </div>
                <div
                  className={`text-sm sm:text-base font-extrabold font-mono mt-0.5 ${
                    reportScope === 'student'
                      ? reportSummaryStats.netPoints > 0
                        ? 'text-emerald-700'
                        : reportSummaryStats.netPoints < 0
                        ? 'text-rose-700'
                        : 'text-slate-900'
                      : 'text-slate-900'
                  }`}
                >
                  {reportScope === 'student'
                    ? `${
                        reportSummaryStats.netPoints > 0
                          ? `+${reportSummaryStats.netPoints}`
                          : reportSummaryStats.netPoints
                      } Poin`
                    : `${reportSummaryStats.uniqueStudents} Siswa`}
                </div>
              </div>
            </div>

            {/* TABEL DATA LAPORAN RESMI (KRONOLOGI PER SISWA ATAU REKAP KELAS) */}
            <div className="overflow-x-auto mb-8 font-sans">
              {reportScope === 'student' && reportSelectedStudentObj ? (
                <table className="w-full border-collapse border border-slate-500 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 uppercase font-bold">
                      <th className="border border-slate-500 py-2 px-2 text-center w-8">No</th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">
                        Tanggal &amp; Waktu
                      </th>
                      <th className="border border-slate-500 py-2 px-2.5 text-center">
                        Jenis Tindakan
                      </th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">
                        Rincian Keterangan / Deskripsi Kejadian
                      </th>
                      <th className="border border-slate-500 py-2 px-2.5 text-right">
                        Bobot Poin
                      </th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">
                        Guru / Pencatat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportFilteredPoints.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-slate-400 py-8 text-center text-slate-500"
                        >
                          Belum ada riwayat catatan kedisiplinan / prestasi untuk siswa ini pada periode yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      reportFilteredPoints.map((item, idx) => {
                        const isPrestasi = item.jenis === 'Prestasi' || item.poin > 0;
                        const formattedDate = new Date(item.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={item.id} className="odd:bg-white even:bg-slate-50/50">
                            <td className="border border-slate-400 py-2 px-2 text-center font-mono">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 whitespace-nowrap font-mono text-[10px]">
                              {formattedDate}
                            </td>
                            <td
                              className={`border border-slate-400 py-2 px-2.5 text-center font-bold ${
                                isPrestasi ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {item.jenis}
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 text-slate-800">
                              {item.keterangan}
                            </td>
                            <td
                              className={`border border-slate-400 py-2 px-2.5 text-right font-mono font-bold ${
                                isPrestasi ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {item.poin > 0 ? `+${item.poin}` : item.poin} Poin
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 text-slate-700">
                              {item.pencatat || 'Admin Sekolah'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse border border-slate-500 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 uppercase font-bold">
                      <th className="border border-slate-500 py-2 px-2 text-center w-8">No</th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">
                        Tanggal &amp; Waktu
                      </th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">Nama Siswa</th>
                      <th className="border border-slate-500 py-2 px-2 text-center">NIS</th>
                      <th className="border border-slate-500 py-2 px-2 text-center">Kelas</th>
                      <th className="border border-slate-500 py-2 px-2 text-center">Jenis</th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">
                        Rincian Keterangan
                      </th>
                      <th className="border border-slate-500 py-2 px-2 text-right">Bobot Poin</th>
                      <th className="border border-slate-500 py-2 px-2 text-right">
                        Akumulasi Siswa
                      </th>
                      <th className="border border-slate-500 py-2 px-2.5 text-left">
                        Nama Pencatat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportFilteredPoints.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="border border-slate-400 py-8 text-center text-slate-500"
                        >
                          Tidak ada catatan poin kedisiplinan pada filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      reportFilteredPoints.map((item, idx) => {
                        const isPrestasi = item.jenis === 'Prestasi' || item.poin > 0;
                        const displayStudentName =
                          item.students?.nama || item.student_name || 'Siswa';
                        const displayStudentNis =
                          item.students?.nis || item.students?.nisn || item.student_nisn || '-';
                        const studentBal =
                          studentBalanceMap.get(String(item.student_id).toLowerCase())?.total ??
                          item.poin;
                        const formattedDate = new Date(item.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={item.id} className="odd:bg-white even:bg-slate-50/50">
                            <td className="border border-slate-400 py-2 px-2 text-center font-mono">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 whitespace-nowrap font-mono text-[10px]">
                              {formattedDate}
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 font-bold text-slate-900">
                              {displayStudentName}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center font-mono">
                              {displayStudentNis}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center font-semibold">
                              {item.student_kelas || 'Umum'}
                            </td>
                            <td
                              className={`border border-slate-400 py-2 px-2 text-center font-bold ${
                                isPrestasi ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {item.jenis}
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 text-slate-800">
                              {item.keterangan}
                            </td>
                            <td
                              className={`border border-slate-400 py-2 px-2 text-right font-mono font-bold ${
                                isPrestasi ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {item.poin > 0 ? `+${item.poin}` : item.poin}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-right font-mono font-bold text-slate-900">
                              {studentBal > 0 ? `+${studentBal}` : studentBal}
                            </td>
                            <td className="border border-slate-400 py-2 px-2.5 text-slate-700">
                              {item.pencatat || 'Admin Sekolah'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* BAGIAN TANDA TANGAN RESMI DI BAGIAN BAWAH */}
            {reportScope === 'student' && reportSelectedStudentObj ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 text-xs sm:text-sm text-center">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Orang Tua / Wali Murid</p>
                  <div className="h-20" />
                  <p className="font-bold underline">
                    {waliMuridSignName || 'Orang Tua / Wali Siswa'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Wali dari {reportSelectedStudentObj.nama}
                  </p>
                </div>

                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Kepala Sekolah</p>
                  <div className="h-20" />
                  <p className="font-bold underline">{kepalaSekolahName || 'Kepala Sekolah'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{kepalaSekolahNip || 'NIP. -'}</p>
                </div>

                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Petugas Kesiswaan / Guru BK</p>
                  <div className="h-20" />
                  <p className="font-bold underline">
                    {petugasBkName || 'Guru BK / Kesiswaan'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{petugasBkNip || 'NIP. -'}</p>
                </div>

                <div>
                  <p>
                    {kotaCetak || 'Jakarta'},{' '}
                    {new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="font-bold">
                    Wali Kelas {reportSelectedStudentObj.kelas || ''}
                  </p>
                  <div className="h-20" />
                  <p className="font-bold underline">
                    {waliKelasName || 'Hesti Supriyani, S.Pd.I'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{waliKelasNip || 'NIP. -'}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-xs sm:text-sm text-center">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Kepala Sekolah</p>
                  <div className="h-20" />
                  <p className="font-bold underline">{kepalaSekolahName || 'Kepala Sekolah'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{kepalaSekolahNip || 'NIP. -'}</p>
                </div>

                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Petugas Kesiswaan / Guru BK</p>
                  <div className="h-20" />
                  <p className="font-bold underline">
                    {petugasBkName || 'Guru BK / Kesiswaan'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{petugasBkNip || 'NIP. -'}</p>
                </div>

                <div>
                  <p>
                    {kotaCetak || 'Jakarta'},{' '}
                    {new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="font-bold">
                    Wali Kelas{reportRombelFilter !== 'ALL' ? ` ${reportRombelFilter}` : ''}
                  </p>
                  <div className="h-20" />
                  <p className="font-bold underline">
                    {waliKelasName || 'Hesti Supriyani, S.Pd.I'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{waliKelasNip || 'NIP. -'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
