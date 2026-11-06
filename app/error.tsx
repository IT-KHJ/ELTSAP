"use client";

import { useEffect } from "react";

/** 화면 표시 중 예상하지 못한 문제가 생겼을 때의 안내 화면 (오류 원문은 콘솔에만) */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-lg font-semibold text-gray-900">화면을 표시하는 중에 문제가 생겼어요.</p>
        <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
          {"잠시 후 다시 시도하세요.\n문제가 계속되면 관리자에게 문의하세요."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-10 px-5 rounded-[10px] bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
