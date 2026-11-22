import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Save,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Code2,
} from 'lucide-react';
import { MessageTemplate, StatusCategory } from '../types';
import { INITIAL_TEMPLATES } from '../data/initialData';
import { supabaseService } from '../services/supabaseClient';
import { AttendanceService, formatReadableStatus } from '../services/attendanceService';
import { sound } from '../utils/audio';

interface TemplateManagerProps {
  externalTemplates?: MessageTemplate[];
  onExternalTemplatesChange?: (templates: MessageTemplate[]) => void;
}

const CATEGORIES: { key: StatusCategory; label: string; color: string }[] = [
  { key: 'hadir_tepat', label: 'Hadir Tepat', color: 'emerald' },
  { key: 'hadir_telat', label: 'Hadir Telat', color: 'amber' },
  { key: 'pulang', label: 'Pulang', color: 'cyan' },
  { key: 'izin', label: 'Izin', color: 'purple' },
  { key: 'sakit', label: 'Sakit', color: 'rose' },
];

function ensureTwentyTemplates(list?: MessageTemplate[] | null): MessageTemplate[] {
  if (!list || !Array.isArray(list) || list.length === 0) {
    return INITIAL_TEMPLATES.map((t) => ({ ...t }));
  }

  const result: MessageTemplate[] = [];
  for (const cat of CATEGORIES) {
    const catKeyLower = cat.key.toLowerCase();
    const matched = list.filter(
      (item) => String(item.status_category || '').trim().toLowerCase() === catKeyLower
    );
    const defaultsForCat = INITIAL_TEMPLATES.filter(
      (item) => String(item.status_category || '').trim().toLowerCase() === catKeyLower
    );

    for (let i = 0; i < 4; i++) {
      const existing = matched[i];
      const fallback = defaultsForCat[i];
      if (existing && String(existing.message_text || '').trim() !== '') {
        result.push({
          id: existing.id || fallback.id,
          status_category: cat.key,
          variation_number: i + 1,
          message_text: existing.message_text,
        });
      } else if (fallback) {
        result.push({
          ...fallback,
          status_category: cat.key,
          variation_number: i + 1,
        });
      }
    }
  }

  return result;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  externalTemplates,
  onExternalTemplatesChange,
}) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>(() =>
    ensureTwentyTemplates(externalTemplates)
  );
  // Default ke '' ("Pilih Kategori Template...") saat halaman pertama kali dibuka
  const [categoryFilter, setCategoryFilter] = useState<StatusCategory | 'all' | ''>('');
  // State toggle Live Preview per kartu (default tersembunyi semua)
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [saveAllSuccess, setSaveAllSuccess] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const syncState = (nextTemplates: MessageTemplate[]) => {
    const normalized = ensureTwentyTemplates(nextTemplates);
    setTemplates(normalized);
    if (onExternalTemplatesChange) {
      onExternalTemplatesChange(normalized);
    }
  };

  const loadTemplates = async () => {
    try {
      const tmpls = await supabaseService.getTemplates();
      syncState(tmpls && tmpls.length > 0 ? tmpls : INITIAL_TEMPLATES);
    } catch {
      syncState(INITIAL_TEMPLATES);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (externalTemplates && externalTemplates.length > 0) {
      setTemplates(ensureTwentyTemplates(externalTemplates));
    }
  }, [externalTemplates]);

  const togglePreviewForCard = (id: string) => {
    setExpandedPreviewIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderLivePreview = (rawText: string, statusCategory: StatusCategory): string => {
    const sampleName = 'Muhammad Rizky Pratama';
    const sampleClass = '1A';
    const sampleTime = AttendanceService.formatTime(new Date());
    const sampleStatus = formatReadableStatus(statusCategory);

    // Mendukung kurung kurawal {...} maupun kurung siku [...] untuk kompatibilitas penuh
    let text = rawText || '';
    text = text.replace(/\[NAMA\]/gi, sampleName);
    text = text.replace(/\{nama\}/gi, sampleName);
    text = text.replace(/\[KELAS\]/gi, sampleClass);
    text = text.replace(/\{kelas\}/gi, sampleClass);
    text = text.replace(/\[WAKTU\]/gi, sampleTime);
    text = text.replace(/\{waktu\}/gi, sampleTime);
    text = text.replace(/\[JAM\]/gi, sampleTime);
    text = text.replace(/\{jam\}/gi, sampleTime);
    text = text.replace(/\[STATUS\]/gi, sampleStatus);
    text = text.replace(/\{status\}/gi, sampleStatus);
    text = text.replace(/\bHADIR_TEPAT\b/gi, 'Hadir Tepat Waktu');
    text = text.replace(/\bHADIR_TELAT\b/gi, 'Hadir Terlambat');
    return text;
  };

  const handleTextChange = (id: string, newText: string) => {
    const updated = templates.map((t) =>
      t.id === id ? { ...t, message_text: newText } : t
    );
    syncState(updated);
  };

  const handleInsertVariable = (id: string, token: string) => {
    const updated = templates.map((t) => {
      if (t.id !== id) return t;
      const current = t.message_text || '';
      const needsSpace = current.length > 0 && !current.endsWith(' ');
      return {
        ...t,
        message_text: current + (needsSpace ? ' ' : '') + token,
      };
    });
    syncState(updated);
  };

  const handleSaveSingleTemplate = async (tmpl: MessageTemplate) => {
    setSavingId(tmpl.id);
    await supabaseService.updateTemplate(tmpl.id, tmpl.message_text);
    const saved = await supabaseService.saveAllTemplates(templates);
    syncState(saved);
    setSavingId(null);
    setSavedId(tmpl.id);
    sound.playSuccess();
    setTimeout(() => {
      setSavedId((prev) => (prev === tmpl.id ? null : prev));
    }, 1500);
  };

  const handleSaveAllTemplates = async () => {
    setIsSavingAll(true);
    const saved = await supabaseService.saveAllTemplates(templates);
    syncState(saved);
    setIsSavingAll(false);
    setSaveAllSuccess(true);
    sound.playSuccess();
    setTimeout(() => setSaveAllSuccess(false), 2500);
  };

  const handleResetDefaultTemplates = async () => {
    if (confirm('Kembalikan ke-20 template pesan ke pengaturan default (4 variasi per kategori)?')) {
      setIsResetting(true);
      const resetList = await supabaseService.resetTemplatesToDefault();
      syncState(resetList);
      setIsResetting(false);
      sound.playSuccess();
    }
  };

  const variableGuides = [
    { token: '{nama}', desc: 'Nama lengkap siswa', sample: 'Muhammad Rizky Pratama' },
    { token: '{kelas}', desc: 'Nama Rombel / Kelas siswa', sample: '1A' },
    { token: '{waktu}', desc: 'Jam presensi tercatat (WIB)', sample: AttendanceService.formatTime(new Date()) },
    { token: '{status}', desc: 'Status kehadiran siswa', sample: 'Hadir Tepat Waktu' },
  ];

  const getCategoryCount = (catKey: StatusCategory): number => {
    const target = String(catKey).trim().toLowerCase();
    return templates.filter(
      (t) => String(t.status_category || '').trim().toLowerCase() === target
    ).length;
  };

  const filteredTemplates =
    categoryFilter === ''
      ? []
      : categoryFilter === 'all'
      ? templates
      : templates.filter(
          (t) =>
            String(t.status_category || '').trim().toLowerCase() ===
            String(categoryFilter).trim().toLowerCase()
        );

  return (
    <div className="space-y-6">
      {/* Top Banner & Variable Guide Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Info & Category Controls */}
        <div className="lg:col-span-7 bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
                  <h2 className="text-base font-bold text-gray-900">
                    20 Template Pesan WhatsApp (Variasi Otomatis Anti-Spam)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Tersedia <strong>5 Kategori Kehadiran</strong> dengan masing-masing <strong>4 variasi pesan unik</strong> (Total 20 template). Edit langsung teks pada kotak di bawah lalu klik <strong>Simpan Pengaturan</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start">
              <button
                type="button"
                onClick={handleResetDefaultTemplates}
                disabled={isResetting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition flex items-center gap-1.5 active:scale-95"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-gray-600 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'Mereset...' : 'Reset Default'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAllTemplates}
                disabled={isSavingAll}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-white transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {saveAllSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveAllSuccess ? 'Tersimpan!' : isSavingAll ? 'Menyimpan...' : 'Simpan 20 Template'}</span>
              </button>
            </div>
          </div>

          {/* Filter Kategori:
              1. Tampilan Ponsel (md:hidden): Dropdown <select> tunggal yang dimulai dari "Pilih Kategori Template..."
              2. Tampilan Desktop (hidden md:flex): Dropdown <select> & deretan tombol tab kategori */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            {/* DROPDOWN SELECT KATEGORI TEMPLATE */}
            <div className="space-y-1.5">
              <label
                htmlFor="wa-template-category-select"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >
                Pilih Kategori Template{' '}
                {categoryFilter === ''
                  ? '(Pilih Kategori untuk Menampilkan)'
                  : `(${categoryFilter === 'all' ? 20 : 4} Template Ditampilkan)`}
              </label>
              <select
                id="wa-template-category-select"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as StatusCategory | 'all' | '')
                }
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition shadow-2xs ${
                  categoryFilter === '' ? 'text-slate-500' : 'text-slate-800'
                }`}
              >
                <option value="" disabled>
                  Pilih Kategori Template...
                </option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label} (4 Template)
                  </option>
                ))}
                <option value="all">
                  Semua Kategori (20 Template)
                </option>
              </select>
            </div>

            {/* DESKTOP QUICK BUTTON TABS (hidden md:flex) */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs">
                {CATEGORIES.map((cat) => {
                  const count = getCategoryCount(cat.key);
                  const isActive =
                    categoryFilter !== '' &&
                    categoryFilter !== 'all' &&
                    String(categoryFilter).toLowerCase() === cat.key.toLowerCase();
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategoryFilter(cat.key)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 active:scale-95 ${
                        isActive
                          ? 'bg-cyan-500 text-white shadow-sm font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 active:scale-95 ${
                    categoryFilter === 'all'
                      ? 'bg-cyan-500 text-white shadow-sm font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua ({templates.length})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Panduan Variabel Dinamis */}
        <div className="lg:col-span-5 bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-cyan-600" />
              Panduan Variabel Dinamis
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold">
              Otomatis Diubah Saat Kirim
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {variableGuides.map((v) => (
              <div
                key={v.token}
                className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1"
              >
                <div className="font-mono font-bold text-cyan-700 text-[11px]">{v.token}</div>
                <div className="text-[11px] text-gray-600">{v.desc}</div>
                <div className="text-[10px] text-gray-400 font-mono truncate">
                  Contoh: <span className="text-gray-700 font-semibold">{v.sample}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conditional Rendering berdasarkan Pilihan Kategori Dropdown */}
      {categoryFilter === '' ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-2xs ios-tab-transition">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Pilih Kategori Template Terlebih Dahulu
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Silakan pilih salah satu kategori kehadiran pada dropdown <strong>&quot;Pilih Kategori Template...&quot;</strong> di atas untuk melihat dan mengedit variasi pesan WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 border border-slate-200 hover:border-cyan-200 text-xs font-bold transition-all duration-300 active:scale-95"
              >
                {cat.label} (4 Template)
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-bold transition-all duration-300 active:scale-95"
            >
              Semua Kategori (20 Template)
            </button>
          </div>
        </div>
      ) : (
      /* Grid 2 Kolom untuk Kartu Editor Textarea Template Pesan */
      <div key={categoryFilter} className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start ios-tab-transition">
        {filteredTemplates.map((tmpl, idx) => {
          const catLower = String(tmpl.status_category || '').trim().toLowerCase() as StatusCategory;
          let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          if (catLower === 'hadir_telat') {
            badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
          } else if (catLower === 'pulang') {
            badgeColor = 'bg-cyan-50 text-cyan-700 border-cyan-200';
          } else if (catLower === 'izin') {
            badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
          } else if (catLower === 'sakit') {
            badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
          }

          const variationNum = tmpl.variation_number || (idx % 4) + 1;
          const previewText = renderLivePreview(tmpl.message_text, catLower);
          const isSingleSaving = savingId === tmpl.id;
          const isSingleSaved = savedId === tmpl.id;
          const isPreviewVisible = Boolean(expandedPreviewIds[tmpl.id]);

          return (
            <div
              key={tmpl.id}
              className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3.5 flex flex-col justify-between hover:border-cyan-300 transition"
            >
              <div className="space-y-3">
                {/* Header Kartu Variasi */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${badgeColor}`}>
                      {formatReadableStatus(catLower).toUpperCase()}
                    </span>
                    <span className="text-[11px] font-bold text-gray-800 bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200">
                      Variasi {variationNum}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePreviewForCard(tmpl.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 border ${
                        isPreviewVisible
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border-gray-200'
                      }`}
                    >
                      {isPreviewVisible ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sembunyikan Notifikasi</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          <span>Tampilkan Notifikasi</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveSingleTemplate(tmpl)}
                      disabled={isSingleSaving}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                        isSingleSaved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200'
                      }`}
                    >
                      {isSingleSaved ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Tersimpan</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          <span>{isSingleSaving ? 'Menyimpan...' : 'Simpan'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tombol Sisipkan Variabel Cepat (4 Variabel Standar) */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Teks Pesan (Dapat Diedit):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {['{nama}', '{kelas}', '{waktu}', '{status}'].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => handleInsertVariable(tmpl.id, token)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-gray-100 hover:bg-cyan-50 text-gray-700 hover:text-cyan-700 border border-gray-200 hover:border-cyan-200 font-semibold transition"
                      >
                        +{token}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kotak Input Textarea Langsung */}
                <textarea
                  value={tmpl.message_text}
                  onChange={(e) => handleTextChange(tmpl.id, e.target.value)}
                  rows={4}
                  placeholder="Tuliskan isi template pesan WhatsApp di sini..."
                  className="w-full bg-gray-50 focus:bg-white border border-gray-200 focus:border-cyan-500 rounded-xl p-3.5 font-mono text-xs text-gray-900 leading-relaxed focus:outline-none shadow-sm transition resize-y"
                />

                {/* Area Live Preview Gelembung Chat WhatsApp (Hanya Tampil Jika Toggle Aktif) */}
                {isPreviewVisible && (
                  <div className="bg-[#e5ddd5]/50 border border-emerald-200/90 rounded-2xl p-3.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Pratinjau Notifikasi WhatsApp Wali Murid</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                        {AttendanceService.formatTime(new Date())} WIB
                      </span>
                    </div>
                    <div className="bg-[#dcf8c6] border border-emerald-300/70 rounded-2xl rounded-tl-sm p-3.5 shadow-sm relative">
                      <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {previewText}
                      </p>
                      <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-emerald-800/70 font-mono">
                        <span>{AttendanceService.formatTime(new Date())}</span>
                        <span>✓✓</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};


