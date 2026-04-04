"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-layer"
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
          style={{
            width: "100vw",
            height: "100vh",
            minHeight: "100dvh",
            top: 0,
            left: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 backdrop-blur-[4px]"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={onClose}
            role="presentation"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={cn(
              "relative z-10 flex max-h-[min(100dvh,100vh)] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl sm:max-h-[min(90vh,800px)] sm:p-6",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <h2 className="mb-4 text-xl font-bold text-text-primary">{title}</h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
