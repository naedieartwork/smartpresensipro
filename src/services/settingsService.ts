import { supabaseService } from './supabaseClient';
import { sidobeService } from './sidobeService';
import { SpecialScheduleMode } from '../types';

export interface TimeRange {
  start: string;
  end: string;
}

export type BackupScheduleType = 'Harian' | 'Mingguan' | 'Bulanan';
export type PrimaryAccentTheme = 'cyan' | 'emerald' | 'indigo' | 'darkgreen' | 'deepyellow' | 'purple' | 'violet' | 'amber';

export interface ThemeAccentConfig {
  id: PrimaryAccentTheme;
  name: string;
  subtitle: string;
  primaryHex: string;
  hoverHex: string;
  lightHex: string;
  borderHex: string;
  textHex: string;
  ringHex: string;
  badgeBg: string;
  previewBg: string;
}

export const ACCENT_THEME_CONFIGS: Record<string, ThemeAccentConfig> = {
  cyan: {
    id: 'cyan',
    name: 'Ocean Cyan',
    subtitle: 'Nuansa biru langit / cyan',
    primaryHex: '#06b6d4',
    hoverHex: '#0891b2',
    lightHex: '#ecfeff',
    borderHex: '#a5f3fc',
    textHex: '#0891b2',
    ringHex: 'rgba(6, 182, 212, 0.4)',
    badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    previewBg: 'bg-cyan-500',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Madrasah',
    subtitle: 'Nuansa hijau zamrud / teal tua',
    primaryHex: '#059669',
    hoverHex: '#047857',
    lightHex: '#ecfdf5',
    borderHex: '#a7f3d0',
    textHex: '#047857',
    ringHex: 'rgba(5, 150, 105, 0.4)',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    previewBg: 'bg-emerald-600',
  },
  indigo: {
    id: 'indigo',
    name: 'Royal Indigo',
    subtitle: 'Nuansa biru nila akademis',
    primaryHex: '#4f46e5',
    hoverHex: '#4338ca',
    lightHex: '#eef2ff',
    borderHex: '#c7d2fe',
    textHex: '#4338ca',
    ringHex: 'rgba(79, 70, 229, 0.4)',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    previewBg: 'bg-indigo-600',
  },
  darkgreen: {
    id: 'darkgreen',
    name: 'Dark Green',
    subtitle: 'Nuansa hijau tua pekat elegan',
    primaryHex: '#065f46',
    hoverHex: '#044e38',
    lightHex: '#ecfdf5',
    borderHex: '#a7f3d0',
    textHex: '#044e38',
    ringHex: 'rgba(6, 95, 70, 0.4)',
    badgeBg: 'bg-emerald-900 text-emerald-100 border-emerald-800',
    previewBg: 'bg-emerald-900',
  },
  deepyellow: {
    id: 'deepyellow',
    name: 'Deep Yellow',
    subtitle: 'Nuansa kuning tua keemasan hangat',
    primaryHex: '#ca8a04',
    hoverHex: '#a16207',
    lightHex: '#fefce8',
    borderHex: '#fef08a',
    textHex: '#a16207',
    ringHex: 'rgba(202, 138, 4, 0.4)',
    badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    previewBg: 'bg-yellow-600',
  },
  purple: {
    id: 'purple',
    name: 'Royal Purple',
    subtitle: 'Nuansa ungu pekat elegan',
    primaryHex: '#6d28d9',
    hoverHex: '#5b21b6',
    lightHex: '#f3e8ff',
    borderHex: '#d8b4fe',
    textHex: '#5b21b6',
    ringHex: 'rgba(109, 40, 217, 0.4)',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    previewBg: 'bg-purple-700',
  },
};

