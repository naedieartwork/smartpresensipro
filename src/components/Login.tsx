import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  Lock,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  CreditCard,
  ArrowLeft,
  KeyRound,
  Timer,
} from 'lucide-react';
import { supabaseService } from '../services/supabaseClient';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
} from '../services/settingsService';
import { AppUser, Student } from '../types';

interface LoginProps {
  onLoginSuccess: (
    userRole: string,
    user?: AppUser,
    student?: Student,
    rememberStudentProfile?: boolean
  ) => void;
  onCancelPreview?: () => void;
}

type LoginTab = 'siswa' | 'staf';

const LOCKOUT_STORAGE_KEY = 'smart_presensi_student_login_lock_until';
const FAILED_COUNT_STORAGE_KEY = 'smart_presensi_student_login_failed_count';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onCancelPreview }) => {
  const [activeTab, setActiveTab] = useState<LoginTab>('siswa');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Identitas Instansi Dinamis (public.app_settings id = 1)
  const [brandConfig, setBrandConfig] = useState(() => {
    const s = settingsService.getSettings();
    return {
      appLogo: s.appLogo || '',
      appTitle: s.appTitle || DEFAULT_APP_TITLE,
      appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
    };
  });
  const [logoError, setLogoError] = useState(false);

  const { appLogo, appTitle, appSubtitle } = brandConfig;

  // Form State Tab 1: Portal Siswa / Wali Murid (NIS / NISN / Nomor Kartu UID + 6 Digit PIN WA Wali)
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentPin, setStudentPin] = useState('');
  const [showStudentPin, setShowStudentPin] = useState(false);
  const [rememberStudentProfile, setRememberStudentProfile] = useState(true);

  // Proteksi Anti-Brute Force (Kunci Sementara 60 Detik Jika Salah 5x Berturut-turut)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem(FAILED_COUNT_STORAGE_KEY) || '0', 10);
      return Number.isNaN(saved) ? 0 : saved;
    } catch {
      return 0;
    }
  });

  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => {
    try {
      const lockUntil = parseInt(localStorage.getItem(LOCKOUT_STORAGE_KEY) || '0', 10);
      if (lockUntil > Date.now()) {
        return Math.ceil((lockUntil - Date.now()) / 1000);
      }
      return 0;
    } catch {
      return 0;
    }
  });

  // Form State Tab 2: Login Staf / Guru / Admin
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const syncBrand = () => {
      const s = settingsService.getSettings();
      setBrandConfig({
        appLogo: s.appLogo || '',
        appTitle: s.appTitle || DEFAULT_APP_TITLE,
        appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
      });
      setLogoError(false);
    };

    syncBrand();
    settingsService.loadFromSupabase().then(syncBrand);
    const unsub = settingsService.subscribe(syncBrand);
    window.addEventListener('storage', syncBrand);

    let channel: any = null;
    try {
      const supabase = supabaseService.getClient();
      channel = supabase
        .channel('login_app_settings_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings' },
          () => {
            settingsService.loadFromSupabase().then(syncBrand);
          }
        )
        .subscribe();
    } catch {
      // Abaikan jika realtime tidak tersedia
    }

    return () => {
      unsub();
      window.removeEventListener('storage', syncBrand);
      if (channel) {
        try {
          supabaseService.getClient().removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Timer Hitung Mundur Lockout Anti-Brute Force (60 Detik)
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const interval = setInterval(() => {
      try {
        const lockUntil = parseInt(localStorage.getItem(LOCKOUT_STORAGE_KEY) || '0', 10);
        const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
        setLockoutSeconds(remaining);
        if (remaining <= 0) {
          setFailedAttempts(0);
          localStorage.removeItem(LOCKOUT_STORAGE_KEY);
          localStorage.removeItem(FAILED_COUNT_STORAGE_KEY);
          setErrorMsg(null);
        }
      } catch {
        setLockoutSeconds((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const registerFailedAttempt = (customError?: string) => {
    const nextCount = failedAttempts + 1;
    setFailedAttempts(nextCount);
    try {
      localStorage.setItem(FAILED_COUNT_STORAGE_KEY, String(nextCount));
    } catch {
      // ignore
    }

    if (nextCount >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
      setLockoutSeconds(LOCKOUT_DURATION_SECONDS);
      try {
        localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockUntil));
      } catch {
        // ignore
      }
      setErrorMsg(
        `Terlalu banyak percobaan gagal (${MAX_FAILED_ATTEMPTS}x). Akses login dikunci sementara selama ${LOCKOUT_DURATION_SECONDS} detik demi keamanan data siswa.`
      );
    } else {
      const remainingTries = MAX_FAILED_ATTEMPTS - nextCount;
      setErrorMsg(
        `${customError || 'Kombinasi NIS/UID dan PIN tidak sesuai.'} (Sisa percobaan: ${remainingTries}x)`
      );
    }
  };

  const resetBruteForceCounter = () => {
    setFailedAttempts(0);
    setLockoutSeconds(0);
    try {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      localStorage.removeItem(FAILED_COUNT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleLoginSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMsg(null);

    const cleanInput = studentIdentifier.trim();
    const cleanPin = studentPin.replace(/\D/g, '').trim();

    if (!cleanInput) {
      setErrorMsg('Silakan masukkan NIS / NISN atau Nomor Kartu (UID) siswa.');
      return;
    }

    if (cleanPin.length !== 6) {
      setErrorMsg('PIN Keamanan Wali wajib terdiri dari 6 angka.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await supabaseService.authenticateStudent(cleanInput, cleanPin);
      if (!result.success || !result.student) {
        registerFailedAttempt(result.error);
        return;
      }

      resetBruteForceCounter();
      onLoginSuccess('Siswa', undefined, result.student, rememberStudentProfile);
    } catch (err: any) {
      registerFailedAttempt(err.message || 'Gagal memverifikasi data siswa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginStaf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username dan Password wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await supabaseService.authenticateAppUser(username.trim(), password);
      if (!result.success || !result.user) {
        registerFailedAttempt(result.error || 'Username atau Password tidak valid.');
        return;
      }
      resetBruteForceCounter();
      onLoginSuccess(result.user.role, result.user);
    } catch (err: any) {
      registerFailedAttempt(err.message || 'Kredensial staf tidak valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ornaments (iOS Style Blur) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-400/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {onCancelPreview && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={onCancelPreview}
              className="px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 border border-gray-200 shadow-xs text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-600" />
              <span>Kembali ke Dashboard Staf / Admin</span>
            </button>
          </div>
        )}

        {/* Header Logo & Identitas Instansi Dinamis (public.app_settings) */}
        <div className="text-center mb-7">
          {appLogo && !logoError ? (
            <div className="w-16 h-16 mx-auto bg-white/90 backdrop-blur-md rounded-2xl p-1.5 flex items-center justify-center shadow-lg border border-white mb-4">
              <img
                src={appLogo}
                alt={appTitle}
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto bg-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-cyan-700 tracking-tight">
            {appTitle}
          </h1>
          <p className="text-sm text-cyan-600/80 font-semibold mt-1">
            {appSubtitle}
          </p>
        </div>

        {/* Glassmorphism Login Panel */}
        <div className="bg-white/85 backdrop-blur-xl border border-white shadow-xl rounded-3xl overflow-hidden">
          {/* 2 Tabs Segmented Control */}
          <div className="flex p-2 bg-gray-100/60 border-b border-gray-200/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('siswa');
                if (!isLocked) setErrorMsg(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'siswa'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Portal Siswa / Wali</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('staf');
                if (!isLocked) setErrorMsg(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'staf'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Staf / Guru / Admin</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* Lockout Anti-Brute Force Banner */}
            {isLocked && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                <Timer className="w-4 h-4 shrink-0 text-amber-600 mt-0.5 animate-pulse" />
                <div>
                  <div className="font-bold text-amber-950">
                    Proteksi Keamanan Aktif ({lockoutSeconds} detik)
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Anda telah salah memasukkan kredensial sebanyak {MAX_FAILED_ATTEMPTS} kali berturut-turut. Silakan tunggu hitung mundur selesai untuk mencoba kembali.
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && !isLocked && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TAB 1: PORTAL SISWA / WALI MURID (DENGAN PIN 6 DIGIT WA WALI & INGAT PROFIL) */}
            {activeTab === 'siswa' && (
              <form onSubmit={handleLoginSiswa} className="space-y-4 animate-in fade-in">
                {/* Input 1: NIS / NISN atau Nomor Kartu (UID) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 ml-1 block">
                    NIS / NISN atau Nomor Kartu (UID)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={studentIdentifier}
                      disabled={isLocked}
                      onChange={(e) => setStudentIdentifier(e.target.value)}
                      placeholder="Masukkan NIS, NISN, atau UID Kartu..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Input 2: PIN Keamanan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 ml-1 block">
                    PIN Keamanan
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type={showStudentPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={studentPin}
                      disabled={isLocked}
                      onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60 transition-all font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPin((prev) => !prev)}
                      title={showStudentPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                      className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-gray-700 transition"
                    >
                      {showStudentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-1 leading-relaxed">
                    Masukkan 6 digit PIN keamanan akun Anda.
                  </p>
                </div>

                {/* Checkbox: Ingat profil anak di perangkat ini */}
                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberStudentProfile}
                    disabled={isLocked}
                    onChange={(e) => setRememberStudentProfile(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Ingat profil anak di perangkat ini
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    isLocked ||
                    !studentIdentifier.trim() ||
                    studentPin.length !== 6
                  }
                  className="w-full mt-2 py-3 px-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-300 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>
                    {isLocked
                      ? `Terkunci Sementara (${lockoutSeconds} dtk)`
                      : isLoading
                      ? 'Memverifikasi PIN & Data Siswa...'
                      : 'Masuk Portal Siswa / Wali'}
                  </span>
                  {!isLoading && !isLocked && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            )}

            {/* TAB 2: LOGIN STAF / GURU / ADMIN */}
            {activeTab === 'staf' && (
              <form onSubmit={handleLoginStaf} className="space-y-4 animate-in fade-in">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 ml-1 block">
                    Username Akun
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      disabled={isLocked}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username (misal: naedie)"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 ml-1 block">
                    Password / Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      disabled={isLocked}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                      className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-gray-700 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isLocked || !username.trim() || !password}
                  className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>
                    {isLocked
                      ? `Terkunci Sementara (${lockoutSeconds} dtk)`
                      : isLoading
                      ? 'Memverifikasi Akun...'
                      : 'Masuk Dashboard Staf'}
                  </span>
                  {!isLoading && !isLocked && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            )}
          </div>

          <div className="bg-gray-50/70 p-4 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-mono">
              {appTitle} | {appSubtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};