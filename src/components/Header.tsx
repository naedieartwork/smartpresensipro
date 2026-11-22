import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Radio,
  Volume2,
  VolumeX,
  Settings,
  LogOut,
  ChevronDown,
  Award,
  UserCog,
  X,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  Shield,
  Lock,
  Check,
  RefreshCw,
  Crop,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { WorkerState, AppUser, UserRole } from '../types';
import { sound } from '../utils/audio';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
  compressAvatarImage,
} from '../services/settingsService';
import { supabaseService } from '../services/supabaseClient';
import { syncDynamicPWAManifest } from '../hooks/usePWAInstall';
import { getCroppedImgBlob } from '../utils/cropImage';

interface HeaderProps {
  workerState: WorkerState;
  isRealSupabase: boolean;
  onOpenSettings: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser?: AppUser | null;
  onUpdateCurrentUser?: (user: AppUser) => void;
  onLogout?: () => void;
  onSwitchRole?: (role: UserRole) => void;
  onPreviewStudentPortal?: () => void;
  onPreviewLoginPage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workerState,
  onOpenSettings,
  activeTab,
  setActiveTab,
  currentUser,
  onUpdateCurrentUser,
  onLogout,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sound.enabled);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Self-Service Profile Edit Modal states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [editUsername, setEditUsername] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [editNamaLengkap, setEditNamaLengkap] = useState<string>('');
  const [editNip, setEditNip] = useState<string>('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileFormError, setProfileFormError] = useState<string>('');

  // Custom Image Cropper State for User Profile Avatar
  const [isCropperModalOpen, setIsCropperModalOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [cropperCrop, setCropperCrop] = useState<Point>({ x: 0, y: 0 });
  const [cropperZoom, setCropperZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);

  const [brandConfig, setBrandConfig] = useState(() => {
    const s = settingsService.getSettings();
    return {
      appLogo: s.appLogo || '',
      appTitle: s.appTitle || DEFAULT_APP_TITLE,
      appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
    };
  });
  const [logoError, setLogoError] = useState<boolean>(false);

  useEffect(() => {
    const syncBrand = () => {
      const s = settingsService.getSettings();
      const nextLogo = s.appLogo || '';
      const nextTitle = s.appTitle || DEFAULT_APP_TITLE;
      const nextSubtitle = s.appSubtitle || DEFAULT_APP_SUBTITLE;
      setBrandConfig({
        appLogo: nextLogo,
        appTitle: nextTitle,
        appSubtitle: nextSubtitle,
      });
      setLogoError(false);
      syncDynamicPWAManifest(nextTitle, nextSubtitle, nextLogo);
    };
    syncBrand();
    const unsub = settingsService.subscribe(syncBrand);
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // State & Real-time Listener untuk Badge Notifikasi Pengajuan Izin/Sakit
  const [unreadLeaveCount, setUnreadLeaveCount] = useState<number>(0);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const reqs = await supabaseService.getLeaveRequests();
      const pendingCount = reqs.filter((r) => r.status === 'pending').length;
      setUnreadLeaveCount(pendingCount);
    } catch {
      // ignore fetch error
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();

    const supabase = supabaseService.getClient();
    const channel = supabase
      .channel('header-leave-requests-channel')
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

  const toggleSound = () => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) sound.playSuccess();
  };

  const activeRole: UserRole = currentUser?.role || 'Super Admin';
  const canAccessMembers =
    activeRole === 'Super Admin' || activeRole === 'Admin' || activeRole === 'Wali Kelas';
  const canAccessSchedule = activeRole === 'Super Admin' || activeRole === 'Admin' || activeRole === 'Wali Kelas';
  const canAccessQueue = activeRole === 'Super Admin' || activeRole === 'Admin';
  const canAccessSettings = activeRole === 'Super Admin' || activeRole === 'Admin';

  const displayName = currentUser?.nama_lengkap
    ? currentUser.nama_lengkap.split(',')[0].split(' ').slice(0, 2).join(' ')
    : currentUser?.username || 'Naedie';

  // Ambil avatar_url langsung dari currentUser (atau fallback cache jika offline)
  const profileExtras = currentUser?.username
    ? supabaseService.getUserProfileExtrasMap()[currentUser.username.trim().toLowerCase()]
    : undefined;
  const activeAvatarUrl =
    currentUser?.avatar_url ?? currentUser?.avatarUrl ?? profileExtras?.avatarUrl ?? '';

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Wali Kelas':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Operator':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleOpenEditProfile = async () => {
    if (!currentUser) return;
    setIsProfileMenuOpen(false);
    setProfileFormError('');
    setShowEditPassword(false);

    const extras = currentUser.username
      ? supabaseService.getUserProfileExtrasMap()[currentUser.username.trim().toLowerCase()]
      : undefined;

    setEditUsername(currentUser.username || '');
    setEditPassword(currentUser.password || '');
    setEditNamaLengkap(currentUser.nama_lengkap || '');
    setEditNip(currentUser.nip || '');
    setEditAvatarUrl(
      currentUser.avatar_url ?? currentUser.avatarUrl ?? extras?.avatarUrl ?? ''
    );
    setIsEditProfileOpen(true);

    // Ambil data terbaru langsung dari tabel app_users di Supabase
    try {
      const matched = await supabaseService.getAppUserByIdOrUsername(
        currentUser.id,
        currentUser.username
      );
      if (matched) {
        if (matched.password) setEditPassword(matched.password);
        if (matched.nama_lengkap) setEditNamaLengkap(matched.nama_lengkap);
        if (matched.nip !== undefined) setEditNip(matched.nip || '');
        const cloudAvatar = matched.avatar_url ?? matched.avatarUrl;
        if (cloudAvatar !== undefined) setEditAvatarUrl(cloudAvatar);
      }
    } catch {
      // Abaikan jika gagal fetch background
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileFormError('Format file harus berupa gambar (PNG, JPG, atau WEBP).');
      return;
    }
    setProfileFormError('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        setCropperImageSrc(result);
        setCropperCrop({ x: 0, y: 0 });
        setCropperZoom(1);
        setIsCropperModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = '';
    }
  };

  const handleApplyCrop = async () => {
    if (!cropperImageSrc || !croppedAreaPixels) return;
    setIsProcessingCrop(true);
    try {
      const croppedBlob = await getCroppedImgBlob(cropperImageSrc, croppedAreaPixels, 128);
      const compressedDataUrl = await compressAvatarImage(croppedBlob);
      setEditAvatarUrl(compressedDataUrl);
      sound.playSuccess();
      setIsCropperModalOpen(false);
      setCropperImageSrc(null);
    } catch {
      setProfileFormError('Gagal memproses crop foto profil. Silakan coba gambar lain.');
    } finally {
      setIsProcessingCrop(false);
    }
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const isMasterAccount =
      Boolean(currentUser.is_master) || currentUser.username?.trim().toLowerCase() === 'naedie';
    const cleanUsername = isMasterAccount ? 'naedie' : editUsername.trim().toLowerCase();
    const cleanPassword = editPassword.trim();
    const cleanNama = editNamaLengkap.trim();
    const cleanNip = editNip.trim();
    const cleanAvatarUrl = editAvatarUrl.trim();

    if (!cleanUsername) {
      setProfileFormError('Username tidak boleh kosong.');
      return;
    }
    if (!cleanNama) {
      setProfileFormError('Nama Lengkap & Gelar wajib diisi.');
      return;
    }
    if (!cleanPassword) {
      setProfileFormError('Password / Kata Sandi tidak boleh kosong.');
      return;
    }

    setIsSavingProfile(true);
    setProfileFormError('');

    try {
      const assignedClassVal =
        currentUser.role === 'Wali Kelas'
          ? currentUser.assignedClass || currentUser.assigned_class || currentUser.rombel || '1A'
          : undefined;

      await supabaseService.updateAppUser(currentUser.id, {
        username: cleanUsername,
        password: cleanPassword,
        nama_lengkap: cleanNama,
        nip: cleanNip,
        role: currentUser.role,
        assigned_class: assignedClassVal,
        assignedClass: assignedClassVal,
        rombel: assignedClassVal,
        status: currentUser.status || 'Aktif',
        avatar_url: cleanAvatarUrl,
        avatarUrl: cleanAvatarUrl,
      });

      // Ambil baris terbaru dari app_users jika tersedia untuk memastikan ID & kolom sinkron
      const refreshedFromDb = await supabaseService.getAppUserByIdOrUsername(
        currentUser.id,
        cleanUsername
      );

      const updatedUser: AppUser = {
        ...currentUser,
        ...(refreshedFromDb || {}),
        username: cleanUsername,
        password: cleanPassword,
        nama_lengkap: cleanNama,
        nip: cleanNip,
        avatar_url: cleanAvatarUrl,
        avatarUrl: cleanAvatarUrl,
      };

      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }

      sound.playSuccess();
      setIsEditProfileOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan perubahan profil.';
      setProfileFormError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isMasterCurrentUser =
    Boolean(currentUser?.is_master) || currentUser?.username?.trim().toLowerCase() === 'naedie';

  return (
    <header className="sticky top-0 z-45 bg-white/90 backdrop-blur-md border-b border-gray-200 px-3.5 sm:px-6 py-2.5 sm:py-3 transition-all shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 lg:gap-3">
        {/* Brand Zone: min-w-[180px] lg:min-w-[220px] shrink-0 agar Nama Instansi & Slogan tampil utuh */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 lg:flex-initial min-w-[180px] lg:min-w-[220px] shrink-0 mr-2">
          {brandConfig.appLogo && !logoError ? (
            <img
              src={brandConfig.appLogo}
              alt={brandConfig.appTitle}
              onError={() => setLogoError(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl shrink-0"
            />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-cyan-700 block truncate">
                {brandConfig.appTitle || DEFAULT_APP_TITLE}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-cyan-600/80 font-semibold block truncate">
              {brandConfig.appSubtitle || DEFAULT_APP_SUBTITLE}
            </p>
          </div>
        </div>

        {/* Desktop Nav Links (Filtered by Role) */}
        <nav className="hidden lg:flex items-center gap-1 p-1 bg-gray-100/90 backdrop-blur-xs border border-gray-200 rounded-xl font-medium shrink-0">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`text-xs px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-300 ease-out active:scale-95 flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-cyan-500 text-white shadow-sm font-bold scale-[1.02]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <span>Presensi</span>
            {unreadLeaveCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono leading-none flex items-center justify-center shadow-2xs ${
                  activeTab === 'terminal'
                    ? 'bg-rose-600 text-white ring-2 ring-white'
                    : 'bg-rose-500 text-white animate-pulse'
                }`}
                title={`${unreadLeaveCount} pengajuan izin/sakit menunggu konfirmasi`}
              >
                {unreadLeaveCount}
              </span>
            )}
          </button>

          {canAccessMembers && (
            <button
              onClick={() => setActiveTab('members')}
              className={`text-xs px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-300 ease-out active:scale-95 ${
                activeTab === 'members'
                  ? 'bg-cyan-500 text-white shadow-sm font-bold scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              {activeRole === 'Wali Kelas' ? 'Data Siswa' : 'Kelola Member'}
            </button>
          )}

          {canAccessSchedule && (
            <button
              onClick={() => setActiveTab('schedule')}
              className={`text-xs px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-300 ease-out active:scale-95 ${
                activeTab === 'schedule'
                  ? 'bg-cyan-500 text-white shadow-sm font-bold scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              Akademik<span className="hidden xl:inline"> &amp; Info</span>
            </button>
          )}

          {canAccessQueue && (
            <button
              onClick={() => setActiveTab('queue')}
              className={`text-xs px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-300 ease-out active:scale-95 flex items-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'bg-cyan-500 text-white shadow-sm font-bold scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <span>Monitoring Notifikasi</span>
              {workerState.countdownSeconds > 0 && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`text-xs px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-300 ease-out active:scale-95 ${
              activeTab === 'reports'
                ? 'bg-cyan-500 text-white shadow-sm font-bold scale-[1.02]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            Rekap &amp; Laporan
          </button>

          <button
            onClick={() => setActiveTab('points')}
            className={`text-xs px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-300 ease-out active:scale-95 flex items-center gap-1.5 ${
              activeTab === 'points'
                ? 'bg-cyan-500 text-white shadow-sm font-bold scale-[1.02]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <Award className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${activeTab === 'points' ? 'scale-110' : ''}`} />
            <span>Poin &amp; Kedisiplinan</span>
          </button>
        </nav>

        {/* Action Controls Zone */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Matikan Suara Beep' : 'Aktifkan Suara Beep'}
            className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 items-center justify-center transition shrink-0"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
          </button>

          {/* Pengaturan Button (Only Super Admin & Admin) */}
          {canAccessSettings && (
            <button
              onClick={onOpenSettings}
              title="Pengaturan & Konfigurasi Sistem"
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              className={`w-9 h-9 sm:w-10 sm:h-10 xl:w-auto xl:px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-95 shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-cyan-500 text-white shadow-sm ring-2 ring-cyan-200'
                  : 'bg-gray-100 hover:bg-cyan-50 text-gray-700 hover:text-cyan-600 border border-gray-200'
              }`}
            >
              <Settings
                className={`w-4 h-4 transition-transform duration-300 ${
                  activeTab === 'settings' ? 'text-white rotate-90' : 'text-cyan-600'
                }`}
              />
              <span className="hidden 2xl:inline">Pengaturan</span>
            </button>
          )}

          {/* Active User Profile Indicator & Logout */}
          {currentUser && (
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                title="Profil Akun Pengguna"
                className="h-9 sm:h-10 px-2 sm:px-2.5 max-w-[200px] rounded-xl bg-gray-100 hover:bg-gray-200/80 border border-gray-200 flex items-center justify-center gap-1.5 text-xs transition active:scale-95"
              >
                {activeAvatarUrl ? (
                  <img
                    src={activeAvatarUrl}
                    alt={displayName}
                    className="w-6 h-6 rounded-lg object-cover border border-white/60 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-cyan-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 uppercase">
                    {(displayName || 'U').charAt(0)}
                  </div>
                )}
                <div className="hidden sm:flex items-center gap-1 leading-none min-w-0 overflow-hidden">
                  <span className="font-bold text-gray-900 truncate max-w-[64px]">
                    {displayName.split(' ')[0]}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border truncate ${getRoleBadgeColor(
                      activeRole
                    )}`}
                  >
                    {isMasterCurrentUser ? `👑 ${activeRole}` : activeRole}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-68 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 text-xs animate-in fade-in slide-in-from-top-1">
                  {/* Bagian Atas: Informasi Pengguna, Username, Role (+ Kelas Binaan), & Status Akun */}
                  <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-start gap-3">
                    {activeAvatarUrl ? (
                      <img
                        src={activeAvatarUrl}
                        alt={displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-gray-200 shadow-xs shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 uppercase shadow-xs mt-0.5">
                        {(displayName || 'U').charAt(0)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-gray-900 truncate">
                          {currentUser.nama_lengkap || currentUser.username}
                        </span>
                        {isMasterCurrentUser ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[9px] shrink-0">
                            👑 MASTER
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[9px] shrink-0">
                            {currentUser.status || 'Aktif'}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-500 font-mono truncate">
                        @{currentUser.username}
                      </div>

                      {currentUser.nip && (
                        <div className="text-[10px] text-gray-500 truncate">
                          NIP: <span className="font-semibold text-gray-700">{currentUser.nip}</span>
                        </div>
                      )}

                      <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeColor(
                            activeRole
                          )}`}
                        >
                          {activeRole === 'Wali Kelas'
                            ? (() => {
                                const rawClass = String(
                                  currentUser.assignedClass ||
                                    currentUser.assigned_class ||
                                    currentUser.rombel ||
                                    '1A'
                                ).trim();
                                const formattedClass = /^kelas\s+/i.test(rawClass)
                                  ? rawClass
                                  : `Kelas ${rawClass}`;
                                return `Wali Kelas • ${formattedClass}`;
                              })()
                            : activeRole}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bagian Tengah: Tombol Edit Profil & Kata Sandi */}
                  <div className="px-2 py-1.5 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={handleOpenEditProfile}
                      className="w-full px-2.5 py-2 rounded-xl text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 font-bold flex items-center gap-2.5 transition"
                    >
                      <div className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                        <UserCog className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="text-xs font-bold leading-tight">Edit Profil &amp; Kata Sandi</div>
                        <div className="text-[10px] font-medium text-gray-400 truncate">
                          Perbarui identitas, foto &amp; sandi
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Bagian Bawah: Tombol Merah Keluar / Ganti Akun (Logout) */}
                  {onLogout && (
                    <div className="px-2 pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2.5 transition"
                      >
                        <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <LogOut className="w-3.5 h-3.5" />
                        </div>
                        <span>Keluar / Ganti Akun</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Form Personalisasi Akun (Self-Service Profile Edit) via Portal agar tidak pernah terpotong Navbar */}
      {isEditProfileOpen &&
        currentUser &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:hidden">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/95 backdrop-blur-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0">
                    <UserCog className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Edit Profil &amp; Kata Sandi
                      </h3>
                      {isMasterCurrentUser && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                          👑 MASTER OWNER
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Personalisasi identitas, foto profil, dan kredensial akun Anda
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfileSubmit} className="p-5 space-y-4 text-xs">
                {profileFormError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs">
                    {profileFormError}
                  </div>
                )}

                {/* a. Personalisasi Foto Profil (Opsional - Dikompresi 128x128px ke kolom avatar_url) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Foto Profil Akun
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Opsional • 128×128px</span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    {editAvatarUrl ? (
                      <img
                        src={editAvatarUrl}
                        alt="Preview Avatar"
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-cyan-600 text-white font-extrabold text-xl flex items-center justify-center shrink-0 uppercase shadow-md border-2 border-white">
                        {(editNamaLengkap || editUsername || 'U').trim().charAt(0)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={avatarFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleAvatarFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => avatarFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 border border-slate-200 font-bold text-[11px] inline-flex items-center gap-1.5 shadow-2xs transition"
                        >
                          <Camera className="w-3.5 h-3.5 text-cyan-600" />
                          <span>Unggah Foto</span>
                        </button>
                        {editAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => setEditAvatarUrl('')}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus Foto</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        Otomatis dikompresi ke 128×128px &amp; disimpan ke kolom <span className="font-mono font-semibold text-slate-600">avatar_url</span> di Supabase.
                      </p>
                    </div>
                  </div>
                </div>

                {/* b. Kolom yang Dapat Diedit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Username Login <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isMasterCurrentUser}
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="Contoh: budi_santoso"
                      className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-mono text-xs ${
                        isMasterCurrentUser
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 text-slate-900'
                      }`}
                    />
                    {isMasterCurrentUser && (
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">
                        Username Master Owner dikunci permanen.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Password / Kata Sandi <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        required
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Masukkan kata sandi..."
                        className="w-full pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-mono text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword((prev) => !prev)}
                        title={showEditPassword ? 'Sembunyikan Sandi' : 'Lihat Sandi'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showEditPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editNamaLengkap}
                    onChange={(e) => setEditNamaLengkap(e.target.value)}
                    placeholder="Contoh: Hesti Supriyani, S.Pd.I"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 text-xs text-slate-900 font-medium"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Otomatis tersinkronisasi ke profil Wali Kelas &amp; dokumen laporan cetak A4.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIP / ID Pegawai
                  </label>
                  <input
                    type="text"
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                    placeholder="Contoh: 19880412 201503 2 004 (Kosongkan jika belum ada)"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-mono text-xs text-slate-900"
                  />
                </div>

                {/* c. Kolom yang Dikunci (Read-Only / Disabled) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500">
                      Hak Akses &amp; Status Akun (Dikunci Sistem)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Role Pengguna
                      </label>
                      <div className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed select-none">
                        <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {activeRole === 'Wali Kelas'
                            ? (() => {
                                const rawClass = String(
                                  currentUser.assignedClass ||
                                    currentUser.assigned_class ||
                                    currentUser.rombel ||
                                    '1A'
                                ).trim();
                                const formattedClass = /^kelas\s+/i.test(rawClass)
                                  ? rawClass
                                  : `Kelas ${rawClass}`;
                                return `Wali Kelas (${formattedClass})`;
                              })()
                            : activeRole}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Status Akun
                      </label>
                      <input
                        type="text"
                        disabled
                        value={
                          isMasterCurrentUser
                            ? 'Aktif (Master Owner)'
                            : currentUser.status || 'Aktif'
                        }
                        className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold text-xs cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold transition shadow-md shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 3. MODAL CUSTOM IMAGE CROPPER UNTUK FOTO PROFIL PENGGUNA */}
      {isCropperModalOpen &&
        cropperImageSrc &&
        createPortal(
          <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="ios-glass-card bg-white/95 rounded-3xl max-w-md w-full p-5 sm:p-6 border border-white/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200 flex items-center justify-center shrink-0 shadow-2xs">
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
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                  💡 Sentuh &amp; geser foto secara langsung untuk memposisikan wajah.
                </p>
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
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
    </header>
  );
};

