import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-12 h-12 text-red-500" />,
          iconBg: 'bg-red-50',
          confirmBtn: 'bg-red-500 hover:bg-red-600 text-white',
          border: 'border-red-100',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
          iconBg: 'bg-yellow-50',
          confirmBtn: 'bg-yellow-500 hover:bg-yellow-600 text-white',
          border: 'border-yellow-100',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-12 h-12 text-green-500" />,
          iconBg: 'bg-green-50',
          confirmBtn: 'bg-green-500 hover:bg-green-600 text-white',
          border: 'border-green-100',
        };
      case 'info':
      default:
        return {
          icon: <AlertCircle className="w-12 h-12 text-[#5D5FEF]" />,
          iconBg: 'bg-[#5D5FEF]/10',
          confirmBtn: 'bg-[#5D5FEF] hover:bg-[#4D4FCF] text-white',
          border: 'border-[#5D5FEF]/20',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className={`relative bg-white rounded-3xl shadow-2xl max-w-md w-full border-2 ${styles.border} animate-in zoom-in duration-200`}>
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="p-8">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl ${styles.iconBg} flex items-center justify-center mb-6`}>
            {styles.icon}
          </div>

          {/* Content */}
          <h3 className="text-2xl font-black text-gray-900 mb-3">{title}</h3>
          <p className="text-gray-600 text-base leading-relaxed mb-8">{message}</p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${styles.confirmBtn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
