'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ModalType = 'confirm' | 'info' | 'error';

export interface ModalOptions {
  type: ModalType;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ModalContextType {
  open: (options: ModalOptions) => Promise<boolean>;
  close: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<(ModalOptions & { isOpen: boolean; resolve?: (value: boolean) => void }) | null>(null);

  const open = useCallback((options: ModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({ ...options, isOpen: true, resolve });
    });
  }, []);

  const close = useCallback(() => {
    if (modal?.resolve) modal.resolve(false);
    setModal(null);
  }, [modal]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal?.isOpen) close();
    };
    if (modal?.isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [modal?.isOpen, close]);

  const handleConfirm = () => {
    if (modal?.resolve) modal.resolve(true);
    setModal(null);
  };

  return (
    <ModalContext.Provider value={{ open, close }}>
      {children}
      {modal?.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-lg p-7 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-600 mb-6 text-center whitespace-pre-line">{modal.message}</p>
            <div className="flex gap-3 justify-end">
              {(modal.type === 'confirm') && (
                <button
                  type="button"
                  onClick={close}
                  className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium text-sm"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
              >
                {modal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
