import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  HardDriveDownload,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  FileJson,
  Calendar,
  ShieldCheck,
  Users,
  School,
  ClipboardList,
  MessageSquare,
  Megaphone,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { supabaseService } from '../services/supabaseClient';
import { settingsService, BackupScheduleType } from '../services/settingsService';
import { sound } from '../utils/audio';

interface BackupMaintenancePanelProps {
  onDataRestored?: () => void;
}

interface ParsedBackupPreview {
  fileName: string;
  version: string;
  backupType: string;
  createdAt: string;
  counts: {
    app_settings: number;
    rombel: number;
    students: number;
    app_users: number;
    message_templates: number;
    announcements: number;
    attendance_log: number;
  };
  rawData: {
    app_settings?: any[];
    rombel?: any[];
    students?: any[];
    app_users?: any[];
    message_templates?: any[];
    announcements?: any[];
    attendance_log?: any[];
  };
}

export const BackupMaintenancePanel: React.FC<BackupMaintenancePanelProps> = ({
  onDataRestored,
}) => {
  const initialSettings = settingsService.getSettings();
  const [backupSchedule, setBackupSchedule] = useState<BackupScheduleType>(
    initialSettings.backupSchedule || 'Mingguan'
  );
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(
    initialSettings.lastBackupDate || null
  );

  // Real-time Database Row Counts
  const [stats, setStats] = useState({
    students: 0,
    rombel: 0,
    attendance_log: 0,
    wa_queue: 0,
    wa_queue_sent: 0,
    announcements: 0,
    app_users: 0,
    message_templates: 20,
  });
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  // Export states
  const [isExportingFull, setIsExportingFull] = useState<boolean>(false);
  const [isExportingMaster, setIsExportingMaster] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  // Restore states
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupPreview, setBackupPreview] = useState<ParsedBackupPreview | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Housekeeping states
  const [isClearingQueue, setIsClearingQueue] = useState<boolean>(false);
  const [confirmClearQueue, setConfirmClearQueue] = useState<boolean>(false);

  const [purgeMode, setPurgeMode] = useState<'older_1m' | 'older_3m' | 'older_6m' | 'month' | 'all'>('older_3m');
  const [purgeMonth, setPurgeMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [confirmPurgeLogs, setConfirmPurgeLogs] = useState<boolean>(false);
  const [isPurgingLogs, setIsPurgingLogs] = useState<boolean>(false);

  // Status feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const showBanner = (type: 'success' | 'warning' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const dbStats = await supabaseService.getDatabaseStats();
      setStats(dbStats);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
    const s = settingsService.getSettings();
    setBackupSchedule(s.backupSchedule || 'Mingguan');
    setLastBackupDate(s.lastBackupDate || null);

    const unsubSettings = settingsService.subscribe(() => {
      const latest = settingsService.getSettings();
      setBackupSchedule(latest.backupSchedule || 'Mingguan');
      setLastBackupDate(latest.lastBackupDate || null);
    });
    const unsubSupabase = supabaseService.subscribe(() => {
      loadStats();
    });

    return () => {
      unsubSettings();
      unsubSupabase();
    };
  }, []);

  const handleSelectSchedule = async (mode: BackupScheduleType) => {
    setBackupSchedule(mode);
    await settingsService.recordBackupMetadata({ backupSchedule: mode });
    showBanner('success', `Jadwal pengingat backup diatur ke periode ${mode}.`);
  };

  // Hitung kesehatan backup
  const getBackupHealth = () => {
    const thresholdDays =
      backupSchedule === 'Harian' ? 1 : backupSchedule === 'Mingguan' ? 7 : 30;

    if (!lastBackupDate) {
      return {
        isHealthy: false,
        daysSince: null as number | null,
        thresholdDays,
        badgeLabel: 'Waktunya Backup!',
        title: 'Belum Pernah Dilakukan Backup Database',
        desc: `Jadwal pengingat aktif: ${backupSchedule} (maksimal setiap ${thresholdDays} hari). Segera unduh Full Backup (.JSON) pertama Anda untuk mengamankan data sekolah.`,
      };
    }

    const lastTime = new Date(lastBackupDate).getTime();
    const nowTime = Date.now();
    const diffMs = Math.max(0, nowTime - lastTime);
    const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hoursSince = Math.floor(diffMs / (1000 * 60 * 60));

    const isHealthy = diffMs < thresholdDays * 24 * 60 * 60 * 1000;

    if (isHealthy) {
      return {
        isHealthy: true,
        daysSince,
        thresholdDays,
        badgeLabel: 'Aman & Terlindungi',
        title: 'Database Sekolah Aman & Terlindungi',
        desc:
          daysSince === 0
            ? `Backup terakhir baru saja dilakukan (${hoursSince === 0 ? 'kurang dari 1 jam' : `${hoursSince} jam`} yang lalu). Sesuai jadwal ${backupSchedule} (< ${thresholdDays} hari).`
            : `Backup terakhir dilakukan ${daysSince} hari yang lalu (masih dalam rentang jadwal ${backupSchedule} < ${thresholdDays} hari).`,
      };
    }

    return {
      isHealthy: false,
      daysSince,
      thresholdDays,
      badgeLabel: 'Waktunya Backup!',
      title: `Melewati Jadwal Backup ${backupSchedule} (${daysSince} Hari Berlalu)`,
      desc: `Sudah ${daysSince} hari sejak backup terakhir dilakukan (melewati batas jadwal ${backupSchedule} ${thresholdDays} hari). Disarankan segera mengunduh Full Backup (.JSON).`,
    };
  };

  const health = getBackupHealth();

  const formatDateIndo = (isoStr: string | null) => {
    if (!isoStr) return 'Belum pernah dibackup';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2A. Unduh Full Backup (.JSON) atau Master Data (.JSON)
  const handleDownloadJsonBackup = async (includeAttendanceLogs: boolean) => {
    if (includeAttendanceLogs) {
      setIsExportingFull(true);
    } else {
      setIsExportingMaster(true);
    }

    try {
      const snapshot = await supabaseService.fetchDatabaseSnapshot(includeAttendanceLogs);
      const nowIso = new Date().toISOString();
      const datePart = nowIso.slice(0, 10);
      const currentSettings = settingsService.getSettings();

      const payload = {
        version: '2.0.0',
        app_title: currentSettings.appTitle,
        backup_type: backupSchedule,
        scope: includeAttendanceLogs ? 'full_snapshot' : 'master_data_only',
        created_at: nowIso,
        counts: {
          app_settings: snapshot.app_settings.length,
          rombel: snapshot.rombel.length,
          students: snapshot.students.length,
          app_users: snapshot.app_users.length,
          message_templates: snapshot.message_templates.length,
          announcements: snapshot.announcements.length,
          attendance_log: snapshot.attendance_log.length,
        },
        data: snapshot,
      };

      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const fileTypeLabel = includeAttendanceLogs ? backupSchedule : `MasterData_${backupSchedule}`;
      const fileName = `Backup_SmartPresensi_${fileTypeLabel}_${datePart}.json`;

      triggerFileDownload(blob, fileName);

      // Catat waktu terakhir backup ke localStorage & app_settings
      setLastBackupDate(nowIso);
      await settingsService.recordBackupMetadata({
        lastBackupDate: nowIso,
        backupSchedule,
      });

      sound.playSuccess();
      showBanner(
        'success',
        `File "${fileName}" berhasil diunduh dan waktu backup terakhir telah diperbarui!`
      );
      loadStats();
    } catch (err: any) {
      sound.playAlert();
      showBanner('error', 'Gagal mengekspor backup JSON: ' + (err?.message || String(err)));
    } finally {
      setIsExportingFull(false);
      setIsExportingMaster(false);
    }
  };

  // 2B. Unduh Arsip Log Presensi (.CSV siap dibuka di Excel)
  const handleDownloadAttendanceCsv = async () => {
    setIsExportingCsv(true);
    try {
      const rows = await supabaseService.getAllAttendanceLogsForCsv();
      const datePart = new Date().toISOString().slice(0, 10);

      const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const header = ['No', 'Waktu Presensi (ISO)', 'Tanggal', 'Jam', 'UID Kartu / RFID', 'NISN', 'Nama Siswa', 'Kelas', 'Status Kehadiran'];
      const csvLines = [header.join(',')];

      rows.forEach((r, idx) => {
        let tanggalStr = '-';
        let jamStr = '-';
        if (r.waktu) {
          const d = new Date(r.waktu);
          if (!isNaN(d.getTime())) {
            tanggalStr = d.toLocaleDateString('id-ID');
            jamStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          }
        }
        csvLines.push(
          [
            String(idx + 1),
            escapeCsv(r.waktu),
            escapeCsv(tanggalStr),
            escapeCsv(jamStr),
            escapeCsv(r.uid_kartu),
            escapeCsv(r.nisn),
            escapeCsv(r.nama_siswa),
            escapeCsv(r.kelas),
            escapeCsv(r.status_kehadiran),
          ].join(',')
        );
      });

      // Tambahkan UTF-8 BOM (\uFEFF) agar langsung rapi saat dibuka di Microsoft Excel
      const csvContent = '\uFEFF' + csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const fileName = `Arsip_LogPresensi_SmartPresensi_${datePart}.csv`;

      triggerFileDownload(blob, fileName);
      sound.playSuccess();
      showBanner('success', `Arsip CSV (${rows.length} baris log presensi) berhasil diunduh!`);
    } catch (err: any) {
      sound.playAlert();
      showBanner('error', 'Gagal mengunduh CSV log presensi: ' + (err?.message || String(err)));
    } finally {
      setIsExportingCsv(false);
    }
  };

  // 3A. Pilih File JSON untuk Pratinjau Restore
  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const dataNode = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;

        if (
          !dataNode ||
          typeof dataNode !== 'object' ||
          (!Array.isArray(dataNode.students) &&
            !Array.isArray(dataNode.rombel) &&
            !Array.isArray(dataNode.app_settings) &&
            !Array.isArray(dataNode.message_templates))
        ) {
          sound.playAlert();
          showBanner(
            'error',
            'Format file JSON tidak dikenali sebagai file Backup Smart Presensi.'
          );
          return;
        }

        setBackupPreview({
          fileName: file.name,
          version: String(parsed.version || '1.0'),
          backupType: String(parsed.backup_type || 'Manual'),
          createdAt: String(parsed.created_at || new Date(file.lastModified).toISOString()),
          counts: {
            app_settings: Array.isArray(dataNode.app_settings) ? dataNode.app_settings.length : 0,
            rombel: Array.isArray(dataNode.rombel) ? dataNode.rombel.length : 0,
            students: Array.isArray(dataNode.students) ? dataNode.students.length : 0,
            app_users: Array.isArray(dataNode.app_users) ? dataNode.app_users.length : 0,
            message_templates: Array.isArray(dataNode.message_templates)
              ? dataNode.message_templates.length
              : 0,
            announcements: Array.isArray(dataNode.announcements)
              ? dataNode.announcements.length
              : 0,
            attendance_log: Array.isArray(dataNode.attendance_log)
              ? dataNode.attendance_log.length
              : 0,
          },
          rawData: dataNode,
        });
      } catch (err: any) {
        sound.playAlert();
        showBanner('error', 'Gagal membaca file JSON: Pastikan file backup tidak rusak.');
      } finally {
        if (restoreInputRef.current) {
          restoreInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // 3B. Eksekusi Restore 1-Click Upsert ke Supabase
  const handleConfirmRestore = async () => {
    if (!backupPreview) return;
    setIsRestoring(true);
    try {
      const result = await supabaseService.restoreDatabaseSnapshot(backupPreview.rawData);
      await settingsService.loadFromSupabase();
      await loadStats();
      if (onDataRestored) onDataRestored();

      sound.playSuccess();
      const summaryText = `Siswa (${result.restoredCounts.students}), Kelas (${result.restoredCounts.rombel}), Log (${result.restoredCounts.attendance_log}), User (${result.restoredCounts.app_users}), Pengumuman (${result.restoredCounts.announcements})`;

      if (result.warnings.length > 0) {
        showBanner(
          'warning',
          `Pemulihan selesai sebagian [${summaryText}]. Catatan: ${result.warnings.join('; ')}`
        );
      } else {
        showBanner(
          'success',
          `Database berhasil dipulihkan sepenuhnya via 1-Click Upsert: ${summaryText}!`
        );
      }
      setBackupPreview(null);
    } catch (err: any) {
      sound.playAlert();
      showBanner('error', 'Gagal memulihkan database: ' + (err?.message || String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  // 4A. Bersihkan Antrean WA Terkirim ('sent')
  const handleClearSentWaQueue = async () => {
    setIsClearingQueue(true);
    try {
      const { deletedCount } = await supabaseService.clearSentQueueWithCount();
      setConfirmClearQueue(false);
      await loadStats();
      sound.playSuccess();
      showBanner(
        'success',
        `Berhasil membersihkan ${deletedCount} antrean WA berstatus 'sent' dari database!`
      );
    } catch (err: any) {
      sound.playAlert();
      showBanner('error', 'Gagal membersihkan antrean WA: ' + (err?.message || String(err)));
    } finally {
      setIsClearingQueue(false);
    }
  };

  // 4B. Hapus Log Presensi Lama
  const handlePurgeOldAttendanceLogs = async () => {
    setIsPurgingLogs(true);
    try {
      const { deletedCount } = await supabaseService.purgeAttendanceLogs(purgeMode, purgeMonth);
      setConfirmPurgeLogs(false);
      await loadStats();
      sound.playSuccess();
      showBanner(
        'success',
        `Optimasi selesai: ${deletedCount} baris riwayat presensi lama telah dihapus dari Supabase.`
      );
    } catch (err: any) {
      sound.playAlert();
      showBanner('error', 'Gagal menghapus log presensi lama: ' + (err?.message || String(err)));
    } finally {
      setIsPurgingLogs(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-gray-500 hover:text-gray-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= KOLOM KIRI (6 Kolom): Kesehatan Backup & Ekspor Backup ================= */}
        <div className="lg:col-span-6 space-y-6">
          {/* FITUR 1: Panel Jadwal & Status Kesehatan Backup */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Jadwal & Status Kesehatan Backup
                  </h2>
                  <p className="text-xs text-gray-500">
                    Pantau perlindungan cadangan data & ringkasan baris tabel Supabase
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadStats}
                disabled={isLoadingStats}
                title="Muat Ulang Jumlah Baris Database"
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin text-cyan-600' : ''}`} />
                <span>Refresh Data</span>
              </button>
            </div>

            {/* Pilihan Mode Pengingat Periode Maintenance: Harian / Mingguan / Bulanan */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Periode Pengingat Backup Rutin:</span>
                </span>
                <span className="text-[11px] font-mono text-gray-500">
                  Terakhir: <strong>{formatDateIndo(lastBackupDate)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
                {(['Harian', 'Mingguan', 'Bulanan'] as BackupScheduleType[]).map((mode) => {
                  const isActive = backupSchedule === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSelectSchedule(mode)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isActive
                          ? 'bg-cyan-500 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      <span>{mode}</span>
                      <span className={`text-[10px] font-normal ${isActive ? 'text-cyan-100' : 'text-gray-400'}`}>
                        ({mode === 'Harian' ? '1 hr' : mode === 'Mingguan' ? '7 hr' : '30 hr'})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Indikator Visual Status Kesehatan Backup (Hijau vs Kuning/Merah) */}
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all ${
                health.isHealthy
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/80 border-amber-300 text-amber-950'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  health.isHealthy
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-amber-500 text-white shadow-sm animate-pulse'
                }`}
              >
                {health.isHealthy ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold">{health.title}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      health.isHealthy
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-700 border-rose-300'
                    }`}
                  >
                    {health.badgeLabel}
                  </span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">{health.desc}</p>
              </div>
            </div>

            {/* Ringkasan Jumlah Baris Data Real-Time dari Supabase */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Ringkasan Baris Data Real-Time (Supabase)</span>
                <span className="font-mono text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                  Live Count
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-[10px] font-semibold text-gray-500">Total Siswa</span>
                    <Users className="w-3.5 h-3.5 text-cyan-600" />
                  </div>
                  <div className="text-lg font-extrabold text-gray-900 font-mono mt-1">
                    {stats.students}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-[10px] font-semibold text-gray-500">Total Kelas</span>
                    <School className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-lg font-extrabold text-gray-900 font-mono mt-1">
                    {stats.rombel}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-[10px] font-semibold text-gray-500">Log Presensi</span>
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-gray-900 font-mono mt-1">
                    {stats.attendance_log}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-[10px] font-semibold text-gray-500">Antrean WA</span>
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-lg font-extrabold text-gray-900 font-mono mt-1">
                    {stats.wa_queue}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-[10px] font-semibold text-gray-500">Pengumuman</span>
                    <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="text-lg font-extrabold text-gray-900 font-mono mt-1">
                    {stats.announcements}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FITUR 2: Ekspor Backup (Full Snapshot JSON & Per-Tabel CSV) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shrink-0">
                  <HardDriveDownload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Ekspor Backup Database (JSON & CSV)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Unduh salinan lengkap seluruh tabel Supabase ke komputer/perangkat lokal
                  </p>
                </div>
              </div>
            </div>

            {/* Tombol Utama: Unduh Full Backup (.JSON) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-50/80 to-blue-50/60 border border-cyan-200 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    Rekomendasi Utama
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 pt-1">
                    Full Snapshot Database (.JSON)
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Mencakup seluruh tabel: <code>app_settings</code>, <code>rombel</code>,{' '}
                    <code>students</code>, <code>app_users</code>, <code>message_templates</code>,{' '}
                    <code>announcements</code>, dan <code>attendance_log</code>.
                  </p>
                </div>
                <FileJson className="w-8 h-8 text-cyan-600 shrink-0 hidden sm:block" />
              </div>

              <button
                type="button"
                onClick={() => handleDownloadJsonBackup(true)}
                disabled={isExportingFull}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] transition"
              >
                <HardDriveDownload className="w-4 h-4" />
                <span>
                  {isExportingFull
                    ? 'Mengumpulkan Seluruh Tabel Supabase...'
                    : `Unduh Full Backup (.JSON) — Backup_SmartPresensi_${backupSchedule}_${new Date()
                        .toISOString()
                        .slice(0, 10)}.json`}
                </span>
              </button>
            </div>

            {/* Opsi Backup Cepat Master Data Saja & Arsip CSV */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-gray-800">
                Opsi Ekspor Cepat & Arsip Excel (.CSV):
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadJsonBackup(false)}
                  disabled={isExportingMaster}
                  className="p-3.5 rounded-xl bg-gray-50 hover:bg-cyan-50/60 border border-gray-200 hover:border-cyan-300 text-left transition flex items-start gap-3 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 group-hover:border-cyan-200 flex items-center justify-center text-cyan-600 shrink-0 shadow-xs">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 group-hover:text-cyan-700">
                      {isExportingMaster ? 'Mengekspor...' : 'Backup Cepat Master Data (.JSON)'}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Hanya konfigurasi, kelas, siswa, user & template (tanpa ribuan log presensi).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAttendanceCsv}
                  disabled={isExportingCsv}
                  className="p-3.5 rounded-xl bg-gray-50 hover:bg-emerald-50/60 border border-gray-200 hover:border-emerald-300 text-left transition flex items-start gap-3 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 group-hover:border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-700">
                      {isExportingCsv ? 'Menyiapkan CSV...' : 'Ekspor Log Presensi (.CSV Excel)'}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Unduh khusus arsip riwayat presensi ({stats.attendance_log} baris) siap buka di Excel.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= KOLOM KANAN (6 Kolom): Restore 1-Click Upsert & Maintenance ================= */}
        <div className="lg:col-span-6 space-y-6">
          {/* FITUR 3: Restore / Pemulihan Database (1-Click Upsert) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Pulihkan Data dari File Backup (.JSON)
                  </h2>
                  <p className="text-xs text-gray-500">
                    1-Click Upsert berurutan ke Supabase dengan pratinjau isi file terlebih dahulu
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />

              <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50/70 text-center space-y-2.5 transition">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    Pilih File Backup Smart Presensi (<code>.json</code>)
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Data tidak akan langsung ditimpa sebelum Anda memeriksa pratinjau dan menekan tombol konfirmasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition active:scale-95 inline-flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4" />
                  <span>Pilih File Backup (.JSON)</span>
                </button>
              </div>

              {/* Pratinjau Isi File Backup sebelum dieksekusi */}
              {backupPreview && (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-start justify-between gap-2 border-b border-blue-200/80 pb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase">
                        Pratinjau File Backup Siap Pulih
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 mt-1.5 font-mono break-all">
                        {backupPreview.fileName}
                      </h4>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Dibuat pada: <strong>{formatDateIndo(backupPreview.createdAt)}</strong> • Tipe:{' '}
                        <strong>{backupPreview.backupType}</strong> (v{backupPreview.version})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBackupPreview(null)}
                      title="Batalkan Pilihan File"
                      className="p-1 text-gray-400 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white border border-blue-100">
                      <div className="text-[10px] text-gray-500">Siswa</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">
                        {backupPreview.counts.students}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-blue-100">
                      <div className="text-[10px] text-gray-500">Kelas</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">
                        {backupPreview.counts.rombel}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-blue-100">
                      <div className="text-[10px] text-gray-500">Log Presensi</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">
                        {backupPreview.counts.attendance_log}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-blue-100">
                      <div className="text-[10px] text-gray-500">User</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">
                        {backupPreview.counts.app_users}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-blue-100">
                      <div className="text-[10px] text-gray-500">Template</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">
                        {backupPreview.counts.message_templates}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-blue-100">
                      <div className="text-[10px] text-gray-500">Info</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">
                        {backupPreview.counts.announcements}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBackupPreview(null)}
                      disabled={isRestoring}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 font-semibold text-xs transition"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      disabled={isRestoring}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isRestoring
                          ? 'Memulihkan Tabel ke Supabase...'
                          : 'Konfirmasi & Pulihkan Database'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FITUR 4: Maintenance & Housekeeping Database (Optimasi Ruang Supabase) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Optimasi & Pembersihan Rutin (Housekeeping)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Jaga performa query dan hemat ruang penyimpanan database Supabase sekolah
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Aksi 1: Bersihkan Antrean WA Terkirim */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <span>1. Bersihkan Antrean WA Terkirim</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                        {stats.wa_queue_sent} Terkirim
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Menghapus baris di tabel <code>wa_queue</code> yang sudah berstatus{' '}
                      <code>'sent'</code> agar proses antrean notifikasi WhatsApp harian tetap ringan dan cepat.
                    </p>
                  </div>

                  {!confirmClearQueue ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearQueue(true)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bersihkan Antrean WA Terkirim</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmClearQueue(false)}
                        disabled={isClearingQueue}
                        className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSentWaQueue}
                        disabled={isClearingQueue}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isClearingQueue ? 'Menghapus...' : 'Ya, Hapus Sekarang'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Aksi 2: Hapus Log Presensi Lama (Pilih Rentang / Bulan) */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="space-y-1">
                  <div className="font-bold text-gray-900 flex items-center justify-between">
                    <span>2. Hapus Log Presensi Lama (Pilih Rentang / Bulan)</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-mono text-[10px] font-bold">
                      Total: {stats.attendance_log} Log
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Hapus riwayat presensi uji coba atau semester lampau setelah Anda mengunduh arsip backup (.JSON / .CSV).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                      Pilih Rentang Waktu Penghapusan:
                    </label>
                    <select
                      value={purgeMode}
                      onChange={(e) => {
                        setPurgeMode(e.target.value as any);
                        setConfirmPurgeLogs(false);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-xs"
                    >
                      <option value="older_1m">Lebih lama dari 1 Bulan yang lalu</option>
                      <option value="older_3m">Lebih lama dari 3 Bulan yang lalu</option>
                      <option value="older_6m">Lebih lama dari 6 Bulan (Semester Lampau)</option>
                      <option value="month">Pilih Bulan Spesifik (YYYY-MM)</option>
                      <option value="all">Semua Log Presensi (Reset Uji Coba)</option>
                    </select>
                  </div>

                  {purgeMode === 'month' && (
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        Pilih Bulan & Tahun Arsip:
                      </label>
                      <input
                        type="month"
                        value={purgeMonth}
                        onChange={(e) => {
                          setPurgeMonth(e.target.value);
                          setConfirmPurgeLogs(false);
                        }}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-cyan-500 shadow-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-1">
                  {!confirmPurgeLogs ? (
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeLogs(true)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Log Presensi Sesuai Rentang</span>
                    </button>
                  ) : (
                    <div className="w-full p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-rose-800">
                        Yakin ingin menghapus permanen log presensi pada rentang ini? Pastikan Anda sudah melakukan Backup!
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => setConfirmPurgeLogs(false)}
                          disabled={isPurgingLogs}
                          className="px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 font-semibold text-xs"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handlePurgeOldAttendanceLogs}
                          disabled={isPurgingLogs}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isPurgingLogs ? 'Menghapus...' : 'Konfirmasi Hapus'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
