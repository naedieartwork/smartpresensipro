import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sliders,
  MessageSquare,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  Save,
  Check,
  Info,
  Building2,
  Upload,
  RotateCcw,
  Radio,
  Image as ImageIcon,
  HardDriveDownload,
  Palette,
  Lock,
  GraduationCap,
  Calendar,
  Archive,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  QrCode,
  ShieldAlert,
  Users,
  FileCheck2,
  Cpu,
  Cloud,
  Zap,
  XCircle,
  Smartphone,
  Download,
} from 'lucide-react';
import { sidobeService } from '../services/sidobeService';
import {
  settingsService,
  SystemSettings,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
  compressLogoImage,
  getBase64SizeKB,
  ACCENT_THEME_CONFIGS,
  PrimaryAccentTheme,
  applyThemeAccent,
} from '../services/settingsService';
import { supabaseService } from '../services/supabaseClient';
import { MessageTemplate, AppUser, SpecialScheduleMode } from '../types';
import { INITIAL_TEMPLATES } from '../data/initialData';
import { sound } from '../utils/audio';
import { TemplateManager } from './TemplateManager';
import { BackupMaintenancePanel } from './BackupMaintenancePanel';
import { usePWAInstall, syncDynamicPWAManifest } from '../hooks/usePWAInstall';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
  currentUser?: AppUser | null;
}

