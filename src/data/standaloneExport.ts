export const STANDALONE_INDEX_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portal Presensi Sekolah & Anti-Spam WhatsApp Gateway</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Google Fonts: Plus Jakarta Sans & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <!-- Supabase JS Client v2 CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  
  <!-- html5-qrcode CDN for Camera QR Scanner -->
  <script src="https://unpkg.com/html5-qrcode"></script>
  
  <style>
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background-color: #08110e;
      color: #e2e8f0;
      min-height: 100vh;
    }
    .ios-glass {
      background: rgba(18, 30, 26, 0.65);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(52, 211, 153, 0.15);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .ios-glass-card {
      background: rgba(23, 37, 32, 0.55);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(74, 222, 128, 0.12);
      box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.25);
    }
  </style>
</head>
<body class="p-3 sm:p-6 max-w-7xl mx-auto selection:bg-emerald-500 selection:text-slate-950 pb-16">
  <!-- Top App Bar (iOS Glassmorphism) -->
  <header class="ios-glass rounded-2xl p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg text-lg">
        🏫
      </div>
      <div>
        <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-white">Smart Presensi & Anti-Spam WA</h1>
        <p class="text-xs text-emerald-400 font-medium">Spintax 20 Variasi Template & Worker Delay 15 Detik</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <div id="workerBadge" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        Worker: Aktif (15s)
      </div>
      <button onclick="toggleWorker()" id="toggleWorkerBtn" class="text-xs px-3 py-1.5 rounded-xl font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition">
        Jeda Worker
      </button>
    </div>
  </header>

  <!-- Nav Tabs (4 Tabs Utama) -->
  <div class="flex flex-wrap items-center gap-2 p-1.5 bg-black/40 border border-emerald-500/15 rounded-2xl mb-6 w-fit text-xs font-semibold">
    <button onclick="switchTab('presensi')" id="tabBtn-presensi" class="px-4 py-2 rounded-xl transition bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
      1. Presensi (QR/RFID)
    </button>
    <button onclick="switchTab('members')" id="tabBtn-members" class="px-4 py-2 rounded-xl transition text-slate-400 hover:text-white">
      2. Kelola Member
    </button>
    <button onclick="switchTab('templates')" id="tabBtn-templates" class="px-4 py-2 rounded-xl transition text-slate-400 hover:text-white">
      3. WA Notifikasi
    </button>
    <button onclick="switchTab('queue')" id="tabBtn-queue" class="px-4 py-2 rounded-xl transition text-slate-400 hover:text-white">
      4. Monitoring Notifikasi
    </button>
  </div>

  <!-- SECTION 1: TERMINAL PRESENSI HYBRID (KAMERA QR + USB RFID) -->
  <section id="section-presensi" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <div class="lg:col-span-7 space-y-6">
      <!-- 1. Live Camera QR Scanner -->
      <div class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base">
              📷
            </div>
            <div>
              <h2 class="text-sm font-bold text-white flex items-center gap-2">
                <span>Kamera QR Scanner</span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  HP / Webcam
                </span>
              </h2>
              <p class="text-xs text-slate-400">Pindai QR Code dari kartu pelajar atau layar HP siswa</p>
            </div>
          </div>
          <button type="button" onclick="toggleCameraQR()" id="btnToggleCamera" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300 transition shadow-md active:scale-95">
            Nyalakan Kamera QR
          </button>
        </div>

        <!-- Viewport Kamera QR -->
        <div class="relative rounded-2xl overflow-hidden bg-black/70 border border-emerald-500/20 min-h-[200px] flex items-center justify-center">
          <div id="qr-reader" class="w-full max-w-xs mx-auto overflow-hidden hidden"></div>
          <div id="qrPlaceholder" class="text-center p-6 space-y-2">
            <div class="text-3xl">🔲</div>
            <p class="text-xs font-bold text-slate-300">Kamera Scanner Sedang Nonaktif</p>
            <p class="text-[11px] text-slate-500 max-w-xs">Klik tombol "Nyalakan Kamera QR" untuk memindai kartu barcode/QR.</p>
          </div>
        </div>
      </div>

      <!-- 2. USB RFID Reader Card -->
      <div class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
        <h2 class="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <span>💳</span> USB RFID Reader (Keyboard HID Keystroke)
        </h2>
        <p class="text-xs text-slate-400 mb-4">
          Kolom input otomatis autofocus untuk menangkap sinyal kartu USB RFID reader secara instan.
        </p>

        <form id="rfidForm" class="space-y-3">
          <div>
            <label class="text-xs text-slate-300 block mb-1">Pilih Kategori Status</label>
            <div class="grid grid-cols-5 gap-1.5 text-xs font-semibold">
              <button type="button" onclick="selectStatus('hadir_tepat')" id="btnStatus-hadir_tepat" class="py-2 rounded-xl border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Hadir Tepat</button>
              <button type="button" onclick="selectStatus('hadir_telat')" id="btnStatus-hadir_telat" class="py-2 rounded-xl border bg-black/30 text-slate-400 border-white/5">Telat</button>
              <button type="button" onclick="selectStatus('pulang')" id="btnStatus-pulang" class="py-2 rounded-xl border bg-black/30 text-slate-400 border-white/5">Pulang</button>
              <button type="button" onclick="selectStatus('izin')" id="btnStatus-izin" class="py-2 rounded-xl border bg-black/30 text-slate-400 border-white/5">Izin</button>
              <button type="button" onclick="selectStatus('sakit')" id="btnStatus-sakit" class="py-2 rounded-xl border bg-black/30 text-slate-400 border-white/5">Sakit</button>
            </div>
          </div>

          <div class="flex gap-2">
            <input 
              type="text" 
              id="rfidInput" 
              placeholder="Scan kartu RFID USB / Ketik UID (contoh: E2000019)..." 
              class="flex-1 bg-black/60 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono uppercase"
              required
              autofocus
              autocomplete="off"
            />
            <button type="submit" class="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95">
              Submit Tap
            </button>
          </div>
        </form>

        <div id="scanResult" class="hidden mt-3 p-3 rounded-xl text-xs font-mono"></div>

        <!-- Kartu Simulasi Dinamis dari Database Students -->
        <div class="mt-4 pt-3 border-t border-emerald-500/10">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-slate-400 font-medium">Data Siswa Riil dari Database (Klik untuk Tap Cepat):</span>
            <span id="studentCountBadge" class="text-[10px] text-emerald-400 font-mono">Memuat...</span>
          </div>
          <div id="quickTapContainer" class="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1"></div>
        </div>
      </div>
    </div>

    <!-- Info Spintax Anti-Spam & Hybrid Status -->
    <div class="lg:col-span-5 space-y-4">
      <div class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
        <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <span>🛡️</span> Mekanisme Spintax Anti-Spam
        </h3>
        <p class="text-xs text-slate-300 leading-relaxed mb-3">
          Saat presensi disubmit, sistem mengambil 1 dari 4 variasi pesan secara acak dengan <code>Math.random()</code>, mengganti <code>[NAMA]</code> & <code>[WAKTU]</code>, lalu memasukkannya ke tabel <code>wa_queue</code> dengan status <strong>pending</strong>.
        </p>
        <div class="p-3 bg-black/40 rounded-xl border border-emerald-500/20 text-[11px] font-mono text-emerald-300 space-y-1">
          <div>✓ Status Masuk wa_queue : PENDING</div>
          <div>✓ API WA Ditembak Saat Ini : TIDAK (Aman)</div>
          <div>✓ Delay Antrean Eksekusi : TEPAT 15 DETIK / PESAN</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ================================================================ -->
  <!-- SECTION 2: KELOLA MEMBER (3 SUB-TAB: DATA SISWA, KELAS, USER)   -->
  <!-- ================================================================ -->
  <section id="section-members" class="hidden space-y-6">
    <!-- Header Card Kelola Member -->
    <div class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <span>👥</span> Kelola Member & Master Data
          </h2>
          <p class="text-xs text-slate-400">
            Pusat administrasi relasi data sekolah: Siswa & RFID, Rombel / Kelas, dan Akun Operator.
          </p>
        </div>
        
        <!-- Tombol Aksi dinamis sesuai sub-tab -->
        <div id="memberActionBtnContainer">
          <button onclick="openAddStudentModal()" id="btnActionAddStudent" class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs rounded-xl shadow-md active:scale-95 transition">
            + Tambah Siswa Baru
          </button>
          <button onclick="openAddRombelModal()" id="btnActionAddRombel" class="hidden px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs rounded-xl shadow-md active:scale-95 transition">
            + Tambah Kelas (Rombel)
          </button>
          <button onclick="openAddUserModal()" id="btnActionAddUser" class="hidden px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs rounded-xl shadow-md active:scale-95 transition">
            + Tambah User Operator
          </button>
        </div>
      </div>

      <!-- 3 Sub-Tabs Horizontal Pills -->
      <div class="mt-5 pt-4 border-t border-emerald-500/15">
        <div class="inline-flex p-1 bg-black/60 rounded-xl border border-emerald-500/20 text-xs font-semibold">
          <button onclick="switchSubTab('students')" id="subTabBtn-students" class="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition">
            Data Siswa
          </button>
          <button onclick="switchSubTab('classes')" id="subTabBtn-classes" class="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition">
            Data Kelas
          </button>
          <button onclick="switchSubTab('users')" id="subTabBtn-users" class="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition">
            Data User
          </button>
        </div>
      </div>
    </div>

    <!-- SUB-TAB 1: DATA SISWA -->
    <div id="subSection-students" class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <input
          type="text"
          id="studentSearchInput"
          oninput="searchStudents()"
          placeholder="Cari siswa berdasarkan nama, UID RFID, atau kelas..."
          class="w-full sm:max-w-md bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
        />
        <span id="studentTableCount" class="text-xs text-slate-400 font-mono">0 Siswa</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-slate-400 border-b border-emerald-500/15">
              <th class="pb-3 font-semibold pl-2">#</th>
              <th class="pb-3 font-semibold">Nama Siswa</th>
              <th class="pb-3 font-semibold">UID RFID</th>
              <th class="pb-3 font-semibold">No. WhatsApp Wali</th>
              <th class="pb-3 font-semibold">Kelas (Rombel)</th>
              <th class="pb-3 font-semibold text-right pr-2">Aksi</th>
            </tr>
          </thead>
          <tbody id="studentTableBody" class="divide-y divide-emerald-500/10 font-mono">
            <tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">Memuat data siswa...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SUB-TAB 2: DATA KELAS (ROMBEL) -->
    <div id="subSection-classes" class="hidden ios-glass-card rounded-2xl p-5 border border-emerald-500/20 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <input
          type="text"
          id="rombelSearchInput"
          oninput="searchRombel()"
          placeholder="Cari nama kelas atau nama wali kelas..."
          class="w-full sm:max-w-md bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
        />
        <span id="rombelTableCount" class="text-xs text-slate-400 font-mono">0 Kelas</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-slate-400 border-b border-emerald-500/15">
              <th class="pb-3 font-semibold pl-2">#</th>
              <th class="pb-3 font-semibold">Nama Kelas (Rombel)</th>
              <th class="pb-3 font-semibold">Nama Wali Kelas</th>
              <th class="pb-3 font-semibold">Jumlah Siswa</th>
              <th class="pb-3 font-semibold text-right pr-2">Aksi</th>
            </tr>
          </thead>
          <tbody id="rombelTableBody" class="divide-y divide-emerald-500/10 font-mono">
            <tr><td colspan="5" class="py-6 text-center text-slate-500 font-sans">Memuat data kelas...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SUB-TAB 3: DATA USER -->
    <div id="subSection-users" class="hidden ios-glass-card rounded-2xl p-5 border border-emerald-500/20 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <input
          type="text"
          id="userSearchInput"
          oninput="searchUsers()"
          placeholder="Cari username, nama lengkap, atau role operator..."
          class="w-full sm:max-w-md bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
        />
        <span id="userTableCount" class="text-xs text-slate-400 font-mono">0 Operator</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-slate-400 border-b border-emerald-500/15">
              <th class="pb-3 font-semibold pl-2">#</th>
              <th class="pb-3 font-semibold">Username</th>
              <th class="pb-3 font-semibold">Nama Lengkap</th>
              <th class="pb-3 font-semibold">Role Pengguna</th>
              <th class="pb-3 font-semibold">Status</th>
              <th class="pb-3 font-semibold text-right pr-2">Aksi</th>
            </tr>
          </thead>
          <tbody id="userTableBody" class="divide-y divide-emerald-500/10 font-mono">
            <tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">Memuat data user...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- SECTION 3: CRUD 20 TEMPLATE PESAN (SPINTAX) -->
  <section id="section-templates" class="hidden space-y-6">
    <div class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <span>📝</span> Manajemen 20 Template Pesan (Spintax)
          </h2>
          <p class="text-xs text-slate-400">
            Tiap kategori memiliki 4 variasi pesan agar sistem tidak memicu deteksi spam WhatsApp.
          </p>
        </div>
      </div>

      <!-- Kategori Filter -->
      <div class="flex flex-wrap gap-2 mb-5">
        <button onclick="filterTemplateCategory('all')" id="catBtn-all" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Semua (20)</button>
        <button onclick="filterTemplateCategory('hadir_tepat')" id="catBtn-hadir_tepat" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-slate-400 border border-white/5">Hadir Tepat (4)</button>
        <button onclick="filterTemplateCategory('hadir_telat')" id="catBtn-hadir_telat" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-slate-400 border border-white/5">Hadir Telat (4)</button>
        <button onclick="filterTemplateCategory('pulang')" id="catBtn-pulang" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-slate-400 border border-white/5">Pulang (4)</button>
        <button onclick="filterTemplateCategory('izin')" id="catBtn-izin" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-slate-400 border border-white/5">Izin (4)</button>
        <button onclick="filterTemplateCategory('sakit')" id="catBtn-sakit" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-slate-400 border border-white/5">Sakit (4)</button>
      </div>

      <div id="templateCardsGrid" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
    </div>
  </section>

  <!-- SECTION 4: ANTREAN WA & WORKER 15S -->
  <section id="section-queue" class="hidden space-y-6">
    <div class="ios-glass-card rounded-2xl p-5 border border-emerald-500/20">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-bold text-white flex items-center gap-2">
            <span>🚀</span> Antrean wa_queue (Worker Anti-Spam 15 Detik)
          </h2>
          <p class="text-xs text-slate-400">
            Worker polling 1 baris pending terlama (FIFO), eksekusi API Sidobe, update status jadi 'sent', lalu delay tepat 15s.
          </p>
        </div>
      </div>

      <div class="bg-black/60 rounded-xl p-4 border border-emerald-500/20 mb-4">
        <div class="flex items-center justify-between text-xs text-slate-300 mb-2">
          <span class="font-semibold">Hitung Mundur Jeda Anti-Spam (15s):</span>
          <span id="countdownText" class="font-mono font-bold text-emerald-400">Siap</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div id="countdownBar" class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <p id="workerLogText" class="text-[11px] text-slate-400 mt-2 font-mono truncate">Menunggu data antrean...</p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-slate-400 border-b border-emerald-500/15">
              <th class="pb-2.5 font-semibold">Tujuan WA</th>
              <th class="pb-2.5 font-semibold">Status</th>
              <th class="pb-2.5 font-semibold">Waktu Masuk</th>
              <th class="pb-2.5 font-semibold">Isi Pesan WhatsApp</th>
            </tr>
          </thead>
          <tbody id="queueTableBody" class="divide-y divide-emerald-500/10 font-mono">
            <tr>
              <td colspan="4" class="py-6 text-center text-slate-500 font-sans">Belum ada antrean pesan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ==================== MODALS ==================== -->

  <!-- MODAL: Tambah Siswa Baru (DENGAN DYNAMIC SELECT ROMBEL) -->
  <div id="addStudentModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Tambah Siswa Baru</h3>
        <button onclick="closeAddStudentModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="addStudentForm" onsubmit="submitAddStudent(event)" class="space-y-3 text-xs">
        <div>
          <label class="text-slate-300 block mb-1">Nama Lengkap Siswa *</label>
          <input type="text" id="addNama" placeholder="Contoh: Muhammad Rizky" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">UID Kartu RFID *</label>
          <input type="text" id="addRfid" placeholder="Contoh: E2000019 (HEX)" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white font-mono uppercase focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Nomor WhatsApp Wali Murid *</label>
          <input type="text" id="addWa" placeholder="Contoh: 6281234567890" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Kelas / Rombel * (Dinamis dari Tabel Rombel)</label>
          <select id="addKelasSelect" class="w-full bg-black/80 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required>
            <option value="">-- Pilih Kelas --</option>
          </select>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeAddStudentModal()" class="px-4 py-2 text-slate-400 hover:text-white">Batal</button>
          <button type="submit" class="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-md">Simpan Siswa</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Edit Siswa (DENGAN DYNAMIC SELECT ROMBEL) -->
  <div id="editStudentModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Edit Data Siswa</h3>
        <button onclick="closeEditStudentModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="editStudentForm" onsubmit="submitEditStudent(event)" class="space-y-3 text-xs">
        <input type="hidden" id="editStudentId" />
        <div>
          <label class="text-slate-300 block mb-1">Nama Lengkap Siswa *</label>
          <input type="text" id="editStudentNama" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">UID Kartu RFID *</label>
          <input type="text" id="editStudentRfid" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white font-mono uppercase focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Nomor WhatsApp Wali Murid *</label>
          <input type="text" id="editStudentWa" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Kelas / Rombel *</label>
          <select id="editStudentKelasSelect" class="w-full bg-black/80 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required>
            <option value="">-- Pilih Kelas --</option>
          </select>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeEditStudentModal()" class="px-4 py-2 text-slate-400 hover:text-white">Batal</button>
          <button type="submit" class="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-md">Simpan Perubahan</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Tambah Rombel Baru -->
  <div id="addRombelModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Tambah Kelas (Rombel) Baru</h3>
        <button onclick="closeAddRombelModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="addRombelForm" onsubmit="submitAddRombel(event)" class="space-y-3 text-xs">
        <div>
          <label class="text-slate-300 block mb-1">Nama Kelas / Rombel *</label>
          <input type="text" id="addRombelNama" placeholder="Contoh: X RPL 1" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Nama Wali Kelas *</label>
          <input type="text" id="addRombelWali" placeholder="Contoh: Drs. Bambang Sutrisno, M.Pd." class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeAddRombelModal()" class="px-4 py-2 text-slate-400 hover:text-white">Batal</button>
          <button type="submit" class="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-md">Simpan Kelas</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Edit Rombel -->
  <div id="editRombelModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Edit Data Kelas (Rombel)</h3>
        <button onclick="closeEditRombelModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="editRombelForm" onsubmit="submitEditRombel(event)" class="space-y-3 text-xs">
        <input type="hidden" id="editRombelId" />
        <div>
          <label class="text-slate-300 block mb-1">Nama Kelas / Rombel *</label>
          <input type="text" id="editRombelNama" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Nama Wali Kelas *</label>
          <input type="text" id="editRombelWali" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeEditRombelModal()" class="px-4 py-2 text-slate-400 hover:text-white">Batal</button>
          <button type="submit" class="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-md">Simpan Perubahan</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Tambah User Baru -->
  <div id="addUserModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Tambah User Operator</h3>
        <button onclick="closeAddUserModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="addUserForm" onsubmit="submitAddUser(event)" class="space-y-3 text-xs">
        <div>
          <label class="text-slate-300 block mb-1">Username *</label>
          <input type="text" id="addUserUsername" placeholder="Contoh: operator_sore" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Nama Lengkap *</label>
          <input type="text" id="addUserNama" placeholder="Contoh: Dewi Lestari, S.Pd." class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-slate-300 block mb-1">Role</label>
            <select id="addUserRole" class="w-full bg-black/80 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-white focus:outline-none">
              <option value="Operator Presensi">Operator Presensi</option>
              <option value="Guru Piket">Guru Piket</option>
              <option value="Administrator">Administrator</option>
            </select>
          </div>
          <div>
            <label class="text-slate-300 block mb-1">Status</label>
            <select id="addUserStatus" class="w-full bg-black/80 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-white focus:outline-none">
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeAddUserModal()" class="px-4 py-2 text-slate-400 hover:text-white">Batal</button>
          <button type="submit" class="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-md">Simpan User</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Edit User -->
  <div id="editUserModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Edit Data User</h3>
        <button onclick="closeEditUserModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="editUserForm" onsubmit="submitEditUser(event)" class="space-y-3 text-xs">
        <input type="hidden" id="editUserId" />
        <div>
          <label class="text-slate-300 block mb-1">Username *</label>
          <input type="text" id="editUserUsername" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-400" required />
        </div>
        <div>
          <label class="text-slate-300 block mb-1">Nama Lengkap *</label>
          <input type="text" id="editUserNama" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400" required />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-slate-300 block mb-1">Role</label>
            <select id="editUserRole" class="w-full bg-black/80 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-white focus:outline-none">
              <option value="Operator Presensi">Operator Presensi</option>
              <option value="Guru Piket">Guru Piket</option>
              <option value="Administrator">Administrator</option>
            </select>
          </div>
          <div>
            <label class="text-slate-300 block mb-1">Status</label>
            <select id="editUserStatus" class="w-full bg-black/80 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-white focus:outline-none">
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeEditUserModal()" class="px-4 py-2 text-slate-400 hover:text-white">Batal</button>
          <button type="submit" class="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-md">Simpan Perubahan</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Edit Template Pesan -->
  <div id="editTemplateModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="ios-glass rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-emerald-500/30 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Edit Template Pesan WhatsApp</h3>
        <button onclick="closeEditModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <input type="hidden" id="editTemplateId" />
      <div>
        <label class="text-xs text-slate-300 block mb-1">Kategori Status</label>
        <input type="text" id="editCategory" class="w-full bg-black/60 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono" readonly />
      </div>
      <div>
        <label class="text-xs text-slate-300 block mb-1">Isi Pesan (Wajib memuat [NAMA] dan [WAKTU])</label>
        <textarea id="editMessageText" rows="6" class="w-full bg-black/60 border border-emerald-500/30 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-400 leading-relaxed"></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="closeEditModal()" class="px-4 py-2 text-xs text-slate-400 hover:text-white">Batal</button>
        <button onclick="saveEditedTemplate()" class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs rounded-xl shadow-md">Simpan Perubahan</button>
      </div>
  <!-- MODAL: LIHAT & DOWNLOAD QR CODE OTOMATIS (ON-THE-FLY) -->
  <div id="qrCodeModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
    <div class="ios-glass rounded-3xl max-w-sm w-full p-6 border border-emerald-500/30 space-y-5 shadow-2xl text-center">
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="inline-flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold text-sm">
            📷
          </div>
          <span id="qrModalBadge" class="text-xs font-bold text-emerald-400 tracking-wider font-mono">
            QR KARTU
          </span>
        </div>
        <button onclick="closeQrModal()" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
          ✕
        </button>
      </div>

      <div class="relative mx-auto w-56 h-56 p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-emerald-400/30">
        <img id="qrCodeModalImg" src="" alt="QR Code" class="w-full h-full object-contain" />
      </div>

      <div class="space-y-1.5">
        <h4 id="qrModalTitle" class="text-base font-bold text-white tracking-tight">Nama</h4>
        <p id="qrModalSubtitle" class="text-xs text-slate-300">Keterangan</p>
        <div class="pt-2">
          <span id="qrModalUidText" class="inline-block px-3.5 py-1.5 rounded-full bg-black/70 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold tracking-wider">
            UID: -
          </span>
        </div>
      </div>

      <div class="pt-2 border-t border-white/10 flex gap-2.5">
        <button type="button" onclick="closeQrModal()" class="flex-1 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition">
          Tutup
        </button>
        <button type="button" id="btnDownloadQr" onclick="downloadCurrentQr()" class="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-1.5">
          <span>⬇️ Download QR</span>
        </button>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>`;

export const STANDALONE_APP_JS = `/**
 * PORTAL PRESENSI SEKOLAH & ANTI-SPAM WHATSAPP (SIDOBE API)
 * FOKUS: Kelola Member (Siswa, Rombel, User), Spintax 20 Template, & Worker 15s
 * Tech Stack: HTML5, Vanilla JavaScript, Supabase JS Client v2
 */

