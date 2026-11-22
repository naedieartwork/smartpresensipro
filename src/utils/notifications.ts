export interface ScanNotificationPayload {
  studentName: string;
  studentClass?: string;
  statusLabel: string;
  timeStr: string;
  method?: string;
  cardUid?: string;
}

class LocalNotificationService {
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      const result = await Notification.requestPermission();
      return result;
    } catch {
      return Notification.permission;
    }
  }

  public async triggerScanSuccessNotification(payload: ScanNotificationPayload): Promise<boolean> {
    if (!this.isSupported()) return false;

    let permission: NotificationPermission | 'unsupported' = Notification.permission;
    if (permission === 'default') {
      permission = await this.requestPermission();
    }

    if (permission !== 'granted') return false;

    const rawClass = (payload.studentClass || 'Umum').trim();
    const formattedClass = /^kelas\s+/i.test(rawClass) ? rawClass : `Kelas ${rawClass}`;
    const methodLabel = payload.method || 'QR/RFID';

    const title = `✅ Presensi Berhasil (${payload.statusLabel})`;
    const body = `${payload.studentName} • ${formattedClass}\nTercatat pukul ${payload.timeStr} WIB via ${methodLabel}${
      payload.cardUid ? ` [${payload.cardUid}]` : ''
    }`;

    const notificationOptions: NotificationOptions & {
      vibrate?: number[];
      renotify?: boolean;
    } = {
      body,
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: `scan-presensi-${payload.cardUid || Date.now()}`,
      renotify: true,
      vibrate: [120, 60, 120],
      data: {
        url: './',
        timestamp: Date.now(),
        ...payload,
      },
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, notificationOptions);
          return true;
        }
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_SCAN_NOTIFICATION',
            title,
            options: notificationOptions,
          });
          return true;
        }
      }

      // Fallback ke Web Notification API langsung jika Service Worker belum aktif
      new Notification(title, notificationOptions);
      return true;
    } catch {
      try {
        new Notification(title, {
          body,
          icon: './icon-192x192.png',
          tag: notificationOptions.tag,
        });
        return true;
      } catch {
        return false;
      }
    }
  }
}

export const notificationService = new LocalNotificationService();