export function applyThemeAccent(accent: PrimaryAccentTheme = 'cyan') {
  const config = ACCENT_THEME_CONFIGS[accent] || ACCENT_THEME_CONFIGS.cyan;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--primary-accent', config.primaryHex);
    root.style.setProperty('--primary-accent-hover', config.hoverHex);
    root.style.setProperty('--primary-accent-light', config.lightHex);
    root.style.setProperty('--primary-accent-border', config.borderHex);
    root.style.setProperty('--primary-accent-text', config.textHex);
    root.style.setProperty('--primary-accent-ring', config.ringHex);
    root.setAttribute('data-theme-accent', config.id);
  }
}

export interface PointRulesSettings {
  initialCreditPoints: number;
  enableAutoDeduction: boolean;
  lateDeductionPoints: number;
  alpaDeductionPoints: number;
  thresholds: {
    amanMin: number;
    peringatanLisanMin: number;
    sp1Min: number;
    sp2Min: number;
    sp3Min: number;
  };
}

export const defaultPointRules: PointRulesSettings = {
  initialCreditPoints: 100,
  enableAutoDeduction: true,
  lateDeductionPoints: 2,
  alpaDeductionPoints: 5,
  thresholds: {
    amanMin: 80,
    peringatanLisanMin: 60,
    sp1Min: 40,
    sp2Min: 20,
    sp3Min: 0,
  },
};

export interface DocumentSignatoriesSettings {
  kotaCetak: string;
  kepalaSekolahName: string;
  kepalaSekolahNip: string;
  petugasBkName: string;
  petugasBkNip: string;
}

export const defaultDocumentSignatories: DocumentSignatoriesSettings = {
  kotaCetak: 'Jakarta',
  kepalaSekolahName: 'Kepala Sekolah',
  kepalaSekolahNip: 'NIP. .................................',
  petugasBkName: 'Guru BK / Kesiswaan',
  petugasBkNip: 'NIP. .................................',
};

export interface SystemSettings {
  appLogo: string;
  appTitle: string;
  appSubtitle: string;
  primaryAccent: PrimaryAccentTheme;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  isAutomaticMode: boolean;
  special_schedule_enabled: boolean;
  special_schedule_day: number;
  special_schedule_mode: SpecialScheduleMode;
  special_schedule_time: string;
  theme: 'light' | 'high-contrast';
  lastBackupDate: string | null;
  backupSchedule: BackupScheduleType;
  pointRules: PointRulesSettings;
  documentSignatories: DocumentSignatoriesSettings;
  timeRanges: {
    tepat: TimeRange;
    telat: TimeRange;
    pulangCepat: TimeRange;
    pulang: TimeRange;
  };
}

const SETTINGS_KEY = 'smart_presensi_system_settings';

export const DEFAULT_APP_TITLE = 'SMART PRESENSI';
export const DEFAULT_APP_SUBTITLE = 'Sistem Informasi Presensi & Akademik Sekolah';

const defaultSettings: SystemSettings = {
  appLogo: '',
  appTitle: DEFAULT_APP_TITLE,
  appSubtitle: DEFAULT_APP_SUBTITLE,
  primaryAccent: 'cyan',
  academicYear: '2025/2026',
  semester: 'Ganjil',
  isAutomaticMode: true,
  special_schedule_enabled: false,
  special_schedule_day: 5,
  special_schedule_mode: 'pulang_awal',
  special_schedule_time: '10:00',
  theme: 'light',
  lastBackupDate: null,
  backupSchedule: 'Mingguan',
  pointRules: defaultPointRules,
  documentSignatories: defaultDocumentSignatories,
  timeRanges: {
    tepat: { start: '06:00', end: '07:15' },
    telat: { start: '07:16', end: '09:00' },
    pulangCepat: { start: '12:00', end: '14:00' },
    pulang: { start: '14:01', end: '18:00' },
  },
};

/**
 * Auto-Compress Gambar Logo (< 15 KB via HTML5 Canvas, MAX_SIZE = 128px, Transparan WebP/PNG)
 */
