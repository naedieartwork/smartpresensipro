import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomTabBar } from './components/BottomTabBar';
import { AttendanceTerminal } from './components/AttendanceTerminal';
import { QueueWorkerDashboard } from './components/QueueWorkerDashboard';
import { MemberManager } from './components/MemberManager';
import { ScheduleManager } from './components/ScheduleManager';
import { ReportManager } from './components/ReportManager';
import { DisciplineManager } from './components/DisciplineManager';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';
import { StudentDashboard } from './components/StudentDashboard';
import { SplashScreen } from './components/SplashScreen';
import { queueWorker } from './services/queueWorker';
import { supabaseService } from './services/supabaseClient';
import {
  settingsService,
  DEFAULT_APP_TITLE,
  DEFAULT_APP_SUBTITLE,
} from './services/settingsService';
import { WorkerState, AppUser, UserRole, Student } from './types';
import {
  BeforeInstallPromptEvent,
  setGlobalDeferredPrompt,
  syncDynamicPWAManifest,
} from './hooks/usePWAInstall';

const ACTIVE_USER_STORAGE_KEY = 'smart_presensi_active_user_v1';
const ACTIVE_STUDENT_STORAGE_KEY = 'smart_presensi_active_student_v1';

export function getAllowedTabsForRole(role: UserRole): string[] {
  switch (role) {
    case 'Super Admin':
    case 'Admin':
      return ['terminal', 'members', 'schedule', 'queue', 'reports', 'points', 'settings'];
    case 'Wali Kelas':
      return ['terminal', 'members', 'schedule', 'reports', 'points'];
    case 'Operator':
    default:
      return ['terminal', 'reports', 'points'];
  }
}

