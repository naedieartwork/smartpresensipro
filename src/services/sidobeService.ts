import { SidobeConfig } from '../types';

const STORAGE_KEY = 'school_presence_sidobe_config';

const DEFAULT_SIDOBE_API_URL = 'https://api.sidobe.com/wa/v1';

class SidobeService {
  private config: SidobeConfig = {
    apiUrl: DEFAULT_SIDOBE_API_URL,
    apiToken: (import.meta.env.VITE_SIDOBE_SECRET_KEY || '').trim(),
    senderPhone: '',
    simulateHttp: false,
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = {
          ...this.config,
          ...parsed,
          apiUrl: DEFAULT_SIDOBE_API_URL,
          apiToken:
            typeof parsed.apiToken === 'string'
              ? parsed.apiToken.trim()
              : (this.config.apiToken || '').trim(),
          simulateHttp: false,
        };
      }
    } catch {
      // Ignore
    }
  }

  public getConfig(): SidobeConfig {
    this.loadConfig();
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<SidobeConfig>) {
    const cleanedToken =
      newConfig.apiToken !== undefined
        ? newConfig.apiToken.trim()
        : (this.config.apiToken || '').trim();

    this.config = {
      ...this.config,
      ...newConfig,
      apiUrl: DEFAULT_SIDOBE_API_URL,
      apiToken: cleanedToken,
      simulateHttp: false,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore
    }
  }

  /**
   * Format nomor telepon ke format internasional E.164 standar WhatsApp Indonesia (+628xxx)
   */
  public sanitizePhoneNumber(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (!clean.startsWith('62')) {
      clean = '62' + clean;
    }
    if (!clean.startsWith('+')) {
      clean = '+' + clean;
    }
    return clean;
  }

  /**
   * Kirim pesan melalui API Sidobe WA Gateway menggunakan kredensial asli dari environment variables & konfigurasi
   */
  public async sendMessage(
    targetPhone: string,
    message: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    this.loadConfig();
    const formattedPhone = this.sanitizePhoneNumber(targetPhone);

    if (this.config.simulateHttp) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, data: { gateway: 'Simulated' } });
        }, 800);
      });
    }

    const gasUrl = "https://script.google.com/macros/s/AKfycbz9BE-kIObeevV50IUF7RrrCsXBYNrqhnvB1TJm6JHmUzfOGhwwOYa3dNgTYHDjWgm1/exec";
    const apiUrl = DEFAULT_SIDOBE_API_URL;
    const secretKey = (this.config.apiToken || import.meta.env.VITE_SIDOBE_SECRET_KEY || '').trim();

    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          endpoint: apiUrl,
          apiToken: secretKey,
          phone: formattedPhone,
          message: message,
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${responseText.substring(0, 100) || response.statusText}`,
        };
      }

      try {
        const data = JSON.parse(responseText);
        if (data.code === 200 || (data.code >= 200 && data.code < 300) || data.success === true) {
          return { success: true, data: data.body !== undefined ? data.body : data };
        } else {
          return {
            success: false,
            error: 'HTTP ' + data.code + ': ' + (data.body || JSON.stringify(data)),
          };
        }
      } catch {
        return {
          success: false,
          error: `Proxy Error/Bukan JSON: ${responseText.substring(0, 100)}`,
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

export const sidobeService = new SidobeService();