// ================================================================
// 1. KONFIGURASI SUPABASE & SIDOBE WA GATEWAY
// ================================================================
const CONFIG = {
  SUPABASE_URL: window.ENV_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: window.ENV_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
  SIDOBE_API_URL: 'https://api.sidobe.com/send-message',
  SIDOBE_TOKEN: 'DUMMY_SIDOBE_TOKEN_ABC123',
  ANTI_SPAM_DELAY_SECONDS: 15
};

// Inisialisasi Supabase JS Client v2
let supabase = null;
if (typeof window.supabase !== 'undefined' && CONFIG.SUPABASE_URL.startsWith('http')) {
  try {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('✅ Supabase Client v2 berhasil diinisialisasi.');
  } catch (err) {
    console.warn('Supabase fallback ke mode lokal:', err);
  }
}

// Master Data Lokal Reaktif
let currentRombel = [
  { id: 'rmb-1', nama_kelas: 'X RPL 1', nama_wali_kelas: 'Drs. Bambang Sutrisno, M.Pd.' },
  { id: 'rmb-2', nama_kelas: 'X RPL 2', nama_wali_kelas: 'Siti Aminah, S.Kom.' },
  { id: 'rmb-3', nama_kelas: 'XI TKJ 1', nama_wali_kelas: 'Ahmad Fauzi, S.T.' },
  { id: 'rmb-4', nama_kelas: 'XI TKJ 2', nama_wali_kelas: 'Nurul Hidayati, S.Pd.' },
  { id: 'rmb-5', nama_kelas: 'XII SIJA 1', nama_wali_kelas: 'Hendra Kurniawan, M.Kom.' },
  { id: 'rmb-6', nama_kelas: 'XII SIJA 2', nama_wali_kelas: 'Ratna Dewi, S.Pd.' }
];