export default function App() {
  // Authentication State (Staf / Admin)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as AppUser) : null;
    } catch {
      return null;
    }
  });

  // Authentication State (Siswa / Wali Murid)
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_STUDENT_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Student) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(
        localStorage.getItem(ACTIVE_USER_STORAGE_KEY) ||
          localStorage.getItem(ACTIVE_STUDENT_STORAGE_KEY)
      );
    } catch {
      return false;
    }
  });

  const [userRole, setUserRole] = useState<string>(() => {
    try {
      const savedStudent = localStorage.getItem(ACTIVE_STUDENT_STORAGE_KEY);
      if (savedStudent) return 'Siswa';
      const savedUser = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as AppUser;
        return parsed.role || 'Super Admin';
      }
      return '';
    } catch {
      return '';
    }
  });

  // Mode Pratinjau untuk Super Admin / Admin (Melihat Portal Siswa atau Halaman Login tanpa harus kehilangan sesi)
  const [previewMode, setPreviewMode] = useState<'none' | 'student_portal' | 'login_page'>('none');

  // State Custom React Splash Screen (Tahan 2000ms + Transisi Fade-Out Mulus)
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashFadingOut, setIsSplashFadingOut] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState<string>('terminal');
  const [previousTab, setPreviousTab] = useState<string>('terminal');
  const [workerState, setWorkerState] = useState<WorkerState>(queueWorker.getState());
  const [isRealSupabase, setIsRealSupabase] = useState<boolean>(
    supabaseService.isUsingRealSupabase()
  );

  const activeStaffRole: UserRole = (currentUser?.role || 'Super Admin') as UserRole;

  // Tahan Splash Screen selama 2000ms (2 detik) lalu berikan transisi fade-out sebelum di-unmount
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsSplashFadingOut(true);
    }, 2000);

    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Tangkap event beforeinstallprompt di level global App.tsx
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setGlobalDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setGlobalDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Auto-Redirect jika halaman yang sedang dibuka tidak diizinkan untuk role aktif
  useEffect(() => {
    if (!isAuthenticated || userRole === 'Siswa') return;
    const allowedTabs = getAllowedTabsForRole(activeStaffRole);
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('terminal');
    }
  }, [activeStaffRole, activeTab, isAuthenticated, userRole]);

  const handleSelectTab = (tab: string) => {
    const allowedTabs = getAllowedTabsForRole(activeStaffRole);
    if (!allowedTabs.includes(tab)) {
      setActiveTab('terminal');
      return;
    }
    if (tab !== 'settings') {
      setPreviousTab(tab);
    }
    setActiveTab(tab);
  };

  const handleToggleSettingsPage = () => {
    const allowedTabs = getAllowedTabsForRole(activeStaffRole);
    if (!allowedTabs.includes('settings')) {
      setActiveTab('terminal');
      return;
    }
    if (activeTab === 'settings') {
      setActiveTab(previousTab || 'terminal');
    } else {
      setPreviousTab(activeTab);
      setActiveTab('settings');
    }
  };

  useEffect(() => {
    const syncLocalSettings = () => {
      const settings = settingsService.getSettings();
      document.body.classList.toggle('high-contrast', settings.theme === 'high-contrast');
      const nextLogo = settings.appLogo || '';
      const nextTitle = settings.appTitle || DEFAULT_APP_TITLE;
      const nextSubtitle = settings.appSubtitle || DEFAULT_APP_SUBTITLE;
      syncDynamicPWAManifest(nextTitle, nextSubtitle, nextLogo);
    };
    syncLocalSettings();

    // Ambil konfigurasi awal dari tabel public.app_settings (id = 1) di Supabase
    settingsService.loadFromSupabase().then(() => {
      syncLocalSettings();
    });

    const unsubWorker = queueWorker.subscribe((state) => {
      setWorkerState(state);
    });
    const unsubSupabase = supabaseService.subscribe(() => {
      setIsRealSupabase(supabaseService.isUsingRealSupabase());
    });
    const unsubSettings = settingsService.subscribe(syncLocalSettings);

    return () => {
      unsubWorker();
      unsubSupabase();
      unsubSettings();
    };
  }, []);

  // Sinkronisasi Lintas Perangkat (Cross-Device Load): Ambil data terbaru (termasuk avatar_url, nama_lengkap, nip) dari tabel app_users di Supabase
  useEffect(() => {
    if (!isAuthenticated || userRole === 'Siswa' || !currentUser?.username) return;
    let isCancelled = false;

    const syncActiveUserFromCloud = async () => {
      const freshUser = await supabaseService.getAppUserByIdOrUsername(
        currentUser.id,
        currentUser.username
      );
      if (!isCancelled && freshUser) {
        setCurrentUser((prev) => {
          if (!prev) return freshUser;
          const merged: AppUser = {
            ...prev,
            ...freshUser,
            avatar_url: freshUser.avatar_url ?? freshUser.avatarUrl ?? prev.avatar_url ?? prev.avatarUrl ?? '',
            avatarUrl: freshUser.avatar_url ?? freshUser.avatarUrl ?? prev.avatarUrl ?? prev.avatar_url ?? '',
          };
          try {
            localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore storage errors
          }
          return merged;
        });
      }
    };

    syncActiveUserFromCloud();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, userRole, currentUser?.id, currentUser?.username]);

  const handleLoginSuccess = (
    role: string,
    user?: AppUser,
    student?: Student,
    rememberStudentProfile = true
  ) => {
    setPreviewMode('none');
    setUserRole(role);
    setIsAuthenticated(true);

    if (role === 'Siswa') {
      setCurrentUser(null);
      setLoggedInStudent(student || null);
      try {
        localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
        if (student && rememberStudentProfile) {
          localStorage.setItem(ACTIVE_STUDENT_STORAGE_KEY, JSON.stringify(student));
        } else {
          localStorage.removeItem(ACTIVE_STUDENT_STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
      setActiveTab('student_dashboard');
    } else {
      const waliMap = supabaseService.getWaliKelasMap();
      const extrasMap = supabaseService.getUserProfileExtrasMap();
      const baseUser: AppUser = user || {
        id: 'master-naedie',
        username: 'naedie',
        nama_lengkap: 'Naedie (Master Owner)',
        role: (role as UserRole) || 'Super Admin',
        status: 'Aktif',
        is_master: true,
      };
      const resolvedAssignedClass =
        baseUser.assignedClass ||
        baseUser.assigned_class ||
        baseUser.rombel ||
        waliMap[baseUser.username?.toLowerCase() || ''] ||
        waliMap[String(baseUser.id)] ||
        (baseUser.role === 'Wali Kelas' ? '1A' : undefined);
      const extraByUser =
        extrasMap[String(baseUser.id)] ||
        extrasMap[baseUser.username?.toLowerCase() || ''] ||
        {};
      const resolvedAvatar =
        baseUser.avatar_url || baseUser.avatarUrl || extraByUser.avatarUrl || '';
      const resolvedUser: AppUser = {
        ...baseUser,
        assignedClass: resolvedAssignedClass,
        assigned_class: resolvedAssignedClass,
        rombel: resolvedAssignedClass,
        avatar_url: resolvedAvatar,
        avatarUrl: resolvedAvatar,
      };
      setLoggedInStudent(null);
      setCurrentUser(resolvedUser);
      try {
        localStorage.removeItem(ACTIVE_STUDENT_STORAGE_KEY);
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(resolvedUser));
      } catch {
        // ignore storage errors
      }
      setActiveTab('terminal');
    }
  };

  const handleUpdateCurrentUser = (updatedUser: AppUser) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch {
      // ignore storage errors
    }
  };

  const handleSwitchRole = (newRole: UserRole) => {
    if (!currentUser) return;
    const waliMap = supabaseService.getWaliKelasMap();
    const resolvedAssigned =
      newRole === 'Wali Kelas'
        ? currentUser.assignedClass ||
          currentUser.assigned_class ||
          waliMap[currentUser.username?.toLowerCase() || ''] ||
          waliMap[String(currentUser.id)] ||
          '1A'
        : currentUser.assignedClass;
    const updatedUser: AppUser = {
      ...currentUser,
      role: newRole,
      assignedClass: resolvedAssigned,
      assigned_class: resolvedAssigned,
    };
    setCurrentUser(updatedUser);
    setUserRole(newRole);
    try {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch {
      // ignore
    }
    const allowed = getAllowedTabsForRole(newRole);
    if (!allowed.includes(activeTab)) {
      setActiveTab('terminal');
    }
  };

  const handleLogout = () => {
    setPreviewMode('none');
    setIsAuthenticated(false);
    setUserRole('');
    setCurrentUser(null);
    setLoggedInStudent(null);
    try {
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_STUDENT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Jika Belum Login atau Admin sedang membuka Pratinjau Halaman Login Utama
  if (!isAuthenticated || previewMode === 'login_page') {
    return (
      <>
        {showSplash && <SplashScreen isFadingOut={isSplashFadingOut} />}
        <Login
          onLoginSuccess={handleLoginSuccess}
          onCancelPreview={
            isAuthenticated && previewMode === 'login_page'
              ? () => setPreviewMode('none')
              : undefined
          }
        />
      </>
    );
  }

  // Jika yang login adalah SISWA / WALI MURID, atau Admin sedang membuka Pratinjau Portal Siswa
  if (userRole === 'Siswa' || previewMode === 'student_portal') {
    const isPreviewingAsAdmin = previewMode === 'student_portal' && userRole !== 'Siswa';

    return (
      <>
        {showSplash && <SplashScreen isFadingOut={isSplashFadingOut} />}
        <StudentDashboard
          onLogout={isPreviewingAsAdmin ? () => setPreviewMode('none') : handleLogout}
          initialStudent={loggedInStudent}
          isAdminPreview={isPreviewingAsAdmin}
          onExitAdminPreview={isPreviewingAsAdmin ? () => setPreviewMode('none') : undefined}
        />
      </>
    );
  }

  const allowedTabs = getAllowedTabsForRole(activeStaffRole);

  // LAYOUT STAF / ADMIN (Standar dengan Filter RBAC)
  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 relative">
      {showSplash && <SplashScreen isFadingOut={isSplashFadingOut} />}

      {/* Top Header */}
      <Header
        workerState={workerState}
        isRealSupabase={isRealSupabase}
        onOpenSettings={handleToggleSettingsPage}
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        currentUser={currentUser}
        onUpdateCurrentUser={handleUpdateCurrentUser}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        onPreviewStudentPortal={() => setPreviewMode('student_portal')}
        onPreviewLoginPage={() => setPreviewMode('login_page')}
      />

      {/* Main Content Area with iOS-grade Fade-In & Slide-Up Tab Transition */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 sm:pb-8">
        <div key={activeTab} className="ios-tab-transition">
          {activeTab === 'terminal' && (
            <AttendanceTerminal
              onNavigateToQueue={() => handleSelectTab('queue')}
              onQueueUpdated={() => {}}
            />
          )}
          {activeTab === 'members' && allowedTabs.includes('members') && (
            <MemberManager
              currentUser={currentUser}
              onUpdateCurrentUser={handleUpdateCurrentUser}
            />
          )}
          {activeTab === 'schedule' && allowedTabs.includes('schedule') && (
            <ScheduleManager currentUser={currentUser} />
          )}
          {activeTab === 'queue' && allowedTabs.includes('queue') && (
            <QueueWorkerDashboard />
          )}
          {activeTab === 'reports' && allowedTabs.includes('reports') && (
            <ReportManager currentUser={currentUser} />
          )}
          {activeTab === 'points' && allowedTabs.includes('points') && (
            <DisciplineManager currentUser={currentUser} />
          )}
          {activeTab === 'settings' && allowedTabs.includes('settings') && (
            <SettingsModal
              isOpen={true}
              currentUser={currentUser}
              onClose={() => setActiveTab(previousTab || 'terminal')}
              onSettingsChanged={() => {
                setIsRealSupabase(supabaseService.isUsingRealSupabase());
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomTabBar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        workerState={workerState}
        userRole={activeStaffRole}
      />
    </div>
  );
}