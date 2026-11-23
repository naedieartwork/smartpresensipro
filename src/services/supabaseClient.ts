import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Student, AttendanceLog, MessageTemplate, WaQueueItem, SupabaseConfig, StatusCategory, Rombel, AppUser, UserRole, Holiday, KalenderPendidikan, JadwalPelajaran, JadwalHari, Announcement, AnnouncementCategory, StudentPoint, PointActionType, LeaveRequest, LeaveRequestStatus } from '../types';
import { INITIAL_TEMPLATES } from '../data/initialData';
import { DEFAULT_SCHEDULE_1A } from '../data/defaultSchedules';

const TEMPLATES_STORAGE_KEY = 'school_presence_message_templates';
const LEAVE_REQUESTS_STORAGE_KEY = 'smart_presensi_leave_requests_v1';
const ABSENCE_NOTES_STORAGE_KEY = 'smart_presensi_absence_notes_v1';
export const ROMBEL_CACHE_STORAGE_KEY = 'smart_presensi_rombel_cache_v1';
export const WALI_KELAS_MAP_STORAGE_KEY = 'smart_presensi_wali_kelas_map_v1';
export const STUDENT_WALI_MAP_STORAGE_KEY = 'smart_presensi_student_wali_map_v1';
export const STUDENT_AVATAR_MAP_STORAGE_KEY = 'smart_presensi_student_avatar_map_v1';
export const USER_PROFILE_EXTRAS_STORAGE_KEY = 'smart_presensi_user_profile_extras_v1';

export const DEFAULT_JADWAL_HARIAN: Record<string, JadwalHari> = {
  Senin: { aktif: true, masuk: '07:00', telat: '07:15', pulang: '14:00' },
  Selasa: { aktif: true, masuk: '07:00', telat: '07:15', pulang: '14:00' },
  Rabu: { aktif: true, masuk: '07:00', telat: '07:15', pulang: '14:00' },
  Kamis: { aktif: true, masuk: '07:00', telat: '07:15', pulang: '14:00' },
  Jumat: { aktif: true, masuk: '07:00', telat: '07:15', pulang: '11:30' },
  Sabtu: { aktif: false, masuk: '07:00', telat: '07:15', pulang: '12:00' },
  Minggu: { aktif: false, masuk: '07:00', telat: '07:15', pulang: '12:00' },
};

class SupabaseService {
  private client: SupabaseClient;
  private listeners: Array<() => void> = [];
  private leaveRequestsTableMissing = false;
  private leaveRequestsMissingLogged = false;
  private inFlightLeaveRequestsQuery: Promise<{ data: LeaveRequest[] | null; missing: boolean }> | null = null;

