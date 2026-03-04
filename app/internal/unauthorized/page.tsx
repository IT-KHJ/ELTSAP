import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <span className="text-4xl">🚫</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">접근 권한 없음</h1>
        <p className="text-gray-600 mb-8 max-w-md">
          이 페이지는 로그인된 계정이 필요합니다.
          <br />
          권한이 필요하시면 관리자에게 문의하세요.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/internal/login"
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 로그인
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
