'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

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
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    if (modal?.isOpen) resolveRef.current = modal.resolve ?? null;
  }, [modal]);

  const open = useCallback((options: ModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({ ...options, isOpen: true, resolve });
    });
  }, []);

  const close = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setModal(null);
  }, []);

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
    resolveRef.current?.(true);
    resolveRef.current = null;
    setModal(null);
  };

  return (
    <ModalContext.Provider value={{ open, close }}>
      {children}
      {modal?.isOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modal.title ? 'modal-title' : undefined}
          aria-describedby="modal-message"
        >
          <div
            className="bg-[#FFFFFF] rounded-[14px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] max-w-[400px] w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              {modal.title && (
                <h2 id="modal-title" className="text-[15px] font-medium text-[#333] leading-snug">
                  {modal.title}
                </h2>
              )}
              <p
                id="modal-message"
                className="text-[15px] text-[#333] leading-relaxed whitespace-pre-line text-left"
              >
                {modal.message}
              </p>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              {(modal.type === 'confirm') && (
                <button
                  type="button"
                  onClick={close}
                  className="h-10 min-w-[72px] px-4 text-[14px] font-medium text-[#555] bg-[#f0f0f0] rounded-[10px] hover:bg-[#e5e5e5] transition-colors"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className="h-10 min-w-[72px] px-4 text-[14px] font-medium text-white bg-[#2563eb] rounded-[10px] hover:bg-[#1d4ed8] transition-colors"
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
