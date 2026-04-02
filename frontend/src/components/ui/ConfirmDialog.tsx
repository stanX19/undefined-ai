import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle } from "lucide-react";
import { useEffect, useCallback } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
}: ConfirmDialogProps) {
  // Handle Esc key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent scrolling when open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#37322F]/40 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(55,50,47,0.12)] bg-[#FAF9F8] p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-[#37322F]'}`}>
                  <AlertCircle size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-[#37322F] font-sans">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1 text-[#605A57] transition-colors hover:bg-[rgba(55,50,47,0.06)] hover:text-[#37322F]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="mt-4">
              <p className="text-base font-medium leading-relaxed text-[#605A57] font-sans">
                {message}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl border border-[#E0DEDB] bg-white px-6 py-2.5 text-sm font-semibold text-[#49423D] transition-all duration-200 hover:border-[rgba(55,50,47,0.12)] hover:bg-[#FAF9F8] font-sans"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`cursor-pointer rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md font-sans ${
                  isDestructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#37322F] hover:bg-[#49423D]"
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