export async function compressLogoImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Gagal membaca file gambar.'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 128;
        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * MAX_SIZE) / width));
            width = MAX_SIZE;
          } else {
            width = Math.max(1, Math.round((width * MAX_SIZE) / height));
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Pertahankan latar belakang tetap transparan (jangan beri background hitam/putih)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Ekspor menggunakan image/webp (0.8), fallback ke image/png jika browser tidak mendukung WebP
        let compressed = canvas.toDataURL('image/webp', 0.8);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/png');
        }
        resolve(compressed);
      };
      img.onerror = () => {
        reject(new Error('Format gambar tidak valid atau rusak.'));
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      reject(new Error('Gagal membaca file dari perangkat.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Auto-Compress Foto Profil Pengguna ke ukuran 128x128px (Square Center-Crop via HTML5 Canvas Base64 Data URL)
 */
export async function compressAvatarImage(source: File | Blob | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        const TARGET_SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Center-crop square dari gambar lalu skala ke 128x128px
        const minSide = Math.min(img.width, img.height);
        const sx = Math.max(0, Math.round((img.width - minSide) / 2));
        const sy = Math.max(0, Math.round((img.height - minSide) / 2));

        ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, TARGET_SIZE, TARGET_SIZE);

        let compressed = canvas.toDataURL('image/webp', 0.82);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', 0.85);
        }
        resolve(compressed);
      };
      img.onerror = () => {
        reject(new Error('Format foto tidak valid atau rusak.'));
      };
      img.src = dataUrl;
    };

    if (typeof source === 'string') {
      processDataUrl(source);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Gagal membaca file foto profil.'));
        return;
      }
      processDataUrl(dataUrl);
    };
    reader.onerror = () => {
      reject(new Error('Gagal membaca file dari perangkat.'));
    };
    reader.readAsDataURL(source);
  });
}

/**
 * Hitung estimasi ukuran Base64 dalam KB
 */
export function getBase64SizeKB(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  const base64Part = dataUrl.split(',')[1] || '';
  const padding = (base64Part.match(/=+$/) || [''])[0].length;
  const byteLength = Math.max(0, (base64Part.length * 3) / 4 - padding);
  return Math.max(1, Math.round(byteLength / 1024));
}

class SettingsService {
  private listeners: (() => void)[] = [];

  getSettings(): SystemSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const validSchedule: BackupScheduleType =
          parsed.backupSchedule === 'Harian' ||
          parsed.backupSchedule === 'Mingguan' ||
          parsed.backupSchedule === 'Bulanan'
            ? parsed.backupSchedule
            : defaultSettings.backupSchedule;

        const validAccent: PrimaryAccentTheme =
          parsed.primaryAccent && ACCENT_THEME_CONFIGS[parsed.primaryAccent as PrimaryAccentTheme]
            ? (parsed.primaryAccent as PrimaryAccentTheme)
            : defaultSettings.primaryAccent;

        const validSpecialDay =
          typeof parsed.special_schedule_day === 'number' &&
          parsed.special_schedule_day >= 0 &&
          parsed.special_schedule_day <= 6
            ? parsed.special_schedule_day
            : defaultSettings.special_schedule_day;

        const validSpecialMode: SpecialScheduleMode =
          parsed.special_schedule_mode === 'pulang_awal' ||
          parsed.special_schedule_mode === 'libur'
            ? parsed.special_schedule_mode
            : defaultSettings.special_schedule_mode;

        const validSpecialTime =
          typeof parsed.special_schedule_time === 'string' &&
          parsed.special_schedule_time.trim() !== ''
            ? parsed.special_schedule_time.trim()
            : defaultSettings.special_schedule_time;