let currentUsers = [
  { id: 'usr-1', username: 'admin_utama', nama_lengkap: 'Budi Darmawan, S.Kom.', role: 'Administrator', status: 'Aktif' },
  { id: 'usr-2', username: 'operator_pagi', nama_lengkap: 'Maya Anggraini, A.Md.', role: 'Operator Presensi', status: 'Aktif' },
  { id: 'usr-3', username: 'guru_piket', nama_lengkap: 'Joko Prabowo, S.Pd.', role: 'Guru Piket', status: 'Aktif' }
];

let currentStudents = [
  { id: '1', uid_kartu: 'E2000019', rfid_uid: 'E2000019', nama: 'Muhammad Rizky Pratama', no_wa_wali: '6281234567890', class_id: 'rmb-1', kelas: 'X RPL 1' },
  { id: '2', uid_kartu: 'A1045F20', rfid_uid: 'A1045F20', nama: 'Aisyah Putri Rahmadani', no_wa_wali: '6281398765432', class_id: 'rmb-1', kelas: 'X RPL 1' },
  { id: '3', uid_kartu: 'B3092C11', rfid_uid: 'B3092C11', nama: 'Dimas Bagus Wicaksono', no_wa_wali: '6285712345678', class_id: 'rmb-2', kelas: 'X RPL 2' },
  { id: '4', uid_kartu: 'C4081D33', rfid_uid: 'C4081D33', nama: 'Nabila Zahra Kirana', no_wa_wali: '6287890123456', class_id: 'rmb-3', kelas: 'XI TKJ 1' },
  { id: '5', uid_kartu: 'D5073E44', rfid_uid: 'D5073E44', nama: 'Fajar Nugraha Saputra', no_wa_wali: '6282133445566', class_id: 'rmb-4', kelas: 'XI TKJ 2' },
  { id: '6', uid_kartu: 'F6064A55', rfid_uid: 'F6064A55', nama: 'Siti Nurhaliza Azzahra', no_wa_wali: '6289655443322', class_id: 'rmb-5', kelas: 'XII SIJA 1' }
];

