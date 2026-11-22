import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  Github,
  CheckCircle2,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { STANDALONE_INDEX_HTML, STANDALONE_APP_JS } from '../data/standaloneExport';
import { SUPABASE_SQL_SCHEMA } from '../data/sqlSchema';

export const ExportGitHubPages: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'sql' | 'html' | 'js' | 'guide'>('html');
  const [copied, setCopied] = useState<string | null>(null);

  const getActiveContent = () => {
    switch (activeFile) {
      case 'sql':
        return SUPABASE_SQL_SCHEMA;
      case 'html':
        return STANDALONE_INDEX_HTML;
      case 'js':
        return STANDALONE_APP_JS;
      default:
        return '';
    }
  };

  const getFileName = () => {
    switch (activeFile) {
      case 'sql':
        return 'schema.sql';
      case 'html':
        return 'index.html';
      case 'js':
        return 'app.js';
      default:
        return 'panduan.md';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveContent());
    setCopied(activeFile);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadFile = () => {
    const content = getActiveContent();
    const fileName = getFileName();
    let mime = 'text/plain';
    if (fileName.endsWith('.html')) mime = 'text/html';
    if (fileName.endsWith('.js')) mime = 'application/javascript';
    if (fileName.endsWith('.sql')) mime = 'text/sql';

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    // Unduh berturut-turut index.html, app.js, dan schema.sql
    const files = [
      { name: 'schema.sql', content: SUPABASE_SQL_SCHEMA, mime: 'text/sql' },
      { name: 'index.html', content: STANDALONE_INDEX_HTML, mime: 'text/html' },
      { name: 'app.js', content: STANDALONE_APP_JS, mime: 'application/javascript' },
    ];

    files.forEach((f, idx) => {
      setTimeout(() => {
        const blob = new Blob([f.content], { type: f.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 250);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
              <Github className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Export File Mandiri untuk GitHub Pages
              </h2>
              <p className="text-xs text-slate-300">
                Struktur file murni Vanilla JS, HTML5, Tailwind CSS, dan Supabase JS Client tanpa perlu build tool / bundler.
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md active:scale-95 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Download Semua File (3 File)</span>
          </button>
        </div>
      </div>

      {/* File Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 bg-black/40 border border-emerald-500/15 rounded-xl">
          <button
            onClick={() => setActiveFile('html')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeFile === 'html'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>1. index.html</span>
          </button>

          <button
            onClick={() => setActiveFile('js')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeFile === 'js'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>2. app.js</span>
          </button>

          <button
            onClick={() => setActiveFile('sql')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeFile === 'sql'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>3. schema.sql</span>
          </button>

          <button
            onClick={() => setActiveFile('guide')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeFile === 'guide'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Panduan Deploy</span>
          </button>
        </div>

        {activeFile !== 'guide' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center gap-1.5"
            >
              {copied === activeFile ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied === activeFile ? 'Tersalin!' : 'Salin Kode'}</span>
            </button>
            <button
              onClick={handleDownloadFile}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/40 text-slate-300 hover:text-white border border-white/10 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {getFileName()}</span>
            </button>
          </div>
        )}
      </div>

      {/* Code Viewer or Guide */}
      {activeFile === 'guide' ? (
        <div className="ios-glass-card rounded-2xl p-6 border border-emerald-500/20 space-y-5 text-xs text-slate-300">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🚀</span> Langkah-Langkah Deploy ke GitHub Pages
          </h3>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/20 space-y-2">
              <div className="font-bold text-emerald-400 text-sm">
                Langkah 1: Siapkan Database di Supabase
              </div>
              <p>
                1. Buat project baru di{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline"
                >
                  Supabase
                </a>
                .<br />
                2. Buka menu <strong>SQL Editor</strong> &gt; <strong>New Query</strong>.<br />
                3. Salin seluruh isi dari tab <strong>3. schema.sql</strong> dan jalankan (Run).<br />
                4. Ambil <strong>Project URL</strong> dan <strong>Anon Public Key</strong> di menu{' '}
                <em>Project Settings &gt; API</em>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/20 space-y-2">
              <div className="font-bold text-emerald-400 text-sm">
                Langkah 2: Konfigurasi File app.js
              </div>
              <p>
                Buka file <code>app.js</code>, lalu masukkan URL Supabase, Anon Key, serta Token API
                Sidobe Anda di bagian atas:
              </p>
              <pre className="p-3 bg-black/80 rounded-lg text-emerald-300 font-mono text-[11px]">
{`const CONFIG = {
  SUPABASE_URL: 'https://PROJECT_ANDA.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsIn...',
  SIDOBE_TOKEN: 'TOKEN_SIDOBE_ANDA',
  ANTI_SPAM_DELAY_SECONDS: 15
};`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/20 space-y-2">
              <div className="font-bold text-emerald-400 text-sm">
                Langkah 3: Push ke GitHub & Aktifkan GitHub Pages
              </div>
              <p>
                1. Buat repository baru di GitHub (misal: <code>presensi-sekolah-wa</code>).<br />
                2. Masukkan file <code>index.html</code> dan <code>app.js</code> ke root repository.<br />
                3. Buka tab <strong>Settings</strong> repository &gt; <strong>Pages</strong>.<br />
                4. Pada opsi <em>Source</em>, pilih branch <strong>main</strong> / root folder <code>/ (root)</code> lalu klik <strong>Save</strong>.<br />
                5. Website Anda kini live di <code>https://username.github.io/presensi-sekolah-wa/</code>!
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/15 mb-3">
            <span className="font-mono text-xs font-bold text-emerald-400">{getFileName()}</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {getActiveContent().split('\n').length} Baris
            </span>
          </div>

          <pre className="p-4 bg-black/80 rounded-xl border border-emerald-500/20 font-mono text-[11px] text-emerald-200/90 overflow-x-auto max-h-[550px] leading-relaxed">
            {getActiveContent()}
          </pre>
        </div>
      )}
    </div>
  );
};
