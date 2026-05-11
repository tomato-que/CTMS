import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'CTMS - 临床研究管理系统',
  description: 'Clinical Trial Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#F8FAFC]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
