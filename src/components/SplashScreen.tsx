import React, { useState, useEffect } from 'react';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
} from '../services/settingsService';

interface SplashScreenProps {
  isFadingOut?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isFadingOut = false }) => {
  const [brandConfig, setBrandConfig] = useState(() => {
    const s = settingsService.getSettings();
    return {
      appTitle: s.appTitle || DEFAULT_APP_TITLE,
      appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
    };
  });

  useEffect(() => {
    const syncBrand = () => {
      const s = settingsService.getSettings();
      setBrandConfig({
        appTitle: s.appTitle || DEFAULT_APP_TITLE,
        appSubtitle: s.appSubtitle || DEFAULT_APP_SUBTITLE,
      });
    };
    syncBrand();
    const unsub = settingsService.subscribe(syncBrand);
    return () => unsub();
  }, []);

  const { appTitle, appSubtitle } = brandConfig;

  return (
    <div
      style={{ backgroundColor: '#06b6d4' }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#06b6d4] select-none transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-live="polite"
      aria-busy={!isFadingOut}
    >
      {/* Susunan Vertikal di Tengah Layar: Logo Statis -> Margin Proporsional -> Judul -> Subjudul */}
      <div className="flex flex-col items-center justify-center px-6 text-center">
        <img
          src="/icon-192x192.png"
          alt={appTitle}
          className="w-36 h-36 sm:w-40 sm:h-40 object-contain drop-shadow-md animate-pulse"
        />

        <div className="mt-6 flex flex-col items-center animate-in fade-in duration-500">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-xs">
            {appTitle}
          </h1>
          <p className="mt-2 text-xs sm:text-sm font-medium text-white/90 max-w-xs leading-relaxed">
            {appSubtitle}
          </p>
        </div>
      </div>

      {/* Indikator Pemuatan di Bagian Paling Bawah Layar */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2.5 animate-in fade-in duration-500">
        <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        <span className="text-xs font-semibold text-white/90 tracking-wide">
          Memuat aplikasi...
        </span>
      </div>
    </div>
  );
};
