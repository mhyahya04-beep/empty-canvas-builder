import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  searchQuery: string;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSearchQuery: (q: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: getDefaultSidebarOpen(),
  searchQuery: "",
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

function getDefaultSidebarOpen() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.innerWidth >= 1024;
}