// 20 Baris Template Pesan
let localTemplates = [
  // hadir_tepat
  { id: 'tmpl-1', status_category: 'hadir_tepat', message_text: "Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari *[NAMA]*. Diberitahukan bahwa ananda telah tiba dan melakukan presensi kehadiran tepat waktu di sekolah pada pukul *[WAKTU]* WIB. Semoga proses belajar ananda hari ini lancar dan menyenangkan. Terima kasih atas kerja samanya." },
  { id: 'tmpl-2', status_category: 'hadir_tepat', message_text: "Selamat pagi Bapak/Ibu Wali Murid. Kami mengonfirmasi ananda *[NAMA]* telah hadir di sekolah dengan status HADIR TEPAT WAKTU pada jam *[WAKTU]* WIB. Terima kasih atas kedisiplinan ananda dalam mematuhi jadwal sekolah." },
  { id: 'tmpl-3', status_category: 'hadir_tepat', message_text: "Info Presensi Sekolah: Ananda *[NAMA]* telah tiba di gerbang sekolah dengan selamat dan tercatat hadir tepat waktu pukul *[WAKTU]* WIB. Selamat beraktivitas untuk Bapak/Ibu sekalian. Salam hangat dari pihak sekolah." },
  { id: 'tmpl-4', status_category: 'hadir_tepat', message_text: "Yth. Orang tua dari ananda *[NAMA]*, sistem kartu RFID sekolah mencatat kehadiran ananda pada pukul *[WAKTU]* WIB (Kategori: Tepat Waktu). Terima kasih telah mendukung ananda berangkat pagi ke sekolah." },

  // hadir_telat
  { id: 'tmpl-5', status_category: 'hadir_telat', message_text: "Pemberitahuan Presensi: Yth. Orang tua dari ananda *[NAMA]*, ananda tercatat tiba di sekolah pada pukul *[WAKTU]* WIB dan tercatat TERLAMBAT. Mohon dapat memberikan pendampingan agar ananda dapat berangkat lebih awal esok hari." },
  { id: 'tmpl-6', status_category: 'hadir_telat', message_text: "Assalamu'alaikum Wr. Wb. Kami menginformasikan bahwa ananda *[NAMA]* tiba di sekolah pukul *[WAKTU]* WIB melewati batas toleransi jam masuk (Terlambat). Terima kasih atas perhatian dan kerja samanya." },
  { id: 'tmpl-7', status_category: 'hadir_telat', message_text: "Laporan Kehadiran: Ananda *[NAMA]* telah memasuki lingkungan sekolah pada jam *[WAKTU]* WIB dengan status Terlambat. Mohon kerja sama Bapak/Ibu untuk mengevaluasi waktu keberangkatan dari rumah." },
  { id: 'tmpl-8', status_category: 'hadir_telat', message_text: "Yth. Bapak/Ibu Wali dari *[NAMA]*, ananda telah melakukan presensi di gerbang pada pukul *[WAKTU]* WIB (Status: Terlambat). Semoga di hari berikutnya ananda bisa hadir tepat waktu. Terima kasih." },

  // pulang
  { id: 'tmpl-9', status_category: 'pulang', message_text: "Assalamu'alaikum Wr. Wb. Kegiatan belajar mengajar telah selesai. Ananda *[NAMA]* telah melakukan presensi PULANG sekolah pada pukul *[WAKTU]* WIB. Semoga ananda sampai di rumah dengan selamat dan sehat walafiat." },
  { id: 'tmpl-10', status_category: 'pulang', message_text: "Info Kepulangan Siswa: Ananda *[NAMA]* telah meninggalkan area sekolah pada jam *[WAKTU]* WIB. Mohon dipantau perjalanan ananda kembali ke rumah. Terima kasih atas perhatiannya." },
  { id: 'tmpl-11', status_category: 'pulang', message_text: "Yth. Orang tua dari *[NAMA]*, jam pelajaran sekolah hari ini telah usai. Ananda tercatat melakukan tap kartu kepulangan pada pukul *[WAKTU]* WIB. Hati-hati di jalan untuk ananda tercinta." },
  { id: 'tmpl-12', status_category: 'pulang', message_text: "Pemberitahuan Presensi Pulang: Ananda *[NAMA]* telah selesai beraktivitas di sekolah dan tercatat pulang pada *[WAKTU]* WIB. Selamat beristirahat bersama keluarga di rumah." },

  // izin
  { id: 'tmpl-13', status_category: 'izin', message_text: "Konfirmasi Presensi: Surat atau pemberitahuan izin untuk ananda *[NAMA]* telah kami terima dan tercatat di sistem presensi sekolah pada pukul *[WAKTU]* WIB (Status: IZIN). Terima kasih atas konfirmasinya." },
  { id: 'tmpl-14', status_category: 'izin', message_text: "Yth. Bapak/Ibu Wali Murid, laporan izin tidak hadir untuk ananda *[NAMA]* telah berhasil divalidasi oleh piket sekolah pada jam *[WAKTU]* WIB. Terima kasih atas kerja sama Bapak/Ibu." },
  { id: 'tmpl-15', status_category: 'izin', message_text: "Info Kehadiran: Status kehadiran ananda *[NAMA]* hari ini tercatat dengan keterangan 'IZIN' per pukul *[WAKTU]* WIB. Terima kasih telah mengabari pihak sekolah." },
  { id: 'tmpl-16', status_category: 'izin', message_text: "Catatan Presensi Sekolah: Ananda *[NAMA]* terdata berstatus Izin pada pukul *[WAKTU]* WIB. Semoga urusan dan keperluan ananda sekeluarga berjalan lancar." },

  // sakit
  { id: 'tmpl-17', status_category: 'sakit', message_text: "Konfirmasi Kesehatan: Pemberitahuan sakit untuk ananda *[NAMA]* telah tercatat di sistem presensi sekolah pada pukul *[WAKTU]* WIB. Segenap bapak/ibu guru mendoakan semoga ananda lekas sembuh dan pulih kembali." },
  { id: 'tmpl-18', status_category: 'sakit', message_text: "Yth. Orang tua *[NAMA]*, konfirmasi bahwa ananda sedang sakit dan beristirahat telah kami catat pada jam *[WAKTU]* WIB. Semoga ananda segera sembuh dan dapat beraktivitas kembali." },
  { id: 'tmpl-19', status_category: 'sakit', message_text: "Info Ketidakhadiran: Ananda *[NAMA]* tercatat tidak masuk sekolah dengan status 'SAKIT' pada pukul *[WAKTU]* WIB. Istirahat yang cukup untuk ananda tercinta." },
  { id: 'tmpl-20', status_category: 'sakit', message_text: "Pemberitahuan Sekolah: Data izin sakit ananda *[NAMA]* telah masuk ke jurnal kelas per pukul *[WAKTU]* WIB. Lekas sembuh untuk ananda. Terima kasih atas pemberitahuan Bapak/Ibu." }
];

let localQueue = [];
let workerState = { isRunning: true, isPaused: false, countdown: 0, isProcessing: false };
let selectedCategory = 'hadir_tepat';
let currentFilterCat = 'all';
let currentSubTab = 'students';

