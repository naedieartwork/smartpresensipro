import { supabaseService } from './supabaseClient';
import { sidobeService } from './sidobeService';
import { WorkerState, WaQueueItem } from '../types';

export interface WorkerLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

type WorkerListener = (state: WorkerState, logs: WorkerLogEntry[]) => void;

class QueueWorkerService {
  private state: WorkerState = {
    isRunning: true,
    isPaused: false,
    currentProcessingId: null,
    countdownSeconds: 0,
    totalSent: 0,
    totalFailed: 0,
    lastRunTimestamp: null,
    lastLog: 'Worker siap dijalankan.',
  };

  private logs: WorkerLogEntry[] = [];
  private listeners: WorkerListener[] = [];
  private loopTimeoutId: any = null;
  private countdownIntervalId: any = null;
  private isProcessingStep: boolean = false;

  constructor() {
    this.addLog('info', 'Sistem Antrean Anti-Spam (Worker 15 Detik) diinisialisasi.');
    // Start automatically when initialized
    this.start();
  }

  public subscribe(listener: WorkerListener): () => void {
    this.listeners.push(listener);
    listener({ ...this.state }, [...this.logs]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn({ ...this.state }, [...this.logs]));
  }

  public getState(): WorkerState {
    return { ...this.state };
  }

  public getLogs(): WorkerLogEntry[] {
    return [...this.logs];
  }

  private addLog(type: WorkerLogEntry['type'], text: string) {
    const entry: WorkerLogEntry = {
      id: 'log-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      type,
      text,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    this.state.lastLog = text;
    this.notify();
  }

  public start() {
    if (!this.state.isRunning) {
      this.state.isRunning = true;
      this.state.isPaused = false;
      this.addLog('info', 'Worker diaktifkan.');
    }
    this.scheduleNextStep(500);
  }

  public pause() {
    this.state.isPaused = true;
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    this.addLog('warning', 'Worker dijeda (Paused) oleh administrator.');
    this.notify();
  }

  public resume() {
    this.state.isPaused = false;
    this.addLog('info', 'Worker dilanjutkan (Resumed).');
    this.scheduleNextStep(200);
  }

  public togglePause() {
    if (this.state.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  private scheduleNextStep(delayMs: number) {
    if (this.loopTimeoutId) clearTimeout(this.loopTimeoutId);
    this.loopTimeoutId = setTimeout(() => {
      this.processNextItem();
    }, delayMs);
  }

  /**
   * Logika Utama Worker:
   * 1. Ambil 1 baris antrean status 'pending' dari Supabase
   * 2. Ubah status menjadi 'processing'
   * 3. Tembak API Sidobe
   * 4. Ubah status menjadi 'sent' atau 'failed'
   * 5. WAJIB delay 15 detik (Anti-Spam) sebelum item berikutnya
   */
  private async processNextItem() {
    if (!this.state.isRunning || this.state.isPaused || this.isProcessingStep) {
      return;
    }

    this.isProcessingStep = true;
    try {
      // 1. Cari 1 baris antrean tertua dengan status 'pending'
      const pendingItem: WaQueueItem | null = await supabaseService.getNextPendingQueueItem();

      if (!pendingItem) {
        // Antrean sedang kosong, jadwalkan polling ulang setelah 4 detik
        this.state.currentProcessingId = null;
        this.state.countdownSeconds = 0;
        this.notify();
        this.isProcessingStep = false;
        this.scheduleNextStep(4000);
        return;
      }

      // 2. Baris pending ditemukan -> tandai 'processing'
      this.state.currentProcessingId = pendingItem.id;
      this.state.lastRunTimestamp = new Date().toISOString();
      await supabaseService.updateQueueStatus(pendingItem.id, 'processing');
      this.addLog(
        'info',
        `[Memproses] Mengirim pesan ke ${pendingItem.no_wa_tujuan} (${pendingItem.student_name || 'Siswa'})...`
      );

      // 3. Eksekusi pengiriman via Sidobe WA Gateway
      const result = await sidobeService.sendMessage(
        pendingItem.no_wa_tujuan,
        pendingItem.isi_pesan
      );

      if (result.success) {
        // 4a. Update status ke 'sent'
        await supabaseService.updateQueueStatus(pendingItem.id, 'sent');
        this.state.totalSent += 1;
        this.addLog(
          'success',
          `[Berhasil] WhatsApp terkirim ke ${pendingItem.no_wa_tujuan}. Gateway: ${result.data?.gateway || 'Sidobe'}`
        );
      } else {
        // 4b. Update status ke 'failed'
        const errorMsg = result.error || 'Gagal mengirim pesan via Sidobe';
        await supabaseService.updateQueueStatus(pendingItem.id, 'failed', errorMsg);
        this.state.totalFailed += 1;
        this.addLog('error', `[Gagal] WhatsApp ke ${pendingItem.no_wa_tujuan}: ${errorMsg}`);
      }

      this.state.currentProcessingId = null;
      this.isProcessingStep = false;

      // 5. ATURAN ANTI-SPAM: WAJIB DELAY 15 DETIK
      await this.runAntiSpamDelay(15);

      // Lanjut ke antrean berikutnya
      this.scheduleNextStep(100);
    } catch (err: unknown) {
      this.isProcessingStep = false;
      this.state.currentProcessingId = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('error', `[Worker Error] ${msg}`);
      this.scheduleNextStep(5000);
    }
  }

  /**
   * Menjalankan hitung mundur jeda 15 detik anti-spam
   */
  private runAntiSpamDelay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.state.countdownSeconds = seconds;
      this.addLog(
        'info',
        `[Anti-Spam Delay] Menunggu jeda wajib ${seconds} detik sebelum antrean berikutnya...`
      );
      this.notify();

      if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

      this.countdownIntervalId = setInterval(() => {
        if (this.state.isPaused) {
          // Tetap tahan jika worker dijeda
          return;
        }

        this.state.countdownSeconds -= 1;
        this.notify();

        if (this.state.countdownSeconds <= 0) {
          clearInterval(this.countdownIntervalId);
          this.countdownIntervalId = null;
          this.state.countdownSeconds = 0;
          this.notify();
          resolve();
        }
      }, 1000);
    });
  }

  public resetStats() {
    this.state.totalSent = 0;
    this.state.totalFailed = 0;
    this.notify();
  }
}

export const queueWorker = new QueueWorkerService();
