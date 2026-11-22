import { useState, useEffect, useCallback } from 'react';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
} from '../services/settingsService';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Simpan event secara global agar tidak hilang ketika komponen di-mount ulang
let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setGlobalDeferredPrompt(promptEvent: BeforeInstallPromptEvent | null) {
  deferredPromptGlobal = promptEvent;
  notifyListeners();
}

export function getGlobalDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPromptGlobal;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    setGlobalDeferredPrompt(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    setGlobalDeferredPrompt(null);
  });
}

/**
 * Sinkronisasi identitas judul dokumen tanpa memanipulasi DOM <link rel="icon"> dan <link rel="apple-touch-icon">.
 * Array icons pada konfigurasi manifest dikunci secara statis ke /icon-192x192.png dan /icon-512x512.png.
 */
export async function syncDynamicPWAManifest(
  appTitle?: string,
  appSubtitle?: string,
  _appLogo?: string
): Promise<void> {
  if (typeof document === 'undefined') return;

  const settings = settingsService.getSettings();
  const title =
    (appTitle ?? settings.appTitle ?? DEFAULT_APP_TITLE).trim() || DEFAULT_APP_TITLE;
  const subtitle =
    (appSubtitle ?? settings.appSubtitle ?? DEFAULT_APP_SUBTITLE).trim() ||
    DEFAULT_APP_SUBTITLE;

  document.title = `${title} - ${subtitle}`;

  const shortName = title.length > 12 ? title.slice(0, 12).trim() : title;
  const dynamicManifest = {
    id: '/',
    name: `${title} - ${subtitle}`,
    short_name: shortName || 'Presensi',
    description: subtitle,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#06b6d4',
    background_color: '#06b6d4',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  const appleTitleMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-title"]'
  ) as HTMLMetaElement | null;
  if (appleTitleMeta) {
    appleTitleMeta.content = dynamicManifest.short_name;
  }
}

export function usePWAInstall() {
  const checkStandalone = () => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  };

  const checkIOS = () => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  };

  const [isInstalled, setIsInstalled] = useState<boolean>(checkStandalone);
  const [canPrompt, setCanPrompt] = useState<boolean>(() => deferredPromptGlobal !== null);
  const [isIOS] = useState<boolean>(checkIOS);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  useEffect(() => {
    const updateState = () => {
      setIsInstalled(checkStandalone());
      setCanPrompt(deferredPromptGlobal !== null);
    };

    listeners.add(updateState);
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => updateState();
    mediaQuery.addEventListener?.('change', handleMediaChange);

    return () => {
      listeners.delete(updateState);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    const promptEvent = getGlobalDeferredPrompt();
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setGlobalDeferredPrompt(null);
        }
      } catch {
        setShowGuideModal(true);
      }
    } else {
      // Jika deferredPrompt belum tersedia (Safari iOS, di dalam iframe preview, dsb.), tampilkan modal instruksi ramah
      setShowGuideModal(true);
    }
  }, []);

  return {
    isInstalled,
    canPrompt,
    isIOS,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
  };
}
