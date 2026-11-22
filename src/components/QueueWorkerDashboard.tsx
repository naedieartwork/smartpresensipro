import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Send,
  Eye,
  Activity,
  Layers,
  Terminal,
  X,
} from 'lucide-react';
import { WaQueueItem, WorkerState, Student, Rombel } from '../types';
import { queueWorker, WorkerLogEntry } from '../services/queueWorker';
import { supabaseService } from '../services/supabaseClient';

const normalizeWaNumber = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('08')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
};

const formatClassBadgeLabel = (rawClass: string | undefined | null): string => {
  if (!rawClass) return '';
  const trimmed = rawClass.trim();
  if (!trimmed) return '';
  return /^kelas\s+/i.test(trimmed) ? trimmed : `Kelas ${trimmed}`;
};

export const QueueWorkerDashboard: React.FC = () => {
  const [workerState, setWorkerState] = useState<WorkerState>(queueWorker.getState());
  const [logs, setLogs] = useState<WorkerLogEntry[]>(queueWorker.getLogs());
  const [queue, setQueue] = useState<WaQueueItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rombelList, setRombelList] = useState<Rombel[]>([]);
  const [queuePage, setQueuePage] = useState<number>(1);
  const queuePerPage = 10;
  const [selectedMessage, setSelectedMessage] = useState<WaQueueItem | null>(null);

  const refreshQueue = async () => {
    const [items, studentData, rombelData] = await Promise.all([
      supabaseService.getQueue(),
      supabaseService.getStudents(),
      supabaseService.getRombel(),
    ]);
    setQueue(items);
    setStudents(studentData);
    setRombelList(rombelData);
  };

  useEffect(() => {
    const unsubWorker = queueWorker.subscribe((state, logList) => {
      setWorkerState(state);
      setLogs(logList);
      refreshQueue();
    });

    const unsubSupabase = supabaseService.subscribe(refreshQueue);
    refreshQueue();

    return () => {
      unsubWorker();
      unsubSupabase();
    };
  }, []);

  const resolveQueueStudentInfo = (
    item: WaQueueItem
  ): { studentName: string; classLabel: string } => {
    const targetWa = normalizeWaNumber(item.no_wa_tujuan);
    const msgText = String(item.isi_pesan || '');
    const msgLower = msgText.toLowerCase();

    // 1. Cari semua kandidat siswa yang cocok dengan nomor WA yang sudah dinormalisasi
    const phoneMatches = students.filter((s) => {
      const candidateWa = normalizeWaNumber(
        s.no_wa_wali || (s as any).no_wa || (s as any).phone
      );
      if (!candidateWa || !targetWa) return false;
      if (candidateWa === targetWa) return true;
      // Fallback pencocokan 9 digit terakhir jika kode negara berbeda
      return (
        candidateWa.length >= 9 &&
        targetWa.length >= 9 &&
        candidateWa.slice(-9) === targetWa.slice(-9)
      );
    });

    // Jika ada lebih dari 1 siswa dengan nomor WA wali yang sama, prioritaskan yang namanya disebut di isi pesan
    let matchedStudent: Student | undefined =
      phoneMatches.find((s) => s.nama && msgLower.includes(s.nama.trim().toLowerCase())) ||
      phoneMatches[0];

    // 2. Jika belum ketemu dari nomor WA, coba cari siswa yang namanya tercantum di dalam teks pesan
    if (!matchedStudent && msgText) {
      matchedStudent = students.find(
        (s) => s.nama && s.nama.trim().length > 2 && msgLower.includes(s.nama.trim().toLowerCase())
      );
    }

    // 3. Resolusi nama kelas dari relasi rombel_id / data rombel siswa
    let resolvedClass = '';
    if (matchedStudent) {
      const rmbId = matchedStudent.rombel_id || matchedStudent.class_id;
      const matchedRombel = rombelList.find((r) => r.id === rmbId);
      resolvedClass =
        matchedRombel?.nama_kelas ||
        matchedStudent.rombel?.nama_kelas ||
        matchedStudent.kelas ||
        '';
    }

    // Ekstrak kelas dari pesan jika belum ditemukan dari relasi
    if (!resolvedClass && msgText) {
      const classMatch =
        msgText.match(/\(Kelas\s+([^)]+)\)/i) || msgText.match(/Kelas\s*:\s*\*?([^*\n,)]+)\*?/i);
      if (classMatch?.[1]) {
        resolvedClass = classMatch[1].trim();
      }
    }

    // 4. Resolusi nama lengkap siswa (dari matchedStudent, field student_name, atau ekstraksi regex isi pesan)
    let resolvedName = matchedStudent?.nama?.trim() || '';
    if (!resolvedName && item.student_name && item.student_name.trim() !== 'Wali Murid') {
      resolvedName = item.student_name.trim();
    }
    if (!resolvedName && msgText) {
      const patterns = [
        /ananda\s+\*([^*]+)\*/i,
        /Wali dari\s+\*([^*]+)\*/i,
        /Orang tua (?:dari )?(?:ananda )?\*([^*]+)\*/i,
        /Siswa\s*:\s*\*?([^*\n(]+)\*?/i,
        /Nama\s*:\s*\*?([^*\n(]+)\*?/i,
      ];
      for (const regex of patterns) {
        const match = msgText.match(regex);
        if (match?.[1]?.trim()) {
          resolvedName = match[1].trim();
          break;
        }
      }
    }

    // Jika nama diekstrak dari pesan dan belum dapat kelas, coba cocokkan ulang nama ke daftar students
    if (resolvedName && !matchedStudent) {
      const byName = students.find(
        (s) => s.nama && s.nama.trim().toLowerCase() === resolvedName.toLowerCase()
      );
      if (byName) {
        matchedStudent = byName;
        const rmbId = byName.rombel_id || byName.class_id;
        const matchedRombel = rombelList.find((r) => r.id === rmbId);
        resolvedClass =
          matchedRombel?.nama_kelas || byName.rombel?.nama_kelas || byName.kelas || resolvedClass;
      }
    }

    return {
      studentName: resolvedName || 'Siswa Terdaftar',
      classLabel: formatClassBadgeLabel(resolvedClass),
    };
  };

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const processingCount = queue.filter((q) => q.status === 'processing').length;
  const sentCount = queue.filter((q) => q.status === 'sent').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  const totalQueueItems = queue.length;
  const totalQueuePages = Math.max(1, Math.ceil(totalQueueItems / queuePerPage));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const queueStartIndex = (safeQueuePage - 1) * queuePerPage;
  const queueEndIndex = Math.min(queueStartIndex + queuePerPage, totalQueueItems);
  const paginatedQueue = queue.slice(queueStartIndex, queueStartIndex + queuePerPage);

  const handleTogglePause = () => {
    queueWorker.togglePause();
  };

  const handleClearSent = async () => {
    if (confirm('Bersihkan semua riwayat antrean yang sudah berstatus Sent?')) {
      await supabaseService.clearSentQueue();
      setQueuePage(1);
      refreshQueue();
    }
  };

  const handleRetryFailed = async () => {
    const failedItems = queue.filter((q) => q.status === 'failed');
    for (const item of failedItems) {
      await supabaseService.updateQueueStatus(item.id, 'pending');
    }
    setQueuePage(1);
    refreshQueue();
  };

  const renderStatusBadge = (status: WaQueueItem['status']) => {
    if (status === 'processing') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 animate-pulse whitespace-nowrap">
          PROCESSING
        </span>
      );
    }
    if (status === 'sent') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          SENT
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
          FAILED
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        PENDING
      </span>
    );
  };

  const countdown = workerState.countdownSeconds;
  const countdownPct = countdown > 0 ? ((15 - countdown) / 15) * 100 : 100;

  return (
    <div className="space-y-6">
      {/* Top Banner: Anti-Spam Worker Controller & Circular Timer */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-xl w-full">
            <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shrink-0"></span>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 whitespace-nowrap">
                  Antrean Notifikasi WA
                </h2>
              </div>
              <span
                className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border whitespace-nowrap shrink-0 ${
                  workerState.isPaused
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {workerState.isPaused ? 'Worker Dijeda' : 'Worker Berjalan'}
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-snug">
              Pengiriman otomatis dengan jeda aman 15 detik antar pesan.
            </p>

            <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:w-auto pt-1">
              <button
                type="button"
                onClick={handleTogglePause}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-95 whitespace-nowrap ${
                  workerState.isPaused
                    ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {workerState.isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>Jalankan Worker</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>Jeda Worker</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearSent}
                disabled={sentCount === 0}
                className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:text-gray-900 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span>Bersihkan Riwayat</span>
              </button>

              {failedCount > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Kirim Ulang ({failedCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* 15-Second Anti-Spam Timer Ring */}
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 shrink-0 shadow-sm">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-20 h-20 -rotate-90 transform">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-gray-200"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-cyan-500 transition-all duration-1000 ease-linear"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={
                    2 * Math.PI * 32 * (1 - (countdown > 0 ? (15 - countdown) / 15 : 1))
                  }
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-bold font-mono text-gray-900">
                  {countdown > 0 ? countdown : 0}
                </span>
                <span className="text-[9px] uppercase font-mono text-cyan-600 font-bold">
                  {countdown > 0 ? 'Detik' : 'Ready'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-900">Jeda Anti-Spam</div>
              <div className="text-[11px] text-gray-500">
                {countdown > 0
                  ? `Menahan antrean berikutnya...`
                  : pendingCount > 0
                  ? 'Menyiapkan paket pesan...'
                  : 'Antrean sedang bersih'}
              </div>
              <div className="text-[10px] font-mono text-cyan-600 font-semibold">
                Delay Wajib: 15.000 ms
              </div>
            </div>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-3">
          <Activity className="w-4 h-4 text-cyan-600 shrink-0" />
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
            <div
              className="bg-cyan-500 h-full transition-all duration-500"
              style={{ width: `${countdown > 0 ? countdownPct : 100}%` }}
            ></div>
          </div>
          <span className="text-[11px] font-mono text-gray-500 shrink-0 font-semibold">
            {countdown > 0 ? `Sisa ${countdown}s` : 'Siap Kirim'}
          </span>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-amber-600 font-semibold mb-1">
            <span>Antrean Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">{pendingCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Menunggu giliran kirim</div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-cyan-600 font-semibold mb-1">
            <span>Sedang Diproses</span>
            <Send className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">{processingCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Request ke API Sidobe</div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-emerald-600 font-semibold mb-1">
            <span>Berhasil Terkirim</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">{sentCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Notifikasi WA sukses</div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-rose-600 font-semibold mb-1">
            <span>Gagal / Error</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">{failedCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Bisa dikirim ulang</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Real-time Queue List & Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
            {/* Header 1 Baris: Tabel Antrean WA & Badge Total */}
            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Layers className="w-4 h-4 text-cyan-600 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-gray-900 whitespace-nowrap">
                  Tabel Antrean WA
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold font-mono whitespace-nowrap shrink-0">
                {totalQueueItems} Total Antrean
              </span>
            </div>

            {/* MOBILE CARD VIEW: DAFTAR ANTREAN WA (md:hidden) */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              {paginatedQueue.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-gray-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  Antrean pesan WA masih kosong. Lakukan presensi untuk menambahkan antrean baru!
                </div>
              ) : (
                paginatedQueue.map((item) => {
                  const timeStr = new Date(item.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const { studentName, classLabel } = resolveQueueStudentInfo(item);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                    >
                      {/* Sisi Kiri: Hierarki Student-First */}
                      <div className="min-w-0 space-y-1">
                        {/* Baris Utama: Nama Lengkap Siswa + Badge Kelas */}
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="font-bold text-slate-800 text-sm sm:text-base truncate">
                            {studentName}
                          </span>
                          {classLabel && (
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0">
                              {classLabel}
                            </span>
                          )}
                        </div>

                        {/* Baris Kedua: Sub-teks Nomor WA Tujuan */}
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1 truncate">
                          <span>📱</span>
                          <span>{item.no_wa_tujuan}</span>
                        </div>

                        {/* Baris Ketiga: Badge Status & Waktu Masuk */}
                        <div className="flex items-center gap-2 pt-0.5">
                          {renderStatusBadge(item.status)}
                          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                            {timeStr}
                          </span>
                        </div>
                      </div>

                      {/* Sisi Kanan: Tombol Lihat Pesan 1 Baris */}
                      <button
                        type="button"
                        onClick={() => setSelectedMessage(item)}
                        className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition inline-flex items-center gap-1.5 font-semibold whitespace-nowrap shrink-0 shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span>Lihat Pesan</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW: TABEL ANTREAN WA (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200">
                    <th className="pb-3 font-semibold">Siswa &amp; Tujuan WA</th>
                    <th className="pb-3 font-semibold">Status &amp; Waktu</th>
                    <th className="pb-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedQueue.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400">
                        Antrean pesan WA masih kosong. Lakukan presensi untuk menambahkan antrean baru!
                      </td>
                    </tr>
                  ) : (
                    paginatedQueue.map((item) => {
                      const timeStr = new Date(item.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const { studentName, classLabel } = resolveQueueStudentInfo(item);

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition group">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                {studentName}
                              </span>
                              {classLabel && (
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
                                  {classLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1">
                              <span>📱</span>
                              <span>{item.no_wa_tujuan}</span>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {renderStatusBadge(item.status)}
                              <span className="font-mono text-slate-500 text-xs whitespace-nowrap">
                                {timeStr}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedMessage(item)}
                              className="px-3 py-1.5 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 transition inline-flex items-center gap-1.5 font-semibold whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              <span>Lihat Pesan</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Kontrol Navigasi Paginasi (10 item per halaman) */}
            {totalQueueItems > queuePerPage && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-[11px] text-slate-500 font-medium">
                  Menampilkan{' '}
                  <span className="font-bold text-slate-800 font-mono">
                    {queueStartIndex + 1}–{queueEndIndex}
                  </span>{' '}
                  dari <span className="font-bold text-slate-800 font-mono">{totalQueueItems}</span>{' '}
                  antrean{' '}
                  <span className="text-slate-400 font-mono">
                    (Hal {safeQueuePage} dari {totalQueuePages})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setQueuePage((prev) => Math.max(1, prev - 1))}
                    disabled={safeQueuePage <= 1}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                  >
                    &lt; Sebelumnya
                  </button>
                  <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold whitespace-nowrap">
                    Hal {safeQueuePage} dari {totalQueuePages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQueuePage((prev) => Math.min(totalQueuePages, prev + 1))}
                    disabled={safeQueuePage >= totalQueuePages}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                  >
                    Berikutnya &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Worker Event Terminal Log */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-600" />
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Log Eksekusi Worker
                </h4>
              </div>
              <span className="text-[10px] font-mono text-cyan-600 font-semibold">Live Polling</span>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 font-mono text-[11px] max-h-96 overflow-y-auto space-y-2 border border-gray-200">
              {logs.length === 0 ? (
                <div className="text-gray-400 text-center py-4">Belum ada aktivitas worker.</div>
              ) : (
                logs.map((log) => {
                  let color = 'text-gray-700';
                  if (log.type === 'success') color = 'text-emerald-700 font-semibold';
                  if (log.type === 'warning') color = 'text-amber-700 font-semibold';
                  if (log.type === 'error') color = 'text-rose-700 font-semibold';
                  return (
                    <div key={log.id} className="leading-snug">
                      <span className="text-gray-400">[{log.timestamp}]</span>{' '}
                      <span className={color}>{log.text}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Preview Modal */}
      {selectedMessage && (() => {
        const { studentName, classLabel } = resolveQueueStudentInfo(selectedMessage);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">Detail Pesan WhatsApp</h3>
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                      {studentName}
                    </span>
                    {classLabel && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap">
                        {classLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <span>📱</span>
                    <span>{selectedMessage.no_wa_tujuan}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 whitespace-pre-wrap font-sans text-xs text-gray-800 leading-relaxed max-h-72 overflow-y-auto shadow-inner">
              {selectedMessage.isi_pesan}
            </div>

            {selectedMessage.error_message && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <span className="font-bold">Error Detail:</span> {selectedMessage.error_message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Status: <strong className="uppercase text-cyan-600">{selectedMessage.status}</strong>
              </span>
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                Tutup
              </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