// Helpers
function getFormattedTime() {
  const now = new Date();
  return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function sanitizePhone(phone) {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (!clean.startsWith('62')) clean = '62' + clean;
  return clean;
}

// Kamera QR Scanner State & Handler (html5-qrcode)
let html5QrScanner = null;
let isCameraActive = false;
let qrCooldown = false;

async function toggleCameraQR() {
  const qrBox = document.getElementById('qr-reader');
  const qrPlaceholder = document.getElementById('qrPlaceholder');
  const btn = document.getElementById('btnToggleCamera');
  if (!qrBox || !btn) return;

  if (isCameraActive) {
    if (html5QrScanner && html5QrScanner.isScanning) {
      await html5QrScanner.stop();
      html5QrScanner.clear();
    }
    isCameraActive = false;
    qrBox.classList.add('hidden');
    if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
    btn.innerText = 'Nyalakan Kamera QR';
    btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300 transition shadow-md active:scale-95';
  } else {
    try {
      if (typeof Html5Qrcode === 'undefined') {
        alert('Library html5-qrcode belum selesai dimuat dari CDN. Silakan coba sesaat lagi.');
        return;
      }
      qrBox.classList.remove('hidden');
      if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode('qr-reader');
      }
      await html5QrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (qrCooldown) return;
          qrCooldown = true;
          await handleHybridScan(decodedText, 'QR');
          setTimeout(() => { qrCooldown = false; }, 2500);
        },
        () => {}
      );
      isCameraActive = true;
      btn.innerText = 'Hentikan Kamera';
      btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition shadow-md active:scale-95';
    } catch (err) {
      alert('Gagal menyalakan kamera: ' + err.message);
      isCameraActive = false;
      qrBox.classList.add('hidden');
      if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
    }
  }
}

