import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let nextLogId = 0;

export function ToastProvider({ children }) {
    const [logEntries, setLogEntries] = useState([]);

    const clearLog = useCallback(() => setLogEntries([]), []);

    const addLog = useCallback((message, variant) => {
        setLogEntries((prev) => [...prev, { id: ++nextLogId, message, variant, timestamp: Date.now() }]);
    }, []);

    const showError = useCallback((message) => addLog(message, 'danger'), [addLog]);
    const showWarning = useCallback((message) => addLog(message, 'warning'), [addLog]);
    const showSuccess = useCallback((message) => addLog(message, 'success'), [addLog]);
    const showInfo = useCallback((message) => addLog(message, 'info'), [addLog]);

    return (
        <ToastContext.Provider value={{ showError, showWarning, showSuccess, showInfo, logEntries, clearLog }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
