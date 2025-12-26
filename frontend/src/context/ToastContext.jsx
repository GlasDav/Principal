import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Toast Component
function Toast({ toast, onDismiss }) {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <XCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const bgColors = {
        success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
        error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
        warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
        info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    };

    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm min-w-[300px] max-w-[400px] animate-slide-in-right ${bgColors[toast.type]}`}
            role="alert"
        >
            <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{toast.title}</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-300">{toast.message}</p>
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
                <X size={16} />
            </button>
        </div>
    );
}

// Toast Container
function ToastContainer({ toasts, onDismiss }) {
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast toast={toast} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
}

// Provider
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((type, message, options = {}) => {
        const id = ++toastIdRef.current;
        const { title, duration = 4000 } = options;

        const toast = { id, type, message, title };
        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }

        return id;
    }, [dismiss]);

    const toast = {
        success: (message, options) => addToast('success', message, options),
        error: (message, options) => addToast('error', message, options),
        warning: (message, options) => addToast('warning', message, options),
        info: (message, options) => addToast('info', message, options),
        dismiss,
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

export default ToastContext;
