"use client";

import { useEffect, useRef, useState } from "react";
import { WaterRequestForm } from "./WaterRequestForm";

export function WaterRequestModal({
  triggerLabel = "ยื่นคำขอใช้น้ำประปา",
}: {
  triggerLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // controls the enter/exit animation
  const panelRef = useRef<HTMLDivElement>(null);

  // Mount first, then flip to visible on the next frame so the transition runs.
  function open() {
    setIsOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
  }

  function close() {
    setIsVisible(false);
    // Wait for the exit transition to finish before unmounting.
    window.setTimeout(() => setIsOpen(false), 200);
  }

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={open}
        className="inline-flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-navy-deep hover:shadow-lg"
      >
        <span className="text-lg leading-none">＋</span>
        {triggerLabel}
      </button>

      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className={`relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-offwhite shadow-2xl transition-all duration-200 ${
              isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-navy/60">
                  คำร้องขอใช้น้ำประปา
                </p>
                <h2 className="font-display text-lg font-bold text-navy-deep">
                  ยื่นคำขอใช้น้ำประปา
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="ปิดหน้าต่าง"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-navy-deep"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M1 1L17 17M17 1L1 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="overflow-y-auto px-6 py-6 sm:px-8">
              <WaterRequestForm onClose={close} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
