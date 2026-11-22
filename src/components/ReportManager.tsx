import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Search,
  Check,
  Building2,
  Calendar,
  Lock,
  FileText,
  X,
  Save,
  Filter,
} from 'lucide-react';
import { AttendanceLog, Student, Rombel, KalenderPendidikan, Holiday, AppUser } from '../types';
import { supabaseService } from '../services/supabaseClient';
import { evaluateIsHoliday, formatLocalYMD } from '../services/attendanceService';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
  defaultDocumentSignatories,
} from '../services/settingsService';
import { sound } from '../utils/audio';

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';
type PrintStatusFilter = 'all' | 'hadir_tepat' | 'hadir_telat' | 'izin_sakit' | 'alpa';

interface ReportManagerProps {
  currentUser?: AppUser | null;
}

interface PrintableAttendanceRow {
  id: string;
  studentName: string;
  studentNisn: string;
  kelasName: string;
  waktuRaw: string;
  waktuFormatted: string;
  statusCode: 'hadir_tepat' | 'hadir_telat' | 'pulang' | 'izin' | 'sakit' | 'alpa';
  statusLabel: string;
  metodeOrKeterangan: string;
}

export const ReportManager: React.FC<ReportManagerProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rombelList, setRombelList] = useState<Rombel[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [kalenderList, setKalenderList] = useState<KalenderPendidikan[]>([]);
  const [holidayList, setHolidayList] = useState<Holiday[]>([]);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reportPage, setReportPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State Pengaturan Sekolah & Pusat Konfigurasi Cetak Laporan A4
  const [schoolSettings, setSchoolSettings] = useState(() => settingsService.getSettings());
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [printTimeFilter, setPrintTimeFilter] = useState<TimeFilter>('today');
  const [printStartDate, setPrintStartDate] = useState<string>('');
  const [printEndDate, setPrintEndDate] = useState<string>('');
  const [printClassFilter, setPrintClassFilter] = useState<string>('all');
  const [printStatusFilter, setPrintStatusFilter] = useState<PrintStatusFilter>('all');

  // State Identitas Penandatangan Dokumen Resmi (Tersinkronisasi Global dengan Modul Poin)
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
  const [isSavingSignatories, setIsSavingSignatories] = useState<boolean>(false);

  const isWaliKelas = currentUser?.role === 'Wali Kelas';
  const waliAssignedClass = String(
    currentUser?.assignedClass || currentUser?.assigned_class || (isWaliKelas ? '1A' : '')
  ).trim();

  const canEditSignatories = useMemo(() => {
    if (isWaliKelas) return false;
    if (!currentUser) return true;
    return (
      currentUser.role === 'Super Admin' ||
      currentUser.role === 'Admin' ||
      Boolean(currentUser.is_master)
    );
  }, [isWaliKelas, currentUser]);

  const loadData = async () => {
    const [l, s, r, k, h, u] = await Promise.all([
      supabaseService.getAttendanceLogs(),
      supabaseService.getStudents(),
      supabaseService.getRombel(),
      supabaseService.getKalenderPendidikan(),
      supabaseService.getHolidays(),
      supabaseService.getAppUsers(),
    ]);
    setLogs(l);
    setStudents(s);
    setRombelList(r);
    setKalenderList(k);
    setHolidayList(h);
    setAppUsers(u);
  };

  useEffect(() => {
    loadData();
    settingsService.loadFromSupabase().then((loaded) => {
      setSchoolSettings(loaded);
      if (loaded.documentSignatories) {
        setKotaCetak(loaded.documentSignatories.kotaCetak);
        setKepalaSekolahName(loaded.documentSignatories.kepalaSekolahName);
        setKepalaSekolahNip(loaded.documentSignatories.kepalaSekolahNip);
        setPetugasBkName(loaded.documentSignatories.petugasBkName);
        setPetugasBkNip(loaded.documentSignatories.petugasBkNip);
      }
    });
    const unsub = supabaseService.subscribe(loadData);
    const unsubSettings = settingsService.subscribe(() => {
      const current = settingsService.getSettings();
      setSchoolSettings(current);
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

  useEffect(() => {
    if (isWaliKelas && waliAssignedClass) {
      const normalizedWali = waliAssignedClass.toLowerCase().replace(/^kelas\s+/i, '').trim();
      const matchedRombel = rombelList.find(
        (r) =>
          r.id.toLowerCase() === normalizedWali ||
          r.nama_kelas.trim().toLowerCase() === normalizedWali ||
          r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
      );
      if (matchedRombel) {
        if (selectedClass !== matchedRombel.id) {
          setSelectedClass(matchedRombel.id);
        }
        if (printClassFilter !== matchedRombel.id) {
          setPrintClassFilter(matchedRombel.id);
        }
      } else {
        const fallbackVal = normalizedWali.toUpperCase();
        if (selectedClass === 'all') setSelectedClass(fallbackVal);
        if (printClassFilter === 'all') setPrintClassFilter(fallbackVal);
      }
    }
  }, [isWaliKelas, waliAssignedClass, rombelList, selectedClass, printClassFilter]);

  // Auto-populate Nama Wali Kelas & NIP Wali Kelas mengikuti kelas/rombel yang sedang dipilih atau login
  useEffect(() => {
    const activeClassIdOrName = isWaliKelas
      ? waliAssignedClass || '1A'
      : printClassFilter !== 'all'
      ? printClassFilter
      : selectedClass !== 'all'
      ? selectedClass
      : '1A';

    const matchedRombelById = rombelList.find((r) => r.id === activeClassIdOrName);
    const rawClassName = matchedRombelById ? matchedRombelById.nama_kelas : activeClassIdOrName;
    const normTarget = String(rawClassName || '1A')
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

    const matchedRombel =
      matchedRombelById ||
      rombelList.find(
        (r) => r.nama_kelas.trim().toLowerCase().replace(/^kelas\s+/i, '') === normTarget
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
    printClassFilter,
    selectedClass,
    rombelList,
    appUsers,
    currentUser,
  ]);

  useEffect(() => {
    setReportPage(1);
  }, [timeFilter, startDate, endDate, selectedClass, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

    const currentDoc =
      settingsService.getSettings().documentSignatories || defaultDocumentSignatories;
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
      showToast('Data master Identitas Penandatangan berhasil disimpan & disinkronkan!');
    } catch {
      sound.playAlert();
      showToast('Tersimpan di perangkat lokal.');
    } finally {
      setIsSavingSignatories(false);
    }
  };

  /**
   * Petakan (Join/Lookup) data log presensi dengan master data students dan rombel
   */
  const findStudentForLog = (log: AttendanceLog): Student | undefined => {
    const rawLogUid = String(log.uid_kartu || log.rfid_uid || '').trim().toLowerCase();
    const rawLogName = String(log.student_name || '').trim().toLowerCase();

    return students.find((st: any) => {
      if ((log as any).student_id && st.id === (log as any).student_id) return true;
      const candidates = [
        st.uid_kartu,
        st.rfid_uid,
        st.uid,
        st.kode_rfid,
        st.nisn,
        st.nis,
      ];
      if (
        rawLogUid !== '' &&
        candidates.some(
          (val) => val !== undefined && val !== null && String(val).trim().toLowerCase() === rawLogUid
        )
      ) {
        return true;
      }
      if (
        rawLogName !== '' &&
        !rawLogName.startsWith('siswa (') &&
        st.nama &&
        st.nama.trim().toLowerCase() === rawLogName
      ) {
        return true;
      }
      return false;
    });
  };

  const findRombelForStudent = (student?: Student): Rombel | undefined => {
    if (!student) return undefined;
    const rmbId = String(
      student.rombel_id || student.class_id || (student as any).id_rombel || ''
    ).trim();
    const kelasStr = String(student.kelas || '').trim().toLowerCase();

    const matched = rombelList.find(
      (r) =>
        (rmbId && (r.id === rmbId || r.nama_kelas.trim().toLowerCase() === rmbId.toLowerCase())) ||
        (kelasStr && r.nama_kelas.trim().toLowerCase() === kelasStr)
    );
    return matched || student.rombel;
  };

  const resolveLogDetails = (log: AttendanceLog) => {
    const student = findStudentForLog(log);
    const rmb = findRombelForStudent(student);

    const isFallbackLogName =
      !log.student_name || String(log.student_name).trim().toLowerCase().startsWith('siswa (');
    const studentName = student?.nama
      ? student.nama
      : !isFallbackLogName
      ? log.student_name!
      : `Siswa (${log.uid_kartu || '-'})`;

    const studentNisn = student?.nisn || student?.nis || log.uid_kartu || '-';
    const kelasName = rmb?.nama_kelas || student?.kelas || 'Umum';
    const rombelId = rmb?.id || student?.rombel_id || student?.class_id || '';

    return {
      student,
      rmb,
      studentName,
      studentNisn,
      kelasName,
      rombelId,
    };
  };

  const checkStudentMatchesClassFilter = (student: Student | undefined, classFilterValue: string): boolean => {
    if (classFilterValue === 'all') return true;
    if (!student) return false;
    const rmb = findRombelForStudent(student);
    const selectedRombelObj = rombelList.find(
      (r) =>
        r.id === classFilterValue ||
        r.nama_kelas.trim().toLowerCase() === classFilterValue.trim().toLowerCase()
    );
    const selectedKelasName = selectedRombelObj?.nama_kelas.trim().toLowerCase();

    if (rmb && rmb.id === classFilterValue) return true;
    if (student.rombel_id === classFilterValue || student.class_id === classFilterValue) return true;
    if (
      selectedKelasName &&
      ((rmb && rmb.nama_kelas.trim().toLowerCase() === selectedKelasName) ||
        (student.kelas && student.kelas.trim().toLowerCase() === selectedKelasName))
    ) {
      return true;
    }
    if (
      student.kelas &&
      student.kelas.trim().toLowerCase() === classFilterValue.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const isStudentInSelectedClass = (student?: Student): boolean =>
    checkStudentMatchesClassFilter(student, selectedClass);

  const filterLogsByPeriod = (
    sourceLogs: AttendanceLog[],
    periodMode: TimeFilter,
    customStart: string,
    customEnd: string
  ) => {
    const now = new Date();
    const todayYMD = formatLocalYMD(now);

    return sourceLogs.filter((log) => {
      const logDate = new Date(log.waktu);
      const logYMD = formatLocalYMD(logDate);

      if (periodMode === 'today') {
        if (logYMD !== todayYMD) return false;
      } else if (periodMode === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        if (logDate < startOfWeek) return false;
      } else if (periodMode === 'month') {
        if (
          logDate.getMonth() !== now.getMonth() ||
          logDate.getFullYear() !== now.getFullYear()
        )
          return false;
      } else if (periodMode === 'custom') {
        if (customStart && logYMD < customStart) return false;
        if (customEnd && logYMD > customEnd) return false;
      }
      return true;
    });
  };

  const filteredLogs = useMemo(() => {
    const periodLogs = filterLogsByPeriod(logs, timeFilter, startDate, endDate);
    return periodLogs.filter((log) => {
      const details = resolveLogDetails(log);
      if (selectedClass !== 'all') {
        if (!isStudentInSelectedClass(details.student)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = details.studentName.toLowerCase().includes(q);
        const nisnMatch = details.studentNisn.toLowerCase().includes(q);
        const uidMatch = String(log.uid_kartu || '').toLowerCase().includes(q);
        const kelasMatch = details.kelasName.toLowerCase().includes(q);
        if (!nameMatch && !nisnMatch && !uidMatch && !kelasMatch) return false;
      }
      return true;
    });
  }, [logs, students, rombelList, timeFilter, startDate, endDate, selectedClass, searchQuery]);

  const totalHadir = filteredLogs.filter(
    (l) => l.status_kehadiran === 'hadir_tepat' || l.status_kehadiran === 'hadir_telat'
  ).length;

  const totalTerlambat = filteredLogs.filter(
    (l) => l.status_kehadiran === 'hadir_telat'
  ).length;

  const totalIzinSakit = filteredLogs.filter(
    (l) => l.status_kehadiran === 'izin' || l.status_kehadiran === 'sakit'
  ).length;

  const now = new Date();
  const todayYMD = formatLocalYMD(now);
  const todayHolidayCheck = evaluateIsHoliday(now, {
    rombelList,
    kalenderList,
    holidayList,
    selectedRombelId: selectedClass,
  });

  const studentsInScope =
    selectedClass !== 'all'
      ? students.filter((s) => isStudentInSelectedClass(s))
      : students;

  const activeStudentsToday = studentsInScope.filter(
    (s) =>
      !evaluateIsHoliday(now, {
        student: s,
        rombelList,
        kalenderList,
        holidayList,
      }).isHoliday
  );

  const uniquePresentStudentsToday = new Set(
    logs
      .filter((l) => {
        const logYMD = formatLocalYMD(new Date(l.waktu));
        if (logYMD !== todayYMD) return false;
        if (
          l.status_kehadiran !== 'hadir_tepat' &&
          l.status_kehadiran !== 'hadir_telat' &&
          l.status_kehadiran !== 'izin' &&
          l.status_kehadiran !== 'sakit'
        ) {
          return false;
        }
        const details = resolveLogDetails(l);
        return isStudentInSelectedClass(details.student);
      })
      .map((l) => {
        const details = resolveLogDetails(l);
        return details.student?.id || (l.uid_kartu || '').toUpperCase();
      })
  );

  const getDateRangeListFor = (
    periodMode: TimeFilter,
    customStart: string,
    customEnd: string
  ): string[] => {
    const dates: string[] = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    if (periodMode === 'today' || periodMode === 'all') {
      return [formatLocalYMD(today)];
    }

    let cursor = new Date(today);
    let endCursor = new Date(today);

    if (periodMode === 'week') {
      cursor.setDate(today.getDate() - today.getDay());
    } else if (periodMode === 'month') {
      cursor = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);
    } else if (periodMode === 'custom') {
      if (customStart) {
        const [sy, sm, sd] = customStart.split('-').map(Number);
        cursor = new Date(sy, (sm || 1) - 1, sd || 1, 12, 0, 0);
      }
      if (customEnd) {
        const [ey, em, ed] = customEnd.split('-').map(Number);
        const parsedEnd = new Date(ey, (em || 1) - 1, ed || 1, 12, 0, 0);
        endCursor = parsedEnd < today ? parsedEnd : today;
      }
    }

    while (cursor <= endCursor && dates.length <= 366) {
      dates.push(formatLocalYMD(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };

  const calculateRangeAbsence = () => {
    if (timeFilter === 'today' || timeFilter === 'all') {
      if (todayHolidayCheck.isHoliday || activeStudentsToday.length === 0) {
        return {
          count: 0,
          isHolidayNow: true,
          subtitle: todayHolidayCheck.reason || 'Hari Libur / Tidak Ada Jadwal Presensi',
        };
      }
      return {
        count: Math.max(0, activeStudentsToday.length - uniquePresentStudentsToday.size),
        isHolidayNow: false,
        subtitle: 'Siswa belum tap hari ini',
      };
    }

    const rangeDates = getDateRangeListFor(timeFilter, startDate, endDate);
    let totalAlfaInRange = 0;
    let totalEffectiveDaysCount = 0;

    for (const dStr of rangeDates) {
      const dayCheck = evaluateIsHoliday(dStr, {
        rombelList,
        kalenderList,
        holidayList,
        selectedRombelId: selectedClass,
      });
      if (!dayCheck.isHoliday) {
        totalEffectiveDaysCount += 1;
      }

      for (const st of studentsInScope) {
        const stHoliday = evaluateIsHoliday(dStr, {
          student: st,
          rombelList,
          kalenderList,
          holidayList,
        });
        if (stHoliday.isHoliday) continue;

        const hasRecordOnDate = logs.some((l) => {
          const lYMD = formatLocalYMD(new Date(l.waktu));
          if (lYMD !== dStr) return false;
          const matchedSt = findStudentForLog(l);
          return matchedSt?.id === st.id;
        });

        if (!hasRecordOnDate) {
          totalAlfaInRange += 1;
        }
      }
    }

    if (totalEffectiveDaysCount === 0) {
      return {
        count: 0,
        isHolidayNow: true,
        subtitle: todayHolidayCheck.reason || 'Hari Libur / Tidak Ada Jadwal Presensi',
      };
    }

    return {
      count: totalAlfaInRange,
      isHolidayNow: todayHolidayCheck.isHoliday,
      subtitle: todayHolidayCheck.isHoliday
        ? `Hari ini Libur (${todayHolidayCheck.reason})`
        : `${totalEffectiveDaysCount} Hari Efektif (Libur dikecualikan)`,
    };
  };

  const absenceMetric = calculateRangeAbsence();
  const belumPresensi = absenceMetric.count;

  const totalFilteredLogs = filteredLogs.length;
  const totalReportPages = Math.max(1, Math.ceil(totalFilteredLogs / itemsPerPage));
  const safeReportPage = Math.min(reportPage, totalReportPages);
  const reportStartIndex = (safeReportPage - 1) * itemsPerPage;
  const reportEndIndex = Math.min(reportStartIndex + itemsPerPage, totalFilteredLogs);
  const paginatedLogs = filteredLogs.slice(reportStartIndex, reportStartIndex + itemsPerPage);

  // ============================================================================
  // DATA & LOGIKA KHUSUS PUSAT KONFIGURASI CETAK LAPORAN PRESENSI A4
  // ============================================================================
  const handleOpenPrintModal = () => {
    setPrintTimeFilter(timeFilter);
    setPrintStartDate(startDate);
    setPrintEndDate(endDate);
    setPrintClassFilter(selectedClass);
    setPrintStatusFilter('all');
    setIsPrintModalOpen(true);
  };

  const printReportData = useMemo(() => {
    const periodLogs = filterLogsByPeriod(logs, printTimeFilter, printStartDate, printEndDate).filter(
      (log) => {
        const details = resolveLogDetails(log);
        return checkStudentMatchesClassFilter(details.student, printClassFilter);
      }
    );

    const logRows: PrintableAttendanceRow[] = periodLogs.map((log) => {
      const { studentName, studentNisn, kelasName } = resolveLogDetails(log);
      const timeFormatted = new Date(log.waktu).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const statusLabel =
        log.status_kehadiran === 'hadir_tepat'
          ? 'Hadir Tepat Waktu'
          : log.status_kehadiran === 'hadir_telat'
          ? 'Terlambat'
          : log.status_kehadiran === 'pulang'
          ? 'Pulang'
          : log.status_kehadiran === 'izin'
          ? 'Izin'
          : 'Sakit';

      const metodeKet = log.keterangan
        ? `${log.metode || 'Manual'} (${log.keterangan})`
        : log.metode || 'Hybrid (QR/RFID)';

      return {
        id: log.id,
        studentName,
        studentNisn,
        kelasName,
        waktuRaw: log.waktu,
        waktuFormatted: timeFormatted,
        statusCode: log.status_kehadiran,
        statusLabel,
        metodeOrKeterangan: metodeKet,
      };
    });

    // Susun daftar baris siswa yang Belum Presensi / Alpa pada hari efektif dalam periode cetak
    const studentsInPrintScope =
      printClassFilter !== 'all'
        ? students.filter((s) => checkStudentMatchesClassFilter(s, printClassFilter))
        : students;

    const alpaRows: PrintableAttendanceRow[] = [];
    const rangeDates = getDateRangeListFor(printTimeFilter, printStartDate, printEndDate);

    for (const dStr of rangeDates) {
      for (const st of studentsInPrintScope) {
        const stHoliday = evaluateIsHoliday(dStr, {
          student: st,
          rombelList,
          kalenderList,
          holidayList,
        });
        if (stHoliday.isHoliday) continue;

        const hasRecordOnDate = logs.some((l) => {
          const lYMD = formatLocalYMD(new Date(l.waktu));
          if (lYMD !== dStr) return false;
          const matchedSt = findStudentForLog(l);
          if (matchedSt?.id === st.id) return true;
          const rawUid = String(l.uid_kartu || l.rfid_uid || '').trim().toLowerCase();
          return (
            rawUid !== '' &&
            (String(st.uid_kartu || '').trim().toLowerCase() === rawUid ||
              String(st.rfid_uid || '').trim().toLowerCase() === rawUid)
          );
        });

        if (!hasRecordOnDate) {
          const rmb = findRombelForStudent(st);
          const [yy, mm, dd] = dStr.split('-').map(Number);
          const dateLabel =
            yy && mm && dd
              ? new Date(yy, mm - 1, dd).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : dStr;

          alpaRows.push({
            id: `alpa-${st.id}-${dStr}`,
            studentName: st.nama,
            studentNisn: st.nisn || st.nis || st.uid_kartu || '-',
            kelasName: rmb?.nama_kelas || st.kelas || 'Umum',
            waktuRaw: `${dStr}T23:59:00`,
            waktuFormatted: `${dateLabel} • -`,
            statusCode: 'alpa',
            statusLabel: 'Belum Presensi / Alpa',
            metodeOrKeterangan: 'Tanpa Keterangan (Alpa)',
          });
        }
      }
    }

    const countHadirTepat = logRows.filter((r) => r.statusCode === 'hadir_tepat').length;
    const countTerlambat = logRows.filter((r) => r.statusCode === 'hadir_telat').length;
    const countIzinSakit = logRows.filter(
      (r) => r.statusCode === 'izin' || r.statusCode === 'sakit'
    ).length;
    const countAlpa = alpaRows.length;

    let displayRows: PrintableAttendanceRow[] = [];
    if (printStatusFilter === 'all') {
      displayRows = [...logRows, ...alpaRows];
    } else if (printStatusFilter === 'hadir_tepat') {
      displayRows = logRows.filter((r) => r.statusCode === 'hadir_tepat');
    } else if (printStatusFilter === 'hadir_telat') {
      displayRows = logRows.filter((r) => r.statusCode === 'hadir_telat');
    } else if (printStatusFilter === 'izin_sakit') {
      displayRows = logRows.filter((r) => r.statusCode === 'izin' || r.statusCode === 'sakit');
    } else if (printStatusFilter === 'alpa') {
      displayRows = alpaRows;
    }

    return {
      rows: displayRows,
      stats: {
        totalRows: displayRows.length,
        hadirTepat: countHadirTepat,
        terlambat: countTerlambat,
        izinSakit: countIzinSakit,
        alpa: countAlpa,
      },
    };
  }, [
    logs,
    students,
    rombelList,
    kalenderList,
    holidayList,
    printTimeFilter,
    printStartDate,
    printEndDate,
    printClassFilter,
    printStatusFilter,
  ]);

  const formattedPrintPeriodLabel = useMemo(() => {
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

    if (printTimeFilter === 'today') {
      return `Hari Ini (${new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })})`;
    }
    if (printTimeFilter === 'week') {
      return 'Minggu Ini (7 Hari Terakhir)';
    }
    if (printTimeFilter === 'month') {
      return `Bulan Ini (${new Date().toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      })})`;
    }
    if (printTimeFilter === 'custom') {
      if (printStartDate && printEndDate) {
        if (printStartDate === printEndDate) return fmt(printStartDate);
        return `${fmt(printStartDate)} s/d ${fmt(printEndDate)}`;
      }
      if (printStartDate) return `Mulai ${fmt(printStartDate)}`;
      if (printEndDate) return `Sampai ${fmt(printEndDate)}`;
      return 'Rentang Tanggal Kustom';
    }
    return 'Semua Periode';
  }, [printTimeFilter, printStartDate, printEndDate]);

  const formattedPrintClassLabel = useMemo(() => {
    if (printClassFilter === 'all') return 'Semua Kelas (Seluruh Rombel)';
    const matched = rombelList.find(
      (r) =>
        r.id === printClassFilter ||
        r.nama_kelas.trim().toLowerCase() === printClassFilter.trim().toLowerCase()
    );
    const kName = matched ? matched.nama_kelas : printClassFilter;
    return /^kelas\s+/i.test(kName) ? kName : `Kelas ${kName}`;
  }, [printClassFilter, rombelList]);

  const formattedPrintStatusLabel = useMemo(() => {
    if (printStatusFilter === 'hadir_tepat') return 'Hadir Tepat Waktu';
    if (printStatusFilter === 'hadir_telat') return 'Terlambat';
    if (printStatusFilter === 'izin_sakit') return 'Izin / Sakit';
    if (printStatusFilter === 'alpa') return 'Belum Presensi / Alpa';
    return 'Semua Status Kehadiran';
  }, [printStatusFilter]);

  const exportRowsToCsv = (rowsToExport: PrintableAttendanceRow[], suffix = '') => {
    if (rowsToExport.length === 0) {
      showToast('Tidak ada data presensi pada filter yang dipilih untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'Nama Siswa',
      'NISN',
      'Kelas',
      'Waktu Presensi',
      'Status Kehadiran',
      'Metode / Keterangan',
    ];
    const csvRows = rowsToExport.map((row, idx) =>
      [
        idx + 1,
        `"${row.studentName.replace(/"/g, '""')}"`,
        `"${row.studentNisn}"`,
        `"${row.kelasName}"`,
        `"${row.waktuFormatted}"`,
        `"${row.statusLabel}"`,
        `"${row.metodeOrKeterangan.replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanSuffix = suffix ? `_${suffix.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    link.download = `Laporan_Presensi_Siswa${cleanSuffix}_${formatLocalYMD(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    sound.playSuccess();
    showToast('File Spreadsheet (CSV / Excel) berhasil diunduh!');
  };

  const handleExportCsv = () => {
    const currentRows: PrintableAttendanceRow[] = filteredLogs.map((log) => {
      const { studentName, studentNisn, kelasName } = resolveLogDetails(log);
      const timeStr = new Date(log.waktu).toLocaleString('id-ID');
      const statusLabel =
        log.status_kehadiran === 'hadir_tepat'
          ? 'Hadir Tepat Waktu'
          : log.status_kehadiran === 'hadir_telat'
          ? 'Terlambat'
          : log.status_kehadiran === 'pulang'
          ? 'Pulang'
          : log.status_kehadiran === 'izin'
          ? 'Izin'
          : 'Sakit';

      return {
        id: log.id,
        studentName,
        studentNisn,
        kelasName,
        waktuRaw: log.waktu,
        waktuFormatted: timeStr,
        statusCode: log.status_kehadiran,
        statusLabel,
        metodeOrKeterangan: log.keterangan
          ? `${log.metode || 'Manual'} (${log.keterangan})`
          : log.metode || 'Hybrid',
      };
    });
    exportRowsToCsv(currentRows, selectedClass);
  };

  /**
   * Render & Cetak Dokumen A4 Resmi Melalui Iframe Cetak Terisolasi (100% Bersih Tanpa Elemen UI Web)
   */
  const handlePrintOfficialA4 = () => {
    const schoolTitle = (schoolSettings.appTitle || DEFAULT_APP_TITLE).toUpperCase();
    const schoolSubtitle = schoolSettings.appSubtitle || DEFAULT_APP_SUBTITLE;
    const schoolLogo = schoolSettings.appLogo || '';
    const academicYear = schoolSettings.academicYear || '2025/2026';
    const semester = schoolSettings.semester || 'Ganjil';
    const tanggalCetakFormatted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const waktuCetakFormatted = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const tableRowsHtml =
      printReportData.rows.length === 0
        ? `<tr><td colspan="7" style="text-align:center; padding: 24px; color:#64748b;">Tidak ada data presensi siswa pada kombinasi filter yang dipilih.</td></tr>`
        : printReportData.rows
            .map((row, idx) => {
              let statusColor = '#047857';
              if (row.statusCode === 'hadir_telat') statusColor = '#b45309';
              else if (row.statusCode === 'izin' || row.statusCode === 'sakit') statusColor = '#6d28d9';
              else if (row.statusCode === 'alpa') statusColor = '#be123c';
              else if (row.statusCode === 'pulang') statusColor = '#0369a1';

              return `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td><strong>${escapeHtml(row.studentName)}</strong></td>
                  <td style="text-align:center; font-family:monospace;">${escapeHtml(row.studentNisn)}</td>
                  <td style="text-align:center;">${escapeHtml(row.kelasName)}</td>
                  <td style="white-space:nowrap; font-family:monospace; font-size:8pt;">${escapeHtml(row.waktuFormatted)}</td>
                  <td style="text-align:center; font-weight:700; color:${statusColor};">${escapeHtml(row.statusLabel)}</td>
                  <td>${escapeHtml(row.metodeOrKeterangan)}</td>
                </tr>
              `;
            })
            .join('');

    const shortClassSuffix =
      printClassFilter === 'all'
        ? ''
        : ` ${formattedPrintClassLabel.replace(/^Kelas\s+/i, '')}`;

    const htmlDocument = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Laporan Rekapitulasi Presensi Siswa - ${escapeHtml(schoolTitle)}</title>
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
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16pt;
          }
          .letterhead-center {
            flex: 1;
            text-align: center;
            padding: 0 12px;
          }
          .letterhead-title {
            font-size: 16pt;
            font-weight: 800;
            letter-spacing: 0.6px;
            margin: 0;
            text-transform: uppercase;
          }
          .letterhead-subtitle {
            font-size: 10pt;
            margin: 3px 0 2px 0;
            color: #334155;
          }
          .letterhead-academic {
            font-size: 9pt;
            font-weight: bold;
            color: #0f172a;
            margin-top: 2px;
          }
          .letterhead-doccode {
            font-size: 8.5pt;
            font-family: Arial, sans-serif;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #475569;
            margin-top: 3px;
          }
          .report-heading {
            text-align: center;
            margin-bottom: 14px;
          }
          .report-heading h2 {
            font-size: 13pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 0 0 4px 0;
            text-transform: uppercase;
          }
          .report-heading p {
            font-size: 9.5pt;
            margin: 0;
            color: #334155;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 16px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 14px;
            font-family: Arial, sans-serif;
            font-size: 9pt;
          }
          .summary-boxes {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
            font-family: Arial, sans-serif;
          }
          .summary-box {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 7px 10px;
            text-align: center;
          }
          .summary-box .label {
            font-size: 7.5pt;
            text-transform: uppercase;
            color: #64748b;
            font-weight: bold;
          }
          .summary-box .val {
            font-size: 11pt;
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
            <div class="letterhead-academic">TAHUN AJARAN ${escapeHtml(academicYear)} — SEMESTER ${escapeHtml(semester.toUpperCase())}</div>
            <div class="letterhead-doccode">DOKUMEN RESMI ADMINISTRASI PRESENSI &amp; KESISWAAN</div>
          </div>
          <div style="width:68px;"></div>
        </div>

        <div class="report-heading">
          <h2>LAPORAN REKAPITULASI PRESENSI SISWA</h2>
          <p>Periode Laporan: <strong>${escapeHtml(formattedPrintPeriodLabel)}</strong> · Status: <strong>${escapeHtml(formattedPrintStatusLabel)}</strong></p>
        </div>

        <div class="meta-grid">
          <div><strong>Kelas / Rombel:</strong> ${escapeHtml(formattedPrintClassLabel)}</div>
          <div><strong>Wali Kelas:</strong> ${escapeHtml(waliKelasName || 'Hesti Supriyani, S.Pd.I')}</div>
          <div><strong>Periode Tanggal:</strong> ${escapeHtml(formattedPrintPeriodLabel)}</div>
          <div><strong>Waktu Cetak:</strong> ${escapeHtml(tanggalCetakFormatted)}, Pukul ${escapeHtml(waktuCetakFormatted)}</div>
        </div>

        <div class="summary-boxes">
          <div class="summary-box">
            <div class="label">Hadir Tepat Waktu</div>
            <div class="val" style="color:#047857;">${printReportData.stats.hadirTepat} Siswa</div>
          </div>
          <div class="summary-box">
            <div class="label">Terlambat</div>
            <div class="val" style="color:#b45309;">${printReportData.stats.terlambat} Siswa</div>
          </div>
          <div class="summary-box">
            <div class="label">Izin / Sakit</div>
            <div class="val" style="color:#6d28d9;">${printReportData.stats.izinSakit} Siswa</div>
          </div>
          <div class="summary-box">
            <div class="label">Belum Presensi / Alpa</div>
            <div class="val" style="color:#be123c;">${printReportData.stats.alpa} Siswa</div>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width:28px; text-align:center;">No</th>
              <th style="width:140px;">Nama Siswa</th>
              <th style="width:82px; text-align:center;">NISN</th>
              <th style="width:60px; text-align:center;">Kelas</th>
              <th style="width:105px;">Waktu Presensi</th>
              <th style="width:105px; text-align:center;">Status Kehadiran</th>
              <th>Metode / Keterangan</th>
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
            <div><strong>Petugas Piket / Kesiswaan</strong></div>
            <div class="sig-space"></div>
            <div class="sig-name">${escapeHtml(petugasBkName || 'Guru BK / Kesiswaan')}</div>
            <div class="sig-nip">${escapeHtml(petugasBkNip || 'NIP. -')}</div>
          </div>
          <div class="sig-block">
            <div>${escapeHtml(kotaCetak || 'Jakarta')}, ${escapeHtml(tanggalCetakFormatted)}</div>
            <div><strong>Wali Kelas${escapeHtml(shortClassSuffix)}</strong></div>
            <div class="sig-space"></div>
            <div class="sig-name">${escapeHtml(waliKelasName || 'Hesti Supriyani, S.Pd.I')}</div>
            <div class="sig-nip">${escapeHtml(waliKelasNip || 'NIP. -')}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const existingIframe = document.getElementById('attendance-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'attendance-print-iframe';
      iframe.className = 'fixed right-0 bottom-0 w-0 h-0 border-0 pointer-events-none';
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
      }
    } catch (err) {
      console.error('Gagal membuka dialog cetak A4:', err);
      showToast('Gagal menyiapkan dokumen cetak A4.');
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-cyan-600 text-white shadow-xl backdrop-blur-xl flex items-center gap-2 text-xs font-semibold print:hidden">
          <Check className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Title & Export Buttons */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span> Rekap &amp; Laporan Presensi
          </h2>
          <p className="text-xs text-gray-500">
            Analisis kehadiran siswa secara real-time, tersinkronisasi penuh dengan Kalender Pendidikan &amp; Jadwal Harian Rombel.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Download className="w-4 h-4 text-slate-600 shrink-0" />
            <span>Unduh Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenPrintModal}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
          >
            <Printer className="w-4 h-4 text-white shrink-0" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Holiday Synchronization Banner */}
      {todayHolidayCheck.isHoliday && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-sm print:hidden">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">
                Status Hari Ini ({todayHolidayCheck.hariNama}, {todayYMD}): Hari Libur
              </span>
              <span className="block text-[11px] text-amber-700 mt-0.5">
                {todayHolidayCheck.reason} — Siswa tidak dihitung Belum Presensi / Alfa pada hari libur.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] font-bold shrink-0">
            LIBUR AKTIF
          </span>
        </div>
      )}

      {/* 4 Summary Cards (Grid 2x2 on Mobile, 4 Columns on Desktop) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 print:hidden">
        {/* Card 1: Total Hadir */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Total Hadir</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 font-mono mt-1 leading-none">
                {totalHadir}
              </h3>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 truncate block">
            Tepat &amp; Telat
          </span>
        </div>

        {/* Card 2: Terlambat */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Terlambat</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 font-mono mt-1 leading-none">
                {totalTerlambat}
              </h3>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 truncate block">
            Lewat batas toleransi
          </span>
        </div>

        {/* Card 3: Izin / Sakit */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Izin / Sakit</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 font-mono mt-1 leading-none">
                {totalIzinSakit}
              </h3>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 truncate block">
            Tercatat di jurnal
          </span>
        </div>

        {/* Card 4: Belum Presensi */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">
                Belum Presensi
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 font-mono mt-1 leading-none">
                {belumPresensi}
              </h3>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <span
            className="text-[10px] sm:text-xs text-slate-400 truncate block"
            title={absenceMetric.subtitle}
          >
            {absenceMetric.subtitle}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3.5 print:hidden overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          {/* MOBILE TIME FILTER DROPDOWN (<select> iOS Frosted Glass) */}
          <div className="space-y-2.5 w-full md:hidden">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              aria-label="Filter Periode Waktu"
              className="w-full px-3.5 py-2.5 bg-white/50 backdrop-blur border border-slate-200 rounded-xl text-sm font-medium text-slate-900 shadow-2xs focus:bg-white focus:outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              <option value="today">Hari Ini</option>
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="all">Semua Waktu</option>
              <option value="custom">Pilih Periode / Tanggal Kustom</option>
            </select>

            {/* Conditional Rendering untuk Input "Periode" (Mobile) */}
            {timeFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2.5 pt-0.5 transition-all duration-300">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Mulai Tanggal
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white/50 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-cyan-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Selesai Tanggal
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white/50 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-cyan-500 shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* DESKTOP TIME FILTER PILLS */}
          <div className="hidden md:flex items-center gap-2 overflow-x-auto py-1 px-1 no-scrollbar lg:w-auto">
            {(
              [
                { id: 'today', label: 'Hari Ini', hasCalendarIcon: false },
                { id: 'week', label: 'Minggu Ini', hasCalendarIcon: false },
                { id: 'month', label: 'Bulan Ini', hasCalendarIcon: false },
                { id: 'all', label: 'Semua', hasCalendarIcon: false },
                { id: 'custom', label: 'Periode', hasCalendarIcon: true },
              ] as const
            ).map((tab) => {
              const isActive = timeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeFilter(tab.id)}
                  className={`whitespace-nowrap flex-shrink-0 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-cyan-500 text-white shadow-sm font-semibold ring-1 ring-cyan-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {tab.hasCalendarIcon && (
                    <Calendar
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-white' : 'text-cyan-600'
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* DROPDOWN FILTER KELAS / ROMBEL */}
          <div className="w-full sm:w-auto shrink-0">
            <select
              value={selectedClass}
              onChange={(e) => {
                if (!isWaliKelas) setSelectedClass(e.target.value);
              }}
              disabled={isWaliKelas}
              className={`w-full sm:w-auto rounded-xl px-3.5 py-2.5 text-sm focus:outline-none font-medium shadow-2xs transition ${
                isWaliKelas
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold cursor-not-allowed'
                  : 'bg-white/50 backdrop-blur border border-slate-200 text-slate-900 focus:bg-white focus:border-cyan-500 cursor-pointer'
              }`}
            >
              {!isWaliKelas && <option value="all">Semua Kelas (Rombel)</option>}
              {rombelList
                .filter((r) => {
                  if (!isWaliKelas) return true;
                  const normWali = waliAssignedClass.toLowerCase().replace(/^kelas\s+/i, '').trim();
                  return (
                    r.id === selectedClass ||
                    r.nama_kelas.trim().toLowerCase() === normWali ||
                    r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
                  );
                })
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {isWaliKelas ? `Kelas Binaan: ${r.nama_kelas}` : r.nama_kelas}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
          {timeFilter === 'custom' && (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-gray-500">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-900 font-mono focus:outline-none shadow-sm"
              />
              <span className="text-gray-500">Hingga:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-900 font-mono focus:outline-none shadow-sm"
              />
            </div>
          )}

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa atau NISN..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-cyan-500 font-sans shadow-sm"
            />
          </div>

          <span className="text-xs text-gray-500 font-mono">
            {totalFilteredLogs === 0
              ? 'Menampilkan 0 data'
              : `Menampilkan ${reportStartIndex + 1}–${reportEndIndex} dari ${totalFilteredLogs} data`}
          </span>
        </div>
      </div>

      {/* Table & Mobile Card Section */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4 print:hidden">
        <div className="flex items-center justify-between gap-2 whitespace-nowrap">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 truncate">
            <span>📋</span>
            <span className="truncate">Riwayat &amp; Rekapitulasi Presensi</span>
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-xs text-cyan-700 font-mono font-bold shrink-0">
            {totalFilteredLogs} Entri
          </span>
        </div>

        {/* MOBILE CARD VIEW: DAFTAR PRESENSI VERTIKAL - EYEBROW LAYOUT (md:hidden) */}
        <div className="grid grid-cols-1 gap-2.5 md:hidden">
          {paginatedLogs.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              Tidak ada catatan presensi yang cocok dengan filter yang dipilih.
            </div>
          ) : (
            paginatedLogs.map((log) => {
              const { studentName, studentNisn, kelasName } = resolveLogDetails(log);
              const timeFormatted = new Date(log.waktu).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'medium',
              });

              let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              let statusText = 'Hadir Tepat';
              if (log.status_kehadiran === 'hadir_telat') {
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                statusText = 'Terlambat';
              } else if (log.status_kehadiran === 'pulang') {
                badgeColor = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                statusText = 'Pulang';
              } else if (log.status_kehadiran === 'izin') {
                badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
                statusText = 'Izin';
              } else if (log.status_kehadiran === 'sakit') {
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                statusText = 'Sakit';
              }

              const formattedClassLabel = /^kelas\s+/i.test(kelasName.trim())
                ? kelasName.trim()
                : `Kelas ${kelasName.trim()}`;

              return (
                <div
                  key={log.id}
                  className="ios-glass-card p-3.5 rounded-2xl border border-slate-200/90 space-y-2"
                >
                  {/* Baris 1: Eyebrow (Konteks Status Kehadiran & Kelas) */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${badgeColor}`}
                    >
                      {statusText}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--primary-accent-light)] text-[var(--primary-accent-text)] border border-[var(--primary-accent-border)] text-[10px] font-bold whitespace-nowrap">
                      {formattedClassLabel}
                    </span>
                  </div>

                  {/* Baris 2: Data Utama (Nama Siswa Lebar Penuh) */}
                  <div className="w-full font-bold text-slate-800 text-[13px] sm:text-sm leading-snug line-clamp-2">
                    {studentName}
                  </div>

                  {/* Baris 3: Detail Tambahan (Identitas NISN, Waktu Presensi & Metode) */}
                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center flex-wrap gap-2 min-w-0">
                      <span>
                        NISN: <strong className="font-mono text-slate-700">{studentNisn}</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                        <Clock className="w-3 h-3 text-[var(--primary-accent-text)] shrink-0" />
                        <span>{timeFormatted}</span>
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 shrink-0">
                      {log.metode || 'Hybrid'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW: TABEL HORIZONTAL (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-semibold pl-2">#</th>
                <th className="pb-3 font-semibold">Nama Siswa</th>
                <th className="pb-3 font-semibold">NISN</th>
                <th className="pb-3 font-semibold">Kelas</th>
                <th className="pb-3 font-semibold">Waktu Presensi</th>
                <th className="pb-3 font-semibold">Status Kehadiran</th>
                <th className="pb-3 font-semibold text-right pr-2">Metode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-gray-800">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 font-sans">
                    Tidak ada catatan presensi yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, idx) => {
                  const { studentName, studentNisn, kelasName } = resolveLogDetails(log);
                  const timeFormatted = new Date(log.waktu).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  });

                  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  let statusText = 'Hadir Tepat';
                  if (log.status_kehadiran === 'hadir_telat') {
                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    statusText = 'Terlambat';
                  } else if (log.status_kehadiran === 'pulang') {
                    badgeColor = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                    statusText = 'Pulang';
                  } else if (log.status_kehadiran === 'izin') {
                    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
                    statusText = 'Izin';
                  } else if (log.status_kehadiran === 'sakit') {
                    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                    statusText = 'Sakit';
                  }

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="py-3.5 pl-2 text-gray-400">
                        {reportStartIndex + idx + 1}
                      </td>
                      <td className="py-3.5 font-bold text-gray-900 font-sans">
                        {studentName}
                      </td>
                      <td className="py-3.5 text-cyan-600 font-semibold">{studentNisn}</td>
                      <td className="py-3.5 text-gray-600 font-sans">{kelasName}</td>
                      <td className="py-3.5 text-gray-600">{timeFormatted}</td>
                      <td className="py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${badgeColor}`}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2 text-gray-500 text-[11px]">
                        {log.metode || 'Hybrid'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Kontrol Navigasi Paginasi (10 data per halaman) */}
        {totalFilteredLogs > itemsPerPage && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
            <div className="text-[11px] text-slate-500 font-medium">
              Menampilkan{' '}
              <span className="font-bold text-slate-800 font-mono">
                {reportStartIndex + 1}–{reportEndIndex}
              </span>{' '}
              dari <span className="font-bold text-slate-800 font-mono">{totalFilteredLogs}</span>{' '}
              data presensi{' '}
              <span className="text-slate-400 font-mono">
                (Hal {safeReportPage} dari {totalReportPages})
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setReportPage((prev) => Math.max(1, prev - 1))}
                disabled={safeReportPage <= 1}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
              >
                &lt; Sebelumnya
              </button>
              <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold whitespace-nowrap">
                Hal {safeReportPage} dari {totalReportPages}
              </span>
              <button
                type="button"
                onClick={() => setReportPage((prev) => Math.min(totalReportPages, prev + 1))}
                disabled={safeReportPage >= totalReportPages}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
              >
                Berikutnya &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================
          MODAL 1: PUSAT KONFIGURASI CETAK & UNDUH LAPORAN PRESENSI RESMI (A4)
      ======================================================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-4 sm:p-6 md:p-8 print:hidden">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-8 border border-slate-200 shadow-2xl space-y-6 my-4 mb-24">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Pusat Cetak &amp; Unduh Laporan Presensi Resmi (A4)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Konfigurasi periode kehadiran, kelas binaan, filter status, dan pengesahan dokumen resmi sekolah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* 1. PERIODE LAPORAN PRESENSI */}
              <div className="space-y-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                    <Calendar className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>1. Periode Laporan Presensi</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'today', label: 'Hari Ini' },
                        { id: 'week', label: 'Minggu Ini' },
                        { id: 'month', label: 'Bulan Ini' },
                        { id: 'all', label: 'Semua Periode' },
                        { id: 'custom', label: 'Rentang Kustom' },
                      ] as const
                    ).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setPrintTimeFilter(preset.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          printTimeFilter === preset.id
                            ? 'bg-cyan-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {printTimeFilter === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70">
                    <div>
                      <span className="text-xs text-slate-500 font-semibold block mb-1.5">
                        Dari Tanggal:
                      </span>
                      <input
                        type="date"
                        value={printStartDate}
                        onChange={(e) => setPrintStartDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-semibold block mb-1.5">
                        Sampai Tanggal:
                      </span>
                      <input
                        type="date"
                        value={printEndDate}
                        onChange={(e) => setPrintEndDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. FILTER KELAS / ROMBEL & 3. PILIHAN STATUS KEHADIRAN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* 2. Filter Kelas / Rombel */}
                <div className="space-y-2 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <label className="text-slate-800 font-bold flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="flex items-center gap-2">
                      {isWaliKelas ? (
                        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Building2 className="w-4 h-4 text-cyan-600 shrink-0" />
                      )}
                      <span>2. Filter Kelas / Rombel</span>
                    </span>
                    {isWaliKelas && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Kelas Binaan
                      </span>
                    )}
                  </label>
                  <select
                    value={printClassFilter}
                    onChange={(e) => {
                      if (!isWaliKelas) setPrintClassFilter(e.target.value);
                    }}
                    disabled={isWaliKelas}
                    className={`w-full rounded-xl px-3.5 py-3 text-xs sm:text-sm font-semibold focus:outline-none ${
                      isWaliKelas
                        ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'bg-white border border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  >
                    {!isWaliKelas && <option value="all">Semua Kelas (Seluruh Rombel)</option>}
                    {rombelList
                      .filter((r) => {
                        if (!isWaliKelas) return true;
                        const normWali = waliAssignedClass
                          .toLowerCase()
                          .replace(/^kelas\s+/i, '')
                          .trim();
                        return (
                          r.id === printClassFilter ||
                          r.nama_kelas.trim().toLowerCase() === normWali ||
                          r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
                        );
                      })
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Kelas {r.nama_kelas} — Wali: {r.nama_wali_kelas || waliKelasName || '-'}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 3. Pilihan Status Kehadiran */}
                <div className="space-y-2 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <label className="text-slate-800 font-bold flex items-center gap-2 text-xs sm:text-sm">
                    <Filter className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>3. Pilihan Status Kehadiran</span>
                  </label>
                  <select
                    value={printStatusFilter}
                    onChange={(e) => setPrintStatusFilter(e.target.value as PrintStatusFilter)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">Semua Status Kehadiran</option>
                    <option value="hadir_tepat">Hadir Tepat Waktu</option>
                    <option value="hadir_telat">Terlambat</option>
                    <option value="izin_sakit">Izin / Sakit</option>
                    <option value="alpa">Belum Presensi / Alpa</option>
                  </select>
                </div>
              </div>

              {/* 4. IDENTITAS PENANDATANGAN DOKUMEN RESMI (BAGIAN BAWAH LAPORAN A4) */}
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
                      <span className="text-[11px] text-slate-500">Tersinkronisasi Global</span>
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
                      Petugas Piket / Kesiswaan
                    </label>
                    <input
                      type="text"
                      value={petugasBkName}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) =>
                        handleUpdateMasterSignatory('petugasBkName', e.target.value)
                      }
                      placeholder="Nama Petugas Piket / Kesiswaan"
                      className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none ${
                        !canEditSignatories
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-white text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1.5">
                      NIP Petugas Piket / Kesiswaan
                    </label>
                    <input
                      type="text"
                      value={petugasBkNip}
                      readOnly={!canEditSignatories}
                      disabled={!canEditSignatories}
                      onChange={(e) =>
                        handleUpdateMasterSignatory('petugasBkNip', e.target.value)
                      }
                      placeholder="NIP Petugas Piket / Kesiswaan"
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

              {/* RINGKASAN STATISTIK KEHADIRAN REAL-TIME */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cyan-50/60 border border-cyan-200 rounded-2xl p-4 sm:p-5 text-center">
                <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-100">
                  <span className="text-[11px] font-semibold text-emerald-700 block">
                    Hadir Tepat Waktu
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-emerald-600 font-mono tabular-nums mt-0.5 block">
                    {printReportData.stats.hadirTepat} Siswa
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/90 border border-amber-100">
                  <span className="text-[11px] font-semibold text-amber-700 block">
                    Terlambat
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-amber-600 font-mono tabular-nums mt-0.5 block">
                    {printReportData.stats.terlambat} Siswa
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/90 border border-purple-100">
                  <span className="text-[11px] font-semibold text-purple-700 block">
                    Izin / Sakit
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-purple-600 font-mono tabular-nums mt-0.5 block">
                    {printReportData.stats.izinSakit} Siswa
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/90 border border-rose-100">
                  <span className="text-[11px] font-semibold text-rose-700 block">
                    Belum Presensi / Alpa
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-rose-600 font-mono tabular-nums mt-0.5 block">
                    {printReportData.stats.alpa} Siswa
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Aksi Cetak & Unduh */}
            <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition active:scale-95 text-center"
              >
                ← Kembali ke Rekap Presensi
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    exportRowsToCsv(
                      printReportData.rows,
                      `${formattedPrintClassLabel}_${printStatusFilter}`
                    )
                  }
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Download className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>📥 Unduh CSV / Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(true)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <span>🖨️ Cetak / Unduh Laporan Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 2: PRATINJAU DOKUMEN RESMI A4 & CETAK LANGSUNG (TANPA ELEMEN UI WEB)
      ======================================================================== */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-[55] bg-slate-900/80 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex flex-col items-center">
          {/* Toolbar Kontrol di Atas Kertas A4 */}
          <div className="w-full max-w-[210mm] bg-slate-900 text-white rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2 shadow-xl border border-slate-700 print:hidden">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold">
                  Pratinjau Dokumen Resmi A4 — Laporan Rekapitulasi Presensi Siswa
                </h3>
                <p className="text-[11px] text-slate-400">
                  Klik &quot;Cetak / Simpan PDF (A4)&quot; untuk mencetak kertas A4 bersih tanpa elemen navigasi web
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                ← Ubah Filter
              </button>
              <button
                type="button"
                onClick={handlePrintOfficialA4}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF (A4)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPrintPreviewOpen(false);
                  setIsPrintModalOpen(false);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                title="Tutup Pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Kertas A4 Resmi */}
          <div className="w-full max-w-[210mm] bg-white text-slate-900 rounded-xl shadow-2xl p-6 sm:p-10 mb-20 border border-slate-200 font-serif">
            {/* a. Kop Resmi Sekolah */}
            <div className="flex items-center justify-between border-b-4 border-double border-slate-900 pb-4 mb-5 gap-4">
              <div className="shrink-0">
                {schoolSettings.appLogo ? (
                  <img
                    src={schoolSettings.appLogo}
                    alt="Logo Instansi"
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-slate-900 flex items-center justify-center font-extrabold text-xl">
                    {(schoolSettings.appTitle || DEFAULT_APP_TITLE).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="text-center flex-1">
                <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide text-slate-900">
                  {schoolSettings.appTitle || DEFAULT_APP_TITLE}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  {schoolSettings.appSubtitle || DEFAULT_APP_SUBTITLE}
                </p>
                <p className="text-[11px] font-bold text-slate-800 mt-1">
                  TAHUN AJARAN {schoolSettings.academicYear || '2025/2026'} — SEMESTER{' '}
                  {(schoolSettings.semester || 'Ganjil').toUpperCase()}
                </p>
                <p className="text-[10px] font-sans uppercase tracking-widest text-slate-500 mt-0.5">
                  DOKUMEN RESMI ADMINISTRASI PRESENSI &amp; KESISWAAN
                </p>
              </div>

              <div className="w-16 shrink-0 hidden sm:block" />
            </div>

            {/* b. Judul Dokumen & Informasi Kelas / Periode */}
            <div className="text-center mb-4">
              <h2 className="text-sm sm:text-base font-bold uppercase underline tracking-wide">
                LAPORAN REKAPITULASI PRESENSI SISWA
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Periode: <strong>{formattedPrintPeriodLabel}</strong> · Status:{' '}
                <strong>{formattedPrintStatusLabel}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4 font-sans text-xs">
              <div>
                <span className="text-slate-500">Kelas / Rombel:</span>{' '}
                <strong className="text-slate-900">{formattedPrintClassLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500">Wali Kelas:</span>{' '}
                <strong className="text-slate-900">
                  {waliKelasName || 'Hesti Supriyani, S.Pd.I'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Periode Tanggal:</span>{' '}
                <strong className="text-slate-900">{formattedPrintPeriodLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500">Waktu Cetak:</span>{' '}
                <strong className="text-slate-900">
                  {new Date().toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            </div>

            {/* c. Ringkasan Statistik Kehadiran */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 font-sans text-center">
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Hadir Tepat Waktu
                </div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono mt-0.5">
                  {printReportData.stats.hadirTepat} Siswa
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-amber-700">
                  Terlambat
                </div>
                <div className="text-sm sm:text-base font-extrabold text-amber-700 font-mono mt-0.5">
                  {printReportData.stats.terlambat} Siswa
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-purple-700">
                  Izin / Sakit
                </div>
                <div className="text-sm sm:text-base font-extrabold text-purple-700 font-mono mt-0.5">
                  {printReportData.stats.izinSakit} Siswa
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase text-rose-700">
                  Belum Presensi / Alpa
                </div>
                <div className="text-sm sm:text-base font-extrabold text-rose-700 font-mono mt-0.5">
                  {printReportData.stats.alpa} Siswa
                </div>
              </div>
            </div>

            {/* d. Tabel Presensi Formal */}
            <div className="overflow-x-auto mb-8 font-sans">
              <table className="w-full border-collapse border border-slate-500 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 uppercase font-bold">
                    <th className="border border-slate-500 py-2 px-2 text-center w-8">No</th>
                    <th className="border border-slate-500 py-2 px-2.5 text-left">Nama Siswa</th>
                    <th className="border border-slate-500 py-2 px-2 text-center">NISN</th>
                    <th className="border border-slate-500 py-2 px-2 text-center">Kelas</th>
                    <th className="border border-slate-500 py-2 px-2.5 text-left">
                      Waktu Presensi
                    </th>
                    <th className="border border-slate-500 py-2 px-2 text-center">
                      Status Kehadiran
                    </th>
                    <th className="border border-slate-500 py-2 px-2.5 text-left">
                      Metode / Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printReportData.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-400 py-8 text-center text-slate-500"
                      >
                        Tidak ada data presensi siswa pada kombinasi filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    printReportData.rows.map((row, idx) => {
                      let statusTextColor = 'text-emerald-700';
                      if (row.statusCode === 'hadir_telat') statusTextColor = 'text-amber-700';
                      else if (row.statusCode === 'izin' || row.statusCode === 'sakit')
                        statusTextColor = 'text-purple-700';
                      else if (row.statusCode === 'alpa') statusTextColor = 'text-rose-700';
                      else if (row.statusCode === 'pulang') statusTextColor = 'text-cyan-700';

                      return (
                        <tr key={row.id} className="odd:bg-white even:bg-slate-50/50">
                          <td className="border border-slate-400 py-2 px-2 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-400 py-2 px-2.5 font-bold text-slate-900">
                            {row.studentName}
                          </td>
                          <td className="border border-slate-400 py-2 px-2 text-center font-mono">
                            {row.studentNisn}
                          </td>
                          <td className="border border-slate-400 py-2 px-2 text-center font-semibold">
                            {row.kelasName}
                          </td>
                          <td className="border border-slate-400 py-2 px-2.5 whitespace-nowrap font-mono text-[10px]">
                            {row.waktuFormatted}
                          </td>
                          <td
                            className={`border border-slate-400 py-2 px-2 text-center font-bold ${statusTextColor}`}
                          >
                            {row.statusLabel}
                          </td>
                          <td className="border border-slate-400 py-2 px-2.5 text-slate-700">
                            {row.metodeOrKeterangan}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* e. Blok Pengesahan & Tanda Tangan Resmi */}
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
                <p className="font-bold">Petugas Piket / Kesiswaan</p>
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
                  Wali Kelas
                  {printClassFilter !== 'all'
                    ? ` ${formattedPrintClassLabel.replace(/^Kelas\s+/i, '')}`
                    : ''}
                </p>
                <div className="h-20" />
                <p className="font-bold underline">
                  {waliKelasName || 'Hesti Supriyani, S.Pd.I'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{waliKelasNip || 'NIP. -'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
