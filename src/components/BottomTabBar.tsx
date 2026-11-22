import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Clock, Users, BookOpen, FileText, Award } from 'lucide-react';
import { WorkerState, UserRole } from '../types';
import { supabaseService } from '../services/supabaseClient';

interface BottomTabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  workerState: WorkerState;
  userRole?: UserRole;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  setActiveTab,
  workerState,
  userRole = 'Super Admin',
}) => {
  const [unreadLeaveCount, setUnreadLeaveCount] = useState<number>(0);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const reqs = await supabaseService.getLeaveRequests();
      const pendingCount = reqs.filter((r) => r.status === 'pending').length;
      setUnreadLeaveCount(pendingCount);
    } catch {
      // ignore fetch error
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();

    const supabase = supabaseService.getClient();
    const channel = supabase
      .channel('bottom-nav-leave-requests-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leave_requests' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (_payload) => {
          fetchLeaveRequests();
        }
      )
      .subscribe();

    window.addEventListener('leave_requests_updated', fetchLeaveRequests);
    window.addEventListener('storage', fetchLeaveRequests);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('smart_presensi_leave_requests_channel');
        bc.onmessage = () => {
          fetchLeaveRequests();
        };
      } catch {
        bc = null;
      }
    }

    const pollInterval = setInterval(() => {
      fetchLeaveRequests();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('leave_requests_updated', fetchLeaveRequests);
      window.removeEventListener('storage', fetchLeaveRequests);
      if (bc) {
        bc.close();
      }
      clearInterval(pollInterval);
    };
  }, [fetchLeaveRequests]);

  const allTabs = [
    { id: 'terminal', label: 'Presensi', icon: CreditCard, roles: ['Super Admin', 'Admin', 'Wali Kelas', 'Operator'] as UserRole[] },
    { id: 'members', label: userRole === 'Wali Kelas' ? 'Siswa' : 'Member', icon: Users, roles: ['Super Admin', 'Admin', 'Wali Kelas'] as UserRole[] },
    { id: 'queue', label: 'Monitoring', icon: Clock, isCenter: true, roles: ['Super Admin', 'Admin'] as UserRole[] },
    { id: 'schedule', label: 'Akademik', icon: BookOpen, isAcademic: true, roles: ['Super Admin', 'Admin', 'Wali Kelas'] as UserRole[] },
    { id: 'reports', label: 'Laporan', icon: FileText, roles: ['Super Admin', 'Admin', 'Wali Kelas', 'Operator'] as UserRole[] },
    { id: 'points', label: 'Poin', icon: Award, roles: ['Super Admin', 'Admin', 'Wali Kelas', 'Operator'] as UserRole[] },
  ];

  const tabs = allTabs.filter((t) => t.roles.includes(userRole));

  const gridColsClass =
    tabs.length === 6
      ? 'grid-cols-6'
      : tabs.length === 5
      ? 'grid-cols-5'
      : tabs.length === 4
      ? 'grid-cols-4'
      : 'grid-cols-3';

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--primary-accent)] pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] print:hidden">
      <div className={`grid ${gridColsClass} items-center h-16 px-1.5`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isMonitoring = tab.id === 'queue' || tab.isCenter;
          const isTerminal = tab.id === 'terminal';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`group flex flex-col items-center justify-center py-1 px-0.5 space-y-1 transition-all duration-300 ease-out active:scale-90 outline-none ${
                isActive ? 'text-white' : 'text-white/60 hover:text-white/90'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <tab.icon
                  className={`w-5 h-5 transition-transform duration-300 ease-out ${
                    isActive ? 'ios-icon-active text-white' : 'text-white/60 group-hover:text-white/90 group-hover:scale-105'
                  }`}
                />

                {/* Badge Notifikasi Pengajuan Izin/Sakit Pending pada Tab Presensi */}
                {isTerminal && unreadLeaveCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white border border-white text-[9px] font-extrabold font-mono flex items-center justify-center leading-none shadow-2xs">
                    {unreadLeaveCount}
                  </span>
                )}

                {/* Indikator Titik Status Worker/Queue di Sudut Kanan Atas Ikon Monitoring */}
                {isMonitoring &&
                  (workerState.isRunning ? (
                    <span className="absolute -top-0.5 -right-1.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white"></span>
                    </span>
                  ) : (
                    <span className="absolute -top-0.5 -right-1.5 flex h-2.5 w-2.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-400 border border-white"></span>
                    </span>
                  ))}
              </div>

              <span
                className={`text-[10px] leading-tight whitespace-nowrap truncate max-w-full transition-all duration-300 ${
                  isActive ? 'font-bold text-white' : 'font-medium text-white/60 group-hover:text-white/90'
                }`}
              >
                {tab.isAcademic ? (
                  <>
                    Akademik<span className="hidden md:inline"> &amp; Info</span>
                  </>
                ) : (
                  tab.label
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};