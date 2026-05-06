import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-sky-500',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${colors[t.type]} text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 animate-bounce-in`}
            style={{ animation: 'slideUp 0.3s ease' }}
          >
            <span className="text-xl">{icons[t.type]}</span>
            <span className="font-semibold text-[17px]">{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