  constructor() {
    let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xtxornooatucohbtcivp.supabase.co';
    let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eG9ybm9vYXR1Y29oYnRjaXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMzU4NTksImV4cCI6MjEwOTYxMTg1OX0.BttExda6Ec_oRvPx2Cr_ZR-SlO9A9GX7YiMzP4WT1aQ';
    
    supabaseUrl = supabaseUrl.replace(/^\[|\]$/g, '').trim();
    supabaseKey = supabaseKey.replace(/^\[|\]$/g, '').trim();

    this.client = createClient(supabaseUrl, supabaseKey);

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (
          e.key === LEAVE_REQUESTS_STORAGE_KEY ||
          e.key === ABSENCE_NOTES_STORAGE_KEY ||
          e.key === ROMBEL_CACHE_STORAGE_KEY
        ) {
          this.notify();
        }
      });
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getConfig(): SupabaseConfig {
    let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xtxornooatucohbtcivp.supabase.co';
    let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eG9ybm9vYXR1Y29oYnRjaXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMzU4NTksImV4cCI6MjEwOTYxMTg1OX0.BttExda6Ec_oRvPx2Cr_ZR-SlO9A9GX7YiMzP4WT1aQ';
    
    supabaseUrl = supabaseUrl.replace(/^\[|\]$/g, '').trim();
    supabaseKey = supabaseKey.replace(/^\[|\]$/g, '').trim();

    return {
      url: supabaseUrl,
      anonKey: supabaseKey,
      connected: true,
    };
  }

  public setConfig(url: string, anonKey: string): boolean {
    if (url && anonKey) {
      const cleanUrl = url.replace(/^\[|\]$/g, '').trim();
      const cleanKey = anonKey.replace(/^\[|\]$/g, '').trim();
      this.client = createClient(cleanUrl, cleanKey);
      this.leaveRequestsTableMissing = false;
      this.leaveRequestsMissingLogged = false;
      this.inFlightLeaveRequestsQuery = null;
      this.notify();
      return true;
    }
    return false;
  }

  public isUsingRealSupabase(): boolean {
    return true;
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.client.from('students').select('id').limit(1);
      if (error) {
        return { success: false, message: 'Koneksi gagal: ' + error.message };
      }
      return { success: true, message: 'Berhasil terhubung ke database Supabase!' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: 'Error koneksi: ' + msg };
    }
  }

  // ==================== ZERO-MIGRATION METADATA MAPS (WALI KELAS & NAMA WALI SISWA) ====================
  public getWaliKelasMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(WALI_KELAS_MAP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return { wali_kelas: '1A' };
  }

  public saveWaliKelasAssignment(userId: string | undefined, username: string | undefined, assignedClass: string | undefined): void {
    try {
      const map = this.getWaliKelasMap();
      const cleanClass = (assignedClass || '').trim();
      if (userId) {
        if (cleanClass) map[String(userId)] = cleanClass;
        else delete map[String(userId)];
      }
      if (username) {
        const cleanUser = username.trim().toLowerCase();
        if (cleanClass) map[cleanUser] = cleanClass;
        else delete map[cleanUser];
      }
      localStorage.setItem(WALI_KELAS_MAP_STORAGE_KEY, JSON.stringify(map));
      this.syncMetadataMapsToCloud(map, undefined);
    } catch {
      // ignore
    }
  }

  public getStudentWaliMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STUDENT_WALI_MAP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  }

  public saveStudentNamaWali(studentId: string, namaWali: string | undefined): void {
    if (!studentId) return;
    try {
      const map = this.getStudentWaliMap();
      const cleanWali = (namaWali || '').trim();
      if (cleanWali) {
        map[String(studentId)] = cleanWali;
      } else {
        delete map[String(studentId)];
      }
      localStorage.setItem(STUDENT_WALI_MAP_STORAGE_KEY, JSON.stringify(map));
      this.syncMetadataMapsToCloud(undefined, map, undefined);
    } catch {
      // ignore
    }
  }

  public getStudentAvatarMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STUDENT_AVATAR_MAP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  }

  public async saveStudentAvatar(studentId: string, avatarUrl: string | undefined): Promise<void> {
    if (!studentId) return;
    try {
      const map = this.getStudentAvatarMap();
      const cleanAvatar = (avatarUrl || '').trim();
      if (cleanAvatar) {
        map[String(studentId)] = cleanAvatar;
      } else {
        delete map[String(studentId)];
      }
      localStorage.setItem(STUDENT_AVATAR_MAP_STORAGE_KEY, JSON.stringify(map));
      await this.syncMetadataMapsToCloud(undefined, undefined, undefined, map);
    } catch {
      // ignore
    }
  }

  public getUserProfileExtrasMap(): Record<string, { avatarUrl?: string; avatarColor?: string }> {
    try {
      const raw = localStorage.getItem(USER_PROFILE_EXTRAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  }

  public saveUserProfileExtras(
    userId: string | undefined,
    username: string | undefined,
    extras: { avatarUrl?: string; avatarColor?: string }
  ): void {
    try {
      const map = this.getUserProfileExtrasMap();
      const payload = {
        avatarUrl: extras.avatarUrl !== undefined ? extras.avatarUrl.trim() : undefined,
        avatarColor: extras.avatarColor !== undefined ? extras.avatarColor.trim() : undefined,
      };
      if (userId) {
        map[String(userId)] = { ...(map[String(userId)] || {}), ...payload };
      }
      if (username) {
        const cleanUser = username.trim().toLowerCase();
        map[cleanUser] = { ...(map[cleanUser] || {}), ...payload };
      }
      localStorage.setItem(USER_PROFILE_EXTRAS_STORAGE_KEY, JSON.stringify(map));
      this.syncMetadataMapsToCloud(undefined, undefined, map);
    } catch {
      // ignore
    }
  }

  private async syncMetadataMapsToCloud(
    waliMapUpdate?: Record<string, string>,
    studentWaliMapUpdate?: Record<string, string>,
    profileExtrasUpdate?: Record<string, { avatarUrl?: string; avatarColor?: string }>,
    studentAvatarMapUpdate?: Record<string, string>
  ): Promise<void> {
    try {
      const { data: existingRow } = await this.client
        .from('app_settings')
        .select('time_config')
        .eq('id', 1)
        .maybeSingle();

      const existingTc =
        existingRow?.time_config && typeof existingRow.time_config === 'object'
          ? existingRow.time_config
          : {};

      const nextWaliMap = waliMapUpdate || this.getWaliKelasMap();
      const nextStudentWaliMap = studentWaliMapUpdate || this.getStudentWaliMap();
      const nextProfileExtrasMap = profileExtrasUpdate || this.getUserProfileExtrasMap();
      const nextStudentAvatarMap = studentAvatarMapUpdate || this.getStudentAvatarMap();

      await this.client
        .from('app_settings')
        .update({
          time_config: {
            ...existingTc,
            waliKelasMap: nextWaliMap,
            studentWaliMap: nextStudentWaliMap,
            userProfileExtrasMap: nextProfileExtrasMap,
            studentAvatarMap: nextStudentAvatarMap,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
    } catch {
      // Zero-migration fallback: ignore if app_settings update fails
    }
  }

  private async hydrateMetadataMapsFromCloud(): Promise<void> {
    try {
      const { data } = await this.client
        .from('app_settings')
        .select('time_config')
        .eq('id', 1)
        .maybeSingle();
      if (data?.time_config && typeof data.time_config === 'object') {
        const tc = data.time_config as any;
        if (tc.waliKelasMap && typeof tc.waliKelasMap === 'object') {
          const mergedWali = { ...tc.waliKelasMap, ...this.getWaliKelasMap() };
          localStorage.setItem(WALI_KELAS_MAP_STORAGE_KEY, JSON.stringify(mergedWali));
        }
        if (tc.studentWaliMap && typeof tc.studentWaliMap === 'object') {
          const mergedStdWali = { ...tc.studentWaliMap, ...this.getStudentWaliMap() };
          localStorage.setItem(STUDENT_WALI_MAP_STORAGE_KEY, JSON.stringify(mergedStdWali));
        }
        if (tc.userProfileExtrasMap && typeof tc.userProfileExtrasMap === 'object') {
          const mergedExtras = { ...tc.userProfileExtrasMap, ...this.getUserProfileExtrasMap() };
          localStorage.setItem(USER_PROFILE_EXTRAS_STORAGE_KEY, JSON.stringify(mergedExtras));
        }
        if (tc.studentAvatarMap && typeof tc.studentAvatarMap === 'object') {
          const mergedAvatars = { ...tc.studentAvatarMap, ...this.getStudentAvatarMap() };
          localStorage.setItem(STUDENT_AVATAR_MAP_STORAGE_KEY, JSON.stringify(mergedAvatars));
        }
      }
    } catch {
      // ignore
    }
  }

  // ==================== STUDENTS ====================
  public async getStudents(): Promise<Student[]> {
    try {
      const [{ data, error }, rombelList] = await Promise.all([
        this.client.from('students').select('*').order('nama', { ascending: true }),
        this.getRombel(),
        this.hydrateMetadataMapsFromCloud(),
      ]);
      const studentWaliMap = this.getStudentWaliMap();
      const studentAvatarMap = this.getStudentAvatarMap();
      if (!error && data) {
        return data.map((item: any) => {
          const cleanUid = String(
            item.uid_kartu || item.rfid_uid || item.uid || item.kode_rfid || ''
          ).trim();
          const cleanNisn = String(item.nisn || item.nis || '').trim();
          const rmbId = item.rombel_id || item.class_id || item.id_rombel || undefined;
          const matchedRombel = rombelList.find(
            (r) =>
              (rmbId && r.id === rmbId) ||
              (item.kelas &&
                r.nama_kelas.trim().toLowerCase() === String(item.kelas).trim().toLowerCase())
          );
          const resolvedNamaWali =
            item.nama_wali || item.nama_ortu || studentWaliMap[String(item.id)] || undefined;

          // Utamakan kolom avatar_url langsung dari tabel public.students di Supabase
          const dbAvatar =
            typeof item.avatar_url === 'string' && item.avatar_url.trim() !== ''
              ? item.avatar_url.trim()
              : undefined;
          const cachedAvatar = studentAvatarMap[String(item.id)] || undefined;
          const resolvedAvatarUrl = dbAvatar || cachedAvatar || undefined;

          // Jika kolom avatar_url sudah ada di tabel public.students namun masih kosong sementara ada di cache, sinkronkan otomatis ke kolom DB
          if ('avatar_url' in item && !dbAvatar && cachedAvatar && item.id) {
            void this.client
              .from('students')
              .update({ avatar_url: cachedAvatar })
              .eq('id', item.id);
          }

          return {
            ...item,
            uid_kartu: cleanUid,
            rfid_uid: String(item.rfid_uid || cleanUid).trim(),
            nisn: cleanNisn,
            nama_wali: resolvedNamaWali,
            avatar_url: resolvedAvatarUrl,
            rombel_id: matchedRombel ? matchedRombel.id : rmbId,
            class_id: matchedRombel ? matchedRombel.id : rmbId,
            kelas: matchedRombel ? matchedRombel.nama_kelas : item.kelas || undefined,
            rombel: matchedRombel,
          } as Student;
        });
      }
    } catch (err) {
      console.error('Error fetching students from Supabase:', err);
    }
    return [];
  }

  public async getStudentByRfid(cardUid: string): Promise<Student | null> {
    const cleanTag = cardUid.trim().toLowerCase();
    if (!cleanTag) return null;

    try {
      const students = await this.getStudents();
      const matched = students.find((s: any) => {
        const candidates = [
          s.uid_kartu,
          s.rfid_uid,
          s.uid,
          s.kode_rfid,
          s.nisn,
          s.nis,
          s.id,
        ];
        return candidates.some(
          (val) => val !== undefined && val !== null && String(val).trim().toLowerCase() === cleanTag
        );
      });
      if (matched) {
        return {
          ...matched,
          avatar_url: matched.avatar_url || undefined,
        };
      }
    } catch (err) {
      console.error('Error searching student:', err);
    }
    return null;
  }

  public async authenticateStudent(
    identifier: string,
    pin: string
  ): Promise<{ success: boolean; student?: Student; error?: string }> {
    const cleanId = identifier.trim();
    const cleanPin = pin.replace(/\D/g, '').trim();

    if (!cleanId) {
      return {
        success: false,
        error: 'NIS / NISN atau Nomor Kartu (UID) wajib diisi.',
      };
    }

    if (cleanPin.length !== 6) {
      return {
        success: false,
        error: 'PIN Keamanan Wali wajib terdiri dari 6 angka.',
      };
    }

    try {
      const matched = await this.getStudentByRfid(cleanId);
      if (!matched) {
        return {
          success: false,
          error: 'Kombinasi NIS / Nomor Kartu (UID) dan PIN Keamanan Wali tidak sesuai.',
        };
      }

      // Bersihkan karakter non-angka dari nomor WA wali siswa, ambil 6 digit terakhir sebagai PIN valid
      // Jika nomor WA wali belum diisi / kurang dari 6 digit, gunakan PIN default: 123456
      const rawWaDigits = String(matched.no_wa_wali || '').replace(/\D/g, '');
      const validPin = rawWaDigits.length >= 6 ? rawWaDigits.slice(-6) : '123456';

      if (cleanPin !== validPin) {
        return {
          success: false,
          error: 'PIN Keamanan Wali tidak sesuai (pastikan 6 angka terakhir No. WA Wali benar).',
        };
      }

      return { success: true, student: matched };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal memverifikasi data siswa.',
      };
    }
  }

  public async addStudent(student: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
    const rawUid = (student.uid_kartu || student.rfid_uid || '').trim().toUpperCase();
    const cleanUid = rawUid !== '' ? rawUid : null;
    const rawNisn = (student.nisn || '').trim();
    const cleanNisn = rawNisn !== '' ? rawNisn : null;
    const cleanAvatar = (student.avatar_url || '').trim() || null;
    const resolvedClassId = student.rombel_id || student.class_id || null;

    const baseRow: Record<string, any> = {
      uid_kartu: cleanUid,
      rfid_uid: cleanUid,
      nisn: cleanNisn,
      nama: student.nama.trim(),
      no_wa_wali: student.no_wa_wali.trim(),
      rombel_id: resolvedClassId,
      ...(cleanAvatar ? { avatar_url: cleanAvatar } : {}),
    };

    try {
      // 1. Try inserting with avatar_url + rombel_id + rfid_uid
      const { data: dataWithAvatar, error: errWithAvatar } = await this.client
        .from('students')
        .insert([baseRow])
        .select()
        .single();

      if (!errWithAvatar && dataWithAvatar) {
        if (cleanAvatar && dataWithAvatar.id) {
          await this.saveStudentAvatar(String(dataWithAvatar.id), cleanAvatar);
        }
        this.notify();
        return {
          ...dataWithAvatar,
          avatar_url: dataWithAvatar.avatar_url || cleanAvatar || undefined,
        } as Student;
      }

      // 2. Try schema variant using class_id (without rfid_uid) + avatar_url
      const schemaRowWithAvatar: Record<string, any> = {
        uid_kartu: cleanUid,
        nisn: cleanNisn,
        nama: student.nama.trim(),
        no_wa_wali: student.no_wa_wali.trim(),
        class_id: resolvedClassId,
        ...(cleanAvatar ? { avatar_url: cleanAvatar } : {}),
      };
      const { data: dataClassIdAvatar, error: errClassIdAvatar } = await this.client
        .from('students')
        .insert([schemaRowWithAvatar])
        .select()
        .single();

      if (!errClassIdAvatar && dataClassIdAvatar) {
        if (cleanAvatar && dataClassIdAvatar.id) {
          await this.saveStudentAvatar(String(dataClassIdAvatar.id), cleanAvatar);
        }
        this.notify();
        return {
          ...dataClassIdAvatar,
          avatar_url: dataClassIdAvatar.avatar_url || cleanAvatar || undefined,
        } as Student;
      }

      // 3. Fallback if avatar_url column hasn't been added via ALTER TABLE yet
      const { avatar_url: _omittedAvatar, ...rowWithoutAvatar } = baseRow;
      const { data, error } = await this.client
        .from('students')
        .insert([rowWithoutAvatar])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        if (cleanAvatar && data.id) {
          await this.saveStudentAvatar(String(data.id), cleanAvatar);
          // Attempt isolated avatar_url update in case insert rejected another optional column
          await this.client
            .from('students')
            .update({ avatar_url: cleanAvatar })
            .eq('id', data.id);
        }
        this.notify();
        return {
          ...data,
          avatar_url: cleanAvatar || undefined,
        } as Student;
      }
    } catch (err: any) {
      console.error('Error adding student to Supabase:', err);
      throw new Error(err.message || 'Gagal menambahkan siswa ke database Supabase.');
    }
    throw new Error('Gagal menambahkan siswa ke database Supabase.');
  }

  public async deleteStudent(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('students').delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      await this.saveStudentAvatar(id, undefined);
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error deleting student:', err);
      throw new Error(err.message || 'Gagal menghapus siswa.');
    }
  }

  public async updateStudent(
    id: string,
    updates: {
      nama: string;
      nama_wali?: string;
      uid_kartu?: string;
      rfid_uid?: string;
      no_wa_wali: string;
      rombel_id?: string;
      class_id?: string;
      kelas?: string;
      nis?: string;
      nisn?: string;
      avatar_url?: string;
    }
  ): Promise<boolean> {
    const rawUid = (updates.uid_kartu || updates.rfid_uid || '').trim().toUpperCase();
    const cleanUid = rawUid !== '' ? rawUid : null;
    const rawNisn = (updates.nisn || '').trim();
    const cleanNisn = rawNisn !== '' ? rawNisn : null;
    const cleanAvatar =
      updates.avatar_url !== undefined ? updates.avatar_url.trim() || null : undefined;

    if (updates.nama_wali !== undefined) {
      this.saveStudentNamaWali(id, updates.nama_wali);
    }
    if (updates.avatar_url !== undefined) {
      await this.saveStudentAvatar(id, updates.avatar_url);
    }

    try {
      const basePayload: Record<string, any> = {
        nama: updates.nama.trim(),
        no_wa_wali: updates.no_wa_wali.trim(),
      };
      if (updates.uid_kartu !== undefined || updates.rfid_uid !== undefined) {
        basePayload.uid_kartu = cleanUid;
        basePayload.rfid_uid = cleanUid;
      }
      if (updates.nisn !== undefined) basePayload.nisn = cleanNisn;
      if (updates.rombel_id !== undefined || updates.class_id !== undefined) {
        basePayload.rombel_id = updates.rombel_id || updates.class_id || null;
      }
      if (updates.nis !== undefined) basePayload.nis = updates.nis || null;

      // 1. Primary update including avatar_url directly
      if (cleanAvatar !== undefined) {
        const tryWithAvatar = await this.client
          .from('students')
          .update({
            ...basePayload,
            avatar_url: cleanAvatar,
          })
          .eq('id', id);

        if (!tryWithAvatar.error) {
          this.notify();
          return true;
        }

        // 2. If basePayload had rfid_uid / rombel_id mismatch with class_id schema, try core fields + avatar_url
        const corePayloadWithAvatar: Record<string, any> = {
          nama: updates.nama.trim(),
          no_wa_wali: updates.no_wa_wali.trim(),
          ...(cleanUid ? { uid_kartu: cleanUid } : {}),
          ...(updates.nisn !== undefined ? { nisn: cleanNisn } : {}),
          ...(updates.rombel_id !== undefined || updates.class_id !== undefined
            ? { class_id: updates.rombel_id || updates.class_id || null }
            : {}),
          avatar_url: cleanAvatar,
        };
        const tryCoreWithAvatar = await this.client
          .from('students')
          .update(corePayloadWithAvatar)
          .eq('id', id);

        if (!tryCoreWithAvatar.error) {
          this.notify();
          return true;
        }
      }

      // 3. Fallback update without avatar_url if column not yet migrated, plus isolated avatar_url update attempt
      const { error } = await this.client
        .from('students')
        .update(basePayload)
        .eq('id', id);

      if (cleanAvatar !== undefined) {
        await this.client
          .from('students')
          .update({ avatar_url: cleanAvatar })
          .eq('id', id);
      }

      if (error) {
        throw new Error(error.message);
      }

      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error updating student in Supabase:', err);
      throw new Error(err.message || 'Gagal memperbarui data siswa.');
    }
  }

  // ==================== MESSAGE TEMPLATES ====================
  private normalizeTemplateList(rawItems: any[]): MessageTemplate[] {
    const categories: StatusCategory[] = ['hadir_tepat', 'hadir_telat', 'pulang', 'izin', 'sakit'];
    const result: MessageTemplate[] = [];

    for (const cat of categories) {
      const catLower = cat.toLowerCase();
      const matched = (rawItems || []).filter((item: any) => {
        const rawCat = String(item?.status_category || item?.category || item?.kategori || '')
          .trim()
          .toLowerCase();
        return rawCat === catLower;
      });

      const defaultsForCat = INITIAL_TEMPLATES.filter(
        (d) => String(d.status_category).trim().toLowerCase() === catLower
      );

      for (let i = 0; i < 4; i++) {
        const item = matched[i];
        const fallback = defaultsForCat[i];
        if (item && String(item.message_text || item.text || item.isi_pesan || '').trim() !== '') {
          result.push({
            id: String(item.id || fallback?.id || `tmpl-${cat}-${i + 1}`),
            status_category: cat,
            variation_number: i + 1,
            message_text: String(item.message_text || item.text || item.isi_pesan),
          });
        } else if (fallback) {
          result.push({
            id: fallback.id,
            status_category: cat,
            variation_number: i + 1,
            message_text: fallback.message_text,
          });
        }
      }
    }

    return result;
  }

  private getLocalCachedTemplates(): MessageTemplate[] {
    try {
      const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.normalizeTemplateList(parsed);
        }
      }
    } catch {
      // Ignore parse error
    }
    const seeded = this.normalizeTemplateList(INITIAL_TEMPLATES);
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // Ignore storage error
    }
    return seeded;
  }

  private saveLocalCachedTemplates(templates: MessageTemplate[]) {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Ignore storage error
    }
  }

  public async getTemplates(): Promise<MessageTemplate[]> {
    try {
      const { data, error } = await this.client.from('message_templates').select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        const normalized = this.normalizeTemplateList(data);
        this.saveLocalCachedTemplates(normalized);
        return normalized;
      }

      // Jika tabel message_templates di Supabase masih kosong, ambil dari cache lokal / INITIAL_TEMPLATES lalu seed ke Supabase
      const fallbackTemplates = this.getLocalCachedTemplates();
      if (!error && Array.isArray(data) && data.length === 0) {
        try {
          const seedPayload = fallbackTemplates.map((t) => ({
            status_category: t.status_category,
            message_text: t.message_text,
          }));
          const { data: inserted } = await this.client
            .from('message_templates')
            .insert(seedPayload)
            .select('*');
          if (inserted && inserted.length > 0) {
            const seededNormalized = this.normalizeTemplateList(inserted);
            this.saveLocalCachedTemplates(seededNormalized);
            return seededNormalized;
          }
        } catch {
          // Abaikan jika gagal auto-seed ke Supabase, tetap kembalikan fallbackTemplates
        }
      }
      return fallbackTemplates;
    } catch (err) {
      console.error('Error getting templates:', err);
      return this.getLocalCachedTemplates();
    }
  }

  public async getTemplatesByCategory(category: StatusCategory): Promise<MessageTemplate[]> {
    const catLower = String(category || '').trim().toLowerCase();
    const allTemplates = await this.getTemplates();
    const filtered = allTemplates.filter(
      (t) => String(t.status_category || '').trim().toLowerCase() === catLower
    );
    if (filtered.length > 0) return filtered;
    return INITIAL_TEMPLATES.filter(
      (t) => String(t.status_category || '').trim().toLowerCase() === catLower
    );
  }

  public async addTemplate(status_category: StatusCategory, message_text: string): Promise<MessageTemplate> {
    try {
      const { data, error } = await this.client
        .from('message_templates')
        .insert([{ status_category, message_text }])
        .select()
        .single();
      if (!error && data) {
        this.notify();
        return data as MessageTemplate;
      }
    } catch (err: any) {
      console.error('Error adding template in Supabase:', err);
    }
    const fallbackItem: MessageTemplate = {
      id: 'tmpl-' + Date.now().toString(36),
      status_category,
      message_text,
    };
    return fallbackItem;
  }

  public async updateTemplate(id: string, message_text: string): Promise<boolean> {
    const current = this.getLocalCachedTemplates();
    const updatedLocal = current.map((t) =>
      t.id === id ? { ...t, message_text } : t
    );
    this.saveLocalCachedTemplates(updatedLocal);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        await this.client
          .from('message_templates')
          .update({ message_text })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Warning updating single template in Supabase:', err);
    }

    this.notify();
    return true;
  }

  public async saveAllTemplates(templates: MessageTemplate[]): Promise<MessageTemplate[]> {
    const normalized = this.normalizeTemplateList(templates);
    this.saveLocalCachedTemplates(normalized);

    try {
      // Cek apakah semua item sudah memiliki UUID dari Supabase
      const allHaveUuid = normalized.every((t) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)
      );

      if (allHaveUuid) {
        await Promise.all(
          normalized.map((t) =>
            this.client
              .from('message_templates')
              .update({
                status_category: t.status_category,
                message_text: t.message_text,
              })
              .eq('id', t.id)
          )
        );
      } else {
        // Bersihkan dan masukkan 20 baris terbaru agar tersinkronisasi penuh di Supabase
        await this.client
          .from('message_templates')
          .delete()
          .neq('status_category', '__never__');

        const insertPayload = normalized.map((t) => ({
          status_category: t.status_category,
          message_text: t.message_text,
        }));

        const { data: inserted } = await this.client
          .from('message_templates')
          .insert(insertPayload)
          .select('*');

        if (inserted && inserted.length > 0) {
          const synced = this.normalizeTemplateList(inserted);
          this.saveLocalCachedTemplates(synced);
          this.notify();
          return synced;
        }
      }
    } catch (err) {
      console.warn('Warning syncing all templates to Supabase (saved to localStorage):', err);
    }

    this.notify();
    return normalized;
  }

  public async deleteTemplate(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('message_templates').delete().eq('id', id);
      if (error) throw new Error(error.message);
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error deleting template in Supabase:', err);
      throw new Error(err.message || 'Gagal menghapus template.');
    }
  }

  public async resetTemplatesToDefault(): Promise<MessageTemplate[]> {
    const defaultCopy = this.normalizeTemplateList(INITIAL_TEMPLATES);
    this.saveLocalCachedTemplates(defaultCopy);

    try {
      await this.client
        .from('message_templates')
        .delete()
        .neq('status_category', '__never__');

      const insertPayload = defaultCopy.map((t) => ({
        status_category: t.status_category,
        message_text: t.message_text,
      }));

      const { data: inserted } = await this.client
        .from('message_templates')
        .insert(insertPayload)
        .select('*');

      if (inserted && inserted.length > 0) {
        const synced = this.normalizeTemplateList(inserted);
        this.saveLocalCachedTemplates(synced);
        this.notify();
        return synced;
      }
    } catch (err) {
      console.warn('Warning resetting templates in Supabase (reset in localStorage):', err);
    }

    this.notify();
    return defaultCopy;
  }

  // ==================== ATTENDANCE LOG ====================
  public async getAttendanceLogs(): Promise<AttendanceLog[]> {
    try {
      const [{ data, error }, students] = await Promise.all([
        this.client
          .from('attendance_log')
          .select('*')
          .order('waktu', { ascending: false })
          .limit(200),
        this.getStudents(),
      ]);

      if (!error && data) {
        return data.map((item: any) => {
          const rawCardId = String(
            item.uid_kartu || item.rfid_uid || item.uid || item.kode_rfid || item.nisn || ''
          ).trim();
          const cleanCardLower = rawCardId.toLowerCase();

          const matchedStudent = students.find((st: any) => {
            if (item.student_id && st.id === item.student_id) return true;
            const candidates = [
              st.uid_kartu,
              st.rfid_uid,
              st.uid,
              st.kode_rfid,
              st.nisn,
              st.nis,
            ];
            return (
              cleanCardLower !== '' &&
              candidates.some(
                (val) =>
                  val !== undefined &&
                  val !== null &&
                  String(val).trim().toLowerCase() === cleanCardLower
              )
            );
          });

          const resolvedName =
            matchedStudent?.nama ||
            (item.student_name && !String(item.student_name).startsWith('Siswa (')
              ? item.student_name
              : `Siswa (${rawCardId})`);

          const resolvedKelas =
            matchedStudent?.kelas ||
            (typeof matchedStudent?.rombel === 'object' && matchedStudent?.rombel
              ? matchedStudent.rombel.nama_kelas
              : undefined) ||
            'Umum';

          const dateKey = item.waktu ? String(item.waktu).slice(0, 10) : new Date().toISOString().slice(0, 10);
          const notesMap = this.getAbsenceNotesMap();
          const noteByUidDate = notesMap[`${rawCardId.toUpperCase()}_${dateKey}`];
          const noteById = notesMap[String(item.id)];

          return {
            id: item.id,
            uid_kartu: rawCardId,
            rfid_uid: matchedStudent?.rfid_uid || rawCardId,
            student_name: resolvedName,
            student_kelas: resolvedKelas,
            status_kehadiran: item.status_kehadiran,
            waktu: item.waktu,
            metode: item.metode || 'Hybrid',
            keterangan: item.keterangan || noteById || noteByUidDate || undefined,
          };
        });
      }
    } catch (err) {
      console.error('Error getting attendance logs:', err);
    }
    return [];
  }

  public async getStudentAttendanceLogs(student: Student): Promise<AttendanceLog[]> {
    try {
      const { data, error } = await this.client
        .from('attendance_log')
        .select('*')
        .order('waktu', { ascending: false })
        .limit(500);

      if (!error && Array.isArray(data)) {
        const studentCandidates = [
          student.id,
          student.uid_kartu,
          student.rfid_uid,
          student.nisn,
          (student as any).nis,
        ]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim().toLowerCase());

        return data
          .filter((item: any) => {
            const logCandidates = [
              item.student_id,
              item.uid_kartu,
              item.rfid_uid,
              item.uid,
              item.kode_rfid,
              item.nisn,
              item.nis,
            ]
              .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
              .map((v) => String(v).trim().toLowerCase());

            return logCandidates.some((c) => studentCandidates.includes(c));
          })
          .map((item: any) => ({
            id: String(item.id),
            uid_kartu: String(item.uid_kartu || student.uid_kartu || ''),
            rfid_uid: String(item.rfid_uid || student.rfid_uid || student.uid_kartu || ''),
            student_name: student.nama,
            status_kehadiran: item.status_kehadiran as StatusCategory,
            waktu: item.waktu,
            metode: item.metode || 'Otomatis',
          }));
      }
    } catch (err) {
      console.error('Error fetching student attendance logs from Supabase:', err);
    }
    return [];
  }

  public async recordAttendanceLog(
    cardUid: string,
    student_name: string,
    status: StatusCategory,
    metode: 'QR' | 'RFID' | 'Manual' | 'Hybrid' = 'Hybrid',
    keterangan?: string
  ): Promise<AttendanceLog> {
    const now = new Date();
    const waktu = now.toISOString();
    const cleanUid = cardUid.trim().toUpperCase();
    const cleanNote = keterangan ? keterangan.trim() : undefined;
    const newLog: AttendanceLog = {
      id: 'att-' + Date.now().toString(36),
      uid_kartu: cleanUid,
      rfid_uid: cleanUid,
      student_name,
      status_kehadiran: status,
      waktu,
      metode,
      keterangan: cleanNote,
    };

    if (cleanNote) {
      this.saveAbsenceNote(cleanUid, waktu.slice(0, 10), cleanNote);
    }

    try {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const { data: existingToday } = await this.client
        .from('attendance_log')
        .select('id')
        .eq('uid_kartu', cleanUid)
        .gte('waktu', startOfDay)
        .order('waktu', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingToday && existingToday.id) {
        const { data: updatedData, error: updateError } = await this.client
          .from('attendance_log')
          .update({
            status_kehadiran: status,
            waktu,
          })
          .eq('id', existingToday.id)
          .select()
          .single();

        if (!updateError && updatedData) {
          newLog.id = updatedData.id;
          if (cleanNote) {
            this.saveAbsenceNoteById(String(updatedData.id), cleanNote);
          }
          this.notify();
          return newLog;
        }
      }

      const { data, error } = await this.client
        .from('attendance_log')
        .insert([
          {
            uid_kartu: cleanUid,
            status_kehadiran: status,
            waktu,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        newLog.id = data.id;
        if (cleanNote) {
          this.saveAbsenceNoteById(String(data.id), cleanNote);
        }
      }
    } catch (err: any) {
      throw new Error(err.message || String(err));
    }

    this.notify();
    return newLog;
  }

  // ==================== WA QUEUE ====================
  public async getQueue(): Promise<WaQueueItem[]> {
    try {
      const { data, error } = await this.client
        .from('wa_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        return data.map((item: any) => ({
          id: item.id,
          no_wa_tujuan: item.no_wa_tujuan,
          isi_pesan: item.pesan || item.isi_pesan || '',
          status: item.status,
          created_at: item.created_at,
          sent_at: item.sent_at,
          error_message: item.error_message,
        }));
      }
    } catch (err) {
      console.error('Error getting queue from Supabase:', err);
    }
    return [];
  }

  public async enqueueMessage(noWa: string, isiPesan: string): Promise<WaQueueItem> {
    try {
      // Hapus antrean pending/failed lama untuk nomor tujuan yang sama agar antrean menggunakan jam & status tap terbaru
      await this.client
        .from('wa_queue')
        .delete()
        .eq('no_wa_tujuan', noWa)
        .in('status', ['pending', 'failed']);

      const { data, error } = await this.client
        .from('wa_queue')
        .insert([
          {
            no_wa_tujuan: noWa,
            isi_pesan: isiPesan,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase Insert Error:', error);
        throw new Error(error.message);
      }

      this.notify();
      return data as WaQueueItem;
    } catch (err: any) {
      console.error('Supabase Insert Error:', err);
      throw new Error(err.message || String(err));
    }
  }

  public async getNextPendingQueueItem(): Promise<WaQueueItem | null> {
    try {
      const { data, error } = await this.client
        .from('wa_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          no_wa_tujuan: data.no_wa_tujuan,
          isi_pesan: data.pesan || data.isi_pesan || '',
          status: data.status,
          created_at: data.created_at,
          sent_at: data.sent_at,
          error_message: data.error_message,
        };
      }
    } catch (err) {
      console.error('Error fetching pending queue from Supabase:', err);
    }
    return null;
  }

  public async updateQueueStatus(
    id: string,
    status: 'pending' | 'processing' | 'sent' | 'failed',
    errorMessage?: string
  ): Promise<boolean> {
    const sent_at = status === 'sent' ? new Date().toISOString() : undefined;
    try {
      const updatePayload: Record<string, any> = { status };
      if (sent_at) updatePayload.sent_at = sent_at;
      if (errorMessage) updatePayload.error_message = errorMessage;

      const { error } = await this.client.from('wa_queue').update(updatePayload).eq('id', id);
      if (!error) {
        this.notify();
        return true;
      }
    } catch (err) {
      console.error('Error updating queue status:', err);
    }
    return false;
  }

  public async clearSentQueue(): Promise<void> {
    try {
      await this.client.from('wa_queue').delete().eq('status', 'sent');
      this.notify();
    } catch (err) {
      console.error('Error clearing sent queue:', err);
    }
  }

  // ==================== ROMBEL (DATA KELAS) ====================
  public getLocalRombelCache(): Rombel[] {
    try {
      const raw = localStorage.getItem(ROMBEL_CACHE_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as Rombel[];
        }
      }
    } catch {
      // ignore corrupted cache
    }
    return [];
  }

  public saveLocalRombelCache(list: Rombel[]): void {
    try {
      localStorage.setItem(ROMBEL_CACHE_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore storage quota error
    }
  }

  public async getRombel(): Promise<Rombel[]> {
    try {
      const { data, error } = await this.client
        .from('rombel')
        .select('*')
        .order('nama_kelas', { ascending: true });

      if (error) {
        console.error('Error fetching rombel from Supabase:', error);
        return this.getLocalRombelCache();
      }

      const list = (Array.isArray(data) ? data : []).map((item: any) => ({
        ...item,
        jadwal_harian: item.jadwal_harian || DEFAULT_JADWAL_HARIAN,
      })) as Rombel[];

      // Timpa cache lokal dengan data terbaru dari Supabase (termasuk jika kosong [])
      // Tanpa auto-seeding atau fallback kelas dummy
      this.saveLocalRombelCache(list);
      return list;
    } catch (err) {
      console.error('Error fetching rombel from Supabase:', err);
      return this.getLocalRombelCache();
    }
  }

  public async addRombel(rombel: Omit<Rombel, 'id' | 'created_at'>): Promise<Rombel> {
    const jadwal = rombel.jadwal_harian || DEFAULT_JADWAL_HARIAN;
    try {
      const { data, error } = await this.client
        .from('rombel')
        .insert([
          {
            nama_kelas: rombel.nama_kelas.trim(),
            nama_wali_kelas: rombel.nama_wali_kelas.trim(),
            jadwal_harian: jadwal,
          },
        ])
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        const created: Rombel = {
          ...data,
          jadwal_harian: data.jadwal_harian || DEFAULT_JADWAL_HARIAN,
        };
        const currentCache = this.getLocalRombelCache().filter((item) => item.id !== created.id);
        this.saveLocalRombelCache(
          [...currentCache, created].sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas))
        );
        this.notify();
        return created;
      }
    } catch (err: any) {
      console.error('Error adding rombel to Supabase:', err);
      throw new Error(err.message || 'Gagal menambahkan rombel.');
    }
    throw new Error('Gagal menambahkan rombel.');
  }

  public async updateRombel(
    id: string,
    updates: { nama_kelas: string; nama_wali_kelas: string; jadwal_harian?: Record<string, JadwalHari> }
  ): Promise<boolean> {
    try {
      const payload: Record<string, any> = {
        nama_kelas: updates.nama_kelas.trim(),
        nama_wali_kelas: updates.nama_wali_kelas.trim(),
      };
      if (updates.jadwal_harian !== undefined) payload.jadwal_harian = updates.jadwal_harian;

      const { error } = await this.client
        .from('rombel')
        .update(payload)
        .eq('id', id);
      if (error) throw new Error(error.message);

      const updatedCache = this.getLocalRombelCache()
        .map((item) =>
          item.id === id
            ? {
                ...item,
                nama_kelas: payload.nama_kelas,
                nama_wali_kelas: payload.nama_wali_kelas,
                jadwal_harian:
                  updates.jadwal_harian !== undefined ? updates.jadwal_harian : item.jadwal_harian,
              }
            : item
        )
        .sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas));
      this.saveLocalRombelCache(updatedCache);

      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error updating rombel in Supabase:', err);
      throw new Error(err.message || 'Gagal memperbarui rombel.');
    }
  }

  public async deleteRombel(id: string): Promise<boolean> {
    if (!id) {
      throw new Error('ID kelas tidak valid.');
    }

    try {
      // 1. Hapus data terkait di tabel jadwal_pelajaran (Foreign Key rombel_id)
      const { error: jadwalError } = await this.client
        .from('jadwal_pelajaran')
        .delete()
        .eq('rombel_id', id);
      if (
        jadwalError &&
        !/does not exist|Could not find the table/i.test(jadwalError.message)
      ) {
        console.error('Error deleting related jadwal_pelajaran:', jadwalError);
        throw new Error(`Gagal menghapus jadwal pelajaran terkait kelas: ${jadwalError.message}`);
      }

      // 2. Lepaskan relasi Foreign Key pada tabel students (kolom rombel_id & class_id)
      const { error: studentRombelErr } = await this.client
        .from('students')
        .update({ rombel_id: null })
        .eq('rombel_id', id);
      if (
        studentRombelErr &&
        !/column .* does not exist|Could not find the 'rombel_id' column/i.test(
          studentRombelErr.message
        )
      ) {
        console.error('Error detaching students.rombel_id:', studentRombelErr);
        throw new Error(`Gagal melepaskan relasi siswa (rombel_id): ${studentRombelErr.message}`);
      }

      const { error: studentClassErr } = await this.client
        .from('students')
        .update({ class_id: null })
        .eq('class_id', id);
      if (
        studentClassErr &&
        !/column .* does not exist|Could not find the 'class_id' column/i.test(
          studentClassErr.message
        )
      ) {
        console.error('Error detaching students.class_id:', studentClassErr);
        throw new Error(`Gagal melepaskan relasi siswa (class_id): ${studentClassErr.message}`);
      }

      // 3. Eksekusi DELETE langsung pada tabel rombel berdasarkan id
      const { data: deletedRows, error } = await this.client
        .from('rombel')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('Error deleting rombel from Supabase:', error);
        throw new Error(error.message || 'Gagal menghapus kelas di database Supabase.');
      }

      // 4. Verifikasi penghapusan benar-benar tuntas (deteksi silent block oleh RLS)
      if (!deletedRows || deletedRows.length === 0) {
        const { data: stillExists, error: verifyError } = await this.client
          .from('rombel')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (verifyError) {
          throw new Error(`Gagal memverifikasi penghapusan kelas: ${verifyError.message}`);
        }
        if (stillExists) {
          throw new Error(
            'Penghapusan kelas ditolak oleh database Supabase (periksa izin / policy RLS DELETE pada tabel rombel).'
          );
        }
      }

      // 5. Timpa localStorage cache agar data terhapus tidak pernah muncul kembali
      const updatedCache = this.getLocalRombelCache().filter((item) => item.id !== id);
      this.saveLocalRombelCache(updatedCache);

      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error deleting rombel:', err);
      throw new Error(err?.message || 'Gagal menghapus kelas.');
    }
  }

  // ==================== HOLIDAYS (HARI LIBUR) ====================
  public async getHolidays(): Promise<Holiday[]> {
    try {
      const { data, error } = await this.client
        .from('holidays')
        .select('*')
        .order('tanggal', { ascending: true });
      if (!error && data) return data as Holiday[];
    } catch (err) {
      console.error('Error fetching holidays from Supabase:', err);
    }
    return [];
  }

  public async addHoliday(tanggal: string, keterangan: string): Promise<Holiday> {
    try {
      const { data, error } = await this.client
        .from('holidays')
        .insert([{ tanggal, keterangan: keterangan.trim() }])
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        this.notify();
        return data as Holiday;
      }
    } catch (err: any) {
      console.error('Error adding holiday to Supabase:', err);
      throw new Error(err.message || 'Gagal menambahkan hari libur.');
    }
    throw new Error('Gagal menambahkan hari libur.');
  }

  public async deleteHoliday(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('holidays').delete().eq('id', id);
      if (error) throw new Error(error.message);
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error deleting holiday:', err);
      throw new Error(err.message || 'Gagal menghapus hari libur.');
    }
  }

  // ==================== KALENDER PENDIDIKAN ====================
  private getLocalKalenderCache(): KalenderPendidikan[] {
    try {
      const raw = localStorage.getItem('smart_presensi_kalender_cache_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setLocalKalenderCache(items: KalenderPendidikan[]) {
    try {
      localStorage.setItem('smart_presensi_kalender_cache_v1', JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  public async getKalenderPendidikan(): Promise<KalenderPendidikan[]> {
    try {
      const { data, error } = await this.client
        .from('kalender_pendidikan')
        .select('*')
        .order('tanggal_mulai', { ascending: true });
      if (!error && Array.isArray(data)) {
        this.setLocalKalenderCache(data as KalenderPendidikan[]);
        return data as KalenderPendidikan[];
      }
    } catch (err) {
      console.error('Error fetching kalender pendidikan from Supabase:', err);
    }
    return this.getLocalKalenderCache();
  }

  public async addKalender(data: Omit<KalenderPendidikan, 'id' | 'created_at'>): Promise<KalenderPendidikan> {
    const fallbackItem: KalenderPendidikan = {
      id: 'kal-' + Date.now().toString(36),
      tanggal_mulai: data.tanggal_mulai,
      tanggal_selesai: data.tanggal_selesai,
      keterangan: data.keterangan.trim(),
      jenis: data.jenis,
      created_at: new Date().toISOString(),
    };

    try {
      const { data: resData, error } = await this.client
        .from('kalender_pendidikan')
        .insert([{
          tanggal_mulai: data.tanggal_mulai,
          tanggal_selesai: data.tanggal_selesai,
          keterangan: data.keterangan.trim(),
          jenis: data.jenis,
        }])
        .select()
        .single();
      if (!error && resData) {
        const current = this.getLocalKalenderCache();
        this.setLocalKalenderCache([...current, resData as KalenderPendidikan]);
        this.notify();
        return resData as KalenderPendidikan;
      }
    } catch (err: any) {
      console.warn('Fallback saving kalender to localStorage:', err);
    }

    const current = this.getLocalKalenderCache();
    this.setLocalKalenderCache([...current, fallbackItem]);
    this.notify();
    return fallbackItem;
  }

  public async updateKalender(
    id: string,
    updates: Partial<Omit<KalenderPendidikan, 'id' | 'created_at'>>
  ): Promise<boolean> {
    try {
      const payload: Record<string, any> = {};
      if (updates.tanggal_mulai !== undefined) payload.tanggal_mulai = updates.tanggal_mulai;
      if (updates.tanggal_selesai !== undefined) payload.tanggal_selesai = updates.tanggal_selesai;
      if (updates.keterangan !== undefined) payload.keterangan = updates.keterangan.trim();
      if (updates.jenis !== undefined) payload.jenis = updates.jenis;

      await this.client
        .from('kalender_pendidikan')
        .update(payload)
        .eq('id', id);
    } catch (err: any) {
      console.warn('Warning updating kalender in Supabase:', err);
    }

    const current = this.getLocalKalenderCache();
    this.setLocalKalenderCache(
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    this.notify();
    return true;
  }

  public async deleteKalender(id: string): Promise<boolean> {
    try {
      await this.client.from('kalender_pendidikan').delete().eq('id', id);
    } catch (err: any) {
      console.warn('Warning deleting kalender in Supabase:', err);
    }
    const current = this.getLocalKalenderCache();
    this.setLocalKalenderCache(current.filter((item) => item.id !== id));
    this.notify();
    return true;
  }

  // ==================== JADWAL PELAJARAN (KBM) ====================
  private getLocalJadwalCache(): JadwalPelajaran[] {
    try {
      const raw = localStorage.getItem('smart_presensi_jadwal_cache_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setLocalJadwalCache(items: JadwalPelajaran[]) {
    try {
      localStorage.setItem('smart_presensi_jadwal_cache_v1', JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  public async getJadwalPelajaran(rombel_id?: string): Promise<JadwalPelajaran[]> {
    try {
      let query = this.client.from('jadwal_pelajaran').select('*');
      if (rombel_id) {
        query = query.eq('rombel_id', rombel_id);
      }
      const { data, error } = await query.order('hari', { ascending: true });
      if (!error && Array.isArray(data)) {
        if (!rombel_id) {
          this.setLocalJadwalCache(data as JadwalPelajaran[]);
        }
        return data as JadwalPelajaran[];
      }
    } catch (err) {
      console.error('Error fetching jadwal pelajaran from Supabase:', err);
    }
    const cached = this.getLocalJadwalCache();
    return rombel_id ? cached.filter((j) => j.rombel_id === rombel_id) : cached;
  }

  // Method bantuan: Seed otomatis jadwal 1A ke Supabase / LocalCache bila tabel masih kosong
  public async ensure1AScheduleSeeded(rombelId1A: string): Promise<JadwalPelajaran[]> {
    if (!rombelId1A) return [];
    try {
      const existing = await this.getJadwalPelajaran(rombelId1A);
      if (existing && existing.length > 0) {
        return existing;
      }

      // Buat batch insert untuk 20 sesi mata pelajaran kelas 1A
      const payload = DEFAULT_SCHEDULE_1A.map((item) => ({
        rombel_id: rombelId1A,
        hari: item.hari,
        jam_mulai: item.jam_mulai,
        jam_selesai: item.jam_selesai,
        mata_pelajaran: item.mata_pelajaran,
        guru_pengampu: item.guru_pengampu,
      }));

      const { data: inserted, error } = await this.client
        .from('jadwal_pelajaran')
        .insert(payload)
        .select();

      if (!error && Array.isArray(inserted) && inserted.length > 0) {
        const current = this.getLocalJadwalCache().filter((j) => j.rombel_id !== rombelId1A);
        this.setLocalJadwalCache([...current, ...(inserted as JadwalPelajaran[])]);
        this.notify();
        return inserted as JadwalPelajaran[];
      }
    } catch (err) {
      console.warn('Fallback seeding 1A schedule locally:', err);
    }

    // Fallback simpan ke local storage cache
    const fallbackList: JadwalPelajaran[] = DEFAULT_SCHEDULE_1A.map((item, idx) => ({
      id: `jdw-1a-${idx}-${Date.now().toString(36)}`,
      rombel_id: rombelId1A,
      hari: item.hari,
      jam_mulai: item.jam_mulai,
      jam_selesai: item.jam_selesai,
      mata_pelajaran: item.mata_pelajaran,
      guru_pengampu: item.guru_pengampu,
      created_at: new Date().toISOString(),
    }));

    const current = this.getLocalJadwalCache().filter((j) => j.rombel_id !== rombelId1A);
    this.setLocalJadwalCache([...current, ...fallbackList]);
    this.notify();
    return fallbackList;
  }

  public async addJadwalPelajaran(data: Omit<JadwalPelajaran, 'id' | 'created_at'>): Promise<JadwalPelajaran> {
    const fallbackItem: JadwalPelajaran = {
      id: 'jdw-' + Date.now().toString(36),
      rombel_id: data.rombel_id,
      hari: data.hari,
      jam_mulai: data.jam_mulai,
      jam_selesai: data.jam_selesai,
      mata_pelajaran: data.mata_pelajaran.trim(),
      guru_pengampu: data.guru_pengampu.trim(),
      created_at: new Date().toISOString(),
    };

    try {
      const { data: resData, error } = await this.client
        .from('jadwal_pelajaran')
        .insert([{
          rombel_id: data.rombel_id,
          hari: data.hari,
          jam_mulai: data.jam_mulai,
          jam_selesai: data.jam_selesai,
          mata_pelajaran: data.mata_pelajaran.trim(),
          guru_pengampu: data.guru_pengampu.trim(),
        }])
        .select()
        .single();
      if (!error && resData) {
        const current = this.getLocalJadwalCache();
        this.setLocalJadwalCache([...current, resData as JadwalPelajaran]);
        this.notify();
        return resData as JadwalPelajaran;
      }
    } catch (err: any) {
      console.warn('Fallback saving jadwal pelajaran to localStorage:', err);
    }

    const current = this.getLocalJadwalCache();
    this.setLocalJadwalCache([...current, fallbackItem]);
    this.notify();
    return fallbackItem;
  }

  public async updateJadwalPelajaran(
    id: string,
    updates: Partial<Omit<JadwalPelajaran, 'id' | 'created_at'>>
  ): Promise<boolean> {
    try {
      const payload: Record<string, any> = {};
      if (updates.rombel_id !== undefined) payload.rombel_id = updates.rombel_id;
      if (updates.hari !== undefined) payload.hari = updates.hari;
      if (updates.jam_mulai !== undefined) payload.jam_mulai = updates.jam_mulai;
      if (updates.jam_selesai !== undefined) payload.jam_selesai = updates.jam_selesai;
      if (updates.mata_pelajaran !== undefined) payload.mata_pelajaran = updates.mata_pelajaran.trim();
      if (updates.guru_pengampu !== undefined) payload.guru_pengampu = updates.guru_pengampu.trim();

      await this.client
        .from('jadwal_pelajaran')
        .update(payload)
        .eq('id', id);
    } catch (err: any) {
      console.warn('Warning updating jadwal pelajaran in Supabase:', err);
    }

    const current = this.getLocalJadwalCache();
    this.setLocalJadwalCache(
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    this.notify();
    return true;
  }

  public async deleteJadwalPelajaran(id: string): Promise<boolean> {
    try {
      await this.client.from('jadwal_pelajaran').delete().eq('id', id);
    } catch (err: any) {
      console.warn('Warning deleting jadwal pelajaran in Supabase:', err);
    }
    const current = this.getLocalJadwalCache();
    this.setLocalJadwalCache(current.filter((item) => item.id !== id));
    this.notify();
    return true;
  }

  // ==================== APP USERS ====================
  private normalizeUserRole(rawRole: any, isMaster: boolean): UserRole {
    if (isMaster) return 'Super Admin';
    const r = String(rawRole || '').trim();
    if (r === 'Super Admin') return 'Super Admin';
    if (r === 'Admin' || r === 'Administrator') return 'Admin';
    if (r === 'Wali Kelas') return 'Wali Kelas';
    return 'Operator';
  }

  private mapAppUserRow(item: any): AppUser {
    const cleanUsername = String(item.username || '').trim();
    const isMaster = Boolean(item.is_master) || cleanUsername.toLowerCase() === 'naedie';
    const role = this.normalizeUserRole(item.role, isMaster);
    const waliMap = this.getWaliKelasMap();
    const extrasMap = this.getUserProfileExtrasMap();
    const extraByUser =
      extrasMap[String(item.id)] || extrasMap[cleanUsername.toLowerCase()] || {};
    const rawAssignedClass =
      item.assigned_class ||
      item.rombel ||
      item.assignedClass ||
      waliMap[cleanUsername.toLowerCase()] ||
      waliMap[String(item.id)] ||
      (role === 'Wali Kelas' ? '1A' : undefined);

    const resolvedAvatar =
      item.avatar_url !== undefined && item.avatar_url !== null && String(item.avatar_url).trim() !== ''
        ? String(item.avatar_url)
        : item.avatarUrl || extraByUser.avatarUrl || '';

    const cleanAssigned =
      role === 'Wali Kelas' && rawAssignedClass ? String(rawAssignedClass).trim() : undefined;

    return {
      id: String(item.id),
      username: cleanUsername,
      password: item.password !== undefined && item.password !== null ? String(item.password) : '',
      nama_lengkap: String(item.nama_lengkap || cleanUsername),
      nip: item.nip ? String(item.nip) : '',
      role,
      status: item.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      is_master: isMaster,
      assignedClass: cleanAssigned,
      assigned_class: cleanAssigned,
      rombel: cleanAssigned,
      avatar_url: resolvedAvatar,
      avatarUrl: resolvedAvatar,
      created_at: item.created_at,
    };
  }

  public async getAppUserByIdOrUsername(id?: string, username?: string): Promise<AppUser | null> {
    try {
      await this.hydrateMetadataMapsFromCloud();
      const cleanId = String(id || '').trim();
      const cleanUsername = String(username || '').trim();

      if (cleanId && !cleanId.startsWith('master-') && !cleanId.startsWith('local-')) {
        const { data, error } = await this.client
          .from('app_users')
          .select('*')
          .eq('id', cleanId)
          .maybeSingle();

        if (!error && data) {
          return this.mapAppUserRow(data);
        }
      }

      if (cleanUsername) {
        const { data, error } = await this.client
          .from('app_users')
          .select('*')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (!error && data) {
          return this.mapAppUserRow(data);
        }
      }
    } catch (err) {
      console.error('Error fetching single app user from Supabase:', err);
    }
    return null;
  }

  public async getAppUsers(): Promise<AppUser[]> {
    try {
      await this.hydrateMetadataMapsFromCloud();
      const { data, error } = await this.client
        .from('app_users')
        .select('*')
        .order('is_master', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        return data.map((item: any) => this.mapAppUserRow(item));
      }
    } catch (err) {
      console.error('Error fetching app users from Supabase:', err);
    }
    return [];
  }

  public async authenticateAppUser(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      return { success: false, error: 'Username dan Password wajib diisi.' };
    }

    try {
      await this.hydrateMetadataMapsFromCloud();
      const { data, error } = await this.client
        .from('app_users')
        .select('*')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (error) {
        console.error('Error authenticating app user:', error);
        return { success: false, error: 'Gagal menghubungi database autentikasi: ' + error.message };
      }

      if (!data) {
        return { success: false, error: `Akun dengan username "${cleanUsername}" tidak ditemukan.` };
      }

      const dbPassword = String(data.password ?? '');
      if (dbPassword !== password) {
        return { success: false, error: 'Password / kata sandi yang dimasukkan salah.' };
      }

      const mapped = this.mapAppUserRow(data);
      if (mapped.status !== 'Aktif') {
        return {
          success: false,
          error: 'Akun Anda berstatus Nonaktif. Silakan hubungi Super Admin / Admin sekolah.',
        };
      }

      return { success: true, user: mapped };
    } catch (err: any) {
      console.error('Error during authenticateAppUser:', err);
      return { success: false, error: err?.message || 'Gagal melakukan autentikasi.' };
    }
  }

  public async addAppUser(user: Omit<AppUser, 'id' | 'created_at'>): Promise<AppUser> {
    try {
      const cleanUsername = user.username.trim().toLowerCase();
      const isMaster = Boolean(user.is_master) || cleanUsername === 'naedie';
      const resolvedRole: UserRole = isMaster ? 'Super Admin' : user.role;
      const assignedClassVal =
        resolvedRole === 'Wali Kelas'
          ? (user.assignedClass || user.assigned_class || user.rombel || '').trim()
          : '';
      const rawAvatar = (user.avatar_url ?? user.avatarUrl ?? '').trim();

      if (resolvedRole === 'Wali Kelas' && assignedClassVal) {
        this.saveWaliKelasAssignment(undefined, cleanUsername, assignedClassVal);
      }

      const basePayload: Record<string, any> = {
        username: cleanUsername,
        password: (user.password || '').trim(),
        nama_lengkap: (user.nama_lengkap || '').trim(),
        nip: user.nip ? user.nip.trim() : null,
        role: resolvedRole,
        status: user.status || 'Aktif',
        is_master: isMaster,
      };
      if (rawAvatar) {
        basePayload.avatar_url = rawAvatar;
      }

      // Coba insert lengkap dengan assigned_class
      if (resolvedRole === 'Wali Kelas' && assignedClassVal) {
        const tryWithCol = await this.client
          .from('app_users')
          .insert([{ ...basePayload, assigned_class: assignedClassVal }])
          .select('*')
          .single();

        if (!tryWithCol.error && tryWithCol.data) {
          this.saveWaliKelasAssignment(String(tryWithCol.data.id), cleanUsername, assignedClassVal);
          this.notify();
          return this.mapAppUserRow(tryWithCol.data);
        }
      }

      const { data, error } = await this.client
        .from('app_users')
        .insert([basePayload])
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        if (resolvedRole === 'Wali Kelas' && assignedClassVal) {
          this.saveWaliKelasAssignment(String(data.id), cleanUsername, assignedClassVal);
        }
        this.notify();
        return this.mapAppUserRow(data);
      }
    } catch (err: any) {
      console.error('Error adding app user to Supabase:', err);
      throw new Error(err.message || 'Gagal menambahkan pengguna.');
    }
    throw new Error('Gagal menambahkan pengguna.');
  }

  public async updateAppUser(
    id: string,
    updates: {
      username: string;
      password?: string;
      nama_lengkap: string;
      nip?: string;
      role: AppUser['role'];
      status: AppUser['status'];
      assignedClass?: string;
      assigned_class?: string;
      rombel?: string;
      avatar_url?: string;
      avatarUrl?: string;
    }
  ): Promise<boolean> {
    try {
      const cleanId = String(id || '').trim();
      const cleanUsername = updates.username.trim().toLowerCase();
      const isMasterAccount = cleanUsername === 'naedie';
      const resolvedRole: UserRole = isMasterAccount ? 'Super Admin' : updates.role;
      const assignedClassVal =
        resolvedRole === 'Wali Kelas'
          ? (updates.assignedClass || updates.assigned_class || updates.rombel || '').trim()
          : '';

      this.saveWaliKelasAssignment(
        cleanId,
        cleanUsername,
        resolvedRole === 'Wali Kelas' ? assignedClassVal : ''
      );

      const hasAvatarUpdate = updates.avatar_url !== undefined || updates.avatarUrl !== undefined;
      const resolvedAvatarUrl = hasAvatarUpdate
        ? (updates.avatar_url ?? updates.avatarUrl ?? '').trim() || null
        : undefined;

      if (hasAvatarUpdate) {
        this.saveUserProfileExtras(cleanId, cleanUsername, {
          avatarUrl: resolvedAvatarUrl || '',
        });
      }

      const basePayload: Record<string, any> = {
        username: cleanUsername,
        nama_lengkap: updates.nama_lengkap.trim(),
        role: resolvedRole,
        status: isMasterAccount ? 'Aktif' : updates.status,
      };
      if (updates.nip !== undefined) {
        basePayload.nip = updates.nip.trim() || null;
      }
      if (updates.password !== undefined && updates.password.trim() !== '') {
        basePayload.password = updates.password.trim();
      }
      if (hasAvatarUpdate) {
        basePayload.avatar_url = resolvedAvatarUrl;
      }

      // Helper untuk menjalankan UPDATE ke tabel app_users berdasarkan id atau fallback ke username
      const executeUpdateOnAppUsers = async (payloadToTry: Record<string, any>): Promise<boolean> => {
        if (cleanId && !cleanId.startsWith('master-') && !cleanId.startsWith('local-')) {
          const resById = await this.client
            .from('app_users')
            .update(payloadToTry)
            .eq('id', cleanId)
            .select('id');

          if (!resById.error && Array.isArray(resById.data) && resById.data.length > 0) {
            return true;
          }
          if (resById.error) {
            return false;
          }
        }

        const resByUsername = await this.client
          .from('app_users')
          .update(payloadToTry)
          .ilike('username', cleanUsername)
          .select('id');

        if (!resByUsername.error && Array.isArray(resByUsername.data) && resByUsername.data.length > 0) {
          return true;
        }
        return !resByUsername.error;
      };

      // 1. Coba update lengkap termasuk assigned_class jika Wali Kelas atau assigned_class dikirim
      if (
        resolvedRole === 'Wali Kelas' ||
        updates.assignedClass !== undefined ||
        updates.assigned_class !== undefined
      ) {
        const okWithAssigned = await executeUpdateOnAppUsers({
          ...basePayload,
          assigned_class: resolvedRole === 'Wali Kelas' ? assignedClassVal || null : null,
        });
        if (okWithAssigned) {
          this.notify();
          return true;
        }
      }

      // 2. Update langsung dengan basePayload (username, password, nama_lengkap, nip, avatar_url, role, status)
      const okWithBase = await executeUpdateOnAppUsers(basePayload);
      if (!okWithBase && hasAvatarUpdate) {
        // Fallback jika terjadi kendala skema pada kolom opsional
        const { avatar_url: _omitAvatar, ...minimalPayload } = basePayload;
        await executeUpdateOnAppUsers(minimalPayload);
      }

      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error updating app user in Supabase credentials:', err);
      throw new Error(err.message || 'Gagal memperbarui pengguna.');
    }
  }

  public async deleteAppUser(id: string): Promise<boolean> {
    try {
      // Proteksi lapis kedua di sisi service agar akun Master Owner tidak bisa dihapus
      const { data: targetUser } = await this.client
        .from('app_users')
        .select('username, is_master')
        .eq('id', id)
        .maybeSingle();

      if (
        targetUser &&
        (Boolean(targetUser.is_master) ||
          String(targetUser.username || '').trim().toLowerCase() === 'naedie')
      ) {
        throw new Error('Proteksi Sistem: Akun MASTER OWNER tidak dapat dihapus!');
      }

      const { error } = await this.client.from('app_users').delete().eq('id', id);
      if (error) throw new Error(error.message);
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error deleting app user:', err);
      throw new Error(err.message || 'Gagal menghapus pengguna.');
    }
  }

  // ==================== ANNOUNCEMENTS (PENGUMUMAN SEKOLAH) ====================
  public async getAnnouncements(): Promise<Announcement[]> {
    try {
      const { data, error } = await this.client
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements from Supabase:', error);
        return [];
      }

      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          id: String(item.id),
          judul: String(item.judul || ''),
          isi: String(item.isi || ''),
          kategori: (item.kategori || 'Akademik') as AnnouncementCategory,
          target_rombel: String(item.target_rombel || 'Semua Kelas'),
          tanggal: String(
            item.tanggal ||
              (item.created_at ? String(item.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10))
          ),
          is_pinned: Boolean(item.is_pinned),
          broadcast_wa: Boolean(item.broadcast_wa),
          created_at: item.created_at || new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error('Error fetching announcements from Supabase:', err);
    }
    return [];
  }

  public async addAnnouncement(
    payload: Omit<Announcement, 'id' | 'created_at'>
  ): Promise<{ announcement: Announcement; broadcastCount: number }> {
    const nowIso = new Date().toISOString();
    const cleanJudul = payload.judul.trim();
    const cleanIsi = payload.isi.trim();
    const cleanKategori = payload.kategori;
    const cleanTargetRombel = (payload.target_rombel || 'Semua Kelas').trim();
    const cleanTanggal = payload.tanggal || nowIso.slice(0, 10);
    const cleanIsPinned = Boolean(payload.is_pinned);
    const cleanBroadcastWa = Boolean(payload.broadcast_wa);

    const { data, error } = await this.client
      .from('announcements')
      .insert([
        {
          judul: cleanJudul,
          isi: cleanIsi,
          kategori: cleanKategori,
          target_rombel: cleanTargetRombel,
          tanggal: cleanTanggal,
          is_pinned: cleanIsPinned,
          broadcast_wa: cleanBroadcastWa,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error adding announcement to Supabase:', error);
      throw new Error(error.message || 'Gagal menyimpan pengumuman ke Supabase.');
    }

    const createdItem: Announcement = {
      id: String(data.id),
      judul: String(data.judul || cleanJudul),
      isi: String(data.isi || cleanIsi),
      kategori: (data.kategori || cleanKategori) as AnnouncementCategory,
      target_rombel: String(data.target_rombel || cleanTargetRombel),
      tanggal: String(data.tanggal || cleanTanggal),
      is_pinned: Boolean(data.is_pinned),
      broadcast_wa: Boolean(data.broadcast_wa),
      created_at: data.created_at || nowIso,
    };

    let broadcastCount = 0;
    if (createdItem.broadcast_wa) {
      try {
        const [students, rombels] = await Promise.all([
          this.getStudents(),
          this.getRombel(),
        ]);

        const targetRaw = String(createdItem.target_rombel || 'Semua Kelas').trim();
        const targetLower = targetRaw.toLowerCase();

        // Cocokkan juga ID rombel jika target_rombel berupa nama kelas (misal "1A") atau sebaliknya
        const matchedRombelObj = rombels.find(
          (r) =>
            String(r.id).trim().toLowerCase() === targetLower ||
            String(r.nama_kelas).trim().toLowerCase() === targetLower
        );

        const targetStudents = students.filter((st) => {
          const phone = String(st.no_wa_wali || '').trim();
          if (!phone) return false;

          if (!targetRaw || targetLower === 'semua kelas' || targetLower === 'all') {
            return true;
          }

          const stClassCandidates = [
            st.kelas,
            st.rombel_id,
            st.class_id,
            typeof st.rombel === 'object' && st.rombel ? st.rombel.nama_kelas : st.rombel,
            typeof st.rombel === 'object' && st.rombel ? st.rombel.id : undefined,
          ]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase());

          if (stClassCandidates.includes(targetLower)) return true;
          if (
            matchedRombelObj &&
            (stClassCandidates.includes(String(matchedRombelObj.id).trim().toLowerCase()) ||
              stClassCandidates.includes(String(matchedRombelObj.nama_kelas).trim().toLowerCase()))
          ) {
            return true;
          }

          return false;
        });

        if (targetStudents.length > 0) {
          const queueInsertPayload = targetStudents.map((st) => {
            const kelasLabel =
              st.kelas ||
              (typeof st.rombel === 'object' && st.rombel ? st.rombel.nama_kelas : '') ||
              createdItem.target_rombel;

            const messageText =
              `📢 *PENGUMUMAN SEKOLAH (${createdItem.kategori.toUpperCase()})*\n` +
              `*${createdItem.judul}*\n` +
              `Target: ${createdItem.target_rombel} | Tanggal: ${createdItem.tanggal}\n\n` +
              `${createdItem.isi}\n\n` +
              `_Pesan otomatis Sistem Informasi Sekolah untuk Wali dari *${st.nama}* (${kelasLabel})._`;

            return {
              no_wa_tujuan: String(st.no_wa_wali).trim(),
              isi_pesan: messageText,
              status: 'pending' as const,
            };
          });

          const { error: queueErr } = await this.client
            .from('wa_queue')
            .insert(queueInsertPayload);

          if (!queueErr) {
            broadcastCount = queueInsertPayload.length;
          } else {
            for (const item of queueInsertPayload) {
              try {
                await this.client.from('wa_queue').insert([item]);
                broadcastCount++;
              } catch {
                // Ignore individual error
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error broadcasting announcement to wa_queue:', err);
      }
    }

    this.notify();
    return { announcement: createdItem, broadcastCount };
  }

  public async togglePinAnnouncement(id: string, currentPin: boolean): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('announcements')
        .update({ is_pinned: !currentPin })
        .eq('id', id);

      if (error) {
        console.error('Error toggling announcement pin in Supabase:', error);
        throw new Error(error.message || 'Gagal memperbarui status sematan pengumuman.');
      }

      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error toggling announcement pin in Supabase:', err);
      throw new Error(err.message || 'Gagal memperbarui status sematan pengumuman.');
    }
  }

  public async deleteAnnouncement(id: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting announcement from Supabase:', error);
        throw new Error(error.message || 'Gagal menghapus pengumuman.');
      }

      this.notify();
      return true;
    } catch (err: any) {
      console.error('Error deleting announcement from Supabase:', err);
      throw new Error(err.message || 'Gagal menghapus pengumuman.');
    }
  }

  // ==================== BACKUP, RESTORE & MAINTENANCE ====================
  public async getDatabaseStats(): Promise<{
    students: number;
    rombel: number;
    attendance_log: number;
    wa_queue: number;
    wa_queue_sent: number;
    announcements: number;
    app_users: number;
    message_templates: number;
  }> {
    try {
      // Gunakan GET .select('id', { count: 'exact' }) (tanpa head: true) agar 100% akurat
      // menghitung seluruh baris dari awal di setiap tabel public.* Supabase
      const [
        studentsRes,
        rombelRes,
        attendanceRes,
        queueRes,
        announcementsRes,
        usersRes,
        templatesRes,
      ] = await Promise.all([
        this.client.from('students').select('id', { count: 'exact' }),
        this.client.from('rombel').select('id', { count: 'exact' }),
        this.client.from('attendance_log').select('id', { count: 'exact' }),
        this.client.from('wa_queue').select('id, status', { count: 'exact' }),
        this.client.from('announcements').select('id', { count: 'exact' }),
        this.client.from('app_users').select('id', { count: 'exact' }),
        this.client.from('message_templates').select('id', { count: 'exact' }),
      ]);

      const resolveCount = (res: { count: number | null; data: any[] | null }, fallback = 0) => {
        if (Array.isArray(res.data)) {
          return typeof res.count === 'number' && res.count > res.data.length
            ? res.count
            : res.data.length;
        }
        return typeof res.count === 'number' ? res.count : fallback;
      };

      const queueRows = Array.isArray(queueRes.data) ? queueRes.data : [];
      const sentRowsCount = queueRows.filter(
        (q: any) => String(q?.status || '').trim().toLowerCase() === 'sent'
      ).length;

      return {
        students: resolveCount(studentsRes, 0),
        rombel: resolveCount(rombelRes, 0),
        attendance_log: resolveCount(attendanceRes, 0),
        wa_queue: resolveCount(queueRes, 0),
        wa_queue_sent: sentRowsCount,
        announcements: resolveCount(announcementsRes, 0),
        app_users: resolveCount(usersRes, 0),
        message_templates: resolveCount(templatesRes, 20) || 20,
      };
    } catch (err) {
      console.error('Error getting database stats:', err);
      return {
        students: 0,
        rombel: 0,
        attendance_log: 0,
        wa_queue: 0,
        wa_queue_sent: 0,
        announcements: 0,
        app_users: 0,
        message_templates: 20,
      };
    }
  }

  public async fetchDatabaseSnapshot(includeAttendanceLogs: boolean = true): Promise<{
    app_settings: any[];
    rombel: any[];
    students: any[];
    app_users: any[];
    message_templates: any[];
    announcements: any[];
    attendance_log: any[];
  }> {
    // Ambil seluruh data dari 7 tabel utama sesuai skema public.* di Supabase
    // Untuk attendance_log, ambil seluruh riwayat dari awal tanpa filter tanggal hari ini
    const [
      settingsRes,
      rombelRes,
      studentsRes,
      usersRes,
      templatesRes,
      announcementsRes,
      attendanceRes,
    ] = await Promise.all([
      this.client.from('app_settings').select('*'),
      this.client.from('rombel').select('*').order('nama_kelas', { ascending: true }),
      this.client.from('students').select('*').order('nama', { ascending: true }),
      this.client.from('app_users').select('*').order('created_at', { ascending: true }),
      this.client.from('message_templates').select('*'),
      this.client.from('announcements').select('*').order('created_at', { ascending: false }),
      includeAttendanceLogs
        ? this.client.from('attendance_log').select('*').order('waktu', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    return {
      app_settings: Array.isArray(settingsRes.data) ? settingsRes.data : [],
      rombel: Array.isArray(rombelRes.data) ? rombelRes.data : [],
      students: Array.isArray(studentsRes.data) ? studentsRes.data : [],
      app_users: Array.isArray(usersRes.data) ? usersRes.data : [],
      message_templates:
        Array.isArray(templatesRes.data) && templatesRes.data.length > 0
          ? templatesRes.data
          : this.getLocalCachedTemplates(),
      announcements: Array.isArray(announcementsRes.data) ? announcementsRes.data : [],
      attendance_log: Array.isArray(attendanceRes.data) ? attendanceRes.data : [],
    };
  }

  public async getAllAttendanceLogsForCsv(): Promise<
    Array<{
      id: string;
      waktu: string;
      uid_kartu: string;
      nama_siswa: string;
      nisn: string;
      kelas: string;
      status_kehadiran: string;
    }>
  > {
    const [{ data: logRows }, students] = await Promise.all([
      this.client.from('attendance_log').select('*').order('waktu', { ascending: false }),
      this.getStudents(),
    ]);

    const rows = Array.isArray(logRows) ? logRows : [];
    return rows.map((item: any) => {
      const rawUid = String(item.uid_kartu || item.rfid_uid || item.uid || '').trim();
      const lowerUid = rawUid.toLowerCase();
      const matched = students.find((st) => {
        if (item.student_id && st.id === item.student_id) return true;
        const candidates = [st.uid_kartu, st.rfid_uid, st.nisn, st.nis];
        return (
          lowerUid !== '' &&
          candidates.some((v) => v && String(v).trim().toLowerCase() === lowerUid)
        );
      });

      return {
        id: String(item.id || ''),
        waktu: String(item.waktu || ''),
        uid_kartu: rawUid,
        nama_siswa: matched?.nama || item.student_name || `Siswa (${rawUid})`,
        nisn: matched?.nisn || '-',
        kelas: matched?.kelas || '-',
        status_kehadiran: String(item.status_kehadiran || ''),
      };
    });
  }

  /**
   * Pulihkan Database (Sequential 1-Click Upsert dari Tabel Induk ke Tabel Anak):
   * Urutan wajib:
   * 1. public.app_settings
   * 2. public.rombel
   * 3. public.students
   * 4. public.app_users
   * 5. public.message_templates
   * 6. public.announcements
   * 7. public.attendance_log
   *
   * Setiap baris dibersihkan dari properti virtual/relasi join sebelum di-upsert.
   */
  public async restoreDatabaseSnapshot(rawData: {
    app_settings?: any[];
    rombel?: any[];
    students?: any[];
    app_users?: any[];
    message_templates?: any[];
    announcements?: any[];
    attendance_log?: any[];
  }): Promise<{
    success: boolean;
    restoredCounts: Record<string, number>;
    warnings: string[];
  }> {
    const restoredCounts: Record<string, number> = {
      app_settings: 0,
      rombel: 0,
      students: 0,
      app_users: 0,
      message_templates: 0,
      announcements: 0,
      attendance_log: 0,
    };
    const warnings: string[] = [];

    // 1. public.app_settings (Tabel Konfigurasi Induk)
    if (Array.isArray(rawData.app_settings) && rawData.app_settings.length > 0) {
      const cleanSettings = rawData.app_settings.map((row: any) => ({
        id: Number(row.id) || 1,
        app_title: String(row.app_title ?? 'SMART PRESENSI'),
        app_subtitle: String(
          row.app_subtitle ?? 'Sistem Informasi Presensi & Akademik Sekolah'
        ),
        app_logo: String(row.app_logo ?? ''),
        wa_api_token: String(row.wa_api_token ?? ''),
        auto_mode: typeof row.auto_mode === 'boolean' ? row.auto_mode : true,
        time_config:
          row.time_config && typeof row.time_config === 'object' ? row.time_config : {},
        updated_at: row.updated_at || new Date().toISOString(),
      }));
      const { error } = await this.client
        .from('app_settings')
        .upsert(cleanSettings, { onConflict: 'id' });
      if (error) {
        warnings.push(`app_settings: ${error.message}`);
      } else {
        restoredCounts.app_settings = cleanSettings.length;
      }
    }

    // 2. public.rombel (Tabel Induk Kelas - wajib sebelum students karena Foreign Key rombel_id)
    const validRombelIds = new Set<string>();
    if (Array.isArray(rawData.rombel) && rawData.rombel.length > 0) {
      const cleanRombel = rawData.rombel.map((row: any) => {
        // Hanya ambil kolom asli tabel public.rombel
        const item: Record<string, any> = {
          nama_kelas: String(row.nama_kelas || '').trim(),
          nama_wali_kelas: String(row.nama_wali_kelas || '').trim(),
          jadwal_harian:
            row.jadwal_harian && typeof row.jadwal_harian === 'object'
              ? row.jadwal_harian
              : DEFAULT_JADWAL_HARIAN,
        };
        if (row.id) {
          item.id = String(row.id);
          validRombelIds.add(String(row.id));
        }
        if (row.created_at) item.created_at = row.created_at;
        return item;
      });
      const { error } = await this.client
        .from('rombel')
        .upsert(cleanRombel, { onConflict: 'id' });
      if (error) {
        warnings.push(`rombel: ${error.message}`);
      } else {
        restoredCounts.rombel = cleanRombel.length;
      }
    }

    // Ambil daftar ID rombel yang ada di database saat ini untuk memastikan FK rombel_id pada students aman
    try {
      const { data: dbRombels } = await this.client.from('rombel').select('id');
      if (Array.isArray(dbRombels)) {
        dbRombels.forEach((r: any) => {
          if (r?.id) validRombelIds.add(String(r.id));
        });
      }
    } catch {
      // ignore
    }

    // 3. public.students (Tabel Siswa - bersihkan properti virtual seperti rombel, kelas, class_id, nis)
    if (Array.isArray(rawData.students) && rawData.students.length > 0) {
      const cleanStudents = rawData.students.map((row: any) => {
        const uid = String(row.uid_kartu || row.rfid_uid || '').trim().toUpperCase() || null;
        const candidateRombelId = row.rombel_id || row.class_id || null;
        const safeRombelId =
          candidateRombelId && validRombelIds.has(String(candidateRombelId))
            ? String(candidateRombelId)
            : candidateRombelId && validRombelIds.size === 0
            ? String(candidateRombelId)
            : null;

        // Hanya kolom asli public.students (termasuk avatar_url)
        const item: Record<string, any> = {
          nama: String(row.nama || '').trim(),
          uid_kartu: uid,
          rfid_uid: uid,
          nisn: row.nisn ? String(row.nisn).trim() : null,
          no_wa_wali: String(row.no_wa_wali || '').trim(),
          rombel_id: safeRombelId,
          ...(row.avatar_url ? { avatar_url: String(row.avatar_url).trim() } : {}),
        };
        if (row.id) item.id = String(row.id);
        if (row.created_at) item.created_at = row.created_at;
        return item;
      });
      const { error } = await this.client
        .from('students')
        .upsert(cleanStudents, { onConflict: 'id' });
      if (error) {
        warnings.push(`students: ${error.message}`);
      } else {
        restoredCounts.students = cleanStudents.length;
      }
    }

    // 4. public.app_users (Tabel Akun Pengguna - bersihkan properti virtual seperti password_hash)
    if (Array.isArray(rawData.app_users) && rawData.app_users.length > 0) {
      const cleanUsers = rawData.app_users.map((row: any) => {
        const uname = String(row.username || '').trim().toLowerCase();
        const isMaster = Boolean(row.is_master) || uname === 'naedie';
        const item: Record<string, any> = {
          username: uname,
          password:
            row.password !== undefined && row.password !== null
              ? String(row.password)
              : '123456',
          nama_lengkap: String(row.nama_lengkap || uname).trim(),
          nip: row.nip ? String(row.nip).trim() : null,
          role: this.normalizeUserRole(row.role, isMaster),
          status: row.status === 'Nonaktif' && !isMaster ? 'Nonaktif' : 'Aktif',
          is_master: isMaster,
        };
        if (row.id) item.id = String(row.id);
        if (row.created_at) item.created_at = row.created_at;
        return item;
      });
      const { error } = await this.client
        .from('app_users')
        .upsert(cleanUsers, { onConflict: 'id' });
      if (error) {
        warnings.push(`app_users: ${error.message}`);
      } else {
        restoredCounts.app_users = cleanUsers.length;
      }
    }

    // 5. public.message_templates (20 Template WA - bersihkan properti virtual variation_number)
    if (Array.isArray(rawData.message_templates) && rawData.message_templates.length > 0) {
      const normalized = this.normalizeTemplateList(rawData.message_templates);
      this.saveLocalCachedTemplates(normalized);
      const hasUuids = rawData.message_templates.every((t: any) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(t.id || '')
        )
      );
      if (hasUuids) {
        const cleanTemplates = rawData.message_templates.map((t: any) => ({
          id: String(t.id),
          status_category: String(t.status_category || 'hadir_tepat'),
          message_text: String(t.message_text || ''),
        }));
        const { error } = await this.client
          .from('message_templates')
          .upsert(cleanTemplates, { onConflict: 'id' });
        if (error) {
          warnings.push(`message_templates: ${error.message}`);
        } else {
          restoredCounts.message_templates = cleanTemplates.length;
        }
      } else {
        await this.saveAllTemplates(normalized);
        restoredCounts.message_templates = normalized.length;
      }
    }

    // 6. public.announcements (Tabel Pengumuman)
    if (Array.isArray(rawData.announcements) && rawData.announcements.length > 0) {
      const cleanAnnouncements = rawData.announcements.map((row: any) => {
        const item: Record<string, any> = {
          judul: String(row.judul || '').trim(),
          isi: String(row.isi || '').trim(),
          kategori: String(row.kategori || 'Akademik'),
          target_rombel: String(row.target_rombel || 'Semua Kelas'),
          tanggal: String(row.tanggal || new Date().toISOString().slice(0, 10)),
          is_pinned: Boolean(row.is_pinned),
          broadcast_wa: Boolean(row.broadcast_wa),
        };
        if (row.id) item.id = String(row.id);
        if (row.created_at) item.created_at = row.created_at;
        return item;
      });
      const { error } = await this.client
        .from('announcements')
        .upsert(cleanAnnouncements, { onConflict: 'id' });
      if (error) {
        warnings.push(`announcements: ${error.message}`);
      } else {
        restoredCounts.announcements = cleanAnnouncements.length;
      }
    }

    // 7. public.attendance_log (Tabel Anak Riwayat Presensi - bersihkan properti virtual student_name, metode, kelas, rombel)
    if (Array.isArray(rawData.attendance_log) && rawData.attendance_log.length > 0) {
      const cleanLogs = rawData.attendance_log.map((row: any) => {
        const item: Record<string, any> = {
          uid_kartu: String(row.uid_kartu || row.rfid_uid || '').trim().toUpperCase(),
          status_kehadiran: String(row.status_kehadiran || 'hadir_tepat'),
          waktu: row.waktu || new Date().toISOString(),
        };
        if (row.id) item.id = String(row.id);
        return item;
      });
      const { error } = await this.client
        .from('attendance_log')
        .upsert(cleanLogs, { onConflict: 'id' });
      if (error) {
        warnings.push(`attendance_log: ${error.message}`);
      } else {
        restoredCounts.attendance_log = cleanLogs.length;
      }
    }

    this.notify();
    return {
      success: warnings.length === 0,
      restoredCounts,
      warnings,
    };
  }

  public async clearSentQueueWithCount(): Promise<{ deletedCount: number }> {
    const { data: queueRows } = await this.client.from('wa_queue').select('id, status');
    const sentIds = (Array.isArray(queueRows) ? queueRows : [])
      .filter((r: any) => String(r?.status || '').trim().toLowerCase() === 'sent')
      .map((r: any) => r.id)
      .filter(Boolean);

    if (sentIds.length > 0) {
      const { error } = await this.client.from('wa_queue').delete().in('id', sentIds);
      if (error) {
        throw new Error(error.message);
      }
    } else {
      await this.client.from('wa_queue').delete().eq('status', 'sent');
    }

    this.notify();
    return { deletedCount: sentIds.length };
  }

  public async purgeAttendanceLogs(
    mode: 'older_1m' | 'older_3m' | 'older_6m' | 'month' | 'all',
    monthValue?: string
  ): Promise<{ deletedCount: number }> {
    const now = new Date();
    let selectQuery = this.client.from('attendance_log').select('id');
    let deleteQuery = this.client.from('attendance_log').delete();

    if (mode === 'older_1m' || mode === 'older_3m' || mode === 'older_6m') {
      const monthsBack = mode === 'older_1m' ? 1 : mode === 'older_3m' ? 3 : 6;
      const cutoff = new Date(
        now.getFullYear(),
        now.getMonth() - monthsBack,
        now.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();
      selectQuery = selectQuery.lt('waktu', cutoff);
      deleteQuery = deleteQuery.lt('waktu', cutoff);
    } else if (mode === 'month' && monthValue) {
      const [y, m] = monthValue.split('-').map(Number);
      const startIso = new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString();
      const endIso = new Date(y, m, 1, 0, 0, 0, 0).toISOString();
      selectQuery = selectQuery.gte('waktu', startIso).lt('waktu', endIso);
      deleteQuery = deleteQuery.gte('waktu', startIso).lt('waktu', endIso);
    } else if (mode === 'all') {
      selectQuery = selectQuery.not('id', 'is', null);
      deleteQuery = deleteQuery.not('id', 'is', null);
    }

    const { data: matchingRows } = await selectQuery;
    const targetCount = Array.isArray(matchingRows) ? matchingRows.length : 0;

    if (targetCount > 0) {
      const { error } = await deleteQuery;
      if (error) {
        throw new Error(error.message);
      }
    }

    this.notify();
    return { deletedCount: targetCount };
  }

  // ==================== POIN & KEDISIPLINAN (public.student_points) ====================
  private studentPointsRlsWarning: boolean = false;

  public hasStudentPointsRlsWarning(): boolean {
    return this.studentPointsRlsWarning;
  }

  private getLocalStudentPointsCache(): StudentPoint[] {
    try {
      const raw = localStorage.getItem('smart_presensi_student_points_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  private setLocalStudentPointsCache(items: StudentPoint[]): void {
    try {
      localStorage.setItem('smart_presensi_student_points_v1', JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  public async getStudentPoints(studentId?: string): Promise<StudentPoint[]> {
    try {
      const [studentsList, rombelList] = await Promise.all([
        this.getStudents(),
        this.getRombel(),
      ]);

      const studentMap = new Map<string, Student>();
      studentsList.forEach((s) => {
        studentMap.set(String(s.id).toLowerCase(), s);
      });

      const rombelMap = new Map<string, Rombel>();
      rombelList.forEach((r) => {
        rombelMap.set(String(r.id).toLowerCase(), r);
      });

      const enrichItem = (row: any): StudentPoint => {
        const stId = String(row.student_id || '');
        const joinedStudent =
          row.students && !Array.isArray(row.students)
            ? row.students
            : Array.isArray(row.students) && row.students.length > 0
            ? row.students[0]
            : null;
        const matchedStudent = studentMap.get(stId.toLowerCase());

        const rawJenis = String(row.jenis || '').trim();
        const jenis: PointActionType =
          rawJenis.toLowerCase() === 'prestasi' ? 'Prestasi' : 'Pelanggaran';
        const rawPoin = Number(row.poin) || 0;
        const normalizedPoin =
          jenis === 'Pelanggaran' ? -Math.abs(rawPoin) : Math.abs(rawPoin);

        const resolvedRombelId =
          joinedStudent?.rombel_id ||
          matchedStudent?.rombel_id ||
          matchedStudent?.class_id ||
          row.rombel_id ||
          undefined;
        const matchedRombel = resolvedRombelId
          ? rombelMap.get(String(resolvedRombelId).toLowerCase())
          : undefined;

        const resolvedName =
          joinedStudent?.nama || matchedStudent?.nama || row.student_name || 'Siswa';
        const resolvedNis =
          joinedStudent?.nis ||
          joinedStudent?.nisn ||
          matchedStudent?.nisn ||
          matchedStudent?.nis ||
          row.student_nisn ||
          '-';
        const resolvedUid =
          joinedStudent?.uid_kartu ||
          joinedStudent?.rfid_uid ||
          matchedStudent?.uid_kartu ||
          matchedStudent?.rfid_uid ||
          row.student_uid ||
          '-';
        const resolvedKelas =
          matchedRombel?.nama_kelas || matchedStudent?.kelas || row.student_kelas || 'Umum';

        return {
          id: String(row.id),
          student_id: stId,
          jenis,
          keterangan: String(row.keterangan || '').trim(),
          poin: normalizedPoin,
          pencatat: String(row.pencatat || 'Admin Sekolah').trim(),
          created_at: row.created_at || new Date().toISOString(),
          students: joinedStudent || {
            nama: resolvedName,
            nis: String(resolvedNis),
            nisn: String(resolvedNis),
            rombel_id: resolvedRombelId,
          },
          student_name: resolvedName,
          student_nisn: String(resolvedNis),
          student_uid: String(resolvedUid),
          student_kelas: resolvedKelas,
          rombel_id: resolvedRombelId,
        };
      };

      // Query utama dengan join ke tabel students sesuai spesifikasi:
      // await supabase.from('student_points').select('*, students(nama, nis, rombel_id)').order('created_at', { ascending: false })
      let query = this.client
        .from('student_points')
        .select('*, students(nama, nis, rombel_id)')
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      let { data, error } = await query;

      // Apabila kolom di tabel students bernama 'nisn' (bukan 'nis'), lakukan fallback ke select('*, students(*)')
      if (error) {
        let fallbackJoinQuery = this.client
          .from('student_points')
          .select('*, students(*)')
          .order('created_at', { ascending: false });

        if (studentId) {
          fallbackJoinQuery = fallbackJoinQuery.eq('student_id', studentId);
        }

        const retryJoin = await fallbackJoinQuery;
        if (!retryJoin.error) {
          data = retryJoin.data;
          error = null;
        } else {
          let plainQuery = this.client
            .from('student_points')
            .select('*')
            .order('created_at', { ascending: false });

          if (studentId) {
            plainQuery = plainQuery.eq('student_id', studentId);
          }

          const retryPlain = await plainQuery;
          data = retryPlain.data;
          error = retryPlain.error;
        }
      }

      const localCached = this.getLocalStudentPointsCache();

      if (!error && Array.isArray(data)) {
        const dbItems = data.map((row: any) => enrichItem(row));
        const dbIds = new Set(dbItems.map((item) => item.id));

        // Sinkronkan item lokal yang belum masuk ke Supabase apabila akses RLS sudah dibuka
        const unsyncedLocals = localCached.filter((loc) => !dbIds.has(loc.id));
        if (unsyncedLocals.length > 0 && !studentId) {
          for (const pending of unsyncedLocals) {
            const { data: syncedRow, error: syncErr } = await this.client
              .from('student_points')
              .insert([
                {
                  student_id: pending.student_id,
                  jenis: pending.jenis,
                  keterangan: pending.keterangan,
                  poin: pending.poin,
                  pencatat: pending.pencatat,
                },
              ])
              .select()
              .maybeSingle();

            if (!syncErr && syncedRow) {
              this.studentPointsRlsWarning = false;
              dbItems.unshift(enrichItem(syncedRow));
            } else if (syncErr && syncErr.code === '42501') {
              this.studentPointsRlsWarning = true;
              break;
            }
          }
        }

        // Gabungkan data DB dengan item lokal yang masih tertahan RLS (jika ada)
        const remainingUnsynced = this.studentPointsRlsWarning
          ? localCached
              .filter((loc) => !dbIds.has(loc.id))
              .map((loc) => enrichItem(loc))
          : [];

        const merged = [...remainingUnsynced, ...dbItems].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (!studentId) {
          this.setLocalStudentPointsCache(merged);
        }

        if (studentId) {
          return merged.filter(
            (item) => String(item.student_id).toLowerCase() === String(studentId).toLowerCase()
          );
        }
        return merged;
      }

      if (error && error.code === '42501') {
        this.studentPointsRlsWarning = true;
      }

      const enrichedLocal = localCached.map((row) => enrichItem(row));
      if (studentId) {
        return enrichedLocal.filter(
          (item) => String(item.student_id).toLowerCase() === String(studentId).toLowerCase()
        );
      }
      return enrichedLocal;
    } catch {
      const localCached = this.getLocalStudentPointsCache();
      if (studentId) {
        return localCached.filter(
          (item) => String(item.student_id).toLowerCase() === String(studentId).toLowerCase()
        );
      }
      return localCached;
    }
  }

  public async addStudentPoint(payload: {
    student_id: string;
    jenis: PointActionType;
    keterangan: string;
    poin: number;
    pencatat: string;
  }): Promise<{ savedToCloud: boolean; rlsWarning: boolean }> {
    const student_id = payload.student_id;
    const jenis: PointActionType =
      payload.jenis === 'Prestasi' ? 'Prestasi' : 'Pelanggaran';
    const absVal = Math.abs(Math.round(Number(payload.poin) || 0));
    const poin = jenis === 'Pelanggaran' ? -absVal : absVal;
    const keterangan = payload.keterangan.trim();
    const pencatat = (payload.pencatat || 'Admin Sekolah').trim();

    // Eksekusi perintah INSERT langsung ke tabel student_points:
    // await supabase.from('student_points').insert([{ student_id, jenis, keterangan, poin, pencatat }]);
    const { error } = await this.client
      .from('student_points')
      .insert([{ student_id, jenis, keterangan, poin, pencatat }]);

    if (!error) {
      this.studentPointsRlsWarning = false;
      this.notify();
      return { savedToCloud: true, rlsWarning: false };
    }

    // Jika tabel student_points di Supabase masih memblokir INSERT karena Row-Level Security (code 42501),
    // simpan ke cache sinkronisasi lokal agar data tidak hilang dan tampilkan panduan 1-klik buka RLS
    if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
      this.studentPointsRlsWarning = true;
    }

    const fallbackItem: StudentPoint = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'pt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      student_id,
      jenis,
      keterangan,
      poin,
      pencatat,
      created_at: new Date().toISOString(),
    };

    const currentLocal = this.getLocalStudentPointsCache();
    this.setLocalStudentPointsCache([fallbackItem, ...currentLocal]);
    this.notify();
    return { savedToCloud: false, rlsWarning: this.studentPointsRlsWarning };
  }

  public async updateStudentPoint(
    recordId: string,
    payload: {
      jenis: PointActionType;
      keterangan: string;
      poin: number;
      pencatat?: string;
    }
  ): Promise<{ updatedInCloud: boolean; rlsWarning: boolean }> {
    const jenis: PointActionType =
      payload.jenis === 'Prestasi' ? 'Prestasi' : 'Pelanggaran';
    const absVal = Math.abs(Math.round(Number(payload.poin) || 0));
    const poin = jenis === 'Pelanggaran' ? -absVal : absVal;
    const keterangan = payload.keterangan.trim();

    // Eksekusi perintah UPDATE langsung ke tabel student_points:
    // await supabase.from('student_points').update({ jenis, keterangan, poin }).eq('id', recordId);
    const { error } = await this.client
      .from('student_points')
      .update({ jenis, keterangan, poin })
      .eq('id', recordId);

    if (error && (error.code === '42501' || error.message?.toLowerCase().includes('row-level security'))) {
      this.studentPointsRlsWarning = true;
    } else if (!error) {
      this.studentPointsRlsWarning = false;
    }

    const currentLocal = this.getLocalStudentPointsCache();
    const updatedLocal = currentLocal.map((item) =>
      item.id === recordId
        ? {
            ...item,
            jenis,
            keterangan,
            poin,
            ...(payload.pencatat ? { pencatat: payload.pencatat.trim() } : {}),
          }
        : item
    );
    this.setLocalStudentPointsCache(updatedLocal);
    this.notify();

    return {
      updatedInCloud: !error,
      rlsWarning: this.studentPointsRlsWarning,
    };
  }

  public async deleteStudentPoint(recordId: string): Promise<boolean> {
    try {
      // Eksekusi perintah DELETE langsung ke tabel student_points:
      // await supabase.from('student_points').delete().eq('id', recordId);
      const { error } = await this.client
        .from('student_points')
        .delete()
        .eq('id', recordId);

      if (error && (error.code === '42501' || error.message?.toLowerCase().includes('row-level security'))) {
        this.studentPointsRlsWarning = true;
      }
    } catch {
      // ignore network/RLS error and ensure local cache is also cleaned
    }
    const currentLocal = this.getLocalStudentPointsCache().filter(
      (item) => item.id !== recordId
    );
    this.setLocalStudentPointsCache(currentLocal);
    this.notify();
    return true;
  }

  // ==================== PENGAJUAN IZIN / SAKIT (LEAVE REQUESTS & ABSENCE NOTES) ====================
  private getAbsenceNotesMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(ABSENCE_NOTES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  }

  private saveAbsenceNote(uidKartu: string, dateYMD: string, note: string): void {
    try {
      const map = this.getAbsenceNotesMap();
      map[`${uidKartu.trim().toUpperCase()}_${dateYMD}`] = note.trim();
      localStorage.setItem(ABSENCE_NOTES_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  private saveAbsenceNoteById(logId: string, note: string): void {
    try {
      const map = this.getAbsenceNotesMap();
      map[logId] = note.trim();
      localStorage.setItem(ABSENCE_NOTES_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  private getLocalLeaveRequests(): LeaveRequest[] {
    try {
      const raw = localStorage.getItem(LEAVE_REQUESTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } else {
        // Initial sample pending requests for seamless demonstration of approval flow
        const todayStr = new Date().toISOString().slice(0, 10);
        const now = Date.now();
        const initialSeeds: LeaveRequest[] = [
          {
            id: 'leave-seed-01',
            student_id: 'std-2',
            uid_kartu: 'A1045F20',
            student_name: 'Aisyah Putri Rahmadani',
            student_kelas: 'X RPL 1',
            jenis: 'izin',
            tanggal: todayStr,
            alasan: 'Menghadiri acara pernikahan keluarga di luar kota bersama orang tua.',
            status: 'pending',
            created_at: new Date(now - 25 * 60 * 1000).toISOString(),
          },
          {
            id: 'leave-seed-02',
            student_id: 'std-1',
            uid_kartu: 'E2000019',
            student_name: 'Muhammad Rizky Pratama',
            student_kelas: 'X RPL 1',
            jenis: 'sakit',
            tanggal: todayStr,
            alasan: 'Demam tinggi dan sakit flu, sedang istirahat di rumah.',
            status: 'pending',
            created_at: new Date(now - 55 * 60 * 1000).toISOString(),
          },
        ];
        this.setLocalLeaveRequests(initialSeeds);
        return initialSeeds;
      }
    } catch {
      // ignore
    }
    return [];
  }

  private setLocalLeaveRequests(list: LeaveRequest[], emitEvent = true): void {
    try {
      const nextRaw = JSON.stringify(list);
      const prevRaw = localStorage.getItem(LEAVE_REQUESTS_STORAGE_KEY);
      localStorage.setItem(LEAVE_REQUESTS_STORAGE_KEY, nextRaw);
      if (typeof window !== 'undefined' && (emitEvent || prevRaw !== nextRaw)) {
        window.dispatchEvent(new CustomEvent('leave_requests_updated'));
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('smart_presensi_leave_requests_channel');
            bc.postMessage({ type: 'leave_requests_updated', timestamp: Date.now() });
            bc.close();
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private async syncLeaveRequestsToCloud(list: LeaveRequest[]): Promise<void> {
    try {
      const { data: existingRow } = await this.client
        .from('app_settings')
        .select('time_config')
        .eq('id', 1)
        .maybeSingle();

      const existingTc =
        existingRow?.time_config && typeof existingRow.time_config === 'object'
          ? existingRow.time_config
          : {};

      await this.client
        .from('app_settings')
        .update({
          time_config: {
            ...existingTc,
            leaveRequests: list.slice(0, 150),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
    } catch {
      // ignore cloud fallback errors
    }
  }

  private normalizeLeaveRequestRow(row: any): LeaveRequest | null {
    if (!row || typeof row !== 'object' || !row.id) return null;
    const rawJenis = String(row.jenis || 'izin').toLowerCase().trim();
    const rawStatus = String(row.status || 'pending').toLowerCase().trim();
    const status: LeaveRequestStatus =
      rawStatus === 'approved'
        ? 'approved'
        : rawStatus === 'rejected'
        ? 'rejected'
        : 'pending';

    return {
      id: String(row.id),
      student_id: String(row.student_id || ''),
      uid_kartu: String(row.uid_kartu || '').trim().toUpperCase(),
      student_name: String(row.student_name || 'Siswa').trim(),
      student_kelas: String(row.student_kelas || 'Umum').trim(),
      jenis: rawJenis === 'sakit' ? 'sakit' : 'izin',
      tanggal: String(row.tanggal || new Date().toISOString().slice(0, 10)),
      alasan: String(row.alasan || '').trim(),
      status,
      created_at: String(row.created_at || new Date().toISOString()),
      ...(row.reviewed_at ? { reviewed_at: String(row.reviewed_at) } : {}),
    };
  }

  private mergeLeaveRequestLists(...lists: LeaveRequest[][]): LeaveRequest[] {
    const map = new Map<string, LeaveRequest>();
    for (const list of lists) {
      for (const rawItem of list) {
        const item = this.normalizeLeaveRequestRow(rawItem);
        if (!item) continue;
        const existing = map.get(item.id);
        if (!existing) {
          map.set(item.id, item);
        } else {
          // Prefer item that has been reviewed (approved/rejected) or has newer reviewed_at
          const existingReviewedTime = existing.reviewed_at
            ? new Date(existing.reviewed_at).getTime()
            : 0;
          const itemReviewedTime = item.reviewed_at
            ? new Date(item.reviewed_at).getTime()
            : 0;

          if (
            (existing.status === 'pending' && item.status !== 'pending') ||
            itemReviewedTime > existingReviewedTime
          ) {
            map.set(item.id, item);
          }
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  private isLeaveRequestsTableNotFoundError(error: any, status?: number): boolean {
    if (status === 404) return true;
    if (!error) return false;
    const code = String(error.code || '').toUpperCase();
    const errStatus = Number(error.status || error.statusCode || 0);
    const msg = String(error.message || '').toLowerCase();
    const details = String(error.details || '').toLowerCase();
    return (
      errStatus === 404 ||
      code === '42P01' ||
      code === 'PGRST205' ||
      msg.includes('42p01') ||
      msg.includes('pgrst205') ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table') ||
      details.includes('does not exist')
    );
  }

  private markLeaveRequestsTableMissing(): void {
    this.leaveRequestsTableMissing = true;
    if (!this.leaveRequestsMissingLogged) {
      this.leaveRequestsMissingLogged = true;
      console.warn(
        '[Smart Presensi] Tabel public.leave_requests belum tersedia di Supabase (404 / 42P01 / PGRST205). Polling otomatis dihentikan untuk sesi ini.'
      );
    }
  }

  public isLeaveRequestsTableMissing(): boolean {
    return this.leaveRequestsTableMissing;
  }

  private async queryLeaveRequestsTableOnce(): Promise<{ data: LeaveRequest[] | null; missing: boolean }> {
    if (this.leaveRequestsTableMissing) {
      return { data: null, missing: true };
    }

    if (this.inFlightLeaveRequestsQuery) {
      return this.inFlightLeaveRequestsQuery;
    }

    this.inFlightLeaveRequestsQuery = (async () => {
      try {
        const res = await this.client
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150);

        if (res.error) {
          if (this.isLeaveRequestsTableNotFoundError(res.error, res.status)) {
            this.markLeaveRequestsTableMissing();
            return { data: null, missing: true };
          }
          return { data: null, missing: false };
        }

        if (Array.isArray(res.data)) {
          const normalized = res.data
            .map((r: any) => this.normalizeLeaveRequestRow(r))
            .filter((r: LeaveRequest | null): r is LeaveRequest => r !== null);
          return { data: normalized, missing: false };
        }

        return { data: [], missing: false };
      } catch (err: any) {
        if (this.isLeaveRequestsTableNotFoundError(err, err?.status)) {
          this.markLeaveRequestsTableMissing();
          return { data: null, missing: true };
        }
        return { data: null, missing: false };
      } finally {
        this.inFlightLeaveRequestsQuery = null;
      }
    })();

    return this.inFlightLeaveRequestsQuery;
  }

  public async getLeaveRequests(studentIdOrStudent?: string | any): Promise<LeaveRequest[]> {
    // Jika tabel leave_requests tidak tersedia di sesi ini, hentikan query & kembalikan []
    if (this.leaveRequestsTableMissing) {
      return [];
    }

    const tableQueryResult = await this.queryLeaveRequestsTableOnce();
    if (tableQueryResult.missing) {
      return [];
    }

    const localList = this.getLocalLeaveRequests();
    const tableList: LeaveRequest[] = tableQueryResult.data || [];
    let settingsCloudList: LeaveRequest[] = [];

    try {
      const settingsRes = await this.client
        .from('app_settings')
        .select('time_config')
        .eq('id', 1)
        .maybeSingle();

      if (
        !settingsRes.error &&
        settingsRes.data?.time_config &&
        typeof settingsRes.data.time_config === 'object'
      ) {
        const tc = settingsRes.data.time_config as any;
        if (Array.isArray(tc.leaveRequests)) {
          settingsCloudList = tc.leaveRequests
            .map((r: any) => this.normalizeLeaveRequestRow(r))
            .filter((r: LeaveRequest | null): r is LeaveRequest => r !== null);
        }
      }
    } catch {
      // Fallback to tableList & localList if offline
    }

    const mergedList = this.mergeLeaveRequestLists(
      tableList,
      settingsCloudList,
      localList
    );

    // Simpan ke localStorage tanpa memicu infinite loop (hanya emit jika ada perubahan)
    this.setLocalLeaveRequests(mergedList, false);

    if (!studentIdOrStudent) return mergedList;

    const identifiers: string[] = [];
    if (typeof studentIdOrStudent === 'string') {
      identifiers.push(studentIdOrStudent.toLowerCase().trim());
    } else if (typeof studentIdOrStudent === 'object' && studentIdOrStudent !== null) {
      if (studentIdOrStudent.id) identifiers.push(String(studentIdOrStudent.id).toLowerCase().trim());
      if (studentIdOrStudent.uid_kartu) identifiers.push(String(studentIdOrStudent.uid_kartu).toLowerCase().trim());
      if (studentIdOrStudent.rfid_uid) identifiers.push(String(studentIdOrStudent.rfid_uid).toLowerCase().trim());
      if (studentIdOrStudent.nisn) identifiers.push(String(studentIdOrStudent.nisn).toLowerCase().trim());
      if (studentIdOrStudent.nis) identifiers.push(String(studentIdOrStudent.nis).toLowerCase().trim());
      if (studentIdOrStudent.nama) identifiers.push(String(studentIdOrStudent.nama).toLowerCase().trim());
    }

    return mergedList.filter((item) => {
      const itemStudentId = String(item.student_id || '').toLowerCase().trim();
      const itemUid = String(item.uid_kartu || '').toLowerCase().trim();
      const itemName = String(item.student_name || '').toLowerCase().trim();
      return identifiers.some(
        (id) => id && (id === itemStudentId || id === itemUid || id === itemName)
      );
    });
  }

  public async submitLeaveRequest(payload: {
    student_id: string;
    uid_kartu: string;
    student_name: string;
    student_kelas: string;
    jenis: 'izin' | 'sakit';
    tanggal: string;
    alasan: string;
  }): Promise<LeaveRequest> {
    const newReq: LeaveRequest = {
      id: 'leave-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      student_id: payload.student_id,
      uid_kartu: (payload.uid_kartu || '').trim().toUpperCase(),
      student_name: payload.student_name.trim(),
      student_kelas: (payload.student_kelas || 'Umum').trim(),
      jenis: payload.jenis === 'sakit' ? 'sakit' : 'izin',
      tanggal: payload.tanggal || new Date().toISOString().slice(0, 10),
      alasan: payload.alasan.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const current = this.getLocalLeaveRequests();
    const updatedList = this.mergeLeaveRequestLists([newReq], current);
    this.setLocalLeaveRequests(updatedList, true);

    try {
      const tasks: Promise<any>[] = [this.syncLeaveRequestsToCloud(updatedList)];
      if (!this.leaveRequestsTableMissing) {
        tasks.push(
          Promise.resolve(this.client.from('leave_requests').insert([newReq])).then((res) => {
            if (res?.error && this.isLeaveRequestsTableNotFoundError(res.error, res.status)) {
              this.markLeaveRequestsTableMissing();
            }
          })
        );
      }
      await Promise.allSettled(tasks);
    } catch {
      // ignore cloud error, local state is already updated
    }

    this.notify();
    return newReq;
  }

  public async updateLeaveRequestStatus(
    requestId: string,
    status: LeaveRequestStatus
  ): Promise<LeaveRequest | null> {
    const reviewedAt = new Date().toISOString();
    const current = this.getLocalLeaveRequests();
    let updatedItem: LeaveRequest | null = null;
    const nextList = current.map((item) => {
      if (item.id === requestId) {
        updatedItem = {
          ...item,
          status,
          reviewed_at: reviewedAt,
        };
        return updatedItem;
      }
      return item;
    });
    this.setLocalLeaveRequests(nextList, true);

    try {
      const tasks: Promise<any>[] = [this.syncLeaveRequestsToCloud(nextList)];
      if (!this.leaveRequestsTableMissing) {
        tasks.push(
          Promise.resolve(
            this.client
              .from('leave_requests')
              .update({ status, reviewed_at: reviewedAt })
              .eq('id', requestId)
          ).then((res) => {
            if (res?.error && this.isLeaveRequestsTableNotFoundError(res.error, res.status)) {
              this.markLeaveRequestsTableMissing();
            }
          })
        );
      }
      await Promise.allSettled(tasks);
    } catch {
      // ignore cloud error
    }

    this.notify();
    return updatedItem;
  }

  public async resetDemoData(): Promise<void> {
    // No-op for real Supabase
  }
}

export const supabaseService = new SupabaseService();
