import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="text-gray-500 mt-4">页面不存在</p>
        <Link href="/dashboard" className="inline-block mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          返回工作台
        </Link>
      </div>
    </div>
  );
}
