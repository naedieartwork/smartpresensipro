import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Calendar,
  Clock,
  User,
  Trash2,
  Edit2,
  Check,
  X,
  CalendarDays,
  School,
  Megaphone,
  Pin,
  Send,
  Filter,
  Lock,
} from 'lucide-react';
import {
  KalenderPendidikan,
  JadwalPelajaran,
  Rombel,
  Announcement,
  AnnouncementCategory,
  AppUser,
} from '../types';
import { supabaseService } from '../services/supabaseClient';
import { sound } from '../utils/audio';

type ScheduleTab = 'jadwal_kelas' | 'kalender' | 'pengumuman';

interface ScheduleManagerProps {
  currentUser?: AppUser | null;
}

const getInitialEffectiveDay = (): string => {
  const dayIndex = new Date().getDay();
  const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const currentDayName = daysMap[dayIndex];
  const effectiveDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  return effectiveDays.includes(currentDayName) ? currentDayName : 'Senin';
};

const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleaned = String(timeStr).trim().replace('.', ':');
  const [hStr, mStr] = cleaned.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
};

const sortSchedulesChronologically = (items: JadwalPelajaran[]): JadwalPelajaran[] => {
  return [...items].sort((a, b) => {
    const startDiff = parseTimeToMinutes(a.jam_mulai) - parseTimeToMinutes(b.jam_mulai);
    if (startDiff !== 0) return startDiff;
    return parseTimeToMinutes(a.jam_selesai) - parseTimeToMinutes(b.jam_selesai);
  });
};

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('jadwal_kelas');

  // Rombel List & Selected Rombel
  const [rombelList, setRombelList] = useState<Rombel[]>([]);
  const [selectedRombelId, setSelectedRombelId] = useState<string>('');

  // Day Filter State (Default to current workday or Senin)
  const [selectedDay, setSelectedDay] = useState<string>(getInitialEffectiveDay);

  // Jadwal Pelajaran State
  const [jadwalList, setJadwalList] = useState<JadwalPelajaran[]>([]);
  const [isJadwalModalOpen, setIsJadwalModalOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<JadwalPelajaran | null>(null);

  // Form Jadwal State
  const [formRombelId, setFormRombelId] = useState('');
  const [formHari, setFormHari] = useState('Senin');
  const [formJamMulai, setFormJamMulai] = useState('07:15');
  const [formJamSelesai, setFormJamSelesai] = useState('08:45');
  const [formMapel, setFormMapel] = useState('');
  const [formGuru, setFormGuru] = useState('');

  // Kalender Pendidikan State
  const [kalenderList, setKalenderList] = useState<KalenderPendidikan[]>([]);
  const [isKalenderModalOpen, setIsKalenderModalOpen] = useState(false);
  const [formMulai, setFormMulai] = useState('');
  const [formSelesai, setFormSelesai] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formJenis, setFormJenis] = useState<KalenderPendidikan['jenis']>('Libur Nasional');

  // Pengumuman State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementFilter, setAnnouncementFilter] = useState<'Semua' | AnnouncementCategory>('Semua');
  const [formAnnJudul, setFormAnnJudul] = useState('');
  const [formAnnKategori, setFormAnnKategori] = useState<AnnouncementCategory>('Penting');
  const [formAnnTargetRombel, setFormAnnTargetRombel] = useState('Semua Kelas');
  const [formAnnTanggal, setFormAnnTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [formAnnIsi, setFormAnnIsi] = useState('');
  const [formAnnPinned, setFormAnnPinned] = useState(false);
  const [formAnnBroadcastWa, setFormAnnBroadcastWa] = useState(false);
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    const [rData, kData, aData] = await Promise.all([
      supabaseService.getRombel(),
      supabaseService.getKalenderPendidikan(),
      supabaseService.getAnnouncements(),
    ]);
    setRombelList(rData);
    setKalenderList(kData);
    setAnnouncements(aData);
  };

  const loadJadwal = async (rombelId: string) => {
    if (!rombelId) {
      setJadwalList([]);
      return;
    }

    const matchedRombel = rombelList.find((r) => r.id === rombelId);
    const is1A = matchedRombel && matchedRombel.nama_kelas.trim().toLowerCase() === '1a';

    let data = await supabaseService.getJadwalPelajaran(rombelId);

    // Jika rombel 1A dipilih dan belum memiliki jadwal, isi otomatis dengan 20 item KBM Senin-Jumat
    if (is1A && data.length === 0) {
      data = await supabaseService.ensure1AScheduleSeeded(rombelId);
      showToast('Jadwal Pelajaran Kelas 1A (Senin s.d. Jumat) otomatis diisi & tersimpan di database!');
    }

    setJadwalList(sortSchedulesChronologically(data));
  };

  const isWaliKelas = currentUser?.role === 'Wali Kelas';
  const canManageAcademic =
    !currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin';
  const waliAssignedClass = String(
    currentUser?.assignedClass || currentUser?.assigned_class || (isWaliKelas ? '1A' : '')
  ).trim();

  useEffect(() => {
    loadData();
    const unsub = supabaseService.subscribe(() => {
      loadData();
      if (selectedRombelId) loadJadwal(selectedRombelId);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isWaliKelas && waliAssignedClass && rombelList.length > 0) {
      const normWali = waliAssignedClass.toLowerCase().replace(/^kelas\s+/i, '').trim();
      const matched = rombelList.find(
        (r) =>
          r.id.toLowerCase() === normWali ||
          r.nama_kelas.trim().toLowerCase() === normWali ||
          r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
      );
      if (matched && selectedRombelId !== matched.id) {
        setSelectedRombelId(matched.id);
      }
    }
  }, [isWaliKelas, waliAssignedClass, rombelList, selectedRombelId]);

  useEffect(() => {
    if (selectedRombelId) {
      loadJadwal(selectedRombelId);
    }
  }, [selectedRombelId, rombelList]);

  useEffect(() => {
    if (activeTab === 'pengumuman') {
      supabaseService.getAnnouncements().then((data) => {
        setAnnouncements(data);
      });
    }
  }, [activeTab]);

  // Jadwal Handlers
  const handleOpenAddJadwal = () => {
    if (!canManageAcademic) return;
    setEditingJadwal(null);
    setFormRombelId(selectedRombelId || '');
    setFormHari(selectedDay !== 'Semua' ? selectedDay : 'Senin');
    setFormJamMulai('07:15');
    setFormJamSelesai('08:45');
    setFormMapel('');
    setFormGuru('');
    if (!selectedRombelId) {
      showToast('Pilih kelas terlebih dahulu pada form tambah jadwal.');
    }
    setIsJadwalModalOpen(true);
  };

  const handleOpenEditJadwal = (item: JadwalPelajaran) => {
    if (!canManageAcademic) return;
    setEditingJadwal(item);
    setFormRombelId(item.rombel_id);
    setFormHari(item.hari);
    setFormJamMulai(item.jam_mulai);
    setFormJamSelesai(item.jam_selesai);
    setFormMapel(item.mata_pelajaran);
    setFormGuru(item.guru_pengampu);
    setIsJadwalModalOpen(true);
  };

  const handleJadwalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAcademic) return;
    if (!formMapel.trim() || !formGuru.trim() || !formRombelId) {
      alert('Mata pelajaran, guru pengampu, dan kelas wajib diisi!');
      return;
    }

    if (editingJadwal) {
      await supabaseService.updateJadwalPelajaran(editingJadwal.id, {
        rombel_id: formRombelId,
        hari: formHari,
        jam_mulai: formJamMulai,
        jam_selesai: formJamSelesai,
        mata_pelajaran: formMapel.trim(),
        guru_pengampu: formGuru.trim(),
      });
      sound.playSuccess();
      showToast('Jadwal pelajaran berhasil diperbarui!');
    } else {
      await supabaseService.addJadwalPelajaran({
        rombel_id: formRombelId,
        hari: formHari,
        jam_mulai: formJamMulai,
        jam_selesai: formJamSelesai,
        mata_pelajaran: formMapel.trim(),
        guru_pengampu: formGuru.trim(),
      });
      sound.playSuccess();
      showToast('Jadwal pelajaran berhasil ditambahkan!');
    }

    setIsJadwalModalOpen(false);
    setSelectedRombelId(formRombelId);
    loadJadwal(formRombelId);
  };

  const handleDeleteJadwal = async (id: string, mapel: string) => {
    if (!canManageAcademic) return;
    if (confirm(`Yakin ingin menghapus jadwal "${mapel}"?`)) {
      await supabaseService.deleteJadwalPelajaran(id);
      sound.playAlert();
      showToast('Jadwal berhasil dihapus.');
      if (selectedRombelId) loadJadwal(selectedRombelId);
    }
  };

  // Kalender Handlers
  const handleAddKalenderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAcademic) return;
    if (!formMulai || !formSelesai || !formKeterangan.trim()) {
      alert('Tanggal mulai, tanggal selesai, dan keterangan wajib diisi!');
      return;
    }

    await supabaseService.addKalender({
      tanggal_mulai: formMulai,
      tanggal_selesai: formSelesai,
      keterangan: formKeterangan.trim(),
      jenis: formJenis,
    });

    sound.playSuccess();
    showToast('Agenda kalender pendidikan berhasil ditambahkan!');
    setIsKalenderModalOpen(false);
    setFormMulai('');
    setFormSelesai('');
    setFormKeterangan('');
    setFormJenis('Libur Nasional');
    const kData = await supabaseService.getKalenderPendidikan();
    setKalenderList(kData);
  };

  const handleDeleteKalender = async (id: string, ket: string) => {
    if (!canManageAcademic) return;
    if (confirm(`Apakah Anda yakin ingin menghapus agenda "${ket}"?`)) {
      await supabaseService.deleteKalender(id);
      sound.playAlert();
      showToast('Agenda berhasil dihapus.');
      const kData = await supabaseService.getKalenderPendidikan();
      setKalenderList(kData);
    }
  };

  // Pengumuman Handlers
  const handleOpenCreateAnnouncement = () => {
    if (!canManageAcademic) return;
    setFormAnnJudul('');
    setFormAnnKategori('Penting');
    setFormAnnTargetRombel('Semua Kelas');
    setFormAnnTanggal(new Date().toISOString().slice(0, 10));
    setFormAnnIsi('');
    setFormAnnPinned(false);
    setFormAnnBroadcastWa(false);
    setIsAnnouncementModalOpen(true);
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAcademic) return;
    if (!formAnnJudul.trim() || !formAnnIsi.trim()) {
      alert('Judul dan isi pengumuman wajib diisi!');
      return;
    }

    setIsSubmittingAnn(true);
    try {
      const { broadcastCount } = await supabaseService.addAnnouncement({
        judul: formAnnJudul.trim(),
        isi: formAnnIsi.trim(),
        kategori: formAnnKategori,
        target_rombel: formAnnTargetRombel,
        tanggal: formAnnTanggal || new Date().toISOString().slice(0, 10),
        is_pinned: formAnnPinned,
        broadcast_wa: formAnnBroadcastWa,
      });

      sound.playSuccess();
      if (formAnnBroadcastWa) {
        showToast(
          broadcastCount > 0
            ? `Pengumuman diterbitkan & ${broadcastCount} pesan WA masuk ke Antrean Anti-Spam!`
            : 'Pengumuman diterbitkan! (Tidak ditemukan nomor WA wali pada target kelas tersebut)'
        );
      } else {
        showToast('Pengumuman baru berhasil diterbitkan ke Portal Siswa!');
      }

      setIsAnnouncementModalOpen(false);
      const updated = await supabaseService.getAnnouncements();
      setAnnouncements(updated);
    } catch (err: any) {
      alert('Gagal menyimpan pengumuman: ' + (err.message || String(err)));
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  const handleTogglePinAnnouncement = async (item: Announcement) => {
    try {
      await supabaseService.togglePinAnnouncement(item.id, Boolean(item.is_pinned));
      sound.playSuccess();
      showToast(
        item.is_pinned
          ? 'Sematan pengumuman dilepas.'
          : 'Pengumuman disematkan di urutan teratas!'
      );
      const updated = await supabaseService.getAnnouncements();
      setAnnouncements(updated);
    } catch (err: any) {
      alert('Gagal mengubah sematan pengumuman: ' + (err.message || String(err)));
    }
  };

  const handleDeleteAnnouncement = async (id: string, judul: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pengumuman "${judul}"?`)) {
      try {
        await supabaseService.deleteAnnouncement(id);
        sound.playAlert();
        showToast('Pengumuman berhasil dihapus.');
        const updated = await supabaseService.getAnnouncements();
        setAnnouncements(updated);
      } catch (err: any) {
        alert('Gagal menghapus pengumuman: ' + (err.message || String(err)));
      }
    }
  };

  const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const selectedRombel = rombelList.find((r) => r.id === selectedRombelId);

  const filteredAnnouncements =
    announcementFilter === 'Semua'
      ? announcements
      : announcements.filter((a) => a.kategori === announcementFilter);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-cyan-600 text-white shadow-xl backdrop-blur-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-150">
          <Check className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & 3-Tab Segmented Control */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Manajemen Akademik & Informasi Sekolah
              </h2>
              <p className="text-xs text-gray-500">
                Pusat pengaturan jadwal pelajaran per kelas, kalender pendidikan, dan pengumuman portal siswa/wali murid.
              </p>
            </div>
          </div>

          {canManageAcademic && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              {activeTab === 'jadwal_kelas' && (
                <button
                  onClick={handleOpenAddJadwal}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Jadwal Pelajaran</span>
                </button>
              )}

              {activeTab === 'kalender' && (
                <button
                  onClick={() => setIsKalenderModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Agenda Libur</span>
                </button>
              )}

              {activeTab === 'pengumuman' && (
                <button
                  onClick={handleOpenCreateAnnouncement}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Pengumuman</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 1-Row 3-Tab Segmented Control */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl w-full sm:w-fit sm:inline-flex border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('jadwal_kelas')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all duration-300 ease-out active:scale-95 ${
              activeTab === 'jadwal_kelas'
                ? 'bg-cyan-500 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                activeTab === 'jadwal_kelas' ? 'text-white' : 'text-cyan-600'
              }`}
            />
            <span>Mapel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kalender')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all duration-300 ease-out active:scale-95 ${
              activeTab === 'kalender'
                ? 'bg-cyan-500 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Calendar
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                activeTab === 'kalender' ? 'text-white' : 'text-cyan-600'
              }`}
            />
            <span>Kaldik</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pengumuman')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all duration-300 ease-out active:scale-95 ${
              activeTab === 'pengumuman'
                ? 'bg-cyan-500 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Megaphone
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                activeTab === 'pengumuman' ? 'text-white' : 'text-cyan-600'
              }`}
            />
            <span>Pengumuman</span>
            {announcements.length > 0 && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded-full font-bold shrink-0 leading-none ${
                  activeTab === 'pengumuman'
                    ? 'bg-white/20 text-white'
                    : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                }`}
              >
                {announcements.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: JADWAL PELAJARAN (CRUD) */}
      {activeTab === 'jadwal_kelas' && (
        <div className="space-y-4">
          {/* Class Selector Bar */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isWaliKelas ? (
                <Lock className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <School className="w-5 h-5 text-cyan-600 shrink-0" />
              )}
              <div className="w-full sm:w-72">
                <label className="text-[10px] text-gray-500 block mb-1 font-semibold uppercase tracking-wider">
                  {isWaliKelas ? 'Kelas Binaan Wali Kelas (Terkunci)' : 'Pilih Kelas (Rombel)'}
                </label>
                <select
                  value={selectedRombelId}
                  onChange={(e) => {
                    if (!isWaliKelas) setSelectedRombelId(e.target.value);
                  }}
                  disabled={isWaliKelas}
                  className={`w-full rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none shadow-sm ${
                    isWaliKelas
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 cursor-not-allowed'
                      : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                  }`}
                >
                  {!isWaliKelas && <option value="">-- Pilih Kelas Terlebih Dahulu --</option>}
                  {rombelList
                    .filter((r) => {
                      if (!isWaliKelas) return true;
                      const normWali = waliAssignedClass.toLowerCase().replace(/^kelas\s+/i, '').trim();
                      return (
                        r.id === selectedRombelId ||
                        r.nama_kelas.trim().toLowerCase() === normWali ||
                        r.nama_kelas.trim().toLowerCase() === waliAssignedClass.toLowerCase()
                      );
                    })
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Kelas {r.nama_kelas}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {selectedRombel && (
              <div className="text-xs text-gray-600 font-medium">
                Wali Kelas: <span className="font-bold text-gray-900">{selectedRombel.nama_wali_kelas}</span>
              </div>
            )}
          </div>

          {!selectedRombelId ? (
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
                <School className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Silakan pilih kelas terlebih dahulu untuk melihat jadwal</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Gunakan dropdown di atas untuk memilih rombongan belajar (kelas) yang ingin Anda kelola jadwal KBM-nya.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Day Filter Pills Navigation Bar */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-cyan-600" />
                    <span className="text-xs font-bold text-gray-900">Filter Hari Pelajaran:</span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200 font-bold self-start sm:self-auto">
                    Hari Aktif: {selectedDay === 'Semua' ? 'Semua Hari' : selectedDay}
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Semua Hari'].map((day) => {
                    const dayTarget = day === 'Semua Hari' ? 'Semua' : day;
                    const count = day === 'Semua Hari'
                      ? jadwalList.length
                      : jadwalList.filter((j) => j.hari === day).length;
                    const isActive = selectedDay === dayTarget || (day === 'Semua Hari' && selectedDay === 'Semua');

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(dayTarget)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border ${
                          isActive
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <span>{day}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold ${
                            isActive ? 'bg-white/25 text-white' : 'bg-gray-200/80 text-gray-700'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display schedule cards based on selectedDay filter */}
              {(() => {
                const activeDaysToRender = selectedDay === 'Semua' 
                  ? daysOrder 
                  : [selectedDay];

                const hasAnySchedule = activeDaysToRender.some(day => 
                  jadwalList.some(j => j.hari === day)
                );

                if (!hasAnySchedule) {
                  return (
                    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-12 text-center text-gray-500 text-xs space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-gray-900">
                        Belum ada jadwal pelajaran untuk {selectedDay === 'Semua' ? 'kelas ini' : `hari ${selectedDay}`}.
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        {canManageAcademic
                          ? 'Klik tombol "+ Tambah Jadwal Pelajaran" di atas untuk menambahkan sesi pelajaran baru.'
                          : 'Jadwal pelajaran untuk hari ini belum diatur oleh Admin sekolah.'}
                      </p>
                    </div>
                  );
                }

                return activeDaysToRender.map((day) => {
                  const daySchedules = sortSchedulesChronologically(
                    jadwalList.filter((j) => j.hari === day)
                  );
                  if (daySchedules.length === 0) return null;

                  return (
                    <div key={day} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-cyan-600" />
                          <span>Hari {day}</span>
                        </h3>
                        <span className="text-xs text-gray-600 font-mono font-bold bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                          {daySchedules.length} Sesi Pelajaran
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {daySchedules.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200 hover:border-cyan-300 transition shadow-2xs flex flex-col gap-2"
                          >
                            {/* Baris 1: Informasi Waktu Pelajaran (1 baris penuh tersendiri) */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-800 font-mono text-xs font-bold w-fit">
                              <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              <span>{item.jam_mulai} - {item.jam_selesai} WIB</span>
                            </div>

                            {/* Baris 2: Nama Mata Pelajaran (1 baris penuh tersendiri tanpa truncate) */}
                            <h4 className="text-sm font-bold text-gray-900 leading-snug w-full">
                              {item.mata_pelajaran}
                            </h4>

                            {/* Baris 3: Nama Guru Pengampu (beserta ikon kecilnya, 1 baris penuh tersendiri) */}
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium w-full">
                              <User className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              <span>{item.guru_pengampu}</span>
                            </div>

                            {/* Baris 4: Tombol aksi Edit dan Hapus (Hanya untuk Admin & Super Admin) */}
                            {canManageAcademic && (
                              <div className="flex items-center justify-start gap-2 pt-2 mt-1 border-t border-gray-200/80 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditJadwal(item)}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-cyan-50 text-cyan-700 border border-gray-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-98"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-cyan-600" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteJadwal(item.id, item.mata_pelajaran)}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-gray-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-98"
                                  title="Hapus Jadwal"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KALENDER PENDIDIKAN */}
      {activeTab === 'kalender' && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 text-cyan-600 shrink-0" />
              <span className="truncate">Daftar Agenda &amp; Hari Libur Operasional Sekolah</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold font-mono whitespace-nowrap shrink-0">
              {kalenderList.length} Agenda
            </span>
          </div>

          {/* MOBILE CARD VIEW: DAFTAR AGENDA KALDIK (md:hidden) */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {kalenderList.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-gray-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                Belum ada agenda kalender pendidikan yang tercatat.
              </div>
            ) : (
              kalenderList.map((item) => {
                const badgeColor =
                  item.jenis === 'Libur Nasional'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : item.jenis === 'Libur Semester'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-cyan-50 text-cyan-700 border-cyan-200';
                const dateRangeStr =
                  item.tanggal_mulai !== item.tanggal_selesai
                    ? `${item.tanggal_mulai} s.d. ${item.tanggal_selesai}`
                    : item.tanggal_mulai;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="font-bold text-slate-800 text-sm sm:text-base leading-snug">
                        {item.keterangan}
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-xs font-mono font-semibold text-slate-600 flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span>{dateRangeStr}</span>
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${badgeColor}`}
                        >
                          {item.jenis}
                        </span>
                      </div>
                    </div>

                    {canManageAcademic && (
                      <button
                        type="button"
                        onClick={() => handleDeleteKalender(item.id, item.keterangan)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 transition shrink-0 shadow-2xs"
                        title="Hapus Agenda"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW: DAFTAR AGENDA KALDIK (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="hidden sm:table-cell pb-3 font-semibold pl-2">#</th>
                  <th className="pb-3 font-semibold">Keterangan Agenda</th>
                  <th className="pb-3 font-semibold">Rentang Tanggal</th>
                  <th className="pb-3 font-semibold">Jenis Agenda</th>
                  {canManageAcademic && (
                    <th className="pb-3 font-semibold text-right pr-2">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kalenderList.length === 0 ? (
                  <tr>
                    <td colSpan={canManageAcademic ? 5 : 4} className="py-12 text-center text-gray-400">
                      Belum ada agenda kalender pendidikan yang tercatat.
                    </td>
                  </tr>
                ) : (
                  kalenderList.map((item, idx) => {
                    const badgeColor =
                      item.jenis === 'Libur Nasional'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : item.jenis === 'Libur Semester'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-cyan-50 text-cyan-700 border-cyan-200';

                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition group">
                        <td className="hidden sm:table-cell py-3.5 pl-2 font-mono text-gray-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 font-bold text-slate-800">{item.keterangan}</td>
                        <td className="py-3.5 font-mono text-gray-700 font-semibold whitespace-nowrap">
                          {item.tanggal_mulai}{' '}
                          {item.tanggal_mulai !== item.tanggal_selesai && `s.d. ${item.tanggal_selesai}`}
                        </td>
                        <td className="py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeColor}`}
                          >
                            {item.jenis}
                          </span>
                        </td>
                        {canManageAcademic && (
                          <td className="py-3.5 text-right pr-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteKalender(item.id, item.keterangan)}
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-rose-600 border border-gray-200 transition"
                              title="Hapus Agenda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PENGUMUMAN (PORTAL SISWA & BROADCAST WA) */}
      {activeTab === 'pengumuman' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filter Kategori Pengumuman (Dropdown iOS Frosted Glass) */}
          <div className="flex items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <select
                value={announcementFilter}
                onChange={(e) =>
                  setAnnouncementFilter(e.target.value as 'Semua' | AnnouncementCategory)
                }
                aria-label="Filter Kategori Pengumuman"
                className="w-full px-3.5 py-2.5 bg-white/50 backdrop-blur border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:bg-white focus:outline-none focus:border-cyan-500 transition cursor-pointer"
              >
                <option value="Semua">Semua Kategori ({announcements.length})</option>
                {(['Penting', 'Akademik', 'Kegiatan'] as const).map((cat) => {
                  const count = announcements.filter((a) => a.kategori === cat).length;
                  return (
                    <option key={cat} value={cat}>
                      {cat} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Daftar Kartu Pengumuman */}
          {filteredAnnouncements.length === 0 ? (
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-14 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Belum ada pengumuman pada kategori ini</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Klik tombol <strong>+ Buat Pengumuman</strong> di pojok kanan atas untuk menerbitkan informasi sekolah atau mengirim pengumuman ke WhatsApp wali murid.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAnnouncements.map((item) => {
                const categoryBadge =
                  item.kategori === 'Penting'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : item.kategori === 'Akademik'
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between space-y-4 transition ${
                      item.is_pinned
                        ? 'border-cyan-300 ring-1 ring-cyan-100'
                        : 'border-gray-200 hover:border-cyan-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${categoryBadge}`}>
                            {item.kategori.toUpperCase()}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1">
                            <School className="w-3 h-3 text-cyan-600" />
                            <span>Target: {item.target_rombel}</span>
                          </span>
                          {item.is_pinned && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Pin className="w-3 h-3 fill-current" />
                              <span>Disematkan</span>
                            </span>
                          )}
                          {item.broadcast_wa && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <Send className="w-2.5 h-2.5" />
                              <span>Broadcast WA</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-gray-400">{item.tanggal}</span>
                      </div>

                      {/* Judul & Isi Pengumuman */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 leading-snug">{item.judul}</h4>
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed whitespace-pre-wrap">
                          {item.isi}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions: Pin & Hapus (Hanya Admin & Super Admin) */}
                    {canManageAcademic && (
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                        <button
                          type="button"
                          onClick={() => handleTogglePinAnnouncement(item)}
                          className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 border ${
                            item.is_pinned
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? 'fill-current' : ''}`} />
                          <span>{item.is_pinned ? 'Lepas Sematan' : 'Sematkan (Pin)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(item.id, item.judul)}
                          className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-rose-50 text-rose-600 border border-gray-200 hover:border-rose-200 font-semibold transition flex items-center gap-1.5"
                          title="Hapus Pengumuman"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL TAMBAH/EDIT JADWAL PELAJARAN */}
      {isJadwalModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center pt-16 pb-24 sm:py-8 px-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-bold text-gray-900">
                {editingJadwal ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}
              </h3>
              <button
                type="button"
                onClick={() => setIsJadwalModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleJadwalSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3.5 text-xs"
            >
              {!formRombelId && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                  Silakan pilih kelas / rombel terlebih dahulu untuk menambahkan jadwal pelajaran.
                </div>
              )}
              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Pilih Kelas / Rombel *</label>
                <select
                  value={formRombelId}
                  onChange={(e) => setFormRombelId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm font-medium"
                  required
                >
                  <option value="">-- Pilih Kelas Terlebih Dahulu --</option>
                  {rombelList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Hari *</label>
                <select
                  value={formHari}
                  onChange={(e) => setFormHari(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm font-medium"
                >
                  {daysOrder.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Jam Mulai *</label>
                  <input
                    type="time"
                    value={formJamMulai}
                    onChange={(e) => setFormJamMulai(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-cyan-500 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Jam Selesai *</label>
                  <input
                    type="time"
                    value={formJamSelesai}
                    onChange={(e) => setFormJamSelesai(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-cyan-500 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Mata Pelajaran *</label>
                <input
                  type="text"
                  value={formMapel}
                  onChange={(e) => setFormMapel(e.target.value)}
                  placeholder="Contoh: Matematika Peminatan"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Guru Pengampu *</label>
                <input
                  type="text"
                  value={formGuru}
                  onChange={(e) => setFormGuru(e.target.value)}
                  placeholder="Contoh: Drs. Supriyanto"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                  required
                />
              </div>

              <div className="sticky bottom-0 bg-white/95 backdrop-blur-md flex justify-end gap-2 pt-3 pb-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsJadwalModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-gray-600 hover:text-gray-900 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {editingJadwal ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH AGENDA KALENDER */}
      {isKalenderModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center pt-16 pb-24 sm:py-8 px-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-bold text-gray-900">
                Tambah Agenda Libur / Kalender Pendidikan
              </h3>
              <button
                type="button"
                onClick={() => setIsKalenderModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddKalenderSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Tanggal Mulai *</label>
                  <input
                    type="date"
                    value={formMulai}
                    onChange={(e) => setFormMulai(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-cyan-500 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Tanggal Selesai *</label>
                  <input
                    type="date"
                    value={formSelesai}
                    onChange={(e) => setFormSelesai(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-cyan-500 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Jenis Agenda / Libur *</label>
                <select
                  value={formJenis}
                  onChange={(e) => setFormJenis(e.target.value as KalenderPendidikan['jenis'])}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                >
                  <option value="Libur Nasional">Libur Nasional</option>
                  <option value="Libur Semester">Libur Semester</option>
                  <option value="Kegiatan Khusus">Kegiatan Khusus</option>
                </select>
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Keterangan Agenda *</label>
                <input
                  type="text"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Contoh: Libur Hari Raya Idul Fitri"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-cyan-500 shadow-sm"
                  required
                />
              </div>

              <div className="sticky bottom-0 bg-white/95 backdrop-blur-md flex justify-end gap-2 pt-3 pb-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsKalenderModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-gray-600 hover:text-gray-900 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUAT PENGUMUMAN BARU */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center pt-16 pb-24 sm:py-8 px-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header Modal (Pinned) */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100 shrink-0 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate">
                    Buat Pengumuman Sekolah
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate">
                    Terbitkan ke Portal Siswa &amp; Broadcast WA Wali Murid
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1.5 rounded-xl hover:bg-gray-100 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Area Isi Formulir yang Dapat Digulir Mandiri */}
            <form
              onSubmit={handleAnnouncementSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Judul Pengumuman *</label>
                <input
                  type="text"
                  value={formAnnJudul}
                  onChange={(e) => setFormAnnJudul(e.target.value)}
                  placeholder="Contoh: Jadwal Penilaian Akhir Semester (PAS) Ganjil"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-cyan-500 shadow-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Kategori Prioritas *</label>
                  <select
                    value={formAnnKategori}
                    onChange={(e) => setFormAnnKategori(e.target.value as AnnouncementCategory)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-cyan-500 shadow-sm"
                  >
                    <option value="Penting">Penting</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Kegiatan">Kegiatan</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Target Kelas *</label>
                  <select
                    value={formAnnTargetRombel}
                    onChange={(e) => setFormAnnTargetRombel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-cyan-500 shadow-sm"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {rombelList.map((r) => (
                      <option key={r.id} value={r.nama_kelas}>
                        Kelas {r.nama_kelas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-700 block mb-1 font-semibold">Tanggal Terbit *</label>
                  <input
                    type="date"
                    value={formAnnTanggal}
                    onChange={(e) => setFormAnnTanggal(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-cyan-500 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-700 block mb-1 font-semibold">Isi Pengumuman *</label>
                <textarea
                  value={formAnnIsi}
                  onChange={(e) => setFormAnnIsi(e.target.value)}
                  rows={4}
                  placeholder="Tuliskan isi detail pengumuman untuk siswa dan orang tua/wali murid..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-cyan-500 shadow-sm leading-relaxed"
                  required
                />
              </div>

              {/* Opsi Pin & Toggle Spesial Broadcast WhatsApp */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:border-cyan-300 transition">
                  <div className="flex items-center gap-2.5 pr-2">
                    <Pin className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold text-gray-900">Sematkan Pengumuman (Pin di Atas)</div>
                      <div className="text-[11px] text-gray-500">
                        Tampilkan selalu di urutan paling atas papan informasi
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formAnnPinned}
                    onChange={(e) => setFormAnnPinned(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-cyan-50/70 border border-cyan-200 cursor-pointer hover:bg-cyan-50 transition">
                  <div className="flex items-start gap-2.5 pr-2">
                    <Send className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-gray-900">
                        Kirim juga ke WhatsApp Wali Murid (via Antrean Anti-Spam)
                      </div>
                      <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                        Jika dicentang, pesan pengumuman otomatis dimasukkan ke antrean{' '}
                        <code className="font-mono text-cyan-700">wa_queue</code> untuk seluruh siswa
                        pada kelas target ({formAnnTargetRombel}).
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formAnnBroadcastWa}
                    onChange={(e) => setFormAnnBroadcastWa(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded shrink-0"
                  />
                </label>
              </div>

              {/* Sticky Footer dengan Backdrop Blur di Dalam Alur Guliran */}
              <div className="sticky bottom-0 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-3 pb-2 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-gray-600 hover:text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAnn}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 active:scale-95 transition whitespace-nowrap"
                >
                  <Megaphone className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSubmittingAnn ? 'Menerbitkan...' : 'Terbitkan Pengumuman'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