type SettingsTab = 'identity' | 'theme' | 'academic' | 'time' | 'gateway' | 'templates' | 'backup' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen = true,
  onClose,
  onSettingsChanged,
  currentUser,
}) => {
  const isCurrentUserSuperAdmin =
    !currentUser ||
    currentUser.role === 'Super Admin' ||
    Boolean(currentUser.is_master) ||
    currentUser.username?.toLowerCase() === 'naedie';
  const currentSidobe = sidobeService.getConfig();
  const currentSettings = settingsService.getSettings();
  const {
    isInstalled,
    isIOS,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
  } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
  const [mobileSubmenu, setMobileSubmenu] = useState<SettingsTab | null>(null);

  // Tab 1: Identitas Instansi
  const [appLogo, setAppLogo] = useState<string>(currentSettings.appLogo || '');
  const [appTitle, setAppTitle] = useState<string>(
    currentSettings.appTitle || DEFAULT_APP_TITLE
  );
  const [appSubtitle, setAppSubtitle] = useState<string>(
    currentSettings.appSubtitle || DEFAULT_APP_SUBTITLE
  );
  const [primaryAccent, setPrimaryAccent] = useState<PrimaryAccentTheme>(
    currentSettings.primaryAccent || 'cyan'
  );
  const [previewLogoError, setPreviewLogoError] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tab Academic: Tahun Ajaran & Semester
  const [academicYear, setAcademicYear] = useState<string>(
    currentSettings.academicYear || '2025/2026'
  );
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>(
    currentSettings.semester || 'Ganjil'
  );
  const [isSavingAcademic, setIsSavingAcademic] = useState<boolean>(false);
  const [academicFeedback, setAcademicFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Modal Confirmation Arsip & Reset
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetConfirmInput, setResetConfirmInput] = useState<string>('');
  const [isProcessingReset, setIsProcessingReset] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Tab 2: Time & Mode + Jadwal Khusus & Pengecualian
  const [isAutomaticMode, setIsAutomaticMode] = useState<boolean>(currentSettings.isAutomaticMode);
  const [timeRanges, setTimeRanges] = useState<SystemSettings['timeRanges']>(currentSettings.timeRanges);
  const [specialScheduleEnabled, setSpecialScheduleEnabled] = useState<boolean>(
    Boolean(currentSettings.special_schedule_enabled)
  );
  const [specialScheduleDay, setSpecialScheduleDay] = useState<number>(
    typeof currentSettings.special_schedule_day === 'number'
      ? currentSettings.special_schedule_day
      : 5
  );
  const [specialScheduleMode, setSpecialScheduleMode] = useState<SpecialScheduleMode>(
    currentSettings.special_schedule_mode === 'libur' ? 'libur' : 'pulang_awal'
  );
  const [specialScheduleTime, setSpecialScheduleTime] = useState<string>(
    currentSettings.special_schedule_time || '10:00'
  );

  // Tab 3: WA Gateway (Khusus Ganti Token Instansi)
  const [sidobeToken, setSidobeToken] = useState<string>(currentSidobe.apiToken);
  const [showToken, setShowToken] = useState<boolean>(false);

  // Tab 4: 20 Template WA (Spintax)
  const [templates, setTemplates] = useState<MessageTemplate[]>(() =>
    INITIAL_TEMPLATES.map((t) => ({ ...t }))
  );

  // Per-card saving states & specific feedback
  const [isSavingIdentity, setIsSavingIdentity] = useState<boolean>(false);
  const [identityFeedback, setIdentityFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [isSavingTheme, setIsSavingTheme] = useState<boolean>(false);
  const [themeFeedback, setThemeFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [isSavingAutoMode, setIsSavingAutoMode] = useState<boolean>(false);
  const [autoModeFeedback, setAutoModeFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [isSavingSpecialSchedule, setIsSavingSpecialSchedule] = useState<boolean>(false);
  const [specialScheduleFeedback, setSpecialScheduleFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [isSavingTimeRanges, setIsSavingTimeRanges] = useState<boolean>(false);
  const [timeRangesFeedback, setTimeRangesFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [isSavingGateway, setIsSavingGateway] = useState<boolean>(false);
  const [gatewayFeedback, setGatewayFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const applyCurrent = () => {
        const s = settingsService.getSettings();
        setAppLogo(s.appLogo || '');
        setAppTitle(s.appTitle || DEFAULT_APP_TITLE);
        setAppSubtitle(s.appSubtitle || DEFAULT_APP_SUBTITLE);
        setPrimaryAccent(s.primaryAccent || 'cyan');
        setAcademicYear(s.academicYear || '2025/2026');
        setSemester(s.semester || 'Ganjil');
        setPreviewLogoError(false);

        setIsAutomaticMode(s.isAutomaticMode);
        setTimeRanges(s.timeRanges);
        setSpecialScheduleEnabled(Boolean(s.special_schedule_enabled));
        setSpecialScheduleDay(
          typeof s.special_schedule_day === 'number' ? s.special_schedule_day : 5
        );
        setSpecialScheduleMode(
          s.special_schedule_mode === 'libur' ? 'libur' : 'pulang_awal'
        );
        setSpecialScheduleTime(s.special_schedule_time || '10:00');

        const sid = sidobeService.getConfig();
        setSidobeToken(sid.apiToken);
      };

      applyCurrent();
      setShowToken(false);
      setMobileSubmenu(null);

      // Sinkronkan dari tabel public.app_settings (id = 1) di Supabase
      settingsService.loadFromSupabase().then(() => {
        applyCurrent();
      });

      supabaseService.getTemplates().then((loaded) => {
        if (loaded && loaded.length > 0) {
          setTemplates(loaded);
        } else {
          setTemplates(INITIAL_TEMPLATES.map((t) => ({ ...t })));
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isCurrentUserSuperAdmin) {
      if (activeTab === 'gateway' || activeTab === 'backup') {
        setActiveTab('identity');
      }
      if (mobileSubmenu === 'gateway' || mobileSubmenu === 'backup') {
        setMobileSubmenu(null);
      }
    }
  }, [isOpen, isCurrentUserSuperAdmin, activeTab, mobileSubmenu]);

  if (!isOpen) return null;

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressLogoImage(file);
      setAppLogo(compressedDataUrl);
      setPreviewLogoError(false);
    } catch (err: any) {
      alert(err?.message || 'Gagal mengompresi gambar logo.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetLogo = () => {
    setAppLogo('');
    setPreviewLogoError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Card 1: Simpan Identitas Instansi
  const handleSaveIdentityCard = async () => {
    setIsSavingIdentity(true);
    setIdentityFeedback(null);
    const cleanedTitle = appTitle.trim() || DEFAULT_APP_TITLE;
    const cleanedSubtitle = appSubtitle.trim() || DEFAULT_APP_SUBTITLE;
    const cleanedLogo = appLogo.trim();

    setAppTitle(cleanedTitle);
    setAppSubtitle(cleanedSubtitle);
    setAppLogo(cleanedLogo);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle: cleanedTitle,
        appSubtitle: cleanedSubtitle,
        appLogo: cleanedLogo,
        primaryAccent,
        waApiToken: sidobeToken,
        isAutomaticMode,
        timeRanges,
      });

      await syncDynamicPWAManifest(cleanedTitle, cleanedSubtitle, cleanedLogo);
      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setIdentityFeedback({ success: true, message: 'Identitas instansi berhasil diperbarui!' });
      } else {
        sound.playAlert();
        setIdentityFeedback({ success: false, message: `Tersimpan secara lokal: ${res.error}` });
      }
    } catch (err: any) {
      sound.playAlert();
      setIdentityFeedback({ success: false, message: 'Gagal menyimpan identitas: ' + (err?.message || String(err)) });
    } finally {
      setIsSavingIdentity(false);
      setTimeout(() => setIdentityFeedback(null), 4000);
    }
  };

  // Card 2: Simpan Warna Tema Aplikasi
  const handleSaveThemeCard = async () => {
    setIsSavingTheme(true);
    setThemeFeedback(null);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        waApiToken: sidobeToken,
        isAutomaticMode,
        timeRanges,
      });

      applyThemeAccent(primaryAccent);
      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setThemeFeedback({ success: true, message: 'Warna tema aplikasi berhasil disimpan!' });
      } else {
        sound.playAlert();
        setThemeFeedback({ success: false, message: `Tersimpan secara lokal: ${res.error}` });
      }
    } catch (err: any) {
      sound.playAlert();
      setThemeFeedback({ success: false, message: 'Gagal menyimpan tema: ' + (err?.message || String(err)) });
    } finally {
      setIsSavingTheme(false);
      setTimeout(() => setThemeFeedback(null), 4000);
    }
  };

  // Card Academic: Simpan Tahun Ajaran & Semester
  const handleSaveAcademicCard = async () => {
    setIsSavingAcademic(true);
    setAcademicFeedback(null);
    const cleanedYear = academicYear.trim() || '2025/2026';
    setAcademicYear(cleanedYear);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        academicYear: cleanedYear,
        semester,
        waApiToken: sidobeToken,
        isAutomaticMode,
        timeRanges,
      });

      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setAcademicFeedback({ success: true, message: 'Tahun ajaran & semester berhasil diperbarui!' });
      } else {
        sound.playAlert();
        setAcademicFeedback({ success: false, message: `Tersimpan secara lokal: ${res.error}` });
      }
    } catch (err: any) {
      sound.playAlert();
      setAcademicFeedback({ success: false, message: 'Gagal menyimpan tahun ajaran: ' + (err?.message || String(err)) });
    } finally {
      setIsSavingAcademic(false);
      setTimeout(() => setAcademicFeedback(null), 4000);
    }
  };

  // Execute Arsip Data & Reset Tahun Ajaran
  const handleExecuteResetAndArchive = async () => {
    if (resetConfirmInput.trim().toUpperCase() !== 'RESET') {
      alert('Ketik kata "RESET" dengan huruf kapital untuk mengonfirmasi tindakan keamanan ini.');
      return;
    }

    setIsProcessingReset(true);
    setResetFeedback(null);

    try {
      const parts = academicYear.split('/');
      let nextYear = '2026/2027';
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        const startY = Number(parts[0]) + 1;
        const endY = Number(parts[1]) + 1;
        nextYear = `${startY}/${endY}`;
      }

      setAcademicYear(nextYear);
      setSemester('Ganjil');

      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        academicYear: nextYear,
        semester: 'Ganjil',
        waApiToken: sidobeToken,
        isAutomaticMode,
        timeRanges,
      });

      if (onSettingsChanged) onSettingsChanged();

      sound.playSuccess();
      setResetFeedback({
        success: true,
        message: `Arsip data berhasil dikunci! Tahun Ajaran otomatis diperbarui ke ${nextYear} (Semester Ganjil).`,
      });
      setShowResetModal(false);
      setResetConfirmInput('');
    } catch (err: any) {
      sound.playAlert();
      setResetFeedback({ success: false, message: 'Gagal mereset tahun ajaran: ' + (err?.message || String(err)) });
    } finally {
      setIsProcessingReset(false);
      setTimeout(() => setResetFeedback(null), 5000);
    }
  };

  // Card 3: Simpan Mode Otomatis Presensi
  const handleSaveAutoModeCard = async () => {
    setIsSavingAutoMode(true);
    setAutoModeFeedback(null);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        waApiToken: sidobeToken,
        isAutomaticMode,
        special_schedule_enabled: specialScheduleEnabled,
        special_schedule_day: specialScheduleDay,
        special_schedule_mode: specialScheduleMode,
        special_schedule_time: specialScheduleTime,
        timeRanges,
      });

      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setAutoModeFeedback({ success: true, message: 'Mode presensi otomatis berhasil diperbarui!' });
      } else {
        sound.playAlert();
        setAutoModeFeedback({ success: false, message: `Tersimpan secara lokal: ${res.error}` });
      }
    } catch (err: any) {
      sound.playAlert();
      setAutoModeFeedback({ success: false, message: 'Gagal menyimpan mode: ' + (err?.message || String(err)) });
    } finally {
      setIsSavingAutoMode(false);
      setTimeout(() => setAutoModeFeedback(null), 4000);
    }
  };

  // Card 3b: Simpan Jadwal Khusus & Pengecualian
  const handleSaveSpecialScheduleCard = async () => {
    setIsSavingSpecialSchedule(true);
    setSpecialScheduleFeedback(null);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        waApiToken: sidobeToken,
        isAutomaticMode,
        special_schedule_enabled: specialScheduleEnabled,
        special_schedule_day: specialScheduleDay,
        special_schedule_mode: specialScheduleMode,
        special_schedule_time: specialScheduleTime,
        timeRanges,
      });

      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setSpecialScheduleFeedback({
          success: true,
          message: 'Pengaturan jadwal khusus & pengecualian berhasil disimpan!',
        });
      } else {
        sound.playAlert();
        setSpecialScheduleFeedback({
          success: false,
          message: `Tersimpan secara lokal: ${res.error}`,
        });
      }
    } catch (err: any) {
      sound.playAlert();
      setSpecialScheduleFeedback({
        success: false,
        message: 'Gagal menyimpan jadwal khusus: ' + (err?.message || String(err)),
      });
    } finally {
      setIsSavingSpecialSchedule(false);
      setTimeout(() => setSpecialScheduleFeedback(null), 4000);
    }
  };

  // Card 4: Simpan Rentang Jam Presensi
  const handleSaveTimeRangesCard = async () => {
    setIsSavingTimeRanges(true);
    setTimeRangesFeedback(null);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        waApiToken: sidobeToken,
        isAutomaticMode,
        special_schedule_enabled: specialScheduleEnabled,
        special_schedule_day: specialScheduleDay,
        special_schedule_mode: specialScheduleMode,
        special_schedule_time: specialScheduleTime,
        timeRanges,
      });

      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setTimeRangesFeedback({ success: true, message: 'Konfigurasi jam presensi berhasil disimpan!' });
      } else {
        sound.playAlert();
        setTimeRangesFeedback({ success: false, message: `Tersimpan secara lokal: ${res.error}` });
      }
    } catch (err: any) {
      sound.playAlert();
      setTimeRangesFeedback({ success: false, message: 'Gagal menyimpan jam presensi: ' + (err?.message || String(err)) });
    } finally {
      setIsSavingTimeRanges(false);
      setTimeout(() => setTimeRangesFeedback(null), 4000);
    }
  };

  // Card 5: Simpan Token WhatsApp Gateway
  const handleSaveGatewayCard = async () => {
    setIsSavingGateway(true);
    setGatewayFeedback(null);
    const cleanedToken = sidobeToken.trim();
    setSidobeToken(cleanedToken);

    try {
      const res = await settingsService.saveToSupabase({
        appTitle,
        appSubtitle,
        appLogo,
        primaryAccent,
        waApiToken: cleanedToken,
        isAutomaticMode,
        timeRanges,
      });

      if (onSettingsChanged) onSettingsChanged();

      if (res.success) {
        sound.playSuccess();
        setGatewayFeedback({ success: true, message: 'Token API WA Gateway berhasil diperbarui!' });
      } else {
        sound.playAlert();
        setGatewayFeedback({ success: false, message: `Tersimpan secara lokal: ${res.error}` });
      }
    } catch (err: any) {
      sound.playAlert();
      setGatewayFeedback({ success: false, message: 'Gagal menyimpan token WA: ' + (err?.message || String(err)) });
    } finally {
      setIsSavingGateway(false);
      setTimeout(() => setGatewayFeedback(null), 4000);
    }
  };

  const hasTokenConfigured = sidobeToken.trim().length > 0;
  const isBase64Logo = appLogo.startsWith('data:image/');
  const compressedSizeKB = isBase64Logo ? getBase64SizeKB(appLogo) : 0;

  const handleOpenMobileSubmenu = (tab: SettingsTab) => {
    setActiveTab(tab);
    setMobileSubmenu(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToMobileMenu = () => {
    setMobileSubmenu(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mobileSubmenuMeta: Record<
    SettingsTab,
    { title: string; subtitle: string }
  > = {
    identity: {
      title: 'Identitas Instansi',
      subtitle: 'Kelola logo sekolah, nama instansi, dan motto pada tampilan aplikasi.',
    },
    theme: {
      title: 'Warna Tema',
      subtitle: 'Kustomisasi warna tema aksen utama aplikasi secara global.',
    },
    academic: {
      title: 'Tahun Ajaran & Semester',
      subtitle: 'Kelola tahun pelajaran aktif, semester, serta arsip data pergantian tahun ajaran.',
    },
    time: {
      title: 'Jam & Mode Presensi',
      subtitle: 'Atur jadwal pergantian sesi presensi otomatis maupun mode manual.',
    },
    gateway: {
      title: 'WA Gateway',
      subtitle: 'Konfigurasi koneksi token WhatsApp untuk pengiriman pesan ke wali murid.',
    },
    templates: {
      title: 'Template WA',
      subtitle: 'Sesuaikan 20 variasi format pesan otomatis WhatsApp sekolah.',
    },
    backup: {
      title: 'Backup & Maintenance',
      subtitle: 'Unduh cadangan data sekolah, pulihkan database, dan pemeliharaan rutin.',
    },
    about: {
      title: 'Tentang Aplikasi',
      subtitle: 'Informasi versi sistem, keunggulan teknologi (USP), perbandingan efisiensi, dan arsitektur pengembang.',
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Page Header & Dashboard Menu (Tampil di Ponsel saat mobileSubmenu === null, dan Selalu Tampil di Desktop) */}
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5 ${
          mobileSubmenu !== null ? 'hidden md:block' : 'block'
        }`}
      >
        {/* 1. HEADER TAMPILAN PONSEL (Hierarki Vertikal 3 Baris - md:hidden) */}
        <div className="flex flex-col items-start gap-3 pb-4 border-b border-slate-100 md:hidden">
          {/* Baris Paling Atas (Kiri): Tombol Kembali */}
          <button
            type="button"
            onClick={onClose}
            title="Kembali ke Halaman Sebelumnya"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs inline-flex items-center gap-1.5 transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          {/* Baris Berikutnya (Di Bawah Tombol Kembali): Judul Halaman Besar & Tebal */}
          <div className="space-y-1.5 pt-0.5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
              Pengaturan Sistem
            </h1>

            {/* Baris Ketiga (Di Bawah Judul): Deskripsi Naratif Ramah Pengguna (Dinamis berdasarkan Role) */}
            <p className="text-xs text-slate-600 leading-relaxed">
              {isCurrentUserSuperAdmin
                ? 'Pusat kendali utama untuk mengelola identitas sekolah, jam presensi, koneksi pesan WhatsApp, serta cadangan data sekolah.'
                : 'Pusat kendali untuk mengelola identitas sekolah, jam presensi, serta template pesan notifikasi WhatsApp.'}
            </p>
          </div>
        </div>

        {/* 2. HEADER TAMPILAN DESKTOP (Horizontal - hidden md:flex) */}
        <div className="hidden md:flex items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onClose}
              title="Kembali ke Halaman Sebelumnya"
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 font-semibold text-xs flex items-center gap-1.5 transition shrink-0 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <div className="w-10 h-10 rounded-2xl bg-cyan-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              <Sliders className="w-5 h-5 text-white" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Pengaturan Sistem
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isCurrentUserSuperAdmin
                  ? 'Pusat kendali utama untuk mengelola identitas sekolah, jam presensi, koneksi pesan WhatsApp, serta cadangan data sekolah.'
                  : 'Pusat kendali untuk mengelola identitas sekolah, jam presensi, serta template pesan notifikasi WhatsApp.'}
              </p>
            </div>
          </div>
        </div>

        {/* BANNER INSTALL APLIKASI (PWA) - Otomatis Tersembunyi Jika Sudah Terinstal / Standalone */}
        {!isInstalled && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-50/90 via-cyan-50/40 to-slate-50 border border-cyan-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Install Aplikasi (PWA)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-100/80 text-cyan-800 border border-cyan-200 text-[10px] font-mono font-bold">
                    Akses Cepat &amp; Offline-Ready
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  Nikmati kemudahan akses offline dan kecepatan peluncuran instan langsung dari layar utama perangkat HP maupun Desktop Kiosk sekolah tanpa perlu membuka browser berulang kali.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={triggerInstall}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Install Aplikasi Sekarang</span>
            </button>
          </div>
        )}

        {/* =================================================================
            NAVIGASI MENU PENGATURAN:
            1. Tampilan Ponsel (md:hidden): Grid 2 Kolom Kartu Menu Utama (Drill-Down)
               - Super Admin: 8 Kartu (2x4)
               - Admin: 6 Kartu (2x3)
            2. Tampilan Desktop (hidden md:flex): 1 Baris Pill-Tabs Sejajar
           ================================================================= */}

        {/* 1. DASHBOARD MENU CARDS GRID (Grid 2 Kolom Simetris Sempurna - md:hidden) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 p-1 md:hidden">
          {/* Baris 1 - Kartu 1: Identitas Instansi */}
          <button
            type="button"
            onClick={() => handleOpenMobileSubmenu('identity')}
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-cyan-600">Buka &rarr;</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                Identitas Instansi
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                {appLogo ? 'Logo Kustom Aktif' : 'Status: Aktif'}
              </div>
            </div>
          </button>

          {/* Baris 1 - Kartu 2: Warna Tema */}
          <button
            type="button"
            onClick={() => handleOpenMobileSubmenu('theme')}
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-violet-400 hover:bg-violet-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-violet-600">Buka &rarr;</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                Warna Tema
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                {isCurrentUserSuperAdmin ? 'Warna Tema Aktif' : '🔒 Khusus Super Admin'}
              </div>
            </div>
          </button>

          {/* Baris 2 - Kartu 3: Jam & Mode Presensi */}
          <button
            type="button"
            onClick={() => handleOpenMobileSubmenu('time')}
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-amber-600">Buka &rarr;</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                Jam &amp; Mode Presensi
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                Mode: {isAutomaticMode ? 'Otomatis' : 'Manual'}
              </div>
            </div>
          </button>

          {/* Baris 2 - Kartu 4: Template WA */}
          <button
            type="button"
            onClick={() => handleOpenMobileSubmenu('templates')}
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-indigo-600">Buka &rarr;</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                Template WA
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                {templates.length || 20} Variasi Format Pesan
              </div>
            </div>
          </button>

          {/* Baris 3 - Kartu 5: Tahun Ajaran & Semester */}
          <button
            type="button"
            onClick={() => handleOpenMobileSubmenu('academic')}
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-blue-600">Buka &rarr;</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                Tahun Ajaran &amp; Semester
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                {academicYear} • Semester {semester}
              </div>
            </div>
          </button>

          {/* Baris 3 - Kartu 6: WA Gateway (Khusus Super Admin) */}
          {isCurrentUserSuperAdmin && (
            <button
              type="button"
              onClick={() => handleOpenMobileSubmenu('gateway')}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-emerald-600">Buka &rarr;</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-snug">
                  WA Gateway
                </div>
                <div
                  className={`text-[11px] font-medium mt-0.5 truncate ${
                    hasTokenConfigured ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  Status: {hasTokenConfigured ? 'Aktif' : 'Belum Diisi'}
                </div>
              </div>
            </button>
          )}

          {/* Baris 4 - Kartu 7: Backup & Maintenance (Khusus Super Admin) */}
          {isCurrentUserSuperAdmin && (
            <button
              type="button"
              onClick={() => handleOpenMobileSubmenu('backup')}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-violet-400 hover:bg-violet-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
                  <HardDriveDownload className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-violet-600">Buka &rarr;</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-snug">
                  Backup &amp; Maintenance
                </div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                  Status: Cadangan &amp; Pemulihan
                </div>
              </div>
            </button>
          )}

          {/* Kartu 8 (Super Admin: 2x4) / Kartu 6 (Admin: 2x3): Tentang Aplikasi */}
          <button
            type="button"
            onClick={() => handleOpenMobileSubmenu('about')}
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50/30 text-left transition-all flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-cyan-600">Buka &rarr;</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                Tentang Aplikasi
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                Versi 1.0 • Keunggulan
              </div>
            </div>
          </button>
        </div>

        {/* 2. DESKTOP NAVIGATION (1 Baris Pill-Tabs Sejajar Tanpa Terlempar ke Baris Kedua - hidden md:flex) */}
        <div className="hidden md:flex items-center justify-between gap-4 w-full">
          <div className="flex flex-nowrap items-center gap-1 p-1.5 bg-gray-100/90 backdrop-blur-xs rounded-2xl border border-gray-200 w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'identity'
                  ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
              <span>Identitas Instansi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('theme')}
              className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'theme'
                  ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
              <span>Warna Tema</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('academic')}
              className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'academic'
                  ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
              <span>Tahun Ajaran &amp; Semester</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('time')}
              className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'time'
                  ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
              <span>Jam &amp; Mode Presensi</span>
            </button>

            {isCurrentUserSuperAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('gateway')}
                className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'gateway'
                    ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                }`}
              >
                <Globe className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
                <span>WA Gateway</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'templates'
                  ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
              <span>Template WA</span>
            </button>

            {isCurrentUserSuperAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'backup'
                    ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                }`}
              >
                <HardDriveDownload className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
                <span>Backup &amp; Maintenance</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`flex-1 px-2 lg:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all duration-300 ease-out active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'about'
                  ? 'bg-cyan-500 text-white shadow-sm scale-[1.01]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
              <span>Tentang Aplikasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* HEADER KHUSUS HALAMAN SUB-MENU DI PONSEL (Muncul saat salah satu kartu diklik) */}
      {mobileSubmenu !== null && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2 md:hidden ios-tab-transition sticky top-2 z-30">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <button
              type="button"
              onClick={handleBackToMobileMenu}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs inline-flex items-center gap-1.5 transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Daftar Pengaturan</span>
            </button>
          </div>

          <div className="space-y-1 pt-0.5">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {mobileSubmenuMeta[mobileSubmenu].title}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mobileSubmenuMeta[mobileSubmenu].subtitle}
            </p>
          </div>
        </div>
      )}

      {/* KONTEN FORM SUB-MENU:
          - Pada Ponsel: Hanya tampil jika salah satu kartu sub-menu telah diklik (mobileSubmenu !== null)
          - Pada Desktop: Selalu tampil sesuai tab aktif (md:block) */}
      <div
        key={activeTab}
        className={`${mobileSubmenu === null ? 'hidden md:block' : 'block'} space-y-6 ios-tab-transition`}
      >
      {/* TAB 1: IDENTITAS INSTANSI (2-Column Grid Layout: Form Konfigurasi & Live Preview Header) */}
      {activeTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          {/* Kolom Kiri: Form Konfigurasi Identitas & Warna Tema (2 Kartu Terpisah) */}
          <div className="lg:col-span-7 space-y-6">
            {/* KARTU 1: Identitas Instansi / Sekolah */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Identitas Instansi / Sekolah
                    </h2>
                    <p className="text-xs text-gray-500">
                      Sesuaikan logo, nama instansi, dan motto pada Brand Header pojok kiri atas aplikasi
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. Logo / Ikon Instansi */}
              <div className="space-y-3 text-xs">
                <label className="text-gray-800 font-bold block">
                  Logo / Ikon Instansi
                </label>

                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm active:scale-95 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Gambar Logo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs flex items-center gap-1.5 border border-gray-200 active:scale-95 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Gunakan Ikon Default</span>
                  </button>
                </div>

                {isBase64Logo && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Teroptimasi otomatis: ~{compressedSizeKB} KB</span>
                    </span>
                    <span className="text-[11px] text-gray-500">
                      (Maks 128px • Latar Transparan WebP/PNG)
                    </span>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Atau masukkan URL Gambar Logo langsung:</span>
                  </span>
                  <input
                    type="text"
                    value={isBase64Logo ? '' : appLogo}
                    onChange={(e) => {
                      setAppLogo(e.target.value);
                      setPreviewLogoError(false);
                    }}
                    placeholder={
                      isBase64Logo
                        ? `Gambar logo hasil upload aktif (~${compressedSizeKB} KB) — ketik URL baru untuk mengganti`
                        : 'https://contoh-sekolah.sch.id/logo.png'
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-cyan-500 shadow-sm transition"
                  />
                </div>
              </div>

              {/* 2. Judul Utama Aplikasi / Nama Instansi */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-gray-800 font-bold">
                    Judul Utama Aplikasi / Nama Instansi
                  </label>
                  <button
                    type="button"
                    onClick={() => setAppTitle(DEFAULT_APP_TITLE)}
                    className="text-[11px] text-cyan-600 hover:underline font-semibold"
                  >
                    Reset Default
                  </button>
                </div>
                <input
                  type="text"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="Contoh: MI AL-WASHLIYAH atau SMART PRESENSI"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:bg-white focus:outline-none focus:border-cyan-500 shadow-sm transition"
                />
                <p className="hidden md:block text-[11px] text-gray-500">
                  Ditampilkan sebagai judul tebal di baris atas pojok kiri Navbar (Default: <code>{DEFAULT_APP_TITLE}</code>).
                </p>
              </div>

              {/* 3. Sub-Judul / Motto / Slogan */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-gray-800 font-bold">
                    Sub-Judul / Motto / Slogan
                  </label>
                  <button
                    type="button"
                    onClick={() => setAppSubtitle(DEFAULT_APP_SUBTITLE)}
                    className="text-[11px] text-cyan-600 hover:underline font-semibold"
                  >
                    Reset Default
                  </button>
                </div>
                <input
                  type="text"
                  value={appSubtitle}
                  onChange={(e) => setAppSubtitle(e.target.value)}
                  placeholder="Contoh: Cerdas, Berakhlak Mulia & Berprestasi"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-cyan-500 shadow-sm transition"
                />
                <p className="hidden md:block text-[11px] text-gray-500">
                  Ditampilkan tepat di bawah Judul Utama dengan ukuran elegan (Default: <code>{DEFAULT_APP_SUBTITLE}</code>).
                </p>
              </div>

              {/* Tombol Simpan Spesifik Kartu Identitas Instansi */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                {identityFeedback ? (
                  <div className={`text-xs font-semibold flex items-center gap-1.5 ${identityFeedback.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {identityFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{identityFeedback.message}</span>
                  </div>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveIdentityCard}
                  disabled={isSavingIdentity}
                  className="ml-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingIdentity ? 'Menyimpan...' : 'Simpan Identitas Instansi'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Live Preview Header & Kartu Status Aplikasi Perangkat (PWA) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Kartu 1: Live Preview Brand Header */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Live Preview Brand Header
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pratinjau langsung tampilan pojok kiri atas Navbar saat Anda mengetik
                  </p>
                </div>
                <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full font-bold">
                  Real-time Preview
                </span>
              </div>

              {/* Simulasi Bar Navbar */}
              <div className="p-5 rounded-2xl bg-slate-100/80 border border-gray-200 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">
                  Simulasi Tampilan Pojok Kiri Atas Navbar:
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {appLogo.trim() && !previewLogoError ? (
                      <img
                        src={appLogo.trim()}
                        alt={appTitle || DEFAULT_APP_TITLE}
                        onError={() => setPreviewLogoError(true)}
                        className="w-10 h-10 object-contain rounded-xl shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
                        <Radio className="w-5 h-5 text-white animate-pulse" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base sm:text-lg font-extrabold tracking-tight text-cyan-700 block truncate max-w-[200px] sm:max-w-xs">
                          {appTitle.trim() || DEFAULT_APP_TITLE}
                        </span>
                      </div>
                      <p className="text-xs text-cyan-600/80 font-semibold block truncate max-w-[220px] sm:max-w-xs">
                        {appSubtitle.trim() || DEFAULT_APP_SUBTITLE}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:block p-4 rounded-xl bg-cyan-50/60 border border-cyan-200/80 space-y-2 text-xs text-cyan-950">
                <div className="font-bold flex items-center gap-1.5 text-cyan-800">
                  <Info className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>Tips Kustomisasi Identitas Instansi</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-cyan-900/90 leading-relaxed">
                  <li>
                    Gunakan gambar logo berformat <strong>PNG transparan</strong> atau <strong>SVG/JPG</strong> persegi agar proporsional (<code>w-10 h-10 object-contain</code>).
                  </li>
                  <li>
                    Gambar yang diunggah dari perangkat otomatis dikompresi ringan ke format Base64 sehingga langsung tersimpan tanpa memerlukan konfigurasi server tambahan.
                  </li>
                  <li>
                    Klik <strong>Gunakan Ikon Default</strong> kapan saja untuk kembali ke ikon radar biru bawaan.
                  </li>
                </ul>
              </div>
            </div>

            {/* Penempatan 2: Kartu Ringkas Status Aplikasi Perangkat (PWA) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Status Aplikasi Perangkat (PWA)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Instalasi mandiri untuk perangkat HP maupun Desktop Kiosk sekolah
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold shrink-0">
                  PWA Ready
                </span>
              </div>

              {isInstalled ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs font-bold text-emerald-800">
                  <span>✅ Terpasang sebagai Aplikasi Mandiri</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Aplikasi ini dapat dipasang langsung di layar utama HP atau Desktop Kiosk sekolah tanpa melalui Play Store, dengan ikon yang otomatis mengikuti logo instansi Anda.
                  </p>
                  <button
                    type="button"
                    onClick={triggerInstall}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <span className="text-sm leading-none">📲</span>
                    <span>Install Aplikasi ke Perangkat Ini</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB SUB-HALAMAN MANDIRI: TEMA & ESTETIKA */}
      {activeTab === 'theme' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          {/* Kolom Kiri: Pilihan 6 Warna Tema Aksen Utama */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Warna Tema Aksen Utama Aplikasi
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pilih warna aksen utama yang berlaku secara menyeluruh (Panel Admin &amp; Portal Wali Murid)
                    </p>
                  </div>
                </div>

                {!isCurrentUserSuperAdmin && (
                  <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[11px] flex items-center gap-1.5 shadow-2xs shrink-0">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>🔒 Khusus Super Admin</span>
                  </span>
                )}
              </div>

              {!isCurrentUserSuperAdmin && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Mode Lihat (Read-Only): Pilihan warna tema dikunci. Perubahan hanya dapat dilakukan oleh Super Admin / Master Owner.</span>
                </div>
              )}

              {/* Grid 2 Kolom (Mobile) & 3 Kolom (Desktop) 6 Pilihan Tema */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {(Object.keys(ACCENT_THEME_CONFIGS) as PrimaryAccentTheme[]).map((themeKey) => {
                  const config = ACCENT_THEME_CONFIGS[themeKey];
                  const isSelected = primaryAccent === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      disabled={!isCurrentUserSuperAdmin}
                      onClick={() => {
                        if (isCurrentUserSuperAdmin) {
                          setPrimaryAccent(themeKey);
                          applyThemeAccent(themeKey);
                        }
                      }}
                      style={
                        isSelected
                          ? {
                              borderColor: config.primaryHex,
                              backgroundColor: config.lightHex,
                              boxShadow: `0 0 0 2px ${config.ringHex}`,
                            }
                          : {}
                      }
                      className={`relative p-3.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center gap-2 ${
                        isSelected
                          ? 'shadow-2xs font-bold'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 font-medium'
                      } ${
                        !isCurrentUserSuperAdmin
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-pointer active:scale-95'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center border border-black/10 shrink-0"
                        style={{ background: config.primaryHex }}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-white drop-shadow-sm" />
                        )}
                      </div>
                      <div className="text-center min-w-0 w-full">
                        <div className="text-[11px] font-bold text-gray-900 leading-tight truncate">
                          {config.name}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 truncate hidden sm:block">
                          {config.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Tombol Simpan Perubahan Tema Spesifik */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                {themeFeedback ? (
                  <div className={`text-xs font-semibold flex items-center gap-1.5 ${themeFeedback.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {themeFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{themeFeedback.message}</span>
                  </div>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveThemeCard}
                  disabled={isSavingTheme || !isCurrentUserSuperAdmin}
                  className="ml-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingTheme
                      ? 'Menyimpan...'
                      : !isCurrentUserSuperAdmin
                      ? '🔒 Khusus Super Admin'
                      : 'Simpan Perubahan Tema'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Live Preview Komponen Aksen & Panduan Role */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Pratinjau Komponen Tema
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Elemen antarmuka merespons seketika saat tema dipilih
                  </p>
                </div>
                <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full font-bold">
                  Real-time Preview
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-bold text-xs shadow-sm">
                    Tombol Utama
                  </button>
                  <button type="button" className="px-3.5 py-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold text-xs">
                    Tab / Badge Aktif
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white border border-cyan-500 text-slate-800 text-xs font-semibold shadow-2xs flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                  <span>Input Form Focus Accent &amp; Active Indicator</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200/80 space-y-2 text-xs text-cyan-950">
                <div className="font-bold flex items-center gap-1.5 text-cyan-800">
                  <Info className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>Informasi Hak Akses &amp; Cakupan Tema</span>
                </div>
                <p className="text-[11px] text-cyan-900/90 leading-relaxed">
                  Pengaturan warna tema ini berlaku secara global untuk seluruh pengguna (Panel Admin &amp; Portal Wali Murid) dan <strong>hanya dapat diubah oleh Super Admin (Master Owner)</strong>. Status kehadiran (Hadir, Sakit, Pelanggaran) tetap menggunakan warna indikator semantik asli.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB SUB-HALAMAN MANDIRI: TAHUN AJARAN & SEMESTER */}
      {activeTab === 'academic' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          {/* Kolom Kiri: Form Pengaturan Tahun Ajaran & Semester */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Tahun Ajaran &amp; Semester Aktif
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Kelola periode aktif pembelajaran dan semester untuk presensi serta rekapitulasi data
                    </p>
                  </div>
                </div>

                {!isCurrentUserSuperAdmin && (
                  <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[11px] flex items-center gap-1.5 shadow-2xs shrink-0">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>🔒 Khusus Super Admin</span>
                  </span>
                )}
              </div>

              {!isCurrentUserSuperAdmin && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Mode Lihat (Read-Only): Tahun ajaran &amp; semester dikunci. Perubahan hanya dapat dilakukan oleh Super Admin / Master Owner.</span>
                </div>
              )}

              {/* 1. Tahun Ajaran Aktif */}
              <div className="space-y-1.5 text-xs">
                <label className="text-gray-800 font-bold block">
                  Tahun Ajaran Aktif
                </label>
                <input
                  type="text"
                  disabled={!isCurrentUserSuperAdmin}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="Contoh: 2025/2026"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-gray-500">
                  Format standar tahun pelajaran sekolah (Contoh: <code>2025/2026</code>).
                </p>
              </div>

              {/* 2. Semester Aktif */}
              <div className="space-y-2 text-xs pt-1">
                <label className="text-gray-800 font-bold block">
                  Semester Aktif
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Ganjil', 'Genap'] as const).map((semOpt) => {
                    const isSelected = semester === semOpt;
                    return (
                      <button
                        key={semOpt}
                        type="button"
                        disabled={!isCurrentUserSuperAdmin}
                        onClick={() => {
                          if (isCurrentUserSuperAdmin) setSemester(semOpt);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs font-bold'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 font-medium'
                        } ${!isCurrentUserSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                      >
                        <div>
                          <div className="text-xs font-bold">Semester {semOpt}</div>
                          <div className="text-[10px] text-gray-500 font-normal">
                            {semOpt === 'Ganjil' ? 'Periode Juli - Desember' : 'Periode Januari - Juni'}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tombol Simpan Spesifik Kartu Tahun Ajaran */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                {academicFeedback ? (
                  <div className={`text-xs font-semibold flex items-center gap-1.5 ${academicFeedback.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {academicFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{academicFeedback.message}</span>
                  </div>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveAcademicCard}
                  disabled={isSavingAcademic || !isCurrentUserSuperAdmin}
                  className="ml-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingAcademic
                      ? 'Menyimpan...'
                      : !isCurrentUserSuperAdmin
                      ? '🔒 Khusus Super Admin'
                      : 'Simpan Tahun Ajaran'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Kartu Arsip Data & Reset Tahun Ajaran */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Arsip Data &amp; Reset Tahun Ajaran
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Kunci rekapitulasi data dan persiapkan sistem ke tahun ajaran baru
                    </p>
                  </div>
                </div>
              </div>

              {resetFeedback && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${resetFeedback.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  {resetFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{resetFeedback.message}</span>
                </div>
              )}

              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Petunjuk Arsip &amp; Pergantian Tahun</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Melakukan <strong>Arsip Data &amp; Reset Tahun Ajaran</strong> akan membekukan rekapitulasi presensi berjalan dan secara otomatis memperbarui periode ke tahun ajaran berikutnya (contoh: <code>2025/2026</code> &rarr; <code>2026/2027</code>).
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!isCurrentUserSuperAdmin}
                  onClick={() => {
                    if (isCurrentUserSuperAdmin) {
                      setShowResetModal(true);
                      setResetConfirmInput('');
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>
                    {!isCurrentUserSuperAdmin
                      ? '🔒 Arsip & Reset Khusus Super Admin'
                      : 'Arsip Data & Reset Tahun Ajaran'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JAM & MODE PRESENSI (2-Column Grid Layout) */}
      {activeTab === 'time' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          {/* Left Column: Mode Otomatis & Informasi Prioritas Jadwal */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold">
                    Mode Penentuan Status
                  </span>
                  <h2 className="text-base font-bold text-gray-900 mt-2">
                    Mode Otomatis Waktu Presensi
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAutomaticMode(!isAutomaticMode)}
                  className={`w-16 h-9 rounded-full transition-colors relative p-1 shrink-0 border ${
                    isAutomaticMode
                      ? 'bg-cyan-500 border-cyan-400'
                      : 'bg-gray-300 border-gray-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full bg-white shadow-md transition-transform flex items-center justify-center font-bold text-[10px] text-gray-900 ${
                      isAutomaticMode ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  >
                    {isAutomaticMode ? 'AUTO' : 'MAN'}
                  </div>
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Saat <strong>Mode Otomatis (AUTO)</strong> aktif, sistem secara cerdas menentukan status kehadiran siswa (<em>Hadir Tepat Waktu</em>, <em>Terlambat</em>, atau <em>Pulang</em>) berdasarkan waktu tap kartu QR/RFID terhadap jadwal yang berlaku.
              </p>

              <div className="p-3.5 rounded-xl bg-cyan-50/70 border border-cyan-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-cyan-900">Status Saat Ini:</span>
                <span className="font-mono font-bold text-cyan-700 bg-white px-3 py-1 rounded-lg border border-cyan-200">
                  {isAutomaticMode ? 'OTOMATIS AKTIF (DIREKOMENDASIKAN)' : 'MANUAL KLIK'}
                </span>
              </div>

              {/* Tombol Simpan Spesifik Kartu Mode Presensi */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                {autoModeFeedback ? (
                  <div className={`text-xs font-semibold flex items-center gap-1.5 ${autoModeFeedback.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {autoModeFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{autoModeFeedback.message}</span>
                  </div>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveAutoModeCard}
                  disabled={isSavingAutoMode}
                  className="ml-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingAutoMode ? 'Menyimpan...' : 'Simpan Mode Presensi'}</span>
                </button>
              </div>
            </div>

            {/* Kartu Baru (iOS Frosted Glass): Jadwal Khusus & Pengecualian */}
            <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-gray-200/90 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                    Pengecualian Jadwal
                  </span>
                  <h2 className="text-base font-bold text-gray-900 mt-2">
                    Jadwal Khusus &amp; Pengecualian
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSpecialScheduleEnabled(!specialScheduleEnabled)}
                  className={`w-16 h-9 rounded-full transition-colors relative p-1 shrink-0 border ${
                    specialScheduleEnabled
                      ? 'bg-cyan-500 border-cyan-400'
                      : 'bg-gray-300 border-gray-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full bg-white shadow-md transition-transform flex items-center justify-center font-bold text-[10px] text-gray-900 ${
                      specialScheduleEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  >
                    {specialScheduleEnabled ? 'ON' : 'OFF'}
                  </div>
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Tetapkan jam pulang khusus (misalnya hari Jumat pulang lebih awal) atau liburkan hari tertentu secara otomatis saat Mode Otomatis (AUTO) berjalan.
              </p>

              {/* Opsi Lanjutan (Conditional / Expandable Rendering saat Toggle Aktif) */}
              {specialScheduleEnabled && (
                <div className="pt-2 space-y-3.5 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
                  {/* 1. Pilih Hari */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-800 block">
                      Pilih Hari Pengecualian
                    </label>
                    <select
                      value={specialScheduleDay}
                      onChange={(e) => setSpecialScheduleDay(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      <option value={1}>Senin</option>
                      <option value={2}>Selasa</option>
                      <option value={3}>Rabu</option>
                      <option value={4}>Kamis</option>
                      <option value={5}>Jumat (Default)</option>
                      <option value={6}>Sabtu</option>
                      <option value={0}>Minggu</option>
                    </select>
                  </div>

                  {/* 2. Mode Pengecualian */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-800 block">
                      Mode Pengecualian
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          specialScheduleMode === 'pulang_awal'
                            ? 'bg-cyan-50/80 border-cyan-400 text-cyan-900 font-bold shadow-2xs'
                            : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="special_schedule_mode"
                          value="pulang_awal"
                          checked={specialScheduleMode === 'pulang_awal'}
                          onChange={() => setSpecialScheduleMode('pulang_awal')}
                          className="text-cyan-600 focus:ring-cyan-500"
                        />
                        <span>Pulang Lebih Awal</span>
                      </label>

                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          specialScheduleMode === 'libur'
                            ? 'bg-rose-50/80 border-rose-400 text-rose-900 font-bold shadow-2xs'
                            : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="special_schedule_mode"
                          value="libur"
                          checked={specialScheduleMode === 'libur'}
                          onChange={() => setSpecialScheduleMode('libur')}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span>Diliburkan</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Jam Pulang Khusus (Hanya muncul jika Mode = Pulang Lebih Awal) */}
                  {specialScheduleMode === 'pulang_awal' && (
                    <div className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-200/80 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-bold text-cyan-950">
                          Jam Pulang Khusus
                        </label>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                          Status: Pulang
                        </span>
                      </div>
                      <input
                        type="time"
                        value={specialScheduleTime}
                        onChange={(e) => setSpecialScheduleTime(e.target.value)}
                        className="w-full bg-white border border-cyan-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-cyan-500 shadow-2xs"
                      />
                      <p className="text-[11px] text-cyan-800 leading-relaxed">
                        Menimpa jam pulang reguler kelas pada hari terpilih. Siswa yang tap pada atau setelah jam ini otomatis tercatat dengan status <strong>&quot;Pulang&quot;</strong> normal.
                      </p>
                    </div>
                  )}

                  {specialScheduleMode === 'libur' && (
                    <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 text-[11px] text-rose-800 leading-relaxed animate-in fade-in duration-150">
                      Saat siswa melakukan tap presensi pada hari ini, sistem akan menolak dengan notifikasi: <strong>&quot;Hari ini ditetapkan sebagai hari libur.&quot;</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Tombol Simpan Spesifik Kartu Jadwal Khusus */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                {specialScheduleFeedback ? (
                  <div
                    className={`text-xs font-semibold flex items-center gap-1.5 ${
                      specialScheduleFeedback.success ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {specialScheduleFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{specialScheduleFeedback.message}</span>
                  </div>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={handleSaveSpecialScheduleCard}
                  disabled={isSavingSpecialSchedule}
                  className="ml-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingSpecialSchedule ? 'Menyimpan...' : 'Simpan Pengecualian'}
                  </span>
                </button>
              </div>
            </div>

            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-600" />
                Urutan Prioritas Validasi Jadwal
              </h3>
              <div className="space-y-2.5 text-gray-600 leading-relaxed">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="font-bold text-gray-900">1. Kalender Pendidikan & Hari Libur</div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Jika tanggal hari ini termasuk agenda Libur di Kalender Pendidikan atau hari tidak aktif di Rombel, presensi otomatis ditolak.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="font-bold text-gray-900">2. Jadwal Harian Rombel (Kelas)</div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Sistem memprioritaskan jam masuk, batas telat, dan jam pulang dari Rombel masing-masing siswa.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="font-bold text-gray-900">3. Rentang Jam Global (Fallback)</div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Rentang jam di sebelah kanan digunakan sebagai acuan standar apabila Rombel siswa belum memiliki pengaturan jam khusus.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Grid 2 Kolom Pengaturan Rentang Jam Kategori Presensi */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Pengaturan Rentang Jam Kategori Presensi (Global)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Atur batas waktu mulai dan selesai untuk setiap kategori presensi harian
                  </p>
                </div>
                <Clock className="w-5 h-5 text-cyan-600 shrink-0" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Masuk Tepat Waktu */}
                <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200/80 space-y-3">
                  <div className="font-bold text-gray-900 flex items-center justify-between">
                    <span>Masuk Tepat Waktu</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono font-bold">
                      hadir_tepat
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-gray-800">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Jam Mulai:</span>
                      <input
                        type="time"
                        value={timeRanges.tepat.start}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            tepat: { ...timeRanges.tepat, start: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Batas Tepat:</span>
                      <input
                        type="time"
                        value={timeRanges.tepat.end}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            tepat: { ...timeRanges.tepat, end: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Terlambat */}
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="font-bold text-gray-900 flex items-center justify-between">
                    <span>Hadir Terlambat</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-mono font-bold">
                      hadir_telat
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-gray-800">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Mulai Telat:</span>
                      <input
                        type="time"
                        value={timeRanges.telat.start}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            telat: { ...timeRanges.telat, start: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Batas Akhir:</span>
                      <input
                        type="time"
                        value={timeRanges.telat.end}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            telat: { ...timeRanges.telat, end: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Pulang Cepat */}
                <div className="p-4 bg-cyan-50/40 rounded-2xl border border-cyan-200/80 space-y-3">
                  <div className="font-bold text-gray-900 flex items-center justify-between">
                    <span>Pulang Cepat</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-mono font-bold">
                      pulang
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-gray-800">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Jam Mulai:</span>
                      <input
                        type="time"
                        value={timeRanges.pulangCepat.start}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            pulangCepat: { ...timeRanges.pulangCepat, start: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Jam Selesai:</span>
                      <input
                        type="time"
                        value={timeRanges.pulangCepat.end}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            pulangCepat: { ...timeRanges.pulangCepat, end: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Pulang Reguler */}
                <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-200/80 space-y-3">
                  <div className="font-bold text-gray-900 flex items-center justify-between">
                    <span>Pulang Reguler</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono font-bold">
                      pulang
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-gray-800">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Jam Mulai:</span>
                      <input
                        type="time"
                        value={timeRanges.pulang.start}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            pulang: { ...timeRanges.pulang, start: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1 font-sans font-medium">Jam Selesai:</span>
                      <input
                        type="time"
                        value={timeRanges.pulang.end}
                        onChange={(e) =>
                          setTimeRanges({
                            ...timeRanges,
                            pulang: { ...timeRanges.pulang, end: e.target.value },
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
              {timeRangesFeedback ? (
                <div className={`text-xs font-semibold flex items-center gap-1.5 ${timeRangesFeedback.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {timeRangesFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{timeRangesFeedback.message}</span>
                </div>
              ) : <span />}

              <button
                type="button"
                onClick={handleSaveTimeRangesCard}
                disabled={isSavingTimeRanges}
                className="ml-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingTimeRanges ? 'Menyimpan...' : 'Simpan Jam Presensi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: API WA GATEWAY (Khusus Super Admin) */}
      {activeTab === 'gateway' && isCurrentUserSuperAdmin && (
        <div className="max-w-2xl animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Token WhatsApp Gateway Sekolah
                  </h2>
                  <p className="text-xs text-gray-500">
                    Masukkan kode token WhatsApp Gateway milik sekolah untuk mengirim notifikasi kehadiran ke orang tua/wali siswa.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-gray-800 font-bold">
                  Kode Token / Secret Key WhatsApp
                </label>
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md font-semibold ${
                    hasTokenConfigured
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {hasTokenConfigured ? 'Status: Aktif' : 'Belum Diisi'}
                </span>
              </div>

              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={sidobeToken}
                  onChange={(e) => setSidobeToken(e.target.value)}
                  placeholder="Tempel (paste) kode token WhatsApp sekolah di sini..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-xs text-gray-900 font-mono focus:bg-white focus:outline-none focus:border-cyan-500 shadow-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  title={showToken ? 'Sembunyikan Token' : 'Tampilkan Token'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition"
                >
                  {showToken ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="hidden md:block text-xs text-gray-500 leading-relaxed">
                Ketuk ikon mata di sebelah kanan untuk melihat atau menyembunyikan karakter token.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
              {gatewayFeedback ? (
                <div className={`text-xs font-semibold flex items-center gap-1.5 ${gatewayFeedback.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {gatewayFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{gatewayFeedback.message}</span>
                </div>
              ) : <span />}

              <button
                type="button"
                onClick={handleSaveGatewayCard}
                disabled={isSavingGateway}
                className="ml-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingGateway ? 'Menyimpan...' : 'Simpan Token WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEMPLATE WA (SPINTAX) (Full-Width 2-Column Layout) */}
      {activeTab === 'templates' && (
        <div className="animate-in fade-in duration-150">
          <TemplateManager
            externalTemplates={templates}
            onExternalTemplatesChange={setTemplates}
          />
        </div>
      )}

      {/* TAB 5: BACKUP & MAINTENANCE (Pusat Backup, Pemulihan & Maintenance Database - Khusus Super Admin) */}
      {activeTab === 'backup' && isCurrentUserSuperAdmin && (
        <BackupMaintenancePanel
          onDataRestored={() => {
            const s = settingsService.getSettings();
            setAppLogo(s.appLogo || '');
            setAppTitle(s.appTitle || DEFAULT_APP_TITLE);
            setAppSubtitle(s.appSubtitle || DEFAULT_APP_SUBTITLE);
            setIsAutomaticMode(s.isAutomaticMode);
            setTimeRanges(s.timeRanges);
            supabaseService.getTemplates().then((loaded) => {
              if (loaded && loaded.length > 0) setTemplates(loaded);
            });
            if (onSettingsChanged) onSettingsChanged();
          }}
        />
      )}

      {/* TAB 6: TENTANG APLIKASI (Brand Awareness & USP Showcase - Dapat diakses oleh Super Admin & Admin) */}
      {activeTab === 'about' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* BAGIAN A: HERO BRAND CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 bg-gradient-to-br from-cyan-50/90 via-white to-slate-50 border-b border-slate-100">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
                  {appLogo.trim() && !previewLogoError ? (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-cyan-200 shadow-sm p-2 flex items-center justify-center shrink-0">
                      <img
                        src={appLogo.trim()}
                        alt={appTitle || DEFAULT_APP_TITLE}
                        onError={() => setPreviewLogoError(true)}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-cyan-500 flex items-center justify-center text-white shadow-md shrink-0">
                      <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-pulse" />
                    </div>
                  )}

                  <div className="space-y-2.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Cloud Real-Time Active</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Release Build v1.0 Stable</span>
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                      SMART PRESENSI V1.0 — Enterprise School System
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Platform ekosistem digital sekolah terpadu yang mentransformasi pencatatan kehadiran siswa, pembinaan kedisiplinan berbasis kredit poin, manajemen jadwal akademik, hingga pelaporan real-time ke WhatsApp orang tua secara otomatis, akurat, dan efisien.
                    </p>
                  </div>
                </div>

                {/* Ringkasan Metrik Kapabilitas di Sisi Kanan Hero */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 shrink-0 lg:w-60">
                  <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">&lt; 0.5 Detik</div>
                      <div className="text-[11px] text-slate-500 font-medium">Kecepatan Baca Scan</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">Hybrid Cloud</div>
                      <div className="text-[11px] text-slate-500 font-medium">Sinkronisasi &amp; Cadangan</div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 lg:col-span-1 p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">100% Terukur</div>
                      <div className="text-[11px] text-slate-500 font-medium">Akses Multi-Role Aman</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN B: 6 KARTU USP / KEUNGGULAN UTAMA (Grid 1 Kolom di Ponsel, 2-3 Kolom di Desktop) */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-600 shrink-0" />
                  <span>6 Keunggulan Utama Sistem (Core USP)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dirancang khusus untuk menjawab kebutuhan operasional sekolah dan madrasah modern
                </p>
              </div>
              <span className="self-start sm:self-auto text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full">
                6 Modul Terintegrasi Penuh
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* USP 1 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      01 • Hardware Agnostic
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    Dual-Mode Smart Scanner (QR &amp; RFID)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Presensi instan via kamera perangkat maupun RFID Reader tanpa ketergantungan mesin fingerprint konvensional yang mahal.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-cyan-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <span>Plug &amp; Play di HP, Tablet, &amp; PC Kiosk</span>
                </div>
              </div>

              {/* USP 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      02 • Smart Time Engine
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    Smart Auto-Schedule per Rombel
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Deteksi status Hadir Tepat, Terlambat, dan Pulang secara otomatis mengikuti jam jadwal masing-masing kelas.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Sinkron dengan Kalender Pendidikan</span>
                </div>
              </div>

              {/* USP 3 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      03 • Anti-Block Engine
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    WA Gateway Anti-Banned (20+ Spintax)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pengiriman laporan WhatsApp real-time ke orang tua dengan algoritma pengacakan teks otomatis yang aman dari pemblokiran.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Antrean Pintar (Smart Queue Worker)</span>
                </div>
              </div>

              {/* USP 4 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      04 • Credit Point System
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    Integrasi Otomatis Poin &amp; Kedisiplinan
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Keterlambatan presensi langsung terhubung dengan pemotongan kredit poin siswa, analitik bulanan, dan pemantauan SP1/SP2/SP3.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Deteksi Dini Ambang Batas Peringatan</span>
                </div>
              </div>

              {/* USP 5 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      05 • Role-Based Access
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    Ekosistem Multi-Role Terpadu
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hak akses terukur untuk Super Admin, Admin TU, Wali Kelas (otomatis terkunci per rombel), hingga Portal Mandiri Wali Murid.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-violet-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                  <span>Isolasi Data Kelas Binaan Otomatis</span>
                </div>
              </div>

              {/* USP 6 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      06 • Official Document Engine
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    Generator Dokumen &amp; Laporan Resmi A4
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cetak kartu QR massal, rekap presensi, dan buku poin berformat surat resmi A4 lengkap dengan kop sekolah dan blok tanda tangan pengesahan.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Siap Cetak A4 &amp; Ekspor CSV/Excel</span>
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN C: PERBANDINGAN SISTEM KONVENSIONAL VS SMART PRESENSI */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Perbandingan Sistem Konvensional vs Smart Presensi V1.0
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Efisiensi waktu operasional, penghematan anggaran perangkat keras, dan akurasi pelaporan data sekolah
                </p>
              </div>
              <span className="self-start sm:self-auto text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Efisiensi Operasional hingga 90%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    <th className="py-3.5 px-4 sm:px-6 w-1/4">Aspek Operasional</th>
                    <th className="py-3.5 px-4 sm:px-6 w-3/8 text-rose-700 bg-rose-50/40">
                      Cara Manual / Mesin Absensi Lama
                    </th>
                    <th className="py-3.5 px-4 sm:px-6 w-3/8 text-cyan-800 bg-cyan-50/50">
                      Smart Presensi V1.0 (Enterprise)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                      Biaya Perangkat &amp; Perawatan
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 bg-rose-50/15">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>Investasi mesin fingerprint mahal, sensor sering aus/rusak, dan antrean mengular.</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-800 font-medium bg-cyan-50/20">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Tanpa mesin khusus; cukup kamera HP/Webcam atau USB RFID Reader murah &amp; responsif.</span>
                      </div>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                      Notifikasi ke Orang Tua
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 bg-rose-50/15">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>Tidak ada kabar otomatis; wali kelas harus menghubungi orang tua satu per satu.</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-800 font-medium bg-cyan-50/20">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Terkirim real-time ke WhatsApp orang tua lengkap dengan 20+ variasi teks Spintax anti-blokir.</span>
                      </div>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                      Tindak Lanjut Keterlambatan
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 bg-rose-50/15">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>Dicatat manual di buku tata tertib, rawan tercecer, dan rekap SP memakan waktu lama.</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-800 font-medium bg-cyan-50/20">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Otomatis memotong kredit poin siswa saat terlambat dan menghitung status SP1/SP2/SP3 seketika.</span>
                      </div>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                      Pembuatan Laporan Bulanan
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 bg-rose-50/15">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>Tarik data via flashdisk, olah rumus Excel manual, dan format ulang kop surat setiap bulan.</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-800 font-medium bg-cyan-50/20">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>1-Klik cetak laporan resmi A4 siap tanda tangan Kepala Sekolah, Guru BK, &amp; Wali Kelas.</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* BAGIAN D: INFORMASI PENGEMBANG & LISENSI SISTEM */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md p-6 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[11px] font-bold">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>System Architecture &amp; Official License</span>
                </div>

                <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Developed &amp; Engineered by Naedie - Hexago Media
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Dibangun dengan arsitektur web modern berkinerja tinggi untuk menjamin keandalan operasional harian sekolah, kemudahan akses lintas perangkat, serta keamanan data jangka panjang.
                </p>

                {/* Badge Arsitektur Sistem */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>PWA Mobile-First</span>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cloud Sync &amp; Local Fallback</span>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                    <span>Role-Based Security (RBAC)</span>
                  </span>
                </div>
              </div>

              {/* Kotak Info Lisensi Instansi */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-2.5 shrink-0 lg:min-w-[290px]">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-700 pb-2">
                  <span>Lisensi Instansi Aktif</span>
                  <span className="font-mono font-bold text-emerald-400">VERIFIED EDITION</span>
                </div>
                <div className="text-sm font-extrabold text-white truncate">
                  {appTitle.trim() || DEFAULT_APP_TITLE}
                </div>
                <div className="text-xs text-slate-300 truncate">
                  Periode Akademik: {academicYear} ({semester})
                </div>
                <div className="pt-1 text-[11px] text-slate-400 font-mono">
                  &copy; 2026 Naedie - Hexago Media. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Modal Panduan Install PWA (Fallback ketika klik di Pengaturan) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-xs text-lg">
                  📲
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Install Aplikasi {appTitle || DEFAULT_APP_TITLE}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Ikon aplikasi otomatis mengikuti logo instansi sekolah Anda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-2 py-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-cyan-50/70 border border-cyan-100 rounded-xl p-3.5 text-xs text-slate-700 space-y-2">
              {isIOS ? (
                <>
                  <p className="font-bold text-cyan-900">Cara Install di iPhone / iPad (Safari):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> di bagian bawah Safari.</li>
                    <li>Pilih menu <strong>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</strong>.</li>
                    <li>Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-bold text-cyan-900">Cara Install 1-Klik di Chrome / Edge (HP &amp; Desktop):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Pastikan halaman aplikasi dibuka pada tab browser utama.</li>
                    <li>Klik ikon <strong>Install Aplikasi (📲)</strong> di bagian kanan Address Bar atau melalui menu browser <strong>⋮ &rarr; Install Aplikasi / Tambahkan ke Layar Utama</strong>.</li>
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
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI KEAMANAN TINGKAT LANJUT ARSIP & RESET TAHUN AJARAN */}
      {showResetModal && isCurrentUserSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Konfirmasi Arsip &amp; Reset Tahun Ajaran
                  </h3>
                  <p className="text-xs text-gray-500">
                    Prosedur keamanan pergantian periode akademik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-2 py-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
              <p className="font-bold text-amber-900">Peringatan Keamanan:</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Tindakan ini akan mengunci rekapitulasi data presensi periode <strong>{academicYear} (Semester {semester})</strong> dan secara otomatis menaikkan periode ke Tahun Ajaran Baru (Semester Ganjil).
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-gray-800 font-bold block">
                Ketik kata <code className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">RESET</code> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs border border-gray-200 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESET' || isProcessingReset}
                onClick={handleExecuteResetAndArchive}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessingReset ? 'animate-spin' : ''}`} />
                <span>{isProcessingReset ? 'Memproses...' : 'Proses Reset Tahun Ajaran'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


