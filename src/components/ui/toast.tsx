import React, { createContext, useContext } from "react";

type ToastOpts = { title: string; description?: string; variant?: string };
const ToastContext = createContext({ toast: (opts: ToastOpts) => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContext.Provider value={{ toast: (opts: ToastOpts) => { console.info("TOAST:", opts.title, opts.description); } }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
