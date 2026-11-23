import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  CreditCard,
  Phone,
  X,
  ExternalLink,
  Copy,
  Layers,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  School,
  AlertTriangle,
  QrCode,
  Download,
  Upload,
  Calendar,
  Eye,
  EyeOff,
  Lock,
  Camera,
  RefreshCw,
  Filter,
  Printer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crop,
  ZoomIn,
  ZoomOut,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Cropper, { Area, Point } from 'react-easy-crop';
import jsQR from 'jsqr';
import { Student, Rombel, AppUser, JadwalHari, UserRole } from '../types';
import { supabaseService, DEFAULT_JADWAL_HARIAN } from '../services/supabaseClient';
import {
  settingsService,
  compressAvatarImage,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
} from '../services/settingsService';
import { sound } from '../utils/audio';
import { getCroppedImgBlob } from '../utils/cropImage';

const getStudentInitials = (name?: string): string => {
  const parts = (name || 'S').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

type MemberSubTab = 'students' | 'classes' | 'users';

interface MemberManagerProps {
  currentUser?: AppUser | null;
  onUpdateCurrentUser?: (user: AppUser) => void;
}

export const MemberManager: React.FC<MemberManagerProps> = ({
  currentUser,
  onUpdateCurrentUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<MemberSubTab>('students');

  const isCurrentUserSuperAdmin =
    !currentUser ||
    currentUser.role === 'Super Admin' ||
    Boolean(currentUser.is_master) ||
    currentUser.username?.toLowerCase() === 'naedie';

  const isWaliKelas = currentUser?.role === 'Wali Kelas';
  const waliAssignedClass = (
    currentUser?.assignedClass ||
    currentUser?.assigned_class ||
    (isWaliKelas ? '1A' : '')
  ).trim();
  const formattedWaliClassLabel = waliAssignedClass
    ? /^kelas\s+/i.test(waliAssignedClass)
      ? waliAssignedClass
      : `Kelas ${waliAssignedClass}`
    : 'Kelas 1A';

  // Datasets
  const [students, setStudents] = useState<Student[]>([]);
  const [rombelList, setRombelList] = useState<Rombel[]>([]);
  const [userList, setUserList] = useState<AppUser[]>([]);

  // Search queries & Pagination / Filter for Students
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedRombelFilter, setSelectedRombelFilter] = useState<string>('ALL');
  const [studentPage, setStudentPage] = useState<number>(1);
  const studentsPerPage = 10;
  const [isBatchQrPrintOpen, setIsBatchQrPrintOpen] = useState<boolean>(false);
  const [qrPrintColumns, setQrPrintColumns] = useState<2 | 3>(3);
  const [schoolSettings, setSchoolSettings] = useState(() => settingsService.getSettings());
  const [searchRombel, setSearchRombel] = useState('');
  const [classPage, setClassPage] = useState<number>(1);
  const CLASSES_PER_PAGE = 5;
  const [searchUser, setSearchUser] = useState('');

  // Toast & clipboard
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimerRef = useRef<number | null>(null);
  const [deletingRombelId, setDeletingRombelId] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  // Expandable List Tile (Accordion Card) states for Mobile Views
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [expandedRombelId, setExpandedRombelId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // ==================== MODAL STATES ====================
  // 1. Student Modals
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [formStdNama, setFormStdNama] = useState('');
  const [formStdNamaWali, setFormStdNamaWali] = useState('');
  const [formStdRfid, setFormStdRfid] = useState('');
  const [formStdNisn, setFormStdNisn] = useState('');
  const [formStdWa, setFormStdWa] = useState('');
  const [formStdKelas, setFormStdKelas] = useState(''); // Stores rombel id (UUID)
  const [formStdAvatar, setFormStdAvatar] = useState<string>('');

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStdNama, setEditStdNama] = useState('');
  const [editStdNamaWali, setEditStdNamaWali] = useState('');
  const [editStdRfid, setEditStdRfid] = useState('');
  const [editStdNisn, setEditStdNisn] = useState('');
  const [editStdWa, setEditStdWa] = useState('');
  const [editStdKelas, setEditStdKelas] = useState(''); // Stores rombel id (UUID)
  const [editStdAvatar, setEditStdAvatar] = useState<string>('');
  const [isCompressingStdAvatar, setIsCompressingStdAvatar] = useState<boolean>(false);

  // 1.1 Custom Image Cropper State for Student & User Avatar
  const [isCropperModalOpen, setIsCropperModalOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [cropperTarget, setCropperTarget] = useState<'add' | 'edit' | 'add_user' | 'edit_user'>('add');
  const [cropperCrop, setCropperCrop] = useState<Point>({ x: 0, y: 0 });
  const [cropperZoom, setCropperZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);

  // 2. Rombel Modals
  const [isAddRombelOpen, setIsAddRombelOpen] = useState(false);
  const [formRmbNama, setFormRmbNama] = useState('');
  const [formRmbWali, setFormRmbWali] = useState('');
  const [formRmbJadwal, setFormRmbJadwal] = useState<Record<string, JadwalHari>>(DEFAULT_JADWAL_HARIAN);

  const [editingRombel, setEditingRombel] = useState<Rombel | null>(null);
  const [editRmbNama, setEditRmbNama] = useState('');
  const [editRmbWali, setEditRmbWali] = useState('');
  const [editRmbJadwal, setEditRmbJadwal] = useState<Record<string, JadwalHari>>(DEFAULT_JADWAL_HARIAN);

  // 3. User Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [formUsrUsername, setFormUsrUsername] = useState('');
  const [formUsrPassword, setFormUsrPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [formUsrNama, setFormUsrNama] = useState('');
  const [formUsrNip, setFormUsrNip] = useState('');
  const [formUsrRole, setFormUsrRole] = useState<UserRole>('Operator');
  const [formUsrAssignedClass, setFormUsrAssignedClass] = useState<string>('');
  const [formUsrStatus, setFormUsrStatus] = useState<AppUser['status']>('Aktif');
  const [formUsrAvatar, setFormUsrAvatar] = useState<string>('');

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUsrUsername, setEditUsrUsername] = useState('');
  const [editUsrPassword, setEditUsrPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editUsrNama, setEditUsrNama] = useState('');
  const [editUsrNip, setEditUsrNip] = useState('');
  const [editUsrRole, setEditUsrRole] = useState<UserRole>('Operator');
  const [editUsrAssignedClass, setEditUsrAssignedClass] = useState<string>('');
  const [editUsrStatus, setEditUsrStatus] = useState<AppUser['status']>('Aktif');
  const [editUsrAvatar, setEditUsrAvatar] = useState<string>('');

  // 4. QR Code Modal State
  const [selectedQrItem, setSelectedQrItem] = useState<{
    title: string;
    subtitle: string;
    uid: string;
    badge: string;
    type: 'siswa' | 'user';
  } | null>(null);
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);

  // 5. CSV Upload Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvType, setCsvType] = useState<'students' | 'users'>('students');
  const [csvTextContent, setCsvTextContent] = useState('');
  const [csvImportStats, setCsvImportStats] = useState<{
    successCount: number;
    duplicateCount: number;
    errors: string[];
  } | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);

  // 6. UID RFID Camera Scanner & USB RFID Hardware Reader State
  const [uidScannerTarget, setUidScannerTarget] = useState<'add' | 'edit' | null>(null);
  const [scannerCameraFacing, setScannerCameraFacing] = useState<'environment' | 'user'>('environment');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerAnimRef = useRef<number | null>(null);
  const hasScannedUidRef = useRef(false);
  const addUidInputRef = useRef<HTMLInputElement>(null);
  const editUidInputRef = useRef<HTMLInputElement>(null);
  const addNamaInputRef = useRef<HTMLInputElement>(null);
  const editNamaInputRef = useRef<HTMLInputElement>(null);
  const usbRfidBufferRef = useRef<{ buffer: string; lastKeyTime: number }>({ buffer: '', lastKeyTime: 0 });

  // Intercept Enter key from USB RFID Reader on UID input so it does not prematurely submit the form
  const handleUidInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    mode: 'add' | 'edit'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const val = (mode === 'add' ? formStdRfid : editStdRfid).trim().toUpperCase();
      if (val) {
        if (mode === 'add') setFormStdRfid(val);
        else setEditStdRfid(val);
        sound.playSuccess();
        showToast(`Kartu RFID [${val}] berhasil terbaca!`);
        if (mode === 'add' && !formStdNama.trim()) {
          addNamaInputRef.current?.focus();
        } else if (mode === 'edit' && !editStdNama.trim()) {
          editNamaInputRef.current?.focus();
        }
      }
    }
  };

  // Global listener when Add/Edit Student modal is open to catch USB RFID Reader taps even if input is unfocused
  useEffect(() => {
    if (!isAddStudentOpen && !editingStudent) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT');

      if (isInputFocused) return;

      const now = Date.now();
      if (now - usbRfidBufferRef.current.lastKeyTime > 120) {
        usbRfidBufferRef.current.buffer = '';
      }
      usbRfidBufferRef.current.lastKeyTime = now;

      if (e.key === 'Enter') {
        const scanned = usbRfidBufferRef.current.buffer.trim().toUpperCase();
        usbRfidBufferRef.current.buffer = '';
        if (scanned.length >= 4) {
          e.preventDefault();
          if (isAddStudentOpen) {
            setFormStdRfid(scanned);
            addUidInputRef.current?.focus();
          } else if (editingStudent) {
            setEditStdRfid(scanned);
            editUidInputRef.current?.focus();
          }
          sound.playSuccess();
          showToast(`Kartu RFID [${scanned}] otomatis terdeteksi!`);
          if (uidScannerTarget) {
            setUidScannerTarget(null);
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        usbRfidBufferRef.current.buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAddStudentOpen, editingStudent, uidScannerTarget]);

  // Camera QR / Barcode Scanner lifecycle for UID Kartu RFID
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

    if (!uidScannerTarget) {
      stopStream();
      return;
    }

    let isCancelled = false;
    hasScannedUidRef.current = false;
    setScannerError(null);
    setIsScannerStarting(true);

    // Optional native BarcodeDetector for 1D Barcodes + QR
    let barcodeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        barcodeDetector = new BarcodeDetectorClass({
          formats: [
            'qr_code',
            'code_128',
            'code_39',
            'ean_13',
            'ean_8',
            'upc_a',
            'itf',
            'codabar',
          ],
        });
      } catch {
        barcodeDetector = null;
      }
    }

    const handleDetectedCode = (rawText: string) => {
      if (hasScannedUidRef.current || isCancelled) return;
      const cleanCode = rawText.trim().toUpperCase();
      if (!cleanCode) return;

      hasScannedUidRef.current = true;
      if (uidScannerTarget === 'add') {
        setFormStdRfid(cleanCode);
      } else if (uidScannerTarget === 'edit') {
        setEditStdRfid(cleanCode);
      }

      sound.playSuccess();
      showToast(`Kode kartu [${cleanCode}] berhasil dipindai!`);
      stopStream();
      setUidScannerTarget(null);
    };

    const scanFrame = async () => {
      if (isCancelled || hasScannedUidRef.current) return;
      const video = scannerVideoRef.current;
      const canvas = scannerCanvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        // 1. Try native BarcodeDetector first (supports both 1D Barcode & QR Code)
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDetectedCode(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }

        // 2. Always run jsQR fallback for universal QR Code support
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
            handleDetectedCode(qrResult.data);
            return;
          }
        }
      }

      if (!isCancelled && !hasScannedUidRef.current) {
        scannerAnimRef.current = requestAnimationFrame(scanFrame);
      }
    };

    const startCamera = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: scannerCameraFacing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch {
          // Fallback to any available video input (e.g., laptop webcam)
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
              (err?.message || 'Pastikan izin kamera telah diberikan pada browser Anda.')
          );
        }
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      stopStream();
    };
  }, [uidScannerTarget, scannerCameraFacing]);

  const handleOpenCsvModal = (type: 'students' | 'users') => {
    setCsvType(type);
    setCsvTextContent('');
    setCsvImportStats(null);
    setIsCsvModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setCsvTextContent(content);
    };
    reader.readAsText(file);
  };

  const handleProcessCsvImport = async () => {
    if (!csvTextContent.trim()) {
      alert('Pilih file CSV atau masukkan isi teks CSV terlebih dahulu!');
      return;
    }

    setIsProcessingCsv(true);
    const lines = csvTextContent.split(/\r\n|\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      alert('Format CSV tidak valid atau baris data terlalu sedikit (minimal header + 1 baris data).');
      setIsProcessingCsv(false);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    let successCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    try {
      if (csvType === 'students') {
        for (let i = 1; i < lines.length; i++) {
          const rowVals = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = rowVals[idx] || '';
          });

          const nama = rowObj['nama'] || rowObj['namasiswa'] || rowObj['namalengkap'];
          let rfid = rowObj['uid_kartu'] || rowObj['rfid'] || rowObj['rfid_uid'] || rowObj['uid'];
          const nisn = rowObj['nisn'] || '';
          let wa = rowObj['no_wa_wali'] || rowObj['whatsapp'] || rowObj['wa'] || '';
          const kelasInput = rowObj['kelas'] || rowObj['rombongan_belajar'] || (rombelList[0]?.nama_kelas || 'Umum');

          if (!nama || !rfid) {
            errors.push(`Baris ${i + 1}: Nama atau RFID kosong, dilewati.`);
            continue;
          }

          rfid = rfid.toUpperCase();

          const isDuplicate = students.some(
            (s) =>
              (s.uid_kartu && s.uid_kartu.toUpperCase() === rfid) ||
              (s.rfid_uid && s.rfid_uid.toUpperCase() === rfid) ||
              (nisn && s.nisn && s.nisn.trim() === nisn.trim())
          );

          if (isDuplicate) {
            duplicateCount++;
            errors.push(`Baris ${i + 1} (${nama}): Duplikat terdeteksi (RFID/NISN sudah ada).`);
            continue;
          }

          if (wa.startsWith('0')) wa = '62' + wa.slice(1);
          else if (!wa.startsWith('62')) wa = '62' + wa;

          const matchedRombel = rombelList.find(
            (r) => r.id === kelasInput || r.nama_kelas.toLowerCase() === kelasInput.toLowerCase()
          );
          const resolvedRombelId = matchedRombel ? matchedRombel.id : (rombelList[0]?.id || undefined);
          const resolvedClassName = matchedRombel ? matchedRombel.nama_kelas : kelasInput;

          try {
            await supabaseService.addStudent({
              nama,
              uid_kartu: rfid,
              rfid_uid: rfid,
              nisn,
              no_wa_wali: wa || '628123456789',
              rombel_id: resolvedRombelId,
              kelas: resolvedClassName,
            });
            successCount++;
          } catch (err: any) {
            errors.push(`Baris ${i + 1} (${nama}): ${err.message || 'Gagal insert'}`);
          }
        }
      } else {
        for (let i = 1; i < lines.length; i++) {
          const rowVals = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = rowVals[idx] || '';
          });

          const username = (rowObj['username'] || '').toLowerCase();
          const password = rowObj['password'] || '123456';
          const nama = rowObj['nama_lengkap'] || rowObj['nama'] || '';
          const nip = rowObj['nip'] || '';
          const rawRole = (rowObj['role'] || 'Operator').trim();
          const role: UserRole =
            rawRole === 'Super Admin' || rawRole === 'Admin' || rawRole === 'Wali Kelas' || rawRole === 'Operator'
              ? (rawRole as UserRole)
              : 'Operator';
          const status = (rowObj['status'] || 'Aktif') as AppUser['status'];

          if (!username || !nama) {
            errors.push(`Baris ${i + 1}: Username atau Nama Lengkap kosong, dilewati.`);
            continue;
          }

          if (!isCurrentUserSuperAdmin && (role === 'Super Admin' || role === 'Admin')) {
            errors.push(`Baris ${i + 1} (@${username}): Hanya Super Admin yang dapat mengimpor akun ${role}.`);
            continue;
          }

          const isDuplicate = userList.some(
            (u) =>
              u.username.toLowerCase() === username ||
              (nip && u.nip && u.nip.trim() === nip.trim())
          );

          if (isDuplicate) {
            duplicateCount++;
            errors.push(`Baris ${i + 1} (@${username}): Duplikat terdeteksi (Username/NIP sudah ada).`);
            continue;
          }

          try {
            await supabaseService.addAppUser({
              username,
              password,
              nama_lengkap: nama,
              nip,
              role,
              status,
            });
            successCount++;
          } catch (err: any) {
            errors.push(`Baris ${i + 1} (@${username}): ${err.message || 'Gagal insert user'}`);
          }
        }
      }

      sound.playSuccess();
      setCsvImportStats({ successCount, duplicateCount, errors });
      loadAllData();
      showToast(`Import CSV selesai: ${successCount} berhasil, ${duplicateCount} duplikat dilewati.`);
    } catch (err) {
      console.error('Error importing CSV:', err);
      alert('Terjadi kesalahan saat memproses file CSV.');
    } finally {
      setIsProcessingCsv(false);
    }
  };

  const handleOpenStudentQr = (s: Student) => {
    const qrData = (s.nisn && s.nisn.trim()) ? s.nisn.trim() : (s.uid_kartu || s.rfid_uid || '');
    const r = rombelList.find((item) => item.id === s.rombel_id || item.id === s.class_id || item.nama_kelas === s.kelas);
    const kelasName = r ? r.nama_kelas : (s.kelas || 'Umum');
    setSelectedQrItem({
      title: s.nama,
      subtitle: `Kelas: ${kelasName} • NISN: ${s.nisn || '-'} • RFID: ${s.uid_kartu || s.rfid_uid || '-'}`,
      uid: qrData,
      badge: 'QR KARTU SISWA (NISN)',
      type: 'siswa',
    });
  };

  const handleOpenUserQr = (u: AppUser) => {
    const isTargetSuperAdmin =
      u.role === 'Super Admin' || Boolean(u.is_master) || u.username?.toLowerCase() === 'naedie';
    if (!isCurrentUserSuperAdmin && isTargetSuperAdmin) {
      alert('Akses Ditolak: Admin biasa tidak diperbolehkan melihat atau mengakses QR milik Super Admin!');
      return;
    }
    const qrData = u.nip && u.nip.trim() ? u.nip.trim() : u.username;
    setSelectedQrItem({
      title: u.nama_lengkap || u.username,
      subtitle: `@${u.username} • NIP: ${u.nip || '-'} • Role: ${u.role}`,
      uid: qrData,
      badge: 'QR OPERATOR (NIP)',
      type: 'user',
    });
  };

  const handleDownloadQr = async () => {
    if (!selectedQrItem) return;
    setIsDownloadingQr(true);
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
        selectedQrItem.uid
      )}&margin=15`;
      const response = await fetch(qrApiUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${selectedQrItem.type.toUpperCase()}_${selectedQrItem.uid}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      sound.playSuccess();
      showToast(`QR Code untuk "${selectedQrItem.title}" berhasil diunduh!`);
    } catch (err) {
      console.error('Error downloading QR code:', err);
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
        selectedQrItem.uid
      )}&margin=15`;
      const a = document.createElement('a');
      a.href = qrApiUrl;
      a.target = '_blank';
      a.download = `QR_${selectedQrItem.type.toUpperCase()}_${selectedQrItem.uid}.png`;
      a.click();
    } finally {
      setIsDownloadingQr(false);
    }
  };

  const loadAllData = async () => {
    const [s, r, u] = await Promise.all([
      supabaseService.getStudents(),
      supabaseService.getRombel(),
      supabaseService.getAppUsers(),
    ]);
    setStudents(s);
    setRombelList(r);
    setUserList(u);
  };

  useEffect(() => {
    loadAllData();
    const unsub = supabaseService.subscribe(loadAllData);
    const unsubSettings = settingsService.subscribe(() => {
      setSchoolSettings(settingsService.getSettings());
    });
    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  // Tutup dropdown Export Data saat klik di luar area atau tekan Escape
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  // Kunci tab & filter kelas otomatis untuk Role Wali Kelas
  useEffect(() => {
    if (isWaliKelas) {
      setActiveSubTab('students');
      const cleanAssigned = waliAssignedClass.replace(/^kelas\s+/i, '').trim().toLowerCase();
      const matchedRombel = rombelList.find(
        (r) =>
          r.id.toLowerCase() === cleanAssigned ||
          r.nama_kelas.trim().toLowerCase() === cleanAssigned ||
          r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
      );
      setSelectedRombelFilter(matchedRombel ? matchedRombel.id : waliAssignedClass || '1A');
      setStudentPage(1);
    }
  }, [isWaliKelas, waliAssignedClass, rombelList]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastType(type);
    setToastMessage(msg);
    toastTimerRef.current = window.setTimeout(
      () => {
        setToastMessage(null);
        toastTimerRef.current = null;
      },
      type === 'error' ? 5000 : 3000
    );
  };

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 1500);
  };

  const handleStudentAvatarFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'add' | 'edit' | 'add_user' | 'edit_user'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Pilih file gambar yang valid (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        setCropperImageSrc(result);
        setCropperTarget(mode);
        setCropperCrop({ x: 0, y: 0 });
        setCropperZoom(1);
        setIsCropperModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCrop = async () => {
    if (!cropperImageSrc || !croppedAreaPixels) return;
    setIsProcessingCrop(true);
    try {
      const croppedBlob = await getCroppedImgBlob(cropperImageSrc, croppedAreaPixels, 128);
      const compressedBase64 = await compressAvatarImage(croppedBlob);
      if (cropperTarget === 'add') {
        setFormStdAvatar(compressedBase64);
        showToast('Foto profil siswa berhasil disesuaikan!');
      } else if (cropperTarget === 'edit') {
        setEditStdAvatar(compressedBase64);
        showToast('Foto profil siswa berhasil disesuaikan!');
      } else if (cropperTarget === 'add_user') {
        setFormUsrAvatar(compressedBase64);
        showToast('Foto profil user berhasil disesuaikan!');
      } else if (cropperTarget === 'edit_user') {
        setEditUsrAvatar(compressedBase64);
        showToast('Foto profil user berhasil disesuaikan!');
      }
      sound.playSuccess();
      setIsCropperModalOpen(false);
      setCropperImageSrc(null);
    } catch (err: any) {
      console.error('Error cropping avatar:', err);
      alert('Gagal menyesuaikan foto profil: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsProcessingCrop(false);
    }
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStdNama.trim() || !formStdRfid.trim() || !formStdWa.trim()) {
      alert('Nama Siswa, UID RFID, dan Nomor WA Wali wajib diisi!');
      return;
    }

    const cleanRfid = formStdRfid.trim().toUpperCase();
    const existing = students.find(
      (s) => (s.uid_kartu || s.rfid_uid || '').toUpperCase() === cleanRfid
    );
    if (existing) {
      alert(`UID Kartu [${cleanRfid}] sudah digunakan oleh: ${existing.nama}!`);
      return;
    }

    let cleanWa = formStdWa.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.slice(1);
    else if (!cleanWa.startsWith('62')) cleanWa = '62' + cleanWa;

    // Resolve rombel_id and kelas name from rombelList using UUID
    const matchedRombel = rombelList.find((r) => r.id === formStdKelas);
    const resolvedRombelId = matchedRombel ? matchedRombel.id : undefined;
    const resolvedClassName = matchedRombel ? matchedRombel.nama_kelas : (rombelList.length > 0 ? rombelList[0].nama_kelas : 'Umum');

    try {
      const createdStudent = await supabaseService.addStudent({
        nama: formStdNama.trim(),
        nama_wali: formStdNamaWali.trim() || undefined,
        uid_kartu: cleanRfid,
        rfid_uid: cleanRfid,
        nisn: formStdNisn.trim(),
        no_wa_wali: cleanWa,
        rombel_id: resolvedRombelId,
        kelas: resolvedClassName,
        avatar_url: formStdAvatar || undefined,
      });

      if (formStdNamaWali.trim() && createdStudent?.id) {
        supabaseService.saveStudentNamaWali(createdStudent.id, formStdNamaWali.trim());
      }

      sound.playSuccess();
      showToast(`Siswa "${formStdNama.trim()}" berhasil didaftarkan!`);
      setIsAddStudentOpen(false);
      setFormStdNama('');
      setFormStdNamaWali('');
      setFormStdRfid('');
      setFormStdNisn('');
      setFormStdWa('');
      setFormStdKelas('');
      setFormStdAvatar('');
      loadAllData();
    } catch (err: any) {
      alert('Gagal menambahkan siswa: ' + (err.message || 'Unknown error'));
    }
  };

  const handleOpenEditStudent = (s: Student) => {
    setEditingStudent(s);
    setEditStdNama(s.nama);
    setEditStdNamaWali(s.nama_wali || '');
    setEditStdRfid(s.uid_kartu || s.rfid_uid || '');
    setEditStdNisn(s.nisn || '');
    setEditStdWa(s.no_wa_wali);
    setEditStdAvatar(s.avatar_url || '');
    // Find rombel id by rombel_id, class_id, or matching class name
    const foundRombel = rombelList.find(
      (r) => r.id === s.rombel_id || r.id === s.class_id || r.nama_kelas === s.kelas
    );
    setEditStdKelas(foundRombel ? foundRombel.id : (rombelList.length > 0 ? rombelList[0].id : ''));
  };

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editStdNama.trim() || !editStdWa.trim()) {
      alert('Nama Siswa dan Nomor WA Wali tidak boleh kosong!');
      return;
    }
    if (!isWaliKelas && !editStdRfid.trim()) {
      alert('UID Kartu tidak boleh kosong!');
      return;
    }

    const cleanRfid = (editStdRfid.trim() || editingStudent.uid_kartu || editingStudent.rfid_uid || '').toUpperCase();
    if (cleanRfid) {
      const duplicate = students.find(
        (s) =>
          s.id !== editingStudent.id &&
          ((s.uid_kartu && s.uid_kartu.toUpperCase() === cleanRfid) ||
            (s.rfid_uid && s.rfid_uid.toUpperCase() === cleanRfid))
      );
      if (duplicate) {
        alert(`UID Kartu [${cleanRfid}] sudah digunakan oleh ${duplicate.nama}!`);
        return;
      }
    }

    let cleanWa = editStdWa.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.slice(1);
    else if (!cleanWa.startsWith('62')) cleanWa = '62' + cleanWa;

    const matchedRombel = rombelList.find((r) => r.id === editStdKelas);
    const resolvedRombelId = isWaliKelas
      ? editingStudent.rombel_id || matchedRombel?.id
      : matchedRombel
      ? matchedRombel.id
      : editingStudent.rombel_id;
    const resolvedClassName = isWaliKelas
      ? editingStudent.kelas || matchedRombel?.nama_kelas || waliAssignedClass || '1A'
      : matchedRombel
      ? matchedRombel.nama_kelas
      : editingStudent.kelas || 'Umum';

    try {
      await supabaseService.updateStudent(editingStudent.id, {
        nama: editStdNama.trim(),
        nama_wali: editStdNamaWali.trim(),
        uid_kartu: cleanRfid,
        rfid_uid: cleanRfid,
        nisn: editStdNisn.trim(),
        no_wa_wali: cleanWa,
        rombel_id: resolvedRombelId,
        kelas: resolvedClassName,
        avatar_url: editStdAvatar,
      });

      sound.playSuccess();
      showToast(`Biodata & No. WA Wali siswa "${editStdNama.trim()}" berhasil diperbarui!`);
      setEditingStudent(null);
      loadAllData();
    } catch (err: any) {
      alert('Gagal memperbarui data siswa: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteStudent = async (s: Student) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa "${s.nama}" (UID: ${s.rfid_uid})?`)) {
      try {
        await supabaseService.deleteStudent(s.id);
        sound.playAlert();
        showToast(`Data siswa "${s.nama}" telah dihapus.`);
        loadAllData();
      } catch (err: any) {
        alert('Gagal menghapus siswa: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleAddRombelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRmbNama.trim() || !formRmbWali.trim()) {
      alert('Nama Kelas dan Nama Wali Kelas wajib diisi!');
      return;
    }

    const cleanNama = formRmbNama.trim();
    const existing = rombelList.find(
      (r) => r.nama_kelas.toLowerCase() === cleanNama.toLowerCase()
    );
    if (existing) {
      alert(`Kelas [${cleanNama}] sudah terdaftar sebelumnya!`);
      return;
    }

    try {
      await supabaseService.addRombel({
        nama_kelas: cleanNama,
        nama_wali_kelas: formRmbWali.trim(),
        jadwal_harian: formRmbJadwal,
      });

      sound.playSuccess();
      showToast(`Kelas "${cleanNama}" berhasil ditambahkan ke tabel rombel!`);
      setIsAddRombelOpen(false);
      setFormRmbNama('');
      setFormRmbWali('');
      setFormRmbJadwal(DEFAULT_JADWAL_HARIAN);
      loadAllData();
    } catch (err: any) {
      alert('Gagal menambahkan kelas: ' + (err.message || 'Unknown error'));
    }
  };

  const handleOpenEditRombel = (r: Rombel) => {
    setEditingRombel(r);
    setEditRmbNama(r.nama_kelas);
    setEditRmbWali(r.nama_wali_kelas);
    setEditRmbJadwal(r.jadwal_harian ? JSON.parse(JSON.stringify(r.jadwal_harian)) : DEFAULT_JADWAL_HARIAN);
  };

  const handleEditRombelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRombel) return;
    if (!editRmbNama.trim() || !editRmbWali.trim()) {
      alert('Nama Kelas dan Nama Wali Kelas tidak boleh kosong!');
      return;
    }

    const cleanNama = editRmbNama.trim();
    const duplicate = rombelList.find(
      (r) => r.id !== editingRombel.id && r.nama_kelas.toLowerCase() === cleanNama.toLowerCase()
    );
    if (duplicate) {
      alert(`Nama kelas [${cleanNama}] sudah ada!`);
      return;
    }

    const oldNama = editingRombel.nama_kelas;
    try {
      await supabaseService.updateRombel(editingRombel.id, {
        nama_kelas: cleanNama,
        nama_wali_kelas: editRmbWali.trim(),
        jadwal_harian: editRmbJadwal,
      });

      if (oldNama !== cleanNama) {
        for (const st of students) {
          if (st.kelas === oldNama) {
            await supabaseService.updateStudent(st.id, {
              nama: st.nama,
              rfid_uid: st.rfid_uid,
              no_wa_wali: st.no_wa_wali,
              kelas: cleanNama,
            });
          }
        }
      }

      sound.playSuccess();
      showToast(`Data kelas "${cleanNama}" berhasil diperbarui!`);
      setEditingRombel(null);
      loadAllData();
    } catch (err: any) {
      alert('Gagal memperbarui kelas: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteRombel = async (r: Rombel) => {
    if (deletingRombelId === r.id) return;

    const studentCount = students.filter((s) => s.rombel_id === r.id || s.kelas === r.nama_kelas).length;
    const confirmMsg =
      studentCount > 0
        ? `Perhatian: Ada ${studentCount} siswa yang terdaftar di kelas "${r.nama_kelas}". Yakin ingin menghapus kelas ini?`
        : `Apakah Anda yakin ingin menghapus kelas "${r.nama_kelas}"?`;

    if (!confirm(confirmMsg)) return;

    setDeletingRombelId(r.id);
    try {
      await supabaseService.deleteRombel(r.id);

      // Setelah penghapusan di Supabase tuntas, perbarui state React & timpa cache localStorage
      setRombelList((prev) => {
        const nextList = prev.filter((item) => item.id !== r.id);
        supabaseService.saveLocalRombelCache(nextList);
        return nextList;
      });
      if (selectedRombelFilter === r.id) {
        setSelectedRombelFilter('ALL');
      }

      sound.playAlert();
      showToast(`Kelas "${r.nama_kelas}" telah dihapus secara permanen.`, 'success');
      await loadAllData();
    } catch (err: any) {
      console.error('Gagal menghapus kelas:', err);
      sound.playAlert();
      showToast(
        `Gagal menghapus kelas "${r.nama_kelas}": ${err?.message || 'Terjadi kesalahan pada database.'}`,
        'error'
      );
    } finally {
      setDeletingRombelId(null);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsrUsername.trim() || !formUsrPassword.trim() || !formUsrNama.trim()) {
      alert('Username, Password / Kata Sandi, dan Nama Lengkap wajib diisi!');
      return;
    }

    if (formUsrRole === 'Wali Kelas' && !formUsrAssignedClass.trim()) {
      alert('Kelas / Rombel Binaan wajib dipilih untuk akun dengan Role Wali Kelas!');
      return;
    }

    if (!isCurrentUserSuperAdmin && (formUsrRole === 'Super Admin' || formUsrRole === 'Admin')) {
      alert('Akses Ditolak: Hanya Super Admin yang diizinkan membuat akun dengan role Super Admin atau Admin!');
      return;
    }

    const cleanUser = formUsrUsername.trim().toLowerCase();
    const existing = userList.find((u) => u.username.toLowerCase() === cleanUser);
    if (existing) {
      alert(`Username [${cleanUser}] sudah digunakan!`);
      return;
    }

    try {
      await supabaseService.addAppUser({
        username: cleanUser,
        password: formUsrPassword.trim(),
        nama_lengkap: formUsrNama.trim(),
        nip: formUsrNip.trim(),
        role: formUsrRole,
        status: formUsrStatus,
        is_master: false,
        assignedClass: formUsrRole === 'Wali Kelas' ? formUsrAssignedClass.trim() : undefined,
        assigned_class: formUsrRole === 'Wali Kelas' ? formUsrAssignedClass.trim() : undefined,
        rombel: formUsrRole === 'Wali Kelas' ? formUsrAssignedClass.trim() : undefined,
        avatar_url: formUsrAvatar.trim() || undefined,
        avatarUrl: formUsrAvatar.trim() || undefined,
      });

      sound.playSuccess();
      showToast(
        `Akun "${formUsrNama.trim()}" (@${cleanUser})${
          formUsrRole === 'Wali Kelas' ? ` [Wali Kelas • Kelas ${formUsrAssignedClass.trim().replace(/^kelas\s+/i, '')}]` : ''
        } berhasil ditambahkan!`
      );
      setIsAddUserOpen(false);
      setFormUsrUsername('');
      setFormUsrPassword('');
      setShowAddPassword(false);
      setFormUsrNama('');
      setFormUsrNip('');
      setFormUsrRole('Operator');
      setFormUsrAssignedClass('');
      setFormUsrStatus('Aktif');
      setFormUsrAvatar('');
      loadAllData();
    } catch (err: any) {
      alert('Gagal menambahkan user: ' + (err.message || 'Unknown error'));
    }
  };

  const handleOpenEditUser = (u: AppUser) => {
    const isTargetMaster = Boolean(u.is_master) || u.username.toLowerCase() === 'naedie';
    if (!isCurrentUserSuperAdmin && (u.role === 'Super Admin' || isTargetMaster)) {
      alert('Akses Ditolak: Admin tidak memiliki wewenang untuk mengedit akun Super Admin / Master!');
      return;
    }
    setEditingUser(u);
    setEditUsrUsername(u.username);
    setEditUsrPassword(u.password || '');
    setShowEditPassword(false);
    setEditUsrNama(u.nama_lengkap || '');
    setEditUsrNip(u.nip || '');
    setEditUsrRole(u.role);
    setEditUsrAssignedClass(
      u.assignedClass ||
        u.assigned_class ||
        u.rombel ||
        (u.role === 'Wali Kelas' && rombelList.length > 0 ? rombelList[0].nama_kelas : '')
    );
    setEditUsrStatus(u.status || 'Aktif');
    setEditUsrAvatar(u.avatar_url || u.avatarUrl || '');
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUsrUsername.trim() || !editUsrPassword.trim() || !editUsrNama.trim()) {
      alert('Username, Password / Kata Sandi, dan Nama Lengkap tidak boleh kosong!');
      return;
    }

    const isTargetMaster = Boolean(editingUser.is_master) || editingUser.username.toLowerCase() === 'naedie';
    if (!isCurrentUserSuperAdmin && (editingUser.role === 'Super Admin' || isTargetMaster)) {
      alert('Akses Ditolak: Admin tidak dapat mengedit akun Super Admin!');
      return;
    }

    if (
      !isCurrentUserSuperAdmin &&
      (editUsrRole === 'Super Admin' || editUsrRole === 'Admin') &&
      editingUser.role !== editUsrRole
    ) {
      alert('Akses Ditolak: Hanya Super Admin yang dapat menetapkan role Super Admin atau Admin!');
      return;
    }

    const finalRole: UserRole = isTargetMaster ? 'Super Admin' : editUsrRole;
    if (finalRole === 'Wali Kelas' && !editUsrAssignedClass.trim()) {
      alert('Kelas / Rombel Binaan wajib dipilih untuk akun dengan Role Wali Kelas!');
      return;
    }

    const cleanUser = editUsrUsername.trim().toLowerCase();
    const duplicate = userList.find(
      (u) => u.id !== editingUser.id && u.username.toLowerCase() === cleanUser
    );
    if (duplicate) {
      alert(`Username [${cleanUser}] sudah digunakan pengguna lain!`);
      return;
    }

    const finalStatus: AppUser['status'] = isTargetMaster ? 'Aktif' : editUsrStatus;

    try {
      const updatedUsername = isTargetMaster ? editingUser.username : cleanUser;
      const updatedAssignedClass =
        finalRole === 'Wali Kelas' ? editUsrAssignedClass.trim() : undefined;

      await supabaseService.updateAppUser(editingUser.id, {
        username: updatedUsername,
        password: editUsrPassword.trim(),
        nama_lengkap: editUsrNama.trim(),
        nip: editUsrNip.trim(),
        role: finalRole,
        status: finalStatus,
        assignedClass: updatedAssignedClass,
        assigned_class: updatedAssignedClass,
        rombel: updatedAssignedClass,
        avatar_url: editUsrAvatar.trim() || undefined,
        avatarUrl: editUsrAvatar.trim() || undefined,
      });

      if (
        currentUser &&
        onUpdateCurrentUser &&
        (String(editingUser.id) === String(currentUser.id) ||
          editingUser.username.toLowerCase() === currentUser.username.toLowerCase())
      ) {
        onUpdateCurrentUser({
          ...currentUser,
          username: updatedUsername,
          password: editUsrPassword.trim() || currentUser.password,
          nama_lengkap: editUsrNama.trim(),
          nip: editUsrNip.trim(),
          role: finalRole,
          status: finalStatus,
          assignedClass: updatedAssignedClass,
          assigned_class: updatedAssignedClass,
          rombel: updatedAssignedClass,
          avatar_url: editUsrAvatar.trim() || undefined,
          avatarUrl: editUsrAvatar.trim() || undefined,
        });
      }

      sound.playSuccess();
      showToast(`Data akun "${editUsrNama.trim()}" berhasil diperbarui!`);
      setEditingUser(null);
      loadAllData();
    } catch (err: any) {
      alert('Gagal memperbarui user: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    const isTargetMaster = Boolean(u.is_master) || u.username.toLowerCase() === 'naedie';
    if (isTargetMaster) {
      alert('Proteksi Sistem: Akun MASTER OWNER tidak dapat dihapus oleh siapa pun!');
      return;
    }
    if (!isCurrentUserSuperAdmin && u.role === 'Super Admin') {
      alert('Akses Ditolak: Admin tidak memiliki wewenang untuk menghapus akun Super Admin!');
      return;
    }
    if (userList.length <= 1) {
      alert('Tidak dapat menghapus user terakhir dalam sistem!');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus akun "${u.nama_lengkap}" (@${u.username})?`)) {
      try {
        await supabaseService.deleteAppUser(u.id);
        sound.playAlert();
        showToast(`User "${u.nama_lengkap}" telah dihapus.`);
        loadAllData();
      } catch (err: any) {
        alert('Gagal menghapus user: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const filteredStudents = students.filter((s) => {
    // Jika login sebagai Wali Kelas, kunci filter ke kelas binaan Wali Kelas
    if (isWaliKelas && waliAssignedClass) {
      const cleanWaliClass = waliAssignedClass.replace(/^kelas\s+/i, '').trim().toLowerCase();
      const matchedWaliRombel = rombelList.find(
        (r) =>
          r.id.toLowerCase() === cleanWaliClass ||
          r.nama_kelas.trim().toLowerCase() === cleanWaliClass ||
          r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
      );
      const studentKelasClean = String(s.kelas || '')
        .replace(/^kelas\s+/i, '')
        .trim()
        .toLowerCase();
      const isInWaliClass =
        studentKelasClean === cleanWaliClass ||
        String(s.kelas || '').trim().toLowerCase() === waliAssignedClass.toLowerCase() ||
        (matchedWaliRombel &&
          (s.rombel_id === matchedWaliRombel.id ||
            s.class_id === matchedWaliRombel.id ||
            studentKelasClean === matchedWaliRombel.nama_kelas.trim().toLowerCase()));
      if (!isInWaliClass) return false;
    } else if (selectedRombelFilter !== 'ALL') {
      // Filter berdasarkan Kelas (Rombel) untuk Admin / Super Admin
      const matchedRombel = rombelList.find((r) => r.id === selectedRombelFilter);
      const isMatchRombel =
        s.rombel_id === selectedRombelFilter ||
        s.class_id === selectedRombelFilter ||
        (s.kelas && s.kelas.trim().toLowerCase() === selectedRombelFilter.trim().toLowerCase()) ||
        (matchedRombel &&
          s.kelas &&
          s.kelas.trim().toLowerCase() === matchedRombel.nama_kelas.trim().toLowerCase());
      if (!isMatchRombel) return false;
    }

    // Filter berdasarkan Pencarian Teks
    if (!searchStudent.trim()) return true;
    const q = searchStudent.trim().toLowerCase();
    return (
      s.nama.toLowerCase().includes(q) ||
      (s.nama_wali && s.nama_wali.toLowerCase().includes(q)) ||
      (s.nisn && s.nisn.toLowerCase().includes(q)) ||
      (s.uid_kartu || s.rfid_uid || '').toLowerCase().includes(q) ||
      (s.no_wa_wali || '').toLowerCase().includes(q) ||
      (s.kelas && s.kelas.toLowerCase().includes(q))
    );
  });

  const totalFilteredStudents = filteredStudents.length;
  const totalStudentPages = Math.max(1, Math.ceil(totalFilteredStudents / studentsPerPage));
  const safeStudentPage = Math.min(studentPage, totalStudentPages);
  const studentStartIndex = (safeStudentPage - 1) * studentsPerPage;
  const studentEndIndex = Math.min(studentStartIndex + studentsPerPage, totalFilteredStudents);
  const paginatedStudents = filteredStudents.slice(
    studentStartIndex,
    studentStartIndex + studentsPerPage
  );

  const resolveStudentClassLabel = (s: Student): string => {
    const matchedRombel = rombelList.find(
      (item) => item.id === s.rombel_id || item.id === s.class_id || item.nama_kelas === s.kelas
    );
    const rawClassName = matchedRombel ? matchedRombel.nama_kelas : s.kelas || 'Umum';
    return rawClassName.toLowerCase().startsWith('kelas') ? rawClassName : `Kelas ${rawClassName}`;
  };

  const activeFilterRombelLabel = (() => {
    if (selectedRombelFilter === 'ALL') return 'Semua Kelas (Seluruh Rombel)';
    const matched = rombelList.find((r) => r.id === selectedRombelFilter);
    if (!matched) return `Kelas ${selectedRombelFilter}`;
    return matched.nama_kelas.toLowerCase().startsWith('kelas')
      ? matched.nama_kelas
      : `Kelas ${matched.nama_kelas}`;
  })();

  // ==================== EKSPOR DATA SISWA (EXCEL .XLSX & CSV .CSV) ====================
  const buildStudentExportPayload = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStamp = `${yyyy}-${mm}-${dd}`;

    let rawClassSegment = 'Semua';
    if (isWaliKelas && waliAssignedClass) {
      rawClassSegment = waliAssignedClass;
    } else if (selectedRombelFilter !== 'ALL') {
      const matched = rombelList.find((r) => r.id === selectedRombelFilter);
      rawClassSegment = matched ? matched.nama_kelas : selectedRombelFilter;
    }

    const safeClassSegment =
      rawClassSegment
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Semua';

    const fileBaseName = `Data_Siswa_${safeClassSegment}_${dateStamp}`;

    const headers = [
      'No',
      'NIS',
      'NISN',
      'Nama Lengkap',
      'Jenis Kelamin',
      'Kelas / Rombel',
      'UID Kartu RFID',
      'Nama Orang Tua / Wali',
      'No. WhatsApp Wali',
    ];

    const rows = filteredStudents.map((s, idx) => {
      const matchedRombel = rombelList.find(
        (item) => item.id === s.rombel_id || item.id === s.class_id || item.nama_kelas === s.kelas
      );
      const kelasValue = matchedRombel ? matchedRombel.nama_kelas : s.kelas || 'Umum';
      const jenisKelamin = String(
        (s as any).jenis_kelamin || (s as any).gender || '-'
      ).trim();

      return [
        idx + 1,
        String(s.nis || '').trim(),
        String(s.nisn || '').trim(),
        String(s.nama || '').trim(),
        jenisKelamin,
        String(kelasValue).trim(),
        String(s.uid_kartu || s.rfid_uid || '').trim().toUpperCase(),
        String(s.nama_wali || '').trim(),
        String(s.no_wa_wali || '').trim(),
      ];
    });

    return { headers, rows, fileBaseName };
  };

  const handleExportStudentsExcel = () => {
    setIsExportMenuOpen(false);
    if (filteredStudents.length === 0) {
      showToast('Tidak ada data siswa yang tersedia untuk diekspor.', 'error');
      return;
    }

    try {
      const { headers, rows, fileBaseName } = buildStudentExportPayload();
      const sheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Paksa kolom angka sensitif (NIS, NISN, UID Kartu RFID, No. WhatsApp Wali) sebagai tipe String/Text
      // agar nol di depan tidak hilang dan tidak berubah menjadi notasi ilmiah di Microsoft Excel
      const textColumnIndices = [1, 2, 6, 8];
      for (let r = 1; r <= rows.length; r++) {
        for (const c of textColumnIndices) {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          const rawVal = String(sheetData[r][c] ?? '');
          worksheet[cellAddress] = {
            t: 's',
            v: rawVal,
            z: '@',
          };
        }
      }

      worksheet['!cols'] = [
        { wch: 6 },  // No
        { wch: 16 }, // NIS
        { wch: 18 }, // NISN
        { wch: 28 }, // Nama Lengkap
        { wch: 16 }, // Jenis Kelamin
        { wch: 16 }, // Kelas / Rombel
        { wch: 20 }, // UID Kartu RFID
        { wch: 26 }, // Nama Orang Tua / Wali
        { wch: 20 }, // No. WhatsApp Wali
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');
      XLSX.writeFile(workbook, `${fileBaseName}.xlsx`);

      sound.playSuccess();
      showToast(
        `Berhasil mengekspor ${filteredStudents.length} data siswa ke ${fileBaseName}.xlsx`,
        'success'
      );
    } catch (err: any) {
      console.error('Gagal mengekspor Excel siswa:', err);
      sound.playAlert();
      showToast(
        `Gagal mengekspor file Excel: ${err?.message || 'Terjadi kesalahan sistem.'}`,
        'error'
      );
    }
  };

  const handleExportStudentsCsv = () => {
    setIsExportMenuOpen(false);
    if (filteredStudents.length === 0) {
      showToast('Tidak ada data siswa yang tersedia untuk diekspor.', 'error');
      return;
    }

    try {
      const { headers, rows, fileBaseName } = buildStudentExportPayload();
      const escapeCsvCell = (value: string | number) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csvLines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((row) => row.map(escapeCsvCell).join(',')),
      ];

      const csvContent = '\uFEFF' + csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileBaseName}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      sound.playSuccess();
      showToast(
        `Berhasil mengekspor ${filteredStudents.length} data siswa ke ${fileBaseName}.csv`,
        'success'
      );
    } catch (err: any) {
      console.error('Gagal mengekspor CSV siswa:', err);
      sound.playAlert();
      showToast(
        `Gagal mengekspor file CSV: ${err?.message || 'Terjadi kesalahan sistem.'}`,
        'error'
      );
    }
  };

  // Fungsi Cetak Massal Kartu QR (Standar ID Card Kertas A4)
  const handleExecuteBatchQrPrint = () => {
    if (filteredStudents.length === 0) return;

    const schoolTitle = (schoolSettings.appTitle || DEFAULT_APP_TITLE).toUpperCase();
    const schoolSubtitle = schoolSettings.appSubtitle || DEFAULT_APP_SUBTITLE;
    const schoolLogo = schoolSettings.appLogo || '';

    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const cardsHtml = filteredStudents
      .map((s) => {
        const classLabel = resolveStudentClassLabel(s);
        const uidCode = s.uid_kartu || s.rfid_uid || s.nisn || s.id;
        const nisnText = s.nisn || '-';
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
          uidCode
        )}&margin=6`;

        return `
          <div class="qr-id-card">
            <div class="card-header">
              ${
                schoolLogo
                  ? `<img src="${schoolLogo}" alt="Logo" class="school-logo" />`
                  : `<div class="school-logo-placeholder">🎓</div>`
              }
              <div class="school-meta">
                <div class="school-title">${escapeHtml(schoolTitle)}</div>
                <div class="school-sub">${escapeHtml(schoolSubtitle)}</div>
              </div>
            </div>

            <div class="card-body">
              <div class="qr-box">
                <img src="${qrImgUrl}" alt="QR ${escapeHtml(s.nama)}" class="qr-img" crossorigin="anonymous" />
              </div>

              <div class="student-name">${escapeHtml(s.nama)}</div>
              <div class="class-badge">${escapeHtml(classLabel)}</div>

              <div class="meta-box">
                <div class="meta-row">
                  <span class="meta-label">NISN</span>
                  <span class="meta-val">${escapeHtml(nisnText)}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">UID KARTU</span>
                  <span class="meta-val uid">${escapeHtml(uidCode)}</span>
                </div>
              </div>
            </div>

            <div class="card-footer">
              Kartu Presensi Pintar · Scan QR / Tap RFID
            </div>
          </div>
        `;
      })
      .join('');

    const htmlDoc = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Cetak Massal Kartu QR Presensi - ${escapeHtml(activeFilterRombelLabel)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #0f172a;
            background: #ffffff;
          }
          .sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 8px;
            margin-bottom: 12px;
            font-size: 11px;
            color: #475569;
          }
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(${qrPrintColumns}, 1fr);
            gap: 10px;
          }
          .qr-id-card {
            border: 1.5px dashed #94a3b8;
            border-radius: 12px;
            padding: 10px;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
          }
          .card-header {
            display: flex;
            align-items: center;
            gap: 7px;
            background: #0f172a;
            color: #ffffff;
            padding: 7px 9px;
            border-radius: 8px;
            text-align: left;
            margin-bottom: 8px;
          }
          .school-logo {
            width: 26px;
            height: 26px;
            object-fit: contain;
            border-radius: 5px;
            background: #ffffff;
            padding: 2px;
            flex-shrink: 0;
          }
          .school-logo-placeholder {
            width: 26px;
            height: 26px;
            border-radius: 5px;
            background: #2563eb;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            flex-shrink: 0;
          }
          .school-meta {
            min-width: 0;
            flex: 1;
          }
          .school-title {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.3px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .school-sub {
            font-size: 7.5px;
            color: #cbd5e1;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .card-body {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .qr-box {
            padding: 6px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #f8fafc;
            margin-bottom: 7px;
          }
          .qr-img {
            width: ${qrPrintColumns === 2 ? '128px' : '106px'};
            height: ${qrPrintColumns === 2 ? '128px' : '106px'};
            display: block;
          }
          .student-name {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.25;
            margin-bottom: 4px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .class-badge {
            display: inline-block;
            padding: 2px 9px;
            border-radius: 999px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            font-size: 9.5px;
            font-weight: 700;
            margin-bottom: 7px;
          }
          .meta-box {
            width: 100%;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 7px;
            padding: 5px 8px;
            font-size: 9px;
            margin-bottom: 6px;
          }
          .meta-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5px 0;
          }
          .meta-label {
            color: #64748b;
            font-weight: 600;
          }
          .meta-val {
            font-family: monospace;
            font-weight: 700;
            color: #0f172a;
          }
          .meta-val.uid {
            color: #1d4ed8;
          }
          .card-footer {
            font-size: 7.5px;
            color: #64748b;
            border-top: 1px solid #f1f5f9;
            padding-top: 4px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
        </style>
      </head>
      <body>
        <div class="sheet-header">
          <div><strong>${escapeHtml(schoolTitle)}</strong> — Lembar Cetak Kartu QR Presensi Siswa (${escapeHtml(
      activeFilterRombelLabel
    )})</div>
          <div>Total: <strong>${filteredStudents.length} Kartu</strong> · Gunting mengikuti garis putus-putus</div>
        </div>
        <div class="cards-grid">
          ${cardsHtml}
        </div>
      </body>
      </html>
    `;

    try {
      const existingIframe = document.getElementById('batch-qr-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'batch-qr-print-iframe';
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
        doc.write(htmlDoc);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 650);
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  const filteredRombel = rombelList.filter(
    (r) =>
      r.nama_kelas.toLowerCase().includes(searchRombel.toLowerCase()) ||
      r.nama_wali_kelas.toLowerCase().includes(searchRombel.toLowerCase())
  );

  const totalFilteredClasses = filteredRombel.length;
  const totalClassPages = Math.max(1, Math.ceil(totalFilteredClasses / CLASSES_PER_PAGE));
  const safeClassPage = Math.min(classPage, totalClassPages);
  const classStartIndex = (safeClassPage - 1) * CLASSES_PER_PAGE;
  const classEndIndex = Math.min(classStartIndex + CLASSES_PER_PAGE, totalFilteredClasses);
  const paginatedClasses = filteredRombel.slice(
    classStartIndex,
    classStartIndex + CLASSES_PER_PAGE
  );

  // Auto-reset ke halaman 1 saat kata kunci pencarian kelas berubah
  useEffect(() => {
    setClassPage(1);
  }, [searchRombel]);

  // Auto-mundur ke halaman sebelumnya jika item terakhir di halaman aktif dihapus
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalFilteredClasses / CLASSES_PER_PAGE));
    if (classPage > maxPage) {
      setClassPage(maxPage);
    }
  }, [totalFilteredClasses, classPage]);

  const classPageNumbers: Array<number | 'ellipsis'> = (() => {
    if (totalClassPages <= 7) {
      return Array.from({ length: totalClassPages }, (_, i) => i + 1);
    }
    const pages: Array<number | 'ellipsis'> = [1];
    const start = Math.max(2, safeClassPage - 1);
    const end = Math.min(totalClassPages - 1, safeClassPage + 1);
    if (start > 2) pages.push('ellipsis');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalClassPages - 1) pages.push('ellipsis');
    pages.push(totalClassPages);
    return pages;
  })();

  const filteredUsers = userList.filter(
    (u) =>
      u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.nama_lengkap || '').toLowerCase().includes(searchUser.toLowerCase()) ||
      u.role.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl text-white shadow-xl backdrop-blur-xl flex items-center gap-2 text-xs font-semibold ${
            toastType === 'error' ? 'bg-rose-600' : 'bg-cyan-500'
          }`}
        >
          {toastType === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="ios-glass-card rounded-2xl p-5 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {isWaliKelas
                    ? `Data Siswa Binaan (${formattedWaliClassLabel})`
                    : 'Kelola Member & Master Data'}
                </h2>
                {isWaliKelas && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Wali Kelas • {formattedWaliClassLabel}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isWaliKelas
                  ? `Menampilkan daftar siswa khusus ${formattedWaliClassLabel}. Anda dapat memperbarui biodata siswa, nama orang tua, dan nomor WhatsApp wali murid.`
                  : 'Pusat administrasi relasi data sekolah: Siswa & Kartu RFID, Rombel / Kelas, dan Akun Operator Presensi.'}
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0">
            {isWaliKelas ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold">
                <Users className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Total Siswa {formattedWaliClassLabel}: {filteredStudents.length} Siswa</span>
              </div>
            ) : (
              <>
                {activeSubTab === 'students' && (
                  <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:w-auto sm:items-center">
                    <button
                      onClick={() => handleOpenCsvModal('students')}
                      className="w-full justify-center sm:w-auto whitespace-nowrap py-2.5 px-3 text-xs sm:text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-semibold flex items-center gap-2 transition active:scale-95"
                    >
                      <Upload className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span className="md:hidden">Import Data</span>
                      <span className="hidden md:inline">Import CSV Siswa</span>
                    </button>

                    {/* Export Data Dropdown (Excel .xlsx & CSV .csv) */}
                    <div className="relative w-full sm:w-auto" ref={exportDropdownRef}>
                      <button
                        type="button"
                        disabled={filteredStudents.length === 0}
                        onClick={() => {
                          if (filteredStudents.length === 0) {
                            showToast('Tidak ada data siswa yang tersedia untuk diekspor.', 'error');
                            return;
                          }
                          setIsExportMenuOpen((prev) => !prev);
                        }}
                        title={
                          filteredStudents.length === 0
                            ? 'Belum ada data siswa yang dapat diekspor'
                            : `Ekspor ${filteredStudents.length} data siswa sesuai filter aktif`
                        }
                        className="w-full justify-center sm:w-auto whitespace-nowrap py-2.5 px-3 text-xs sm:text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-semibold flex items-center gap-1.5 sm:gap-2 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
                      >
                        <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Export Data</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform duration-150 ${
                            isExportMenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isExportMenuOpen && filteredStudents.length > 0 && (
                        <div className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-2xl bg-white border border-gray-200 shadow-xl py-1.5 z-40">
                          <div className="px-3 py-1.5 border-b border-gray-100">
                            <p className="text-[11px] font-semibold text-gray-500">
                              Ekspor {filteredStudents.length} Siswa
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleExportStudentsExcel}
                            className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Export Excel (.xlsx)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportStudentsCsv}
                            className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 flex items-center gap-2.5 transition"
                          >
                            <FileText className="w-4 h-4 text-cyan-600 shrink-0" />
                            <span>Export CSV (.csv)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setFormStdKelas(rombelList.length > 0 ? rombelList[0].id : '');
                        setFormStdAvatar('');
                        setIsAddStudentOpen(true);
                      }}
                      className="col-span-2 w-full justify-center sm:w-auto whitespace-nowrap py-2.5 px-3 text-xs sm:text-sm rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold flex items-center gap-2 shadow-sm active:scale-95 transition"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span className="md:hidden">Siswa Baru</span>
                      <span className="hidden md:inline">Tambah Siswa Baru</span>
                    </button>
                  </div>
                )}

                {activeSubTab === 'classes' && (
                  <button
                    onClick={() => {
                      setFormRmbJadwal(DEFAULT_JADWAL_HARIAN);
                      setIsAddRombelOpen(true);
                    }}
                    className="w-full justify-center sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Tambah Kelas (Rombel)</span>
                  </button>
                )}

                {activeSubTab === 'users' && (
                  <div className="flex flex-col gap-2.5 w-full sm:flex-row sm:w-auto sm:items-center">
                    <button
                      onClick={() => handleOpenCsvModal('users')}
                      className="w-full justify-center sm:w-auto whitespace-nowrap py-2.5 px-3 text-xs sm:text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-semibold flex items-center gap-2 transition active:scale-95"
                    >
                      <Upload className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span className="md:hidden">Import CSV</span>
                      <span className="hidden md:inline">Import CSV User</span>
                    </button>
                    <button
                      onClick={() => {
                        setFormUsrAssignedClass(rombelList.length > 0 ? rombelList[0].nama_kelas : '1A');
                        setIsAddUserOpen(true);
                      }}
                      className="w-full justify-center sm:w-auto whitespace-nowrap py-2.5 px-3 text-xs sm:text-sm rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold flex items-center gap-2 shadow-sm active:scale-95 transition"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span className="md:hidden">User Baru</span>
                      <span className="hidden md:inline">Tambah User Operator</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Apple Segmented Control Sub-Tabs (Hanya untuk Admin & Super Admin) */}
        {!isWaliKelas && (
          <div className="mt-5 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 border border-slate-200/80 rounded-xl w-full sm:inline-flex sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveSubTab('students')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 ease-out active:scale-95 whitespace-nowrap ${
                  activeSubTab === 'students'
                    ? 'bg-cyan-500 text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Users
                  className={`w-4 h-4 shrink-0 ${
                    activeSubTab === 'students' ? 'text-white' : 'text-cyan-600'
                  }`}
                />
                <span>Siswa</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                    activeSubTab === 'students'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {students.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('classes')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 ease-out active:scale-95 whitespace-nowrap ${
                  activeSubTab === 'classes'
                    ? 'bg-cyan-500 text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <School
                  className={`w-4 h-4 shrink-0 ${
                    activeSubTab === 'classes' ? 'text-white' : 'text-cyan-600'
                  }`}
                />
                <span>Kelas</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                    activeSubTab === 'classes'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {rombelList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('users')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 ease-out active:scale-95 whitespace-nowrap ${
                  activeSubTab === 'users'
                    ? 'bg-cyan-500 text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    activeSubTab === 'users' ? 'text-white' : 'text-cyan-600'
                  }`}
                />
                <span>Admin</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                    activeSubTab === 'users'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {userList.length}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUB-TAB 1: DATA SISWA */}
      {activeSubTab === 'students' && (
        <div className="ios-glass-card rounded-2xl p-5 border border-gray-200 space-y-4">
          {/* Baris Pencarian, Filter Kelas (Rombel) & Tombol Cetak Massal Kartu QR */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Kolom Pencarian Teks */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchStudent}
                  onChange={(e) => {
                    setSearchStudent(e.target.value);
                    setStudentPage(1);
                  }}
                  placeholder="Cari nama siswa, NISN, nama orang tua/wali, atau No. WA..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-600 shadow-2xs transition"
                />
              </div>

              {/* Dropdown Filter Kelas (Rombel) - Terkunci otomatis jika login sebagai Wali Kelas */}
              <div className="relative w-full sm:w-56 shrink-0">
                {isWaliKelas ? (
                  <Lock className="w-3.5 h-3.5 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                ) : (
                  <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                <select
                  value={selectedRombelFilter}
                  disabled={isWaliKelas}
                  onChange={(e) => {
                    setSelectedRombelFilter(e.target.value);
                    setStudentPage(1);
                  }}
                  className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold shadow-2xs transition ${
                    isWaliKelas
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 cursor-not-allowed'
                      : 'bg-gray-50 border-gray-200 text-gray-800 focus:bg-white focus:outline-none focus:border-blue-600'
                  }`}
                >
                  {!isWaliKelas && <option value="ALL">Semua Kelas (Seluruh Rombel)</option>}
                  {rombelList.map((r) => {
                    const label = r.nama_kelas.toLowerCase().startsWith('kelas')
                      ? r.nama_kelas
                      : `Kelas ${r.nama_kelas}`;
                    return (
                      <option key={r.id} value={r.id}>
                        {label}
                      </option>
                    );
                  })}
                  {isWaliKelas &&
                    !rombelList.some(
                      (r) =>
                        r.id === selectedRombelFilter ||
                        r.nama_kelas.toLowerCase() ===
                          waliAssignedClass.replace(/^kelas\s+/i, '').toLowerCase()
                    ) && <option value={selectedRombelFilter}>{formattedWaliClassLabel}</option>}
                </select>
              </div>

              {/* Tombol Cetak Massal Kartu QR (X) */}
              <button
                type="button"
                disabled={filteredStudents.length === 0}
                onClick={() => setIsBatchQrPrintOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-2xs whitespace-nowrap shrink-0"
              >
                <span>🖨️ Cetak Kartu QR ({filteredStudents.length})</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {totalFilteredStudents === 0 ? (
                  <>
                    Menampilkan <span className="font-bold text-gray-900 font-mono">0</span> dari{' '}
                    <span className="font-bold text-gray-900 font-mono">{students.length}</span> siswa
                  </>
                ) : (
                  <>
                    Menampilkan{' '}
                    <span className="font-bold text-gray-900 font-mono">
                      {studentStartIndex + 1}–{studentEndIndex}
                    </span>{' '}
                    dari{' '}
                    <span className="font-bold text-gray-900 font-mono">
                      {totalFilteredStudents}
                    </span>{' '}
                    siswa
                    {selectedRombelFilter !== 'ALL' && (
                      <span className="text-gray-400"> (terfilter dari total {students.length})</span>
                    )}
                  </>
                )}
              </span>
              {totalStudentPages > 1 && (
                <span className="font-mono text-[11px] text-gray-400">
                  Hal {safeStudentPage} / {totalStudentPages}
                </span>
              )}
            </div>
          </div>

          {/* MOBILE EXPANDABLE LIST TILE (ACCORDION CARD): DATA SISWA */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {paginatedStudents.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                {searchStudent || selectedRombelFilter !== 'ALL'
                  ? 'Tidak ada siswa yang sesuai filter / pencarian.'
                  : 'Belum ada data siswa.'}
              </div>
            ) : (
              paginatedStudents.map((s) => {
                const matchedRombel = rombelList.find(
                  (item) =>
                    item.id === s.rombel_id ||
                    item.id === s.class_id ||
                    item.nama_kelas === s.kelas
                );
                const rawClassName = matchedRombel ? matchedRombel.nama_kelas : s.kelas || 'Umum';
                const displayClassBadge = rawClassName.toLowerCase().startsWith('kelas')
                  ? rawClassName
                  : `Kelas ${rawClassName}`;
                const cardUid = s.uid_kartu || s.rfid_uid || '-';
                const isExpanded = expandedStudentId === s.id;

                return (
                  <div
                    key={s.id}
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
                        setExpandedStudentId((prev) => (prev === s.id ? null : s.id))
                      }
                      className="w-full p-3.5 flex items-start justify-between gap-2.5 text-left select-none"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Avatar Siswa atau Inisial Fallback Bertema Dinamis */}
                        {s.avatar_url ? (
                          <img
                            src={s.avatar_url}
                            alt={s.nama}
                            className="w-10 h-10 rounded-full object-cover border border-[var(--primary-accent-border)] shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {getStudentInitials(s.nama)}
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Baris 1: Eyebrow (Badge Kelas & Identitas NISN) */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold text-[10px] leading-tight whitespace-nowrap">
                              {displayClassBadge}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono truncate">
                              NISN: {s.nisn || '-'}
                            </span>
                          </div>

                          {/* Baris 2: Data Utama (Nama Siswa) */}
                          <div className="font-bold text-slate-800 text-[13px] sm:text-sm leading-snug line-clamp-2">
                            {s.nama}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 pt-1">
                        <ChevronDown
                          size={16}
                          className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                            isExpanded ? 'rotate-180 text-[var(--primary-accent-text)]' : ''
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
                        {s.nama_wali && (
                          <div className="text-xs text-slate-600 bg-slate-50/80 border border-slate-200/70 px-3 py-2 rounded-xl flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Orang Tua / Wali
                            </span>
                            <span className="font-bold text-slate-800 text-right truncate">
                              {s.nama_wali}
                            </span>
                          </div>
                        )}

                        {/* Atribut Data Sekunder: UID RFID & Nomor WA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                            <div className="flex items-center gap-2 min-w-0">
                              <CreditCard className="w-4 h-4 text-cyan-600 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                                  UID Kartu RFID
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-700 truncate block mt-0.5">
                                  {cardUid}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyUid(s.uid_kartu || s.rfid_uid || '')}
                              title="Salin UID Kartu"
                              className="p-1.5 rounded-lg bg-white hover:bg-cyan-50 text-slate-600 hover:text-cyan-600 border border-slate-200 transition shrink-0 ml-2"
                            >
                              {copiedUid === (s.uid_kartu || s.rfid_uid) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone className="w-4 h-4 text-cyan-600 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                                  No. WA Wali
                                </span>
                                <a
                                  href={`https://wa.me/${s.no_wa_wali}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-700 hover:text-cyan-600 underline mt-0.5"
                                >
                                  <span>{s.no_wa_wali || '-'}</span>
                                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Deretan Tombol Aksi (CRUD) */}
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentQr(s)}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                          >
                            <QrCode size={14} className="text-cyan-600 shrink-0" />
                            <span>Kartu QR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditStudent(s)}
                            className="flex-1 py-2 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                          >
                            <Edit2 size={14} className="text-cyan-600 shrink-0" />
                            <span>{isWaliKelas ? 'Edit Biodata' : 'Edit Siswa'}</span>
                          </button>
                          {!isWaliKelas && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(s)}
                              title="Hapus Siswa"
                              className="p-2 rounded-xl bg-rose-50/80 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs transition shrink-0 active:scale-95"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW: DATA SISWA */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-semibold pl-2">#</th>
                  <th className="pb-3 font-semibold">Nama Siswa &amp; Wali</th>
                  <th className="pb-3 font-semibold">UID Kartu RFID</th>
                  <th className="pb-3 font-semibold">No. WA Wali</th>
                  <th className="pb-3 font-semibold">Kelas (Rombel)</th>
                  <th className="pb-3 font-semibold text-right pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      {searchStudent || selectedRombelFilter !== 'ALL'
                        ? 'Tidak ada siswa yang sesuai filter / pencarian.'
                        : 'Belum ada data siswa.'}
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition group">
                      <td className="py-3.5 pl-2 font-mono text-gray-400 text-[11px]">
                        {studentStartIndex + idx + 1}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          {s.avatar_url ? (
                            <img
                              src={s.avatar_url}
                              alt={s.nama}
                              className="w-9 h-9 rounded-full object-cover border border-[var(--primary-accent-border)] shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {getStudentInitials(s.nama)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900">{s.nama}</div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              NISN: {s.nisn || '-'}
                              {s.nama_wali ? ` · Wali: ${s.nama_wali}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full text-gray-700 font-mono text-xs font-semibold">
                          <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          <span>{s.uid_kartu || s.rfid_uid}</span>
                          <button
                            onClick={() => handleCopyUid(s.uid_kartu || s.rfid_uid || '')}
                            title="Salin UID Kartu"
                            className="hover:text-blue-600 transition ml-1"
                          >
                            {copiedUid === (s.uid_kartu || s.rfid_uid) ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <a
                          href={`https://wa.me/${s.no_wa_wali}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-gray-700 hover:text-blue-600 font-mono text-xs transition underline"
                        >
                          <Phone className="w-3 h-3 text-blue-600" />
                          <span>{s.no_wa_wali}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      </td>
                      <td className="py-3.5">
                        {(() => {
                          const r = rombelList.find((item) => item.id === s.rombel_id || item.id === s.class_id || item.nama_kelas === s.kelas);
                          return (
                            <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-medium text-[11px]">
                              {r ? r.nama_kelas : (s.kelas || 'Umum')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenStudentQr(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold transition flex items-center gap-1"
                          >
                            <QrCode className="w-3.5 h-3.5 text-blue-600" />
                            <span>Lihat QR</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditStudent(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>{isWaliKelas ? 'Edit Biodata / WA' : 'Edit'}</span>
                          </button>
                          {!isWaliKelas && (
                            <button
                              onClick={() => handleDeleteStudent(s)}
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-rose-600 border border-gray-200 text-xs transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* KONTROL NAVIGASI PAGINASI DI BAGIAN BAWAH DAFTAR SISWA */}
          {totalFilteredStudents > 0 && (
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-slate-500 font-medium">
                Menampilkan{' '}
                <span className="font-bold text-slate-800 font-mono">
                  {studentStartIndex + 1}–{studentEndIndex}
                </span>{' '}
                dari{' '}
                <span className="font-bold text-slate-800 font-mono">
                  {totalFilteredStudents}
                </span>{' '}
                siswa{' '}
                <span className="text-slate-400 font-mono">
                  (Hal {safeStudentPage} dari {totalStudentPages})
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeStudentPage <= 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                >
                  &lt; Sebelumnya
                </button>
                <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold whitespace-nowrap">
                  Hal {safeStudentPage} dari {totalStudentPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setStudentPage((prev) => Math.min(totalStudentPages, prev + 1))
                  }
                  disabled={safeStudentPage >= totalStudentPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                >
                  Berikutnya &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DATA KELAS (ROMBEL) */}
      {activeSubTab === 'classes' && (
        <div className="ios-glass-card rounded-2xl p-5 border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                value={searchRombel}
                onChange={(e) => {
                  setSearchRombel(e.target.value);
                  setClassPage(1);
                }}
                placeholder="Cari nama kelas atau wali kelas..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 shadow-sm"
              />
            </div>
            <div className="text-xs text-gray-500">
              Total Rombel: <span className="font-bold text-gray-900">{rombelList.length} Kelas</span>
            </div>
          </div>

          {/* MOBILE EXPANDABLE LIST TILE (ACCORDION CARD): DATA KELAS */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {filteredRombel.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                {searchRombel ? 'Tidak ada kelas yang cocok.' : 'Belum ada data kelas.'}
              </div>
            ) : (
              paginatedClasses.map((r) => {
                const studentCount = students.filter(
                  (s) => s.rombel_id === r.id || s.class_id === r.id || s.kelas === r.nama_kelas
                ).length;
                const isExpanded = expandedRombelId === r.id;

                return (
                  <div
                    key={r.id}
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
                        setExpandedRombelId((prev) => (prev === r.id ? null : r.id))
                      }
                      className="w-full p-3.5 flex items-start justify-between gap-2.5 text-left select-none"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-[var(--primary-accent-light)] border border-[var(--primary-accent-border)] text-[var(--primary-accent-text)] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Baris 1: Eyebrow (Badge Jumlah Siswa & Identitas Kelas) */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold font-mono text-[10px] leading-tight whitespace-nowrap">
                              <Users className="w-2.5 h-2.5" />
                              <span>{studentCount} Siswa</span>
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              Wali: {r.nama_wali_kelas || '-'}
                            </span>
                          </div>

                          {/* Baris 2: Data Utama (Nama Kelas) */}
                          <div className="font-bold text-slate-800 text-[13px] sm:text-sm leading-snug line-clamp-2">
                            {r.nama_kelas}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 pt-1">
                        <ChevronDown
                          size={16}
                          className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                            isExpanded ? 'rotate-180 text-[var(--primary-accent-text)]' : ''
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                              Nama Wali Kelas
                            </span>
                            <span className="text-xs font-bold text-slate-800 block mt-1 break-words">
                              {r.nama_wali_kelas || '-'}
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                              ID Rombel / Kelas
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-700 block mt-1 truncate">
                              {r.id}
                            </span>
                          </div>
                        </div>

                        {/* Deretan Tombol Aksi (CRUD) */}
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRombel(r)}
                            className="flex-1 py-2 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                          >
                            <Calendar size={14} className="text-cyan-600 shrink-0" />
                            <span>Jadwal Harian</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditRombel(r)}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                          >
                            <Edit2 size={14} className="text-cyan-600 shrink-0" />
                            <span>Edit Kelas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRombel(r)}
                            title="Hapus Kelas"
                            className="p-2 rounded-xl bg-rose-50/80 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs transition shrink-0 active:scale-95"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW: DATA KELAS */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-semibold pl-2">#</th>
                  <th className="pb-3 font-semibold">Nama Kelas (Rombel)</th>
                  <th className="pb-3 font-semibold">Nama Wali Kelas</th>
                  <th className="pb-3 font-semibold">Aturan Jadwal Harian</th>
                  <th className="pb-3 font-semibold">Jumlah Siswa</th>
                  <th className="pb-3 font-semibold text-right pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRombel.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      {searchRombel ? 'Tidak ada kelas yang cocok.' : 'Belum ada data kelas.'}
                    </td>
                  </tr>
                ) : (
                  paginatedClasses.map((r, idx) => {
                    const studentCount = students.filter((s) => s.rombel_id === r.id || s.class_id === r.id || s.kelas === r.nama_kelas).length;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition group">
                        <td className="py-3.5 pl-2 font-mono text-gray-400 text-[11px]">
                          {(safeClassPage - 1) * CLASSES_PER_PAGE + idx + 1}
                        </td>
                        <td className="py-3.5">
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-blue-600" />
                            <span>{r.nama_kelas}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">ID: {r.id}</div>
                        </td>
                        <td className="py-3.5 text-gray-800 font-medium">{r.nama_wali_kelas}</td>
                        <td className="py-3.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRombel(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-xs transition"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Lihat Jadwal Harian</span>
                          </button>
                        </td>
                        <td className="py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-semibold font-mono text-xs">
                            <Users className="w-3.5 h-3.5" />
                            <span>{studentCount} Siswa</span>
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditRombel(r)}
                              className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold transition flex items-center gap-1"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteRombel(r)}
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-rose-600 border border-gray-200 text-xs transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* KONTROL NAVIGASI PAGINASI DAFTAR KELAS (Hanya tampil jika total > 5) */}
          {totalFilteredClasses > CLASSES_PER_PAGE && (
            <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
                Menampilkan{' '}
                <span className="font-bold text-slate-800 font-mono">
                  {classStartIndex + 1}–{classEndIndex}
                </span>{' '}
                dari{' '}
                <span className="font-bold text-slate-800 font-mono">
                  {totalFilteredClasses}
                </span>{' '}
                kelas
              </div>

              <div className="flex items-center justify-center sm:justify-end flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setClassPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeClassPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <div className="flex items-center gap-1">
                  {classPageNumbers.map((pageItem, i) =>
                    pageItem === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="px-1.5 text-xs text-slate-400 select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={pageItem}
                        type="button"
                        onClick={() => setClassPage(pageItem)}
                        aria-current={safeClassPage === pageItem ? 'page' : undefined}
                        className={`min-w-[32px] h-8 px-2.5 rounded-xl border text-xs font-bold font-mono transition ${
                          safeClassPage === pageItem
                            ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-cyan-200'
                        }`}
                      >
                        {pageItem}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setClassPage((prev) => Math.min(totalClassPages, prev + 1))}
                  disabled={safeClassPage >= totalClassPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: DATA USER (ADMIN) */}
      {activeSubTab === 'users' && (
        <div className="ios-glass-card rounded-2xl p-5 border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Cari username, nama lengkap, atau role..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 shadow-sm"
              />
            </div>
            <div className="text-xs text-gray-500 font-semibold">
              Total Operator: <span className="font-bold text-gray-900">{filteredUsers.length} Akun</span>
            </div>
          </div>

          {/* MOBILE EXPANDABLE LIST TILE (ACCORDION CARD): DATA ADMIN / USER */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                {searchUser ? 'Tidak ada user yang sesuai.' : 'Belum ada data operator.'}
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isMasterUser = Boolean(u.is_master) || u.username.toLowerCase() === 'naedie';
                const isProtectedSuperAdmin =
                  !isCurrentUserSuperAdmin && (u.role === 'Super Admin' || isMasterUser);
                const roleBadgeClass =
                  u.role === 'Super Admin'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : u.role === 'Admin'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : u.role === 'Wali Kelas'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200';
                const isExpanded = expandedUserId === u.id;

                return (
                  <div
                    key={u.id}
                    className={`rounded-2xl border transition-all duration-300 ${
                      isExpanded
                        ? 'border-cyan-200 bg-white shadow-md'
                        : 'border-slate-200/90 bg-white/80 backdrop-blur-md shadow-2xs hover:bg-white'
                    }`}
                  >
                    {/* Header (Kondisi Ringkas / Collapsed) - Eyebrow Layout Clickable Hit-Area */}
                    <button
                      type="button"
                      onClick={() => setExpandedUserId((prev) => (prev === u.id ? null : u.id))}
                      className="w-full p-3.5 flex items-start justify-between gap-2.5 text-left select-none"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {u.avatar_url || u.avatarUrl ? (
                          <img
                            src={u.avatar_url || u.avatarUrl}
                            alt={u.nama_lengkap || u.username}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-2xs flex-shrink-0 mt-0.5"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 uppercase shadow-2xs mt-0.5">
                            {(u.nama_lengkap || u.username || 'U').trim().charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Baris 1: Eyebrow (Badge Role & Identitas @username) */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] font-bold text-[10px] leading-tight whitespace-nowrap">
                              {u.role === 'Wali Kelas' && (u.assignedClass || u.assigned_class || u.rombel)
                                ? `Wali • ${
                                    /^kelas\s+/i.test(String(u.assignedClass || u.assigned_class || u.rombel))
                                      ? String(u.assignedClass || u.assigned_class || u.rombel)
                                      : `Kelas ${String(u.assignedClass || u.assigned_class || u.rombel)}`
                                  }`
                                : u.role}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-semibold truncate">
                              @{u.username}
                            </span>
                          </div>

                          {/* Baris 2: Data Utama (Nama Lengkap) */}
                          <div className="font-bold text-slate-800 text-[13px] sm:text-sm leading-snug line-clamp-2">
                            {u.nama_lengkap}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 pt-1">
                        <ChevronDown
                          size={16}
                          className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                            isExpanded ? 'rotate-180 text-[var(--primary-accent-text)]' : ''
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
                        {/* Atribut Data Sekunder */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                              NIP / ID Pegawai
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-700 block mt-1 truncate">
                              {u.nip || '-'}
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                              Status Akun
                            </span>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-bold ${
                                  u.status === 'Aktif' ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    u.status === 'Aktif' ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                ></span>
                                {u.status || 'Aktif'}
                              </span>
                              {isMasterUser && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[9px] font-extrabold tracking-wide shadow-2xs">
                                  👑 MASTER
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Deretan Tombol Aksi (CRUD) */}
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          {isProtectedSuperAdmin ? (
                            <span
                              title="Akun Super Admin / Master Owner terlindungi dari perubahan oleh role Admin"
                              className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50/80 text-amber-800 border border-amber-200/80 text-xs font-semibold shadow-2xs select-none"
                            >
                              <Lock size={14} className="text-amber-600 shrink-0" />
                              <span>Akun Super Admin Terlindungi</span>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenUserQr(u)}
                                className="flex-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                              >
                                <QrCode size={14} className="text-cyan-600 shrink-0" />
                                <span>Kartu QR</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="flex-1 py-2 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                              >
                                <Edit2 size={14} className="text-cyan-600 shrink-0" />
                                <span>Edit User</span>
                              </button>

                              {!isMasterUser && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  title="Hapus Akun User"
                                  className="p-2 rounded-xl bg-rose-50/80 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs transition shrink-0 active:scale-95"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW: DATA ADMIN / USER */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-semibold pl-2">#</th>
                  <th className="pb-3 font-semibold">Username</th>
                  <th className="pb-3 font-semibold">Nama Lengkap</th>
                  <th className="pb-3 font-semibold">Role Pengguna</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      {searchUser ? 'Tidak ada user yang sesuai.' : 'Belum ada data operator.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const isMasterUser = Boolean(u.is_master) || u.username.toLowerCase() === 'naedie';
                    const isProtectedSuperAdmin = !isCurrentUserSuperAdmin && (u.role === 'Super Admin' || isMasterUser);
                    const roleBadgeClass =
                      u.role === 'Super Admin'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : u.role === 'Admin'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : u.role === 'Wali Kelas'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200';

                    return (
                      <tr key={u.id} className="hover:bg-gray-50 transition group">
                        <td className="py-3.5 pl-2 font-mono text-gray-400 text-[11px]">{idx + 1}</td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-blue-600 font-semibold">@{u.username}</span>
                            {isMasterUser && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-extrabold tracking-wide shadow-sm">
                                👑 MASTER OWNER
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2.5">
                            {u.avatar_url || u.avatarUrl ? (
                              <img
                                src={u.avatar_url || u.avatarUrl}
                                alt={u.nama_lengkap || u.username}
                                className="w-8 h-8 rounded-lg object-cover border border-gray-200 shadow-2xs shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                                {(u.nama_lengkap || u.username || 'U').trim().charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-gray-900">{u.nama_lengkap}</div>
                              {u.nip && <div className="text-[10px] text-gray-500 font-mono">NIP: {u.nip}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className={`inline-block px-3 py-1 rounded-full font-semibold text-[11px] ${roleBadgeClass}`}>
                            {u.role === 'Wali Kelas' && (u.assignedClass || u.assigned_class || u.rombel)
                              ? `Wali Kelas • ${
                                  /^kelas\s+/i.test(String(u.assignedClass || u.assigned_class || u.rombel))
                                    ? String(u.assignedClass || u.assigned_class || u.rombel)
                                    : `Kelas ${String(u.assignedClass || u.assigned_class || u.rombel)}`
                                }`
                              : u.role}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${
                              u.status === 'Aktif'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Aktif' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {u.status || 'Aktif'}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {isProtectedSuperAdmin ? (
                              <span
                                title="Akun Super Admin / Master Owner terlindungi dari perubahan oleh role Admin"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50/80 text-amber-800 border border-amber-200/80 text-xs font-semibold shadow-2xs select-none"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Terlindungi</span>
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenUserQr(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold transition flex items-center gap-1"
                                >
                                  <QrCode className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Lihat QR</span>
                                </button>

                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold transition flex items-center gap-1"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Edit</span>
                                </button>

                                {!isMasterUser && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    title="Hapus Akun User"
                                    className="p-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-rose-600 border border-gray-200 text-xs transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL QR CODE VIEW */}
      {selectedQrItem &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-sm max-h-[90vh] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden my-auto">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                  {selectedQrItem.badge}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedQrItem(null)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="flex-1 overflow-y-auto p-6 text-center space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-gray-900">{selectedQrItem.title}</h3>
                  <p className="text-xs text-gray-500 font-mono">{selectedQrItem.subtitle}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 inline-block shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      selectedQrItem.uid
                    )}&margin=10`}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto rounded-xl"
                  />
                </div>
              </div>

              {/* Footer Modal */}
              <div className="shrink-0 space-y-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={isDownloadingQr}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloadingQr ? 'Mengunduh...' : 'Download Gambar QR (PNG)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedQrItem(null)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL CSV IMPORT */}
      {isCsvModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden my-auto">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Upload className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Import CSV {csvType === 'students' ? 'Data Siswa' : 'Akun User Operator'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 text-xs">
                <p className="text-gray-600 leading-relaxed">
                  Pilih file <code>.csv</code> atau paste teks CSV dengan format header baris pertama:{' '}
                  {csvType === 'students' ? (
                    <code className="text-blue-600 font-mono">nama,uid_kartu,nisn,no_wa_wali,kelas</code>
                  ) : (
                    <code className="text-blue-600 font-mono">username,nama_lengkap,nip,role,status</code>
                  )}
                </p>

                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Pilih File CSV (.csv)</label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Atau Paste Teks CSV di Sini:</label>
                  <textarea
                    value={csvTextContent}
                    onChange={(e) => setCsvTextContent(e.target.value)}
                    rows={6}
                    placeholder={`nama,uid_kartu,nisn,no_wa_wali,kelas\nAhmad Fauzi,E2000019,00812345,628123456789,X IPA 1`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-mono focus:outline-none focus:border-blue-600 shadow-sm"
                  />
                </div>

                {csvImportStats && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                    <div className="font-bold">Hasil Import:</div>
                    <div>✅ Berhasil dimasukkan: {csvImportStats.successCount} data</div>
                    <div>⚠️ Duplikat dilewati: {csvImportStats.duplicateCount} data</div>
                    {csvImportStats.errors.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-blue-200 max-h-24 overflow-y-auto font-mono text-[11px] text-rose-700">
                        {csvImportStats.errors.map((err, idx) => (
                          <div key={idx}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleProcessCsvImport}
                  disabled={isProcessingCsv || !csvTextContent.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {isProcessingCsv ? 'Memproses...' : 'Mulai Import CSV'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL ADD STUDENT */}
      {isAddStudentOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center md:items-start justify-center p-4 md:pt-24 md:pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Tambah Siswa Baru</h3>
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="flex-1 min-h-0 flex flex-col text-xs">
                {/* Body Formulir */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
                  {/* Unggah Foto Profil (Avatar) Siswa dengan Auto-Compress */}
                  <div className="flex flex-col items-center justify-center pb-1">
                    <label className="relative group cursor-pointer flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/60 backdrop-blur-md border-2 border-dashed border-[var(--primary-accent-border)] shadow-sm flex items-center justify-center overflow-hidden transition group-hover:border-[var(--primary-accent)]">
                        {formStdAvatar ? (
                          <img
                            src={formStdAvatar}
                            alt="Preview Foto Profil Siswa"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] flex flex-col items-center justify-center gap-0.5">
                            <Camera className="w-5 h-5 opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-tight">
                              {formStdNama.trim() ? getStudentInitials(formStdNama) : 'Foto'}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleStudentAvatarFileChange(e, 'add')}
                        className="hidden"
                      />
                      <span className="mt-1.5 text-[11px] font-semibold text-[var(--primary-accent-text)] hover:underline">
                        {isCompressingStdAvatar
                          ? 'Mengompresi foto...'
                          : formStdAvatar
                          ? 'Ganti Foto Profil Siswa'
                          : 'Unggah Foto Profil Siswa'}
                      </span>
                    </label>
                    {formStdAvatar && (
                      <button
                        type="button"
                        onClick={() => setFormStdAvatar('')}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold mt-0.5"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Lengkap Siswa *</label>
                    <input
                      ref={addNamaInputRef}
                      type="text"
                      value={formStdNama}
                      onChange={(e) => setFormStdNama(e.target.value)}
                      placeholder="Contoh: Muhammad Rizky Pratama"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-700 font-semibold">UID Kartu RFID *</label>
                      <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Auto-Detect USB RFID / Kamera
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        ref={addUidInputRef}
                        type="text"
                        autoFocus
                        value={formStdRfid}
                        onChange={(e) => setFormStdRfid(e.target.value.toUpperCase())}
                        onKeyDown={(e) => handleUidInputKeyDown(e, 'add')}
                        placeholder="Contoh: E2000019 (atau Tap kartu fisik pada alat USB RFID)..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3.5 pr-22 py-2.5 text-xs font-mono text-gray-900 uppercase placeholder:normal-case placeholder:font-sans placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setUidScannerTarget('add')}
                        title="Scan QR Code / Barcode Kartu Siswa dengan Kamera"
                        className="absolute right-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 border border-blue-200 text-[11px] font-bold flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span>Scan</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nomor NISN Resmi</label>
                    <input
                      type="text"
                      value={formStdNisn}
                      onChange={(e) => setFormStdNisn(e.target.value)}
                      placeholder="Contoh: 0081234567"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Orang Tua / Wali</label>
                    <input
                      type="text"
                      value={formStdNamaWali}
                      onChange={(e) => setFormStdNamaWali(e.target.value)}
                      placeholder="Contoh: Bpk. H. Sudirman"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">No. WA Wali Murid *</label>
                    <input
                      type="text"
                      value={formStdWa}
                      onChange={(e) => setFormStdWa(e.target.value)}
                      placeholder="Contoh: 08123456789"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Kelas (Rombel)</label>
                    <select
                      value={formStdKelas}
                      onChange={(e) => setFormStdKelas(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {rombelList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nama_kelas}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setIsAddStudentOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Simpan Siswa
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center md:items-start justify-center p-4 md:pt-24 md:pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-b border-gray-100 bg-white">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    {isWaliKelas ? 'Edit Biodata Siswa & Nomor WA Wali' : 'Edit Data Siswa'}
                  </h3>
                  {isWaliKelas && (
                    <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      Akses Wali Kelas • {formattedWaliClassLabel}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditStudentSubmit} className="flex-1 min-h-0 flex flex-col text-xs">
                {/* Body Formulir */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
                  {/* Unggah Foto Profil (Avatar) Siswa dengan Auto-Compress */}
                  <div className="flex flex-col items-center justify-center pb-1">
                    <label className="relative group cursor-pointer flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/60 backdrop-blur-md border-2 border-dashed border-[var(--primary-accent-border)] shadow-sm flex items-center justify-center overflow-hidden transition group-hover:border-[var(--primary-accent)]">
                        {editStdAvatar ? (
                          <img
                            src={editStdAvatar}
                            alt="Preview Foto Profil Siswa"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] flex flex-col items-center justify-center gap-0.5">
                            <span className="text-sm font-bold leading-none">
                              {getStudentInitials(editStdNama || editingStudent.nama)}
                            </span>
                            <Camera className="w-3.5 h-3.5 opacity-75 mt-0.5" />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleStudentAvatarFileChange(e, 'edit')}
                        className="hidden"
                      />
                      <span className="mt-1.5 text-[11px] font-semibold text-[var(--primary-accent-text)] hover:underline">
                        {isCompressingStdAvatar
                          ? 'Mengompresi foto...'
                          : editStdAvatar
                          ? 'Ganti Foto Profil Siswa'
                          : 'Unggah Foto Profil Siswa'}
                      </span>
                    </label>
                    {editStdAvatar && (
                      <button
                        type="button"
                        onClick={() => setEditStdAvatar('')}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold mt-0.5"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Lengkap Siswa *</label>
                    <input
                      ref={editNamaInputRef}
                      type="text"
                      value={editStdNama}
                      onChange={(e) => setEditStdNama(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  {!isWaliKelas && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-gray-700 font-semibold">UID Kartu RFID *</label>
                        <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Auto-Detect USB RFID / Kamera
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          ref={editUidInputRef}
                          type="text"
                          autoFocus
                          value={editStdRfid}
                          onChange={(e) => setEditStdRfid(e.target.value.toUpperCase())}
                          onKeyDown={(e) => handleUidInputKeyDown(e, 'edit')}
                          placeholder="Contoh: E2000019 (atau Tap kartu fisik pada alat USB RFID)..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3.5 pr-22 py-2.5 text-xs font-mono text-gray-900 uppercase placeholder:normal-case placeholder:font-sans placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 shadow-sm"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setUidScannerTarget('edit')}
                          title="Scan QR Code / Barcode Kartu Siswa dengan Kamera"
                          className="absolute right-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 border border-blue-200 text-[11px] font-bold flex items-center gap-1.5 transition shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5 shrink-0" />
                          <span>Scan</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nomor NISN Resmi</label>
                    <input
                      type="text"
                      value={editStdNisn}
                      onChange={(e) => setEditStdNisn(e.target.value)}
                      placeholder="Contoh: 0081234567"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Orang Tua / Wali</label>
                    <input
                      type="text"
                      value={editStdNamaWali}
                      onChange={(e) => setEditStdNamaWali(e.target.value)}
                      placeholder="Contoh: Bpk. H. Sudirman / Ibu Siti"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">No. WA Orang Tua / Wali Murid *</label>
                    <input
                      type="text"
                      value={editStdWa}
                      onChange={(e) => setEditStdWa(e.target.value)}
                      placeholder="Contoh: 08123456789"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Nomor WhatsApp ini langsung digunakan untuk pengiriman notifikasi presensi &amp; pengumuman ke orang tua siswa.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-700 font-semibold">Kelas / Rombel</label>
                      {isWaliKelas && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <Lock className="w-3 h-3" />
                          <span>Terkunci sesuai Kelas Binaan</span>
                        </span>
                      )}
                    </div>
                    <select
                      value={editStdKelas}
                      disabled={isWaliKelas}
                      onChange={(e) => setEditStdKelas(e.target.value)}
                      className={`w-full border rounded-xl px-3.5 py-2.5 text-xs shadow-sm ${
                        isWaliKelas
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 font-bold cursor-not-allowed'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:outline-none focus:border-blue-600'
                      }`}
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {rombelList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nama_kelas}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL KAMERA PEMINDAI (QR / BARCODE SCANNER) UNTUK UID KARTU */}
      {uidScannerTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden my-auto">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Scan Kode Kartu Siswa (QR / Barcode)
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Arahkan kamera ke QR Code atau Barcode pada kartu fisik siswa
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUidScannerTarget(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {scannerError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{scannerError}</span>
                  </div>
                )}

                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 min-h-[250px] flex flex-col items-center justify-center">
                  <video
                    ref={scannerVideoRef}
                    className="w-full h-full object-cover max-h-[280px]"
                    muted
                    playsInline
                  />
                  <canvas ref={scannerCanvasRef} className="hidden" />

                  {!isScannerStarting && !scannerError && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                      <div className="relative w-52 h-40 border-2 border-cyan-400 rounded-2xl shadow-[inset_0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce shadow-[0_0_10px_#06b6d4]" />
                      </div>
                    </div>
                  )}

                  {isScannerStarting && !scannerError && (
                    <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center gap-2 text-white text-xs">
                      <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                      <span className="font-medium">Mengaktifkan kamera pemindai...</span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 flex items-center justify-between gap-2">
                  <span>
                    💡 Mendukung <strong>QR Code</strong>, <strong>Barcode 1D</strong>, serta <strong>Tap USB RFID</strong> langsung.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setScannerCameraFacing((prev) =>
                        prev === 'environment' ? 'user' : 'environment'
                      )
                    }
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[10px] flex items-center gap-1 transition shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Ganti Kamera</span>
                  </button>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="shrink-0 flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={() => setUidScannerTarget(null)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
                >
                  Batal &amp; Tutup Kamera
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL CUSTOM IMAGE CROPPER UNTUK FOTO PROFIL SISWA */}
      {isCropperModalOpen &&
        cropperImageSrc &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden my-auto">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] flex items-center justify-center shrink-0 shadow-2xs">
                    <Crop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Sesuaikan Foto Profil</h3>
                    <p className="text-[11px] text-gray-500">
                      Geser &amp; atur ukuran agar foto pas di dalam lingkaran
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCropperModalOpen(false);
                    setCropperImageSrc(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Container react-easy-crop */}
                <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700/50 shadow-inner select-none">
                  <Cropper
                    image={cropperImageSrc}
                    crop={cropperCrop}
                    zoom={cropperZoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCropperCrop}
                    onZoomChange={setCropperZoom}
                    onCropComplete={(_croppedArea: Area, croppedAreaPixels: Area) => {
                      setCroppedAreaPixels(croppedAreaPixels);
                    }}
                  />
                </div>

                {/* Slider & Kontrol Zoom */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <ZoomIn className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Perbesar / Zoom:</span>
                    </span>
                    <span className="font-mono text-[11px] text-cyan-700 font-bold bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-100">
                      {Math.round(cropperZoom * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCropperZoom((z) => Math.max(1, Number((z - 0.2).toFixed(2))))}
                      disabled={cropperZoom <= 1}
                      title="Perkecil"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition active:scale-95"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.02}
                      value={cropperZoom}
                      onChange={(e) => setCropperZoom(Number(e.target.value))}
                      className="flex-1 accent-cyan-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setCropperZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))))}
                      disabled={cropperZoom >= 3}
                      title="Perbesar"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition active:scale-95"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    💡 Sentuh &amp; geser foto secara langsung untuk memposisikan foto.
                  </p>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="shrink-0 flex items-center gap-2 px-6 py-4 border-t border-slate-100 bg-gray-50/70">
                <button
                  type="button"
                  disabled={isProcessingCrop}
                  onClick={() => {
                    setIsCropperModalOpen(false);
                    setCropperImageSrc(null);
                  }}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition active:scale-95 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessingCrop}
                  onClick={handleApplyCrop}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isProcessingCrop ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Terapkan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL ADD ROMBEL */}
      {isAddRombelOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center md:items-start justify-center p-4 md:pt-24 md:pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl max-h-[85vh] md:max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">
                  Tambah Kelas (Rombel) &amp; Jadwal Harian
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddRombelOpen(false)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddRombelSubmit} className="flex-1 min-h-0 flex flex-col text-xs">
                {/* Body Formulir */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Kelas (Rombel) *</label>
                    <input
                      type="text"
                      value={formRmbNama}
                      onChange={(e) => setFormRmbNama(e.target.value)}
                      placeholder="Contoh: X IPA 1"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Wali Kelas *</label>
                    <input
                      type="text"
                      value={formRmbWali}
                      onChange={(e) => setFormRmbWali(e.target.value)}
                      placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-2 font-semibold">
                      Jadwal Jam Presensi 7 Hari (Senin - Minggu)
                    </label>
                    <div className="space-y-2">
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => {
                        const dayData = formRmbJadwal[day] || {
                          aktif: true,
                          masuk: '07:00',
                          telat: '07:15',
                          pulang: '14:00',
                        };
                        return (
                          <div
                            key={day}
                            className={`p-3 rounded-2xl border transition ${
                              dayData.aktif
                                ? 'bg-white border-gray-200 shadow-sm'
                                : 'bg-gray-100 border-gray-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={dayData.aktif}
                                  onChange={(e) => {
                                    setFormRmbJadwal({
                                      ...formRmbJadwal,
                                      [day]: { ...dayData, aktif: e.target.checked },
                                    });
                                  }}
                                  className="w-4 h-4 accent-blue-600 rounded"
                                />
                                <span className="font-bold text-gray-900 text-xs">{day}</span>
                              </label>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                  dayData.aktif
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {dayData.aktif ? 'AKTIF (MASUK)' : 'LIBUR'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                              <div>
                                <span className="text-[10px] text-gray-500 block mb-0.5">Masuk:</span>
                                <input
                                  type="time"
                                  disabled={!dayData.aktif}
                                  value={dayData.masuk}
                                  onChange={(e) => {
                                    setFormRmbJadwal({
                                      ...formRmbJadwal,
                                      [day]: { ...dayData, masuk: e.target.value },
                                    });
                                  }}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 block mb-0.5">Batas Telat:</span>
                                <input
                                  type="time"
                                  disabled={!dayData.aktif}
                                  value={dayData.telat}
                                  onChange={(e) => {
                                    setFormRmbJadwal({
                                      ...formRmbJadwal,
                                      [day]: { ...dayData, telat: e.target.value },
                                    });
                                  }}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 block mb-0.5">Pulang:</span>
                                <input
                                  type="time"
                                  disabled={!dayData.aktif}
                                  value={dayData.pulang}
                                  onChange={(e) => {
                                    setFormRmbJadwal({
                                      ...formRmbJadwal,
                                      [day]: { ...dayData, pulang: e.target.value },
                                    });
                                  }}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 disabled:opacity-50"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setIsAddRombelOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Simpan Kelas
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* EDIT ROMBEL MODAL */}
      {editingRombel &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center md:items-start justify-center p-4 md:pt-24 md:pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl max-h-[85vh] md:max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">
                  Edit Kelas (Rombel) &amp; Jadwal Harian
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingRombel(null)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditRombelSubmit} className="flex-1 min-h-0 flex flex-col text-xs">
                {/* Body Formulir */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Kelas (Rombel) *</label>
                    <input
                      type="text"
                      value={editRmbNama}
                      onChange={(e) => setEditRmbNama(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Wali Kelas *</label>
                    <input
                      type="text"
                      value={editRmbWali}
                      onChange={(e) => setEditRmbWali(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-2 font-semibold">
                      Jadwal Jam Presensi 7 Hari (Senin - Minggu)
                    </label>
                    <div className="space-y-2">
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => {
                        const dayData = editRmbJadwal[day] || {
                          aktif: true,
                          masuk: '07:00',
                          telat: '07:15',
                          pulang: '14:00',
                        };
                        return (
                          <div
                            key={day}
                            className={`p-3 rounded-2xl border transition ${
                              dayData.aktif
                                ? 'bg-white border-gray-200 shadow-sm'
                                : 'bg-gray-100 border-gray-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={dayData.aktif}
                                  onChange={(e) => {
                                    setEditRmbJadwal({
                                      ...editRmbJadwal,
                                      [day]: { ...dayData, aktif: e.target.checked },
                                    });
                                  }}
                                  className="w-4 h-4 accent-blue-600 rounded"
                                />
                                <span className="font-bold text-gray-900 text-xs">{day}</span>
                              </label>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                  dayData.aktif
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {dayData.aktif ? 'AKTIF (MASUK)' : 'LIBUR'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                              <div>
                                <span className="text-[10px] text-gray-500 block mb-0.5">Masuk:</span>
                                <input
                                  type="time"
                                  disabled={!dayData.aktif}
                                  value={dayData.masuk}
                                  onChange={(e) => {
                                    setEditRmbJadwal({
                                      ...editRmbJadwal,
                                      [day]: { ...dayData, masuk: e.target.value },
                                    });
                                  }}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 block mb-0.5">Batas Telat:</span>
                                <input
                                  type="time"
                                  disabled={!dayData.aktif}
                                  value={dayData.telat}
                                  onChange={(e) => {
                                    setEditRmbJadwal({
                                      ...editRmbJadwal,
                                      [day]: { ...dayData, telat: e.target.value },
                                    });
                                  }}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 block mb-0.5">Pulang:</span>
                                <input
                                  type="time"
                                  disabled={!dayData.aktif}
                                  value={dayData.pulang}
                                  onChange={(e) => {
                                    setEditRmbJadwal({
                                      ...editRmbJadwal,
                                      [day]: { ...dayData, pulang: e.target.value },
                                    });
                                  }}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 disabled:opacity-50"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setEditingRombel(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL ADD USER */}
      {isAddUserOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center md:items-start justify-center p-4 md:pt-24 md:pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Tambah Akun User Operator</h3>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddUserSubmit} className="flex-1 min-h-0 flex flex-col text-xs">
                {/* Body Formulir */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
                  {/* Unggah Foto Profil (Avatar) User */}
                  <div className="flex flex-col items-center justify-center pb-1">
                    <label className="relative group cursor-pointer flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/60 backdrop-blur-md border-2 border-dashed border-[var(--primary-accent-border)] shadow-sm flex items-center justify-center overflow-hidden transition group-hover:border-[var(--primary-accent)]">
                        {formUsrAvatar ? (
                          <img
                            src={formUsrAvatar}
                            alt="Preview Foto Profil Pengguna"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] flex flex-col items-center justify-center gap-0.5">
                            <Camera className="w-5 h-5 opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-tight">
                              {formUsrNama.trim() ? getStudentInitials(formUsrNama) : 'Foto'}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleStudentAvatarFileChange(e, 'add_user')}
                        className="hidden"
                      />
                      <span className="mt-1.5 text-[11px] font-semibold text-[var(--primary-accent-text)] hover:underline">
                        {formUsrAvatar ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}
                      </span>
                    </label>
                    {formUsrAvatar && (
                      <button
                        type="button"
                        onClick={() => setFormUsrAvatar('')}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold mt-0.5"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Username *</label>
                    <input
                      type="text"
                      value={formUsrUsername}
                      onChange={(e) => setFormUsrUsername(e.target.value)}
                      placeholder="Contoh: operator1"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Password / Kata Sandi *</label>
                    <div className="relative">
                      <input
                        type={showAddPassword ? 'text' : 'password'}
                        value={formUsrPassword}
                        onChange={(e) => setFormUsrPassword(e.target.value)}
                        placeholder="Masukkan password akun"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPassword((prev) => !prev)}
                        title={showAddPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 transition"
                      >
                        {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Lengkap &amp; Gelar *</label>
                    <input
                      type="text"
                      value={formUsrNama}
                      onChange={(e) => setFormUsrNama(e.target.value)}
                      placeholder="Contoh: Siti Aminah, S.Pd"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">NIP / ID Pegawai</label>
                    <input
                      type="text"
                      value={formUsrNip}
                      onChange={(e) => setFormUsrNip(e.target.value)}
                      placeholder="Contoh: 19850101..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Role Pengguna</label>
                    <select
                      value={formUsrRole}
                      onChange={(e) => {
                        const nextRole = e.target.value as UserRole;
                        setFormUsrRole(nextRole);
                        if (nextRole === 'Wali Kelas' && !formUsrAssignedClass) {
                          setFormUsrAssignedClass(rombelList.length > 0 ? rombelList[0].nama_kelas : '1A');
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    >
                      {isCurrentUserSuperAdmin && (
                        <>
                          <option value="Super Admin">Super Admin</option>
                          <option value="Admin">Admin</option>
                        </>
                      )}
                      <option value="Wali Kelas">Wali Kelas</option>
                      <option value="Operator">Operator</option>
                    </select>
                    {!isCurrentUserSuperAdmin && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        * Hanya Super Admin yang dapat menambahkan akun dengan role Super Admin atau Admin.
                      </p>
                    )}
                  </div>

                  {formUsrRole === 'Wali Kelas' && (
                    <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                      <label className="text-emerald-900 block font-bold text-xs">
                        Kelas / Rombel Binaan *
                      </label>
                      <select
                        value={formUsrAssignedClass}
                        onChange={(e) => setFormUsrAssignedClass(e.target.value)}
                        required
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                      >
                        <option value="">-- Pilih Kelas / Rombel Binaan --</option>
                        {rombelList.map((r) => {
                          const label = r.nama_kelas.toLowerCase().startsWith('kelas')
                            ? r.nama_kelas
                            : `Kelas ${r.nama_kelas}`;
                          return (
                            <option key={r.id} value={r.nama_kelas}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[10px] text-emerald-700 leading-relaxed">
                        Wali Kelas hanya dapat mengakses dan mengelola data siswa pada kelas binaan yang dipilih.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Status Akun</label>
                    <select
                      value={formUsrStatus}
                      onChange={(e) => setFormUsrStatus(e.target.value as AppUser['status'])}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                    </select>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Simpan User
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* EDIT USER MODAL */}
      {editingUser &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center md:items-start justify-center p-4 md:pt-24 md:pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
              {/* Header Modal */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-b border-gray-100 bg-white">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900">
                    Edit Akun User Operator
                  </h3>
                  {(editingUser.is_master || editingUser.username.toLowerCase() === 'naedie') && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold shrink-0">
                      👑 MASTER OWNER
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditUserSubmit} className="flex-1 min-h-0 flex flex-col text-xs">
                {/* Body Formulir */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
                  {/* Unggah Foto Profil (Avatar) User */}
                  <div className="flex flex-col items-center justify-center pb-1">
                    <label className="relative group cursor-pointer flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/60 backdrop-blur-md border-2 border-dashed border-[var(--primary-accent-border)] shadow-sm flex items-center justify-center overflow-hidden transition group-hover:border-[var(--primary-accent)]">
                        {editUsrAvatar ? (
                          <img
                            src={editUsrAvatar}
                            alt="Preview Foto Profil Pengguna"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] flex flex-col items-center justify-center gap-0.5">
                            <Camera className="w-5 h-5 opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-tight">
                              {getStudentInitials(editUsrNama || editingUser.nama_lengkap || editingUser.username)}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleStudentAvatarFileChange(e, 'edit_user')}
                        className="hidden"
                      />
                      <span className="mt-1.5 text-[11px] font-semibold text-[var(--primary-accent-text)] hover:underline">
                        {editUsrAvatar ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}
                      </span>
                    </label>
                    {editUsrAvatar && (
                      <button
                        type="button"
                        onClick={() => setEditUsrAvatar('')}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold mt-0.5"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Username *</label>
                    <input
                      type="text"
                      value={editUsrUsername}
                      disabled={Boolean(editingUser.is_master) || editingUser.username.toLowerCase() === 'naedie'}
                      onChange={(e) => setEditUsrUsername(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm disabled:opacity-60"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Password / Kata Sandi *</label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        value={editUsrPassword}
                        onChange={(e) => setEditUsrPassword(e.target.value)}
                        placeholder="Masukkan password akun"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword((prev) => !prev)}
                        title={showEditPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 transition"
                      >
                        {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Nama Lengkap &amp; Gelar *</label>
                    <input
                      type="text"
                      value={editUsrNama}
                      onChange={(e) => setEditUsrNama(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">NIP / ID Pegawai</label>
                    <input
                      type="text"
                      value={editUsrNip}
                      onChange={(e) => setEditUsrNip(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Role Pengguna</label>
                    <select
                      value={editUsrRole}
                      disabled={Boolean(editingUser.is_master) || editingUser.username.toLowerCase() === 'naedie'}
                      onChange={(e) => {
                        const nextRole = e.target.value as UserRole;
                        setEditUsrRole(nextRole);
                        if (nextRole === 'Wali Kelas' && !editUsrAssignedClass) {
                          setEditUsrAssignedClass(rombelList.length > 0 ? rombelList[0].nama_kelas : '1A');
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm disabled:opacity-60"
                    >
                      {(isCurrentUserSuperAdmin || editingUser.role === 'Super Admin') && (
                        <option value="Super Admin">Super Admin</option>
                      )}
                      {(isCurrentUserSuperAdmin || editingUser.role === 'Admin') && (
                        <option value="Admin">Admin</option>
                      )}
                      <option value="Wali Kelas">Wali Kelas</option>
                      <option value="Operator">Operator</option>
                    </select>
                  </div>

                  {editUsrRole === 'Wali Kelas' && (
                    <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                      <label className="text-emerald-900 block font-bold text-xs">
                        Kelas / Rombel Binaan *
                      </label>
                      <select
                        value={editUsrAssignedClass}
                        onChange={(e) => setEditUsrAssignedClass(e.target.value)}
                        required
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                      >
                        <option value="">-- Pilih Kelas / Rombel Binaan --</option>
                        {rombelList.map((r) => {
                          const label = r.nama_kelas.toLowerCase().startsWith('kelas')
                            ? r.nama_kelas
                            : `Kelas ${r.nama_kelas}`;
                          return (
                            <option key={r.id} value={r.nama_kelas}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[10px] text-emerald-700 leading-relaxed">
                        Wali Kelas hanya dapat mengakses dan mengelola data siswa pada kelas binaan yang dipilih.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-gray-700 block mb-1 font-semibold">Status Akun</label>
                    <select
                      value={editUsrStatus}
                      disabled={Boolean(editingUser.is_master) || editingUser.username.toLowerCase() === 'naedie'}
                      onChange={(e) => setEditUsrStatus(e.target.value as AppUser['status'])}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 shadow-sm disabled:opacity-60"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                    </select>
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =====================================================================
          MODAL PRATINJAU CETAK MASSAL KARTU QR (STANDAR ID CARD KERTAS A4)
         ===================================================================== */}
      {isBatchQrPrintOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto">
            {/* Toolbar Kontrol Atas Pratinjau A4 */}
            <div className="w-full max-w-5xl bg-slate-900 text-white border border-slate-700 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xl sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    Pratinjau Cetak Massal Kartu QR Presensi (Kertas A4)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Menampilkan seluruh <strong className="text-white">{filteredStudents.length} siswa</strong> sesuai filter aktif ({activeFilterRombelLabel})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Pilihan Layout Kolom Kertas A4 (2 Kolom vs 3 Kolom) */}
                <div className="inline-flex items-center gap-1 p-1 bg-slate-800 border border-slate-700 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setQrPrintColumns(2)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      qrPrintColumns === 2
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    2 Kolom / Baris
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrPrintColumns(3)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      qrPrintColumns === 3
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    3 Kolom / Baris
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteBatchQrPrint}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Cetak Sekarang / Simpan PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBatchQrPrintOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs inline-flex items-center gap-1 transition"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Kertas Standar A4 Preview Container */}
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-8 space-y-5">
              {/* Header Lembar A4 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 text-xs text-slate-600">
                <div>
                  <span className="font-bold text-slate-900 uppercase">
                    {schoolSettings.appTitle || DEFAULT_APP_TITLE}
                  </span>{' '}
                  — Lembar Cetak ID Card QR Presensi ({activeFilterRombelLabel})
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Total: <strong className="text-slate-900">{filteredStudents.length} Kartu</strong> · Panduan gunting garis putus-putus
                </div>
              </div>

              {/* Grid Kartu QR (Merender Seluruh Siswa dalam filteredStudents) */}
              <div
                className={`grid grid-cols-1 ${
                  qrPrintColumns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
                } gap-4`}
              >
                {filteredStudents.map((s) => {
                  const classLabel = resolveStudentClassLabel(s);
                  const uidCode = s.uid_kartu || s.rfid_uid || s.nisn || s.id;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    uidCode
                  )}&margin=6`;

                  return (
                    <div
                      key={s.id}
                      className="border-2 border-dashed border-slate-300 rounded-2xl p-3.5 bg-white flex flex-col justify-between text-center break-inside-avoid space-y-3"
                    >
                      {/* Header Nama Sekolah */}
                      <div className="flex items-center gap-2.5 bg-slate-900 text-white px-3 py-2 rounded-xl text-left">
                        {schoolSettings.appLogo ? (
                          <img
                            src={schoolSettings.appLogo}
                            alt="Logo Sekolah"
                            className="w-7 h-7 rounded-md object-contain bg-white p-0.5 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <GraduationCap className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-extrabold uppercase tracking-wide truncate leading-tight">
                            {schoolSettings.appTitle || DEFAULT_APP_TITLE}
                          </div>
                          <div className="text-[9px] text-slate-300 truncate leading-tight">
                            {schoolSettings.appSubtitle || DEFAULT_APP_SUBTITLE}
                          </div>
                        </div>
                      </div>

                      {/* Body Kartu: QR Code + Nama Siswa + Badge Kelas + NISN & UID */}
                      <div className="flex flex-col items-center space-y-2">
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl inline-block">
                          <img
                            src={qrUrl}
                            alt={`QR ${s.nama}`}
                            className={`${
                              qrPrintColumns === 2 ? 'w-32 h-32' : 'w-28 h-28'
                            } object-contain mx-auto rounded-lg`}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">
                            {s.nama}
                          </div>
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                            {classLabel}
                          </span>
                        </div>

                        <div className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-2 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-semibold">NISN</span>
                            <span className="font-mono font-bold text-slate-900">
                              {s.nisn || '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-semibold">UID Kartu</span>
                            <span className="font-mono font-bold text-blue-700">{uidCode}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Kartu */}
                      <div className="pt-2 border-t border-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Kartu Presensi Pintar · Scan QR / Tap RFID
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