        return {
          ...defaultSettings,
          ...parsed,
          appLogo: typeof parsed.appLogo === 'string' ? parsed.appLogo : defaultSettings.appLogo,
          appTitle:
            typeof parsed.appTitle === 'string' && parsed.appTitle.trim() !== ''
              ? parsed.appTitle
              : defaultSettings.appTitle,
          appSubtitle:
            typeof parsed.appSubtitle === 'string' && parsed.appSubtitle.trim() !== ''
              ? parsed.appSubtitle
              : defaultSettings.appSubtitle,
          primaryAccent: validAccent,
          special_schedule_enabled:
            typeof parsed.special_schedule_enabled === 'boolean'
              ? parsed.special_schedule_enabled
              : defaultSettings.special_schedule_enabled,
          special_schedule_day: validSpecialDay,
          special_schedule_mode: validSpecialMode,
          special_schedule_time: validSpecialTime,
          lastBackupDate:
            typeof parsed.lastBackupDate === 'string' ? parsed.lastBackupDate : null,
          backupSchedule: validSchedule,
          pointRules: {
            ...defaultPointRules,
            ...(parsed.pointRules || {}),
            thresholds: {
              ...defaultPointRules.thresholds,
              ...(parsed.pointRules?.thresholds || {}),
            },
          },
          documentSignatories: {
            ...defaultDocumentSignatories,
            ...(parsed.documentSignatories || {}),
          },
          timeRanges: {
            ...defaultSettings.timeRanges,
            ...(parsed.timeRanges || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Error reading settings from localStorage:', e);
    }
    return defaultSettings;
  }

  saveSettings(newSettings: Partial<SystemSettings>) {
    const current = this.getSettings();
    const nextTitle =
      newSettings.appTitle !== undefined
        ? newSettings.appTitle.trim() || DEFAULT_APP_TITLE
        : current.appTitle;
    const nextSubtitle =
      newSettings.appSubtitle !== undefined
        ? newSettings.appSubtitle.trim() || DEFAULT_APP_SUBTITLE
        : current.appSubtitle;
    const nextLogo =
      newSettings.appLogo !== undefined ? newSettings.appLogo.trim() : current.appLogo;
    const nextAccent =
      newSettings.primaryAccent && ACCENT_THEME_CONFIGS[newSettings.primaryAccent]
        ? newSettings.primaryAccent
        : current.primaryAccent || 'cyan';

    const updated: SystemSettings = {
      ...current,
      ...newSettings,
      appLogo: nextLogo,
      appTitle: nextTitle,
      appSubtitle: nextSubtitle,
      primaryAccent: nextAccent,
      documentSignatories: {
        ...current.documentSignatories,
        ...(newSettings.documentSignatories || {}),
      },
      timeRanges: {
        ...current.timeRanges,
        ...(newSettings.timeRanges || {}),
      },
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      applyThemeAccent(updated.primaryAccent);
      this.notifyListeners();
    } catch (e) {
      console.warn('Error saving settings to localStorage:', e);
    }
  }

  /**
   * Catat waktu terakhir backup berhasil & jadwal pengingat ke localStorage dan public.app_settings
   */
  async recordBackupMetadata(updates: {
    lastBackupDate?: string | null;
    backupSchedule?: BackupScheduleType;
  }): Promise<void> {
    const current = this.getSettings();
    const nextLastBackup =
      updates.lastBackupDate !== undefined ? updates.lastBackupDate : current.lastBackupDate;
    const nextSchedule =
      updates.backupSchedule !== undefined ? updates.backupSchedule : current.backupSchedule;

    this.saveSettings({
      lastBackupDate: nextLastBackup,
      backupSchedule: nextSchedule,
    });

    try {
      const supabase = supabaseService.getClient();
      const { data: existingRow } = await supabase
        .from('app_settings')
        .select('time_config')
        .eq('id', 1)
        .maybeSingle();

      const existingTimeConfig =
        existingRow?.time_config && typeof existingRow.time_config === 'object'
          ? existingRow.time_config
          : current.timeRanges;

      await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          app_title: current.appTitle,
          app_subtitle: current.appSubtitle,
          app_logo: current.appLogo,
          wa_api_token: sidobeService.getConfig().apiToken,
          auto_mode: current.isAutomaticMode,
          time_config: {
            ...existingTimeConfig,
            ...current.timeRanges,
            primaryAccent: current.primaryAccent,
            lastBackupDate: nextLastBackup,
            backupSchedule: nextSchedule,
          },
          updated_at: new Date().toISOString(),
        });
    } catch (err) {
      console.warn('Warning syncing backup metadata to app_settings:', err);
    }
  }

  /**
   * Ambil konfigurasi dari tabel public.app_settings (id = 1) di Supabase
   * dan sinkronkan ke localStorage, Header state, serta sidobeService
   */
  async loadFromSupabase(): Promise<SystemSettings> {
    const current = this.getSettings();
    try {
      const supabase = supabaseService.getClient();
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data) {
        const remoteTitle =
          typeof data.app_title === 'string' && data.app_title.trim() !== ''
            ? data.app_title.trim()
            : current.appTitle || DEFAULT_APP_TITLE;
        const remoteSubtitle =
          typeof data.app_subtitle === 'string' && data.app_subtitle.trim() !== ''
            ? data.app_subtitle.trim()
            : current.appSubtitle || DEFAULT_APP_SUBTITLE;
        const remoteLogo =
          typeof data.app_logo === 'string' ? data.app_logo.trim() : current.appLogo || '';
        const remoteAutoMode =
          typeof data.auto_mode === 'boolean' ? data.auto_mode : current.isAutomaticMode;

        let remoteAccent: PrimaryAccentTheme = current.primaryAccent || 'cyan';
        if (
          typeof data.primary_accent === 'string' &&
          ACCENT_THEME_CONFIGS[data.primary_accent as PrimaryAccentTheme]
        ) {
          remoteAccent = data.primary_accent as PrimaryAccentTheme;
        }

        let remoteTimeRanges = { ...current.timeRanges };
        let remoteLastBackup = current.lastBackupDate;
        let remoteBackupSchedule: BackupScheduleType = current.backupSchedule;
        let remoteAcademicYear = current.academicYear || '2025/2026';
        let remoteSemester: 'Ganjil' | 'Genap' = current.semester || 'Ganjil';
        let remotePointRules = current.pointRules || defaultPointRules;
        let remoteDocSignatories = current.documentSignatories || defaultDocumentSignatories;

        let remoteSpecialEnabled = current.special_schedule_enabled ?? false;
        let remoteSpecialDay =
          typeof current.special_schedule_day === 'number' ? current.special_schedule_day : 5;
        let remoteSpecialMode: SpecialScheduleMode =
          current.special_schedule_mode === 'libur' ? 'libur' : 'pulang_awal';
        let remoteSpecialTime = current.special_schedule_time || '10:00';

        if (typeof data.special_schedule_enabled === 'boolean') {
          remoteSpecialEnabled = data.special_schedule_enabled;
        }
        if (
          typeof data.special_schedule_day === 'number' &&
          data.special_schedule_day >= 0 &&
          data.special_schedule_day <= 6
        ) {
          remoteSpecialDay = data.special_schedule_day;
        }
        if (
          data.special_schedule_mode === 'pulang_awal' ||
          data.special_schedule_mode === 'libur'
        ) {
          remoteSpecialMode = data.special_schedule_mode;
        }
        if (
          typeof data.special_schedule_time === 'string' &&
          data.special_schedule_time.trim() !== ''
        ) {
          remoteSpecialTime = data.special_schedule_time.trim();
        }

        if (data.time_config && typeof data.time_config === 'object') {
          const tc = data.time_config as any;
          remoteTimeRanges = {
            tepat: tc.tepat || current.timeRanges.tepat,
            telat: tc.telat || current.timeRanges.telat,
            pulangCepat: tc.pulangCepat || current.timeRanges.pulangCepat,
            pulang: tc.pulang || current.timeRanges.pulang,
          };
          if (typeof tc.special_schedule_enabled === 'boolean') {
            remoteSpecialEnabled = tc.special_schedule_enabled;
          }
          if (
            typeof tc.special_schedule_day === 'number' &&
            tc.special_schedule_day >= 0 &&
            tc.special_schedule_day <= 6
          ) {
            remoteSpecialDay = tc.special_schedule_day;
          }
          if (
            tc.special_schedule_mode === 'pulang_awal' ||
            tc.special_schedule_mode === 'libur'
          ) {
            remoteSpecialMode = tc.special_schedule_mode;
          }
          if (
            typeof tc.special_schedule_time === 'string' &&
            tc.special_schedule_time.trim() !== ''
          ) {
            remoteSpecialTime = tc.special_schedule_time.trim();
          }
          if (typeof tc.lastBackupDate === 'string') {
            remoteLastBackup = tc.lastBackupDate;
          }
          if (
            tc.backupSchedule === 'Harian' ||
            tc.backupSchedule === 'Mingguan' ||
            tc.backupSchedule === 'Bulanan'
          ) {
            remoteBackupSchedule = tc.backupSchedule;
          }
          if (
            typeof tc.primaryAccent === 'string' &&
            ACCENT_THEME_CONFIGS[tc.primaryAccent as PrimaryAccentTheme]
          ) {
            remoteAccent = tc.primaryAccent as PrimaryAccentTheme;
          }
          if (typeof tc.academicYear === 'string' && tc.academicYear.trim() !== '') {
            remoteAcademicYear = tc.academicYear.trim();
          }
          if (tc.semester === 'Ganjil' || tc.semester === 'Genap') {
            remoteSemester = tc.semester;
          }
          if (tc.pointRules && typeof tc.pointRules === 'object') {
            remotePointRules = {
              ...defaultPointRules,
              ...tc.pointRules,
              thresholds: {
                ...defaultPointRules.thresholds,
                ...(tc.pointRules.thresholds || {}),
              },
            };
          }
          if (tc.documentSignatories && typeof tc.documentSignatories === 'object') {
            remoteDocSignatories = {
              ...defaultDocumentSignatories,
              ...tc.documentSignatories,
            };
          }
          if (tc.waliKelasMap && typeof tc.waliKelasMap === 'object') {
            const currentWali = supabaseService.getWaliKelasMap();
            try {
              localStorage.setItem(
                'smart_presensi_wali_kelas_map_v1',
                JSON.stringify({ ...tc.waliKelasMap, ...currentWali })
              );
            } catch {
              // ignore
            }
          }
          if (tc.studentWaliMap && typeof tc.studentWaliMap === 'object') {
            const currentStdWali = supabaseService.getStudentWaliMap();
            try {
              localStorage.setItem(
                'smart_presensi_student_wali_map_v1',
                JSON.stringify({ ...tc.studentWaliMap, ...currentStdWali })
              );
            } catch {
              // ignore
            }
          }
        }

        if (typeof data.wa_api_token === 'string' && data.wa_api_token.trim() !== '') {
          sidobeService.setConfig({
            apiToken: data.wa_api_token.trim(),
            simulateHttp: false,
          });
        }

        this.saveSettings({
          appLogo: remoteLogo,
          appTitle: remoteTitle,
          appSubtitle: remoteSubtitle,
          primaryAccent: remoteAccent,
          academicYear: remoteAcademicYear,
          semester: remoteSemester,
          isAutomaticMode: remoteAutoMode,
          special_schedule_enabled: remoteSpecialEnabled,
          special_schedule_day: remoteSpecialDay,
          special_schedule_mode: remoteSpecialMode,
          special_schedule_time: remoteSpecialTime,
          lastBackupDate: remoteLastBackup,
          backupSchedule: remoteBackupSchedule,
          pointRules: remotePointRules,
          documentSignatories: remoteDocSignatories,
          timeRanges: remoteTimeRanges,
        });

        applyThemeAccent(remoteAccent);
        return this.getSettings();
      }
    } catch (err) {
      console.warn('Error loading app_settings from Supabase:', err);
    }
    applyThemeAccent(current.primaryAccent);
    return current;
  }

  /**
   * Simpan data master Identitas Penandatangan Dokumen Resmi oleh Admin / Super Admin
   */
  async saveDocumentSignatories(
    updates: Partial<DocumentSignatoriesSettings>
  ): Promise<{ success: boolean; error?: string }> {
    const current = this.getSettings();
    const nextSignatories: DocumentSignatoriesSettings = {
      ...defaultDocumentSignatories,
      ...(current.documentSignatories || {}),
      ...updates,
    };

    this.saveSettings({
      documentSignatories: nextSignatories,
    });

    try {
      const supabase = supabaseService.getClient();
      const { data: existingRow } = await supabase
        .from('app_settings')
        .select('time_config')
        .eq('id', 1)
        .maybeSingle();

      const existingTimeConfig =
        existingRow?.time_config && typeof existingRow.time_config === 'object'
          ? existingRow.time_config
          : {};

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          app_title: current.appTitle,
          app_subtitle: current.appSubtitle,
          app_logo: current.appLogo,
          wa_api_token: sidobeService.getConfig().apiToken,
          auto_mode: current.isAutomaticMode,
          time_config: {
            ...existingTimeConfig,
            ...current.timeRanges,
            primaryAccent: current.primaryAccent,
            academicYear: current.academicYear,
            semester: current.semester,
            lastBackupDate: current.lastBackupDate,
            backupSchedule: current.backupSchedule,
            pointRules: current.pointRules,
            documentSignatories: nextSignatories,
            waliKelasMap: supabaseService.getWaliKelasMap(),
            studentWaliMap: supabaseService.getStudentWaliMap(),
          },
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Simpan pengaturan secara penuh ke tabel public.app_settings (id = 1) di Supabase
   * sekaligus memperbarui localStorage & sidobeService
   */
  async saveToSupabase(payload: {
    appTitle: string;
    appSubtitle: string;
    appLogo: string;
    primaryAccent?: PrimaryAccentTheme;
    academicYear?: string;
    semester?: 'Ganjil' | 'Genap';
    waApiToken: string;
    isAutomaticMode: boolean;
    special_schedule_enabled?: boolean;
    special_schedule_day?: number;
    special_schedule_mode?: SpecialScheduleMode;
    special_schedule_time?: string;
    timeRanges: SystemSettings['timeRanges'];
    pointRules?: PointRulesSettings;
    documentSignatories?: DocumentSignatoriesSettings;
  }): Promise<{ success: boolean; error?: string }> {
    const current = this.getSettings();
    const cleanedTitle = payload.appTitle.trim() || DEFAULT_APP_TITLE;
    const cleanedSubtitle = payload.appSubtitle.trim() || DEFAULT_APP_SUBTITLE;
    const cleanedLogo = payload.appLogo.trim();
    const cleanedToken = payload.waApiToken.trim();
    const cleanedAccent = payload.primaryAccent || current.primaryAccent || 'cyan';
    const cleanedAcademicYear = payload.academicYear?.trim() || current.academicYear || '2025/2026';
    const cleanedSemester = payload.semester || current.semester || 'Ganjil';
    const cleanedSpecialEnabled =
      payload.special_schedule_enabled !== undefined
        ? payload.special_schedule_enabled
        : current.special_schedule_enabled;
    const cleanedSpecialDay =
      payload.special_schedule_day !== undefined
        ? payload.special_schedule_day
        : current.special_schedule_day;
    const cleanedSpecialMode: SpecialScheduleMode =
      payload.special_schedule_mode !== undefined
        ? payload.special_schedule_mode
        : current.special_schedule_mode;
    const cleanedSpecialTime =
      payload.special_schedule_time !== undefined && payload.special_schedule_time.trim() !== ''
        ? payload.special_schedule_time.trim()
        : current.special_schedule_time || '10:00';
    const cleanedPointRules = payload.pointRules || current.pointRules || defaultPointRules;
    const cleanedDocSignatories =
      payload.documentSignatories || current.documentSignatories || defaultDocumentSignatories;

    // Update cache lokal & state terlebih dahulu agar Navbar berubah seketika
    this.saveSettings({
      appLogo: cleanedLogo,
      appTitle: cleanedTitle,
      appSubtitle: cleanedSubtitle,
      primaryAccent: cleanedAccent,
      academicYear: cleanedAcademicYear,
      semester: cleanedSemester,
      isAutomaticMode: payload.isAutomaticMode,
      special_schedule_enabled: cleanedSpecialEnabled,
      special_schedule_day: cleanedSpecialDay,
      special_schedule_mode: cleanedSpecialMode,
      special_schedule_time: cleanedSpecialTime,
      pointRules: cleanedPointRules,
      documentSignatories: cleanedDocSignatories,
      timeRanges: payload.timeRanges,
    });

    applyThemeAccent(cleanedAccent);

    sidobeService.setConfig({
      apiToken: cleanedToken,
      simulateHttp: false,
    });

    try {
      const supabase = supabaseService.getClient();
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          app_title: cleanedTitle,
          app_subtitle: cleanedSubtitle,
          app_logo: cleanedLogo,
          wa_api_token: cleanedToken,
          auto_mode: payload.isAutomaticMode,
          time_config: {
            ...payload.timeRanges,
            primaryAccent: cleanedAccent,
            academicYear: cleanedAcademicYear,
            semester: cleanedSemester,
            special_schedule_enabled: cleanedSpecialEnabled,
            special_schedule_day: cleanedSpecialDay,
            special_schedule_mode: cleanedSpecialMode,
            special_schedule_time: cleanedSpecialTime,
            lastBackupDate: current.lastBackupDate,
            backupSchedule: current.backupSchedule,
            pointRules: cleanedPointRules,
            documentSignatories: cleanedDocSignatories,
            waliKelasMap: supabaseService.getWaliKelasMap(),
            studentWaliMap: supabaseService.getStudentWaliMap(),
          },
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Supabase app_settings upsert error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error upserting app_settings to Supabase:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }

  // Determine status category based on current time when automatic mode is active
  determineAutomaticStatus(): 'hadir_tepat' | 'hadir_telat' | 'pulang' {
    const settings = this.getSettings();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const timeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const normalized = timeStr.trim().replace('.', ':');
      const [h, m] = normalized.split(':').map(Number);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const isSpecialPulangAwalActive =
      settings.special_schedule_enabled &&
      now.getDay() === settings.special_schedule_day &&
      settings.special_schedule_mode === 'pulang_awal';

    const batasTelatMinutes = timeToMinutes(settings.timeRanges.tepat.end || '07:15');
    const pulangMinutes = isSpecialPulangAwalActive
      ? timeToMinutes(settings.special_schedule_time || '10:00')
      : timeToMinutes(
          settings.timeRanges.pulangCepat?.start || settings.timeRanges.pulang.start || '12:00'
        );

    // Aturan Mutlak: Jika hari pengecualian pulang awal aktif dan waktu >= special_schedule_time, langsung tercatat "pulang" normal
    if (isSpecialPulangAwalActive && nowMinutes >= pulangMinutes) {
      return 'pulang';
    }

    if (nowMinutes <= batasTelatMinutes) {
      return 'hadir_tepat';
    }
    if (nowMinutes > batasTelatMinutes && nowMinutes < pulangMinutes) {
      return 'hadir_telat';
    }
    return 'pulang';
  }
}

export const settingsService = new SettingsService();
if (typeof window !== 'undefined') {
  applyThemeAccent(settingsService.getSettings().primaryAccent);
}