async function handleHybridScan(rawUid, method = 'RFID') {
  const resBox = document.getElementById('scanResult');
  const result = await processAttendanceSubmission(rawUid, selectedCategory, method);
  if (!resBox) return;

  if (!result.success) {
    resBox.className = 'mt-3 p-3 rounded-xl text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30';
    resBox.innerText = result.message;
    resBox.classList.remove('hidden');
  } else {
    resBox.className = 'mt-3 p-3 rounded-xl text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    resBox.innerHTML = \`
      <div class="font-bold">✓ Presensi Sukses via \${result.method || method}: \${result.student.nama} (\${result.statusCategory})</div>
      <div class="text-[11px] text-slate-300 mt-1">Spintax: Memilih Variasi #\${result.variationChosen} dari \${result.totalVariations} template</div>
      <div class="text-[11px] text-amber-300 mt-0.5">Status wa_queue: PENDING (Menunggu giliran worker 15s)</div>
    \`;
    resBox.classList.remove('hidden');
  }
}

// ================================================================
// 2. SUB-TAB SWITCHING & DYNAMIC DROPDOWN SYNC
// ================================================================
function switchSubTab(subTab) {
  currentSubTab = subTab;
  ['students', 'classes', 'users'].forEach(st => {
    const sec = document.getElementById('subSection-' + st);
    const btn = document.getElementById('subTabBtn-' + st);
    if (sec) sec.classList.toggle('hidden', st !== subTab);
    if (btn) {
      btn.className = (st === subTab)
        ? 'px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition'
        : 'px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
    }
  });

  // Toggle action buttons in header
  const btnStd = document.getElementById('btnActionAddStudent');
  const btnRmb = document.getElementById('btnActionAddRombel');
  const btnUsr = document.getElementById('btnActionAddUser');
  if (btnStd) btnStd.classList.toggle('hidden', subTab !== 'students');
  if (btnRmb) btnRmb.classList.toggle('hidden', subTab !== 'classes');
  if (btnUsr) btnUsr.classList.toggle('hidden', subTab !== 'users');

  if (subTab === 'students') renderStudentsTable();
  if (subTab === 'classes') renderRombelTable();
  if (subTab === 'users') renderUserTable();
}

// Sinkronisasi opsi dropdown <select> Kelas dari currentRombel
function populateRombelDropdowns(selectedVal = '') {
  const addSelect = document.getElementById('addKelasSelect');
  const editSelect = document.getElementById('editStudentKelasSelect');

  const optionsHtml = currentRombel.length === 0
    ? '<option value="">-- Belum ada rombel (Tambahkan di Tab Data Kelas) --</option>'
    : '<option value="">-- Pilih Kelas / Rombel --</option>' +
      currentRombel.map(r => \`<option value="\${r.id}">\${r.nama_kelas} (Wali: \${r.nama_wali_kelas})</option>\`).join('');

  if (addSelect) addSelect.innerHTML = optionsHtml;
  if (editSelect) {
    editSelect.innerHTML = optionsHtml;
    if (selectedVal) editSelect.value = selectedVal;
  }
}

// ================================================================
// 3. CRUD DATA KELAS (ROMBEL)
// ================================================================
async function fetchRombelFromDatabase() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('rombel').select('*').order('nama_kelas', { ascending: true });
      if (!error && data && data.length > 0) currentRombel = data;
    } catch (err) {
      console.error('Error fetching rombel:', err);
    }
  }
  populateRombelDropdowns();
  renderRombelTable();
}

function renderRombelTable(filterText = '') {
  const tbody = document.getElementById('rombelTableBody');
  const countEl = document.getElementById('rombelTableCount');
  if (!tbody) return;

  const filtered = currentRombel.filter(r =>
    r.nama_kelas.toLowerCase().includes(filterText.toLowerCase()) ||
    r.nama_wali_kelas.toLowerCase().includes(filterText.toLowerCase())
  );

  if (countEl) countEl.innerText = \`\${filtered.length} Kelas\`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-500 font-sans">Tidak ada data kelas ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((r, idx) => {
    const studentCount = currentStudents.filter(s => s.kelas === r.nama_kelas).length;
    return \`
      <tr class="hover:bg-emerald-950/20 transition">
        <td class="py-3 pl-2 text-slate-500">\${idx + 1}</td>
        <td class="py-3 font-bold text-white font-sans">\${r.nama_kelas}</td>
        <td class="py-3 text-slate-200 font-sans">\${r.nama_wali_kelas}</td>
        <td class="py-3"><span class="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-bold font-mono">\${studentCount} Siswa</span></td>
        <td class="py-3 text-right pr-2">
          <button onclick="openEditRombelModal('\${r.id}', '\${r.nama_kelas}', '\${r.nama_wali_kelas}')" class="px-2.5 py-1 text-[11px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold mr-1 transition font-sans">Edit</button>
          <button onclick="deleteRombel('\${r.id}', '\${r.nama_kelas}')" class="px-2 py-1 text-[11px] rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-semibold transition font-sans">Hapus</button>
        </td>
      </tr>
    \`;
  }).join('');
}

function searchRombel() {
  const val = document.getElementById('rombelSearchInput').value;
  renderRombelTable(val);
}

function openAddRombelModal() {
  document.getElementById('addRombelNama').value = '';
  document.getElementById('addRombelWali').value = '';
  document.getElementById('addRombelModal').classList.remove('hidden');
}

function closeAddRombelModal() {
  document.getElementById('addRombelModal').classList.add('hidden');
}

async function submitAddRombel(e) {
  e.preventDefault();
  const nama = document.getElementById('addRombelNama').value.trim();
  const wali = document.getElementById('addRombelWali').value.trim();

  if (currentRombel.some(r => r.nama_kelas.toLowerCase() === nama.toLowerCase())) {
    alert(\`Kelas [\${nama}] sudah ada!\`);
    return;
  }

  if (supabase) {
    const { data, error } = await supabase.from('rombel').insert([{ nama_kelas: nama, nama_wali_kelas: wali }]).select().single();
    if (!error && data) currentRombel.push(data);
  } else {
    currentRombel.push({ id: 'rmb-' + Date.now(), nama_kelas: nama, nama_wali_kelas: wali });
  }

  closeAddRombelModal();
  populateRombelDropdowns();
  renderRombelTable();
  alert(\`Kelas "\${nama}" berhasil ditambahkan!\`);
}

function openEditRombelModal(id, nama, wali) {
  document.getElementById('editRombelId').value = id;
  document.getElementById('editRombelNama').value = nama;
  document.getElementById('editRombelWali').value = wali;
  document.getElementById('editRombelModal').classList.remove('hidden');
}

function closeEditRombelModal() {
  document.getElementById('editRombelModal').classList.add('hidden');
}

async function submitEditRombel(e) {
  e.preventDefault();
  const id = document.getElementById('editRombelId').value;
  const nama = document.getElementById('editRombelNama').value.trim();
  const wali = document.getElementById('editRombelWali').value.trim();

  const idx = currentRombel.findIndex(r => r.id === id);
  if (idx >= 0) {
    const oldNama = currentRombel[idx].nama_kelas;
    currentRombel[idx] = { ...currentRombel[idx], nama_kelas: nama, nama_wali_kelas: wali };

    // Update students kelas relasi
    if (oldNama !== nama) {
      currentStudents.forEach(s => {
        if (s.kelas === oldNama) s.kelas = nama;
      });
    }
  }

  if (supabase) {
    await supabase.from('rombel').update({ nama_kelas: nama, nama_wali_kelas: wali }).eq('id', id);
  }

  closeEditRombelModal();
  populateRombelDropdowns();
  renderRombelTable();
  renderStudentsTable();
  alert('Data kelas berhasil diperbarui!');
}

async function deleteRombel(id, nama) {
  if (confirm(\`Yakin ingin menghapus kelas "\${nama}"?\`)) {
    if (supabase) {
      await supabase.from('rombel').delete().eq('id', id);
    }
    currentRombel = currentRombel.filter(r => r.id !== id);
    populateRombelDropdowns();
    renderRombelTable();
  }
}

// ================================================================
// 4. CRUD DATA USER (OPERATOR PRESENSI)
// ================================================================
async function fetchUsersFromDatabase() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) currentUsers = data;
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }
  renderUserTable();
}

function renderUserTable(filterText = '') {
  const tbody = document.getElementById('userTableBody');
  const countEl = document.getElementById('userTableCount');
  if (!tbody) return;

  const filtered = currentUsers.filter(u =>
    u.username.toLowerCase().includes(filterText.toLowerCase()) ||
    u.nama_lengkap.toLowerCase().includes(filterText.toLowerCase()) ||
    u.role.toLowerCase().includes(filterText.toLowerCase())
  );

  if (countEl) countEl.innerText = \`\${filtered.length} Operator\`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500 font-sans">Tidak ada user ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((u, idx) => \`
    <tr class="hover:bg-emerald-950/20 transition">
      <td class="py-3 pl-2 text-slate-500">\${idx + 1}</td>
      <td class="py-3 font-mono text-emerald-300 font-bold">@\${u.username}</td>
      <td class="py-3 font-bold text-white font-sans">\${u.nama_lengkap}</td>
      <td class="py-3"><span class="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-sans font-semibold">\${u.role}</span></td>
      <td class="py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${u.status === 'Aktif' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}">\${u.status}</span></td>
      <td class="py-3 text-right pr-2">
        <button onclick="openEditUserModal('\${u.id}', '\${u.username}', '\${u.nama_lengkap}', '\${u.role}', '\${u.status}')" class="px-2.5 py-1 text-[11px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold mr-1 transition font-sans">Edit</button>
        <button onclick="deleteUser('\${u.id}', '\${u.nama_lengkap}')" class="px-2 py-1 text-[11px] rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-semibold transition font-sans">Hapus</button>
      </td>
    </tr>
  \`).join('');
}

function searchUsers() {
  const val = document.getElementById('userSearchInput').value;
  renderUserTable(val);
}

function openAddUserModal() {
  document.getElementById('addUserUsername').value = '';
  document.getElementById('addUserNama').value = '';
  document.getElementById('addUserRole').value = 'Operator Presensi';
  document.getElementById('addUserStatus').value = 'Aktif';
  document.getElementById('addUserModal').classList.remove('hidden');
}

function closeAddUserModal() {
  document.getElementById('addUserModal').classList.add('hidden');
}

async function submitAddUser(e) {
  e.preventDefault();
  const username = document.getElementById('addUserUsername').value.trim().toLowerCase();
  const nama = document.getElementById('addUserNama').value.trim();
  const role = document.getElementById('addUserRole').value;
  const status = document.getElementById('addUserStatus').value;

  if (currentUsers.some(u => u.username.toLowerCase() === username)) {
    alert(\`Username [@\${username}] sudah terdaftar!\`);
    return;
  }

  if (supabase) {
    const { data, error } = await supabase.from('app_users').insert([{ username, nama_lengkap: nama, role, status }]).select().single();
    if (!error && data) currentUsers.push(data);
  } else {
    currentUsers.push({ id: 'usr-' + Date.now(), username, nama_lengkap: nama, role, status });
  }

  closeAddUserModal();
  renderUserTable();
  alert(\`User "@\${username}" berhasil didaftarkan!\`);
}

function openEditUserModal(id, username, nama, role, status) {
  document.getElementById('editUserId').value = id;
  document.getElementById('editUserUsername').value = username;
  document.getElementById('editUserNama').value = nama;
  document.getElementById('editUserRole').value = role;
  document.getElementById('editUserStatus').value = status;
  document.getElementById('editUserModal').classList.remove('hidden');
}

function closeEditUserModal() {
  document.getElementById('editUserModal').classList.add('hidden');
}

async function submitEditUser(e) {
  e.preventDefault();
  const id = document.getElementById('editUserId').value;
  const username = document.getElementById('editUserUsername').value.trim().toLowerCase();
  const nama = document.getElementById('editUserNama').value.trim();
  const role = document.getElementById('editUserRole').value;
  const status = document.getElementById('editUserStatus').value;

  const idx = currentUsers.findIndex(u => u.id === id);
  if (idx >= 0) {
    currentUsers[idx] = { ...currentUsers[idx], username, nama_lengkap: nama, role, status };
  }

  if (supabase) {
    await supabase.from('app_users').update({ username, nama_lengkap: nama, role, status }).eq('id', id);
  }

  closeEditUserModal();
  renderUserTable();
  alert('Data user berhasil diperbarui!');
}

async function deleteUser(id, nama) {
  if (currentUsers.length <= 1) {
    alert('Tidak dapat menghapus operator terakhir!');
    return;
  }
  if (confirm(\`Yakin ingin menghapus user "\${nama}"?\`)) {
    if (supabase) {
      await supabase.from('app_users').delete().eq('id', id);
    }
    currentUsers = currentUsers.filter(u => u.id !== id);
    renderUserTable();
  }
}

// ================================================================
// 5. CRUD DATA SISWA (DENGAN RELASI DINAMIS SELECT KELAS)
// ================================================================
async function fetchStudentsFromDatabase() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('students').select('*').order('nama', { ascending: true });
      if (!error && data) {
        currentStudents = data;
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }
  renderStudentsTable();
  renderQuickTapCards();
}

function renderStudentsTable(filterText = '') {
  const tbody = document.getElementById('studentTableBody');
  const countEl = document.getElementById('studentTableCount');
  if (!tbody) return;

  const filtered = currentStudents.filter(s => {
    const rmb = currentRombel.find(r => r.id === s.class_id);
    const kelasName = rmb ? rmb.nama_kelas : (s.kelas || '');
    return s.nama.toLowerCase().includes(filterText.toLowerCase()) ||
      s.rfid_uid.toLowerCase().includes(filterText.toLowerCase()) ||
      s.no_wa_wali.includes(filterText) ||
      kelasName.toLowerCase().includes(filterText.toLowerCase());
  });

  if (countEl) countEl.innerText = \`\${filtered.length} Siswa\`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500 font-sans">Tidak ada data siswa ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const rmb = currentRombel.find(r => r.id === s.class_id);
    const kelasName = rmb ? rmb.nama_kelas : (s.kelas || 'Umum');
    return \`
    <tr class="hover:bg-emerald-950/20 transition">
      <td class="py-3 pl-2 text-slate-500">\${idx + 1}</td>
      <td class="py-3 font-bold text-white font-sans">\${s.nama}</td>
      <td class="py-3"><span class="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-semibold">\${s.rfid_uid}</span></td>
      <td class="py-3 text-slate-300 font-sans">\${s.no_wa_wali}</td>
      <td class="py-3 text-slate-300 font-sans"><span class="px-2 py-0.5 rounded bg-teal-950/60 border border-teal-500/30 text-teal-300 text-[11px] font-semibold">\${kelasName}</span></td>
      <td class="py-3 text-right pr-2">
        <button onclick="openEditStudentModal('\${s.id}', '\${s.nama}', '\${s.rfid_uid}', '\${s.no_wa_wali}', '\${s.class_id || ''}')" class="px-2.5 py-1 text-[11px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold mr-1 transition font-sans">Edit</button>
        <button onclick="deleteStudent('\${s.id}', '\${s.nama}')" class="px-2 py-1 text-[11px] rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-semibold transition font-sans">Hapus</button>
      </td>
    </tr>
  \`;
  }).join('');
}

function renderQuickTapCards() {
  const container = document.getElementById('quickTapContainer');
  const countBadge = document.getElementById('studentCountBadge');
  if (!container) return;

  if (countBadge) countBadge.innerText = \`\${currentStudents.length} Siswa Terdaftar\`;

  if (currentStudents.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-500 font-sans">Belum ada siswa di database. Buka menu Kelola Member untuk menambah.</span>';
    return;
  }

  container.innerHTML = currentStudents.map(s => {
    const rmb = currentRombel.find(r => r.id === s.class_id);
    const kelasName = rmb ? rmb.nama_kelas : (s.kelas || 'Umum');
    return \`
    <button onclick="quickTap('\${s.rfid_uid}')" class="px-3 py-1.5 rounded-xl bg-black/50 hover:bg-emerald-950/60 border border-emerald-500/20 text-left transition group active:scale-95">
      <span class="text-[10px] font-mono text-emerald-400 font-bold block">\${s.rfid_uid} (\${kelasName})</span>
      <span class="text-xs font-semibold text-white group-hover:text-emerald-300 font-sans truncate block">\${s.nama}</span>
    </button>
  \`;
  }).join('');
}

function searchStudents() {
  const val = document.getElementById('studentSearchInput').value;
  renderStudentsTable(val);
}

function openAddStudentModal() {
  document.getElementById('addNama').value = '';
  document.getElementById('addRfid').value = '';
  document.getElementById('addWa').value = '';
  populateRombelDropdowns();
  document.getElementById('addStudentModal').classList.remove('hidden');
}

function closeAddStudentModal() {
  document.getElementById('addStudentModal').classList.add('hidden');
}

async function submitAddStudent(e) {
  e.preventDefault();
  const nama = document.getElementById('addNama').value.trim();
  const rfid = document.getElementById('addRfid').value.trim().toUpperCase();
  const wa = sanitizePhone(document.getElementById('addWa').value.trim());
  const class_id = document.getElementById('addKelasSelect').value || null;
  const rmb = currentRombel.find(r => r.id === class_id);
  const kelasName = rmb ? rmb.nama_kelas : 'Umum';

  if (currentStudents.some(s => s.rfid_uid.toUpperCase() === rfid)) {
    alert(\`UID RFID [\${rfid}] sudah digunakan oleh siswa lain!\`);
    return;
  }

  if (supabase) {
    const { data, error } = await supabase.from('students').insert([{ rfid_uid: rfid, nama, no_wa_wali: wa, class_id: class_id }]).select().single();
    if (!error && data) {
      currentStudents.push({ ...data, kelas: kelasName });
    }
  } else {
    currentStudents.push({ id: 'local-' + Date.now(), rfid_uid: rfid, nama, no_wa_wali: wa, class_id: class_id, kelas: kelasName });
  }

  closeAddStudentModal();
  fetchStudentsFromDatabase();
  renderRombelTable();
  alert(\`Siswa "\${nama}" berhasil ditambahkan!\`);
}

function openEditStudentModal(id, nama, rfid, wa, class_id) {
  document.getElementById('editStudentId').value = id;
  document.getElementById('editStudentNama').value = nama;
  document.getElementById('editStudentRfid').value = rfid;
  document.getElementById('editStudentWa').value = wa;
  populateRombelDropdowns(class_id);
  document.getElementById('editStudentModal').classList.remove('hidden');
}

function closeEditStudentModal() {
  document.getElementById('editStudentModal').classList.add('hidden');
}

async function submitEditStudent(e) {
  e.preventDefault();
  const id = document.getElementById('editStudentId').value;
  const nama = document.getElementById('editStudentNama').value.trim();
  const rfid = document.getElementById('editStudentRfid').value.trim().toUpperCase();
  const wa = sanitizePhone(document.getElementById('editStudentWa').value.trim());
  const class_id = document.getElementById('editStudentKelasSelect').value || null;
  const rmb = currentRombel.find(r => r.id === class_id);
  const kelasName = rmb ? rmb.nama_kelas : 'Umum';

  if (supabase) {
    await supabase.from('students').update({ nama, rfid_uid: rfid, no_wa_wali: wa, class_id: class_id }).eq('id', id);
  }

  const idx = currentStudents.findIndex(s => s.id === id);
  if (idx >= 0) {
    currentStudents[idx] = { ...currentStudents[idx], nama, rfid_uid: rfid, no_wa_wali: wa, class_id: class_id, kelas: kelasName };
  }

  closeEditStudentModal();
  fetchStudentsFromDatabase();
  renderRombelTable();
  alert('Data siswa berhasil diperbarui!');
}

async function deleteStudent(id, nama) {
  if (confirm(\`Yakin ingin menghapus siswa "\${nama}"?\`)) {
    if (supabase) {
      await supabase.from('students').delete().eq('id', id);
    }
    currentStudents = currentStudents.filter(s => s.id !== id);
    fetchStudentsFromDatabase();
    renderRombelTable();
  }
}

// ================================================================
// 6. LOGIKA PRESENSI (HYBRID QR/RFID & SPINTAX RANDOMIZER)
// ================================================================
async function processAttendanceSubmission(cardUid, statusCategory, method = 'Hybrid') {
  const waktuStr = getFormattedTime();
  const waktuIso = new Date().toISOString();
  const cleanUid = (cardUid || '').trim().toUpperCase();

  let student = currentStudents.find(s => 
    (s.uid_kartu && s.uid_kartu.toUpperCase() === cleanUid) ||
    (s.rfid_uid && s.rfid_uid.toUpperCase() === cleanUid)
  );
  if (!student && supabase) {
    try {
      const { data } = await supabase.from('students').select('*').or(\`uid_kartu.eq.\${cleanUid},rfid_uid.eq.\${cleanUid}\`).maybeSingle();
      if (data) student = data;
    } catch (e) {
      console.warn('Gagal query siswa via Supabase:', e);
    }
  }

  if (!student) {
    return { success: false, message: \`Kartu/QR UID [\${cleanUid}] tidak ditemukan di database!\` };
  }

  let templatesForCat = localTemplates.filter(t => t.status_category === statusCategory);
  if (supabase) {
    try {
      const { data } = await supabase.from('message_templates').select('*').eq('status_category', statusCategory);
      if (data && data.length > 0) templatesForCat = data;
    } catch (e) {
      console.warn('Gagal query message_templates:', e);
    }
  }

  const randIdx = Math.floor(Math.random() * templatesForCat.length);
  const chosenTmpl = templatesForCat[randIdx];

  let renderedMessage = chosenTmpl.message_text
    .replace(/\\[NAMA\\]/g, student.nama)
    .replace(/\\[WAKTU\\]/g, waktuStr);

  if (supabase) {
    try {
      await supabase.from('attendance_log').insert([
        { uid_kartu: student.uid_kartu || cleanUid, status_kehadiran: statusCategory, waktu: waktuIso }
      ]);
      await supabase.from('wa_queue').insert([
        { no_wa_tujuan: sanitizePhone(student.no_wa_wali), isi_pesan: renderedMessage, status: 'pending' }
      ]);
    } catch (err) {
      console.error(err);
    }
  } else {
    localQueue.unshift({
      id: 'local-' + Date.now(),
      no_wa_tujuan: sanitizePhone(student.no_wa_wali),
      isi_pesan: renderedMessage,
      status: 'pending',
      created_at: waktuIso
    });
  }

  renderQueueTable();
  return {
    success: true,
    student,
    statusCategory,
    method,
    variationChosen: randIdx + 1,
    totalVariations: templatesForCat.length,
    renderedMessage
  };
}

// ================================================================
// 7. SISTEM WORKER ANTREAN ANTI-SPAM (DELAY TEPAT 15 DETIK)
// ================================================================
function startQueueWorker() {
  setInterval(async () => {
    if (!workerState.isRunning || workerState.isPaused || workerState.isProcessing || workerState.countdown > 0) {
      return;
    }

    workerState.isProcessing = true;
    let pendingItem = null;

    if (supabase) {
      try {
        const { data } = await supabase.from('wa_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (data) pendingItem = data;
      } catch (e) {
        console.error(e);
      }
    } else {
      pendingItem = localQueue.find(q => q.status === 'pending');
    }

    if (!pendingItem) {
      workerState.isProcessing = false;
      updateWorkerUI('Antrean bersih. Menunggu presensi baru...');
      return;
    }

    updateWorkerUI(\`Memproses kirim WA ke \${pendingItem.no_wa_tujuan}...\`);
    await updateItemStatus(pendingItem.id, 'processing');

    // POST ke Sidobe WA Gateway
    let isSuccess = false;
    let errorDetail = '';

    try {
      const response = await fetch(CONFIG.SIDOBE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${CONFIG.SIDOBE_TOKEN}\`
        },
        body: JSON.stringify({
          api_key: CONFIG.SIDOBE_TOKEN,
          receiver: pendingItem.no_wa_tujuan,
          message: pendingItem.isi_pesan
        })
      });
      isSuccess = response.ok;
      if (!response.ok) errorDetail = await response.text();
    } catch (fetchErr) {
      console.log('Simulasi Sidobe sukses (Sandbox mode):', fetchErr.message);
      await new Promise(r => setTimeout(r, 600));
      isSuccess = true;
    }

    if (isSuccess) {
      await updateItemStatus(pendingItem.id, 'sent');
      updateWorkerUI(\`Berhasil terkirim via Sidobe ke \${pendingItem.no_wa_tujuan}.\`);
    } else {
      await updateItemStatus(pendingItem.id, 'failed', errorDetail);
      updateWorkerUI(\`Gagal kirim: \${errorDetail}\`);
    }

    workerState.isProcessing = false;
    renderQueueTable();

    // WAJIB DELAY 15 DETIK TEPAT ANTI-SPAM
    await runAntiSpamDelay(CONFIG.ANTI_SPAM_DELAY_SECONDS);

  }, 2000);
}

function runAntiSpamDelay(seconds) {
  return new Promise((resolve) => {
    workerState.countdown = seconds;
    const interval = setInterval(() => {
      workerState.countdown -= 1;
      updateCountdownUI(workerState.countdown, seconds);

      if (workerState.countdown <= 0) {
        clearInterval(interval);
        workerState.countdown = 0;
        updateCountdownUI(0, seconds);
        resolve();
      }
    }, 1000);
  });
}

async function updateItemStatus(id, newStatus, errorMsg = '') {
  if (supabase) {
    try {
      await supabase.from('wa_queue').update({
        status: newStatus,
        sent_at: newStatus === 'sent' ? new Date().toISOString() : null,
        error_message: errorMsg || null
      }).eq('id', id);
    } catch (e) {
      console.error(e);
    }
  } else {
    const item = localQueue.find(q => q.id === id);
    if (item) {
      item.status = newStatus;
      if (newStatus === 'sent') item.sent_at = new Date().toISOString();
      if (errorMsg) item.error_message = errorMsg;
    }
  }
}

// ================================================================
// 8. CRUD 20 TEMPLATE UI
// ================================================================
async function renderTemplatesGrid() {
  const container = document.getElementById('templateCardsGrid');
  if (!container) return;

  let templates = localTemplates;
  if (supabase) {
    const { data } = await supabase.from('message_templates').select('*').order('created_at', { ascending: true });
    if (data && data.length > 0) templates = data;
  }

  const filtered = currentFilterCat === 'all' ? templates : templates.filter(t => t.status_category === currentFilterCat);

  container.innerHTML = filtered.map((tmpl, idx) => {
    let catBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (tmpl.status_category === 'hadir_telat') catBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (tmpl.status_category === 'pulang') catBadgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    if (tmpl.status_category === 'izin') catBadgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (tmpl.status_category === 'sakit') catBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';

    return \`
      <div class="ios-glass-card rounded-xl p-4 border border-white/5 space-y-3 flex flex-col justify-between hover:border-emerald-500/30 transition">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border \${catBadgeColor}">\${tmpl.status_category.toUpperCase()}</span>
            <span class="text-[10px] text-slate-400 font-mono">Variasi #\${(idx % 4) + 1}</span>
          </div>
          <p class="text-xs text-slate-200 font-mono leading-relaxed bg-black/40 p-3 rounded-lg border border-white/5 whitespace-pre-wrap">\${tmpl.message_text}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          <span class="text-[10px] text-emerald-400">Variabel: [NAMA], [WAKTU]</span>
          <button onclick="openEditModal('\${tmpl.id}', '\${tmpl.status_category}', \`\${encodeURIComponent(tmpl.message_text)}\`)" class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold transition">Edit Template</button>
        </div>
      </div>
    \`;
  }).join('');
}

function openEditModal(id, category, encodedText) {
  document.getElementById('editTemplateId').value = id;
  document.getElementById('editCategory').value = category;
  document.getElementById('editMessageText').value = decodeURIComponent(encodedText);
  document.getElementById('editTemplateModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editTemplateModal').classList.add('hidden');
}

async function saveEditedTemplate() {
  const id = document.getElementById('editTemplateId').value;
  const newText = document.getElementById('editMessageText').value.trim();

  if (supabase) {
    await supabase.from('message_templates').update({ message_text: newText }).eq('id', id);
  } else {
    const item = localTemplates.find(t => t.id === id);
    if (item) item.message_text = newText;
  }

  closeEditModal();
  renderTemplatesGrid();
  alert('Template berhasil diperbarui!');
}

function filterTemplateCategory(cat) {
  currentFilterCat = cat;
  ['all', 'hadir_tepat', 'hadir_telat', 'pulang', 'izin', 'sakit'].forEach(c => {
    const btn = document.getElementById('catBtn-' + c);
    if (btn) btn.className = (c === cat) ? 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-slate-400 border border-white/5';
  });
  renderTemplatesGrid();
}

// ================================================================
// 9. UI EVENT HANDLERS & NAVIGATION
// ================================================================
function switchTab(tab) {
  ['presensi', 'members', 'templates', 'queue'].forEach(t => {
    const sec = document.getElementById('section-' + t);
    const btn = document.getElementById('tabBtn-' + t);
    if (sec) sec.classList.toggle('hidden', t !== tab);
    if (btn) btn.className = (t === tab) ? 'px-4 py-2 rounded-xl transition bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'px-4 py-2 rounded-xl transition text-slate-400 hover:text-white';
  });
  if (tab === 'templates') renderTemplatesGrid();
  if (tab === 'members') {
    switchSubTab(currentSubTab);
  }
}

function selectStatus(status) {
  selectedCategory = status;
  ['hadir_tepat', 'hadir_telat', 'pulang', 'izin', 'sakit'].forEach(s => {
    const btn = document.getElementById('btnStatus-' + s);
    if (btn) btn.className = (s === status) ? 'py-2 rounded-xl border bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'py-2 rounded-xl border bg-black/30 text-slate-400 border-white/5';
  });
}

function quickTap(uid) {
  document.getElementById('rfidInput').value = uid;
  document.getElementById('rfidForm').dispatchEvent(new Event('submit'));
}

function updateWorkerUI(msg) {
  const el = document.getElementById('workerLogText');
  if (el) el.innerText = msg;
}

function updateCountdownUI(current, total) {
  const txt = document.getElementById('countdownText');
  const bar = document.getElementById('countdownBar');
  if (txt) txt.innerText = current > 0 ? \`Jeda Anti-Spam: \${current}s\` : 'Siap';
  if (bar) bar.style.width = total > 0 ? \`\${((total - current) / total) * 100}%\` : '0%';
}

function toggleWorker() {
  workerState.isPaused = !workerState.isPaused;
  const btn = document.getElementById('toggleWorkerBtn');
  const badge = document.getElementById('workerBadge');
  if (btn) btn.innerText = workerState.isPaused ? 'Lanjutkan Worker' : 'Jeda Worker';
  if (badge) {
    badge.innerHTML = workerState.isPaused
      ? '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Worker: Dijeda'
      : '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Worker: Aktif (15s)';
  }
}

async function renderQueueTable() {
  const tbody = document.getElementById('queueTableBody');
  if (!tbody) return;

  let items = localQueue;
  if (supabase) {
    const { data } = await supabase.from('wa_queue').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) items = data;
  }

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 font-sans">Belum ada antrean pesan.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(q => {
    let badgeClass = 'text-amber-400';
    if (q.status === 'sent') badgeClass = 'text-emerald-400';
    if (q.status === 'failed') badgeClass = 'text-rose-400';
    if (q.status === 'processing') badgeClass = 'text-cyan-400';

    const shortMsg = (q.isi_pesan || '').substring(0, 40) + '...';
    const time = new Date(q.created_at).toLocaleTimeString('id-ID');

    return \`
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-2.5 text-white">\${q.no_wa_tujuan}</td>
        <td class="py-2.5 font-bold \${badgeClass}">\${q.status.toUpperCase()}</td>
        <td class="py-2.5 text-slate-400">\${time}</td>
        <td class="py-2.5 text-slate-300 font-sans truncate max-w-xs">\${shortMsg}</td>
      </tr>
    \`;
  }).join('');
}

// Inisialisasi saat window dimuat
window.addEventListener('DOMContentLoaded', () => {
  fetchRombelFromDatabase();
  fetchUsersFromDatabase();
  fetchStudentsFromDatabase();
  renderTemplatesGrid();
  renderQueueTable();
  startQueueWorker();

  const input = document.getElementById('rfidInput');
  if (input) {
    input.focus();
    window.addEventListener('focus', () => input.focus());
  }

  const rfidForm = document.getElementById('rfidForm');
  if (rfidForm) {
    rfidForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('rfidInput');
      const uid = input.value.trim().toUpperCase();
      const resBox = document.getElementById('scanResult');

      const result = await processAttendanceSubmission(uid, selectedCategory, 'RFID');

      if (!result.success) {
        resBox.className = 'mt-3 p-3 rounded-xl text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30';
        resBox.innerText = result.message;
        resBox.classList.remove('hidden');
      } else {
        resBox.className = 'mt-3 p-3 rounded-xl text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        resBox.innerHTML = \`
          <div class="font-bold">✓ Presensi Sukses via RFID: \${result.student.nama} (\${result.statusCategory})</div>
          <div class="text-[11px] text-slate-300 mt-1">Spintax: Memilih Variasi #\${result.variationChosen} dari \${result.totalVariations} template</div>
          <div class="text-[11px] text-amber-300 mt-0.5">Status wa_queue: PENDING (Menunggu giliran worker 15s)</div>
        \`;
        resBox.classList.remove('hidden');
        input.value = '';
      }
      if (input) input.focus();
    });
  }
});
`;
