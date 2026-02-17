import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import '../styles/toast.css';

const ToastContext = createContext(null);

/**
 * Toast notification provider using React Bootstrap.
 * Replaces blocking alert() calls with non-blocking toasts.
 * Deduplicates by message — repeated triggers reset the dismiss timer
 * instead of stacking duplicates.
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const activeRef = useRef(new Map()); // message -> { id, timerId }

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const dismissToast = useCallback((id, message) => {
        setToasts(prev => prev.map(t =>
            t.id === id ? { ...t, show: false } : t
        ));
        activeRef.current.delete(message);
    }, []);

    const addToast = useCallback((message, variant = 'danger', duration = 5000) => {
        const existing = activeRef.current.get(message);

        if (existing) {
            clearTimeout(existing.timerId);
            const timerId = setTimeout(() => dismissToast(existing.id, message), duration);
            activeRef.current.set(message, { id: existing.id, timerId });
            return;
        }

        const id = Date.now();
        const timerId = setTimeout(() => dismissToast(id, message), duration);
        activeRef.current.set(message, { id, timerId });
        setToasts(prev => [...prev, { id, message, variant, show: true }]);
    }, [dismissToast]);

    const showError = useCallback((message, duration = 2000) => {
        addToast(message, 'danger', duration);
    }, [addToast]);

    const showWarning = useCallback((message) => {
        addToast(message, 'warning', 1800);
    }, [addToast]);

    const showSuccess = useCallback((message) => {
        addToast(message, 'success', 1500);
    }, [addToast]);

    const showInfo = useCallback((message) => {
        addToast(message, 'info', 1500);
    }, [addToast]);

    const dismissMessage = useCallback((message) => {
        const entry = activeRef.current.get(message);
        if (!entry) return;
        clearTimeout(entry.timerId);
        activeRef.current.delete(message);
        setToasts(prev => prev.map(t =>
            t.id === entry.id ? { ...t, show: false } : t
        ));
    }, []);

    return (
        <ToastContext.Provider value={{ showError, showWarning, showSuccess, showInfo, dismissMessage }}>
            {children}
            <ToastContainer
                position="top-end"
                className="p-3 custom-toast-container"
                style={{ zIndex: 9999 }}
            >
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        show={toast.show}
                        onExited={() => removeToast(toast.id)}
                        animation={true}
                        className={`custom-toast toast-${toast.variant}`}
                    >
                        <Toast.Body className="custom-toast-body">
                            <span className="toast-label">
                                {toast.variant === 'danger' ? 'Error' :
                                 toast.variant === 'warning' ? 'Warning' :
                                 toast.variant === 'success' ? 'Success' : 'Info'}
                            </span>
                            {toast.message}
                        </Toast.Body>
                    </Toast>
                ))}
            </ToastContainer>
        </ToastContext.Provider>
    );
}

/**
 * Hook to access toast notifications.
 * @returns {{ showError, showWarning, showSuccess, showInfo }}
 */
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        // Fallback to alert if ToastProvider is not available
        return {
            showError: (msg) => alert(msg),
            showWarning: (msg) => alert(msg),
            showSuccess: (msg) => alert(msg),
            showInfo: (msg) => alert(msg),
            dismissMessage: () => {}
        };
    }
    return context;
}
