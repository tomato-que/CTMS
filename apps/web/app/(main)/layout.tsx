'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAppStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, user, setUser, setToken } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setHasToken(true);
      } catch {
        localStorage.clear();
      }
    }

    if (!storedToken) {
      // No token - redirect to login immediately, don't show the dashboard layout
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, []);

  // Not logged in - show minimal spinner while redirecting
  if (!hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Still loading user data
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}>
        <Header />
        <Breadcrumb />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
