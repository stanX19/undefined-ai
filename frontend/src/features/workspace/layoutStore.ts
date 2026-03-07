import { create } from "zustand";

interface WorkspaceLayoutState {
  isSidebarCollapsed: boolean;
  isChatCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChatCollapsed: (collapsed: boolean) => void;
}

export const useWorkspaceLayoutStore = create<WorkspaceLayoutState>((set) => ({
  isSidebarCollapsed: window.innerWidth < 768,
  isChatCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setChatCollapsed: (collapsed) => set({ isChatCollapsed: collapsed }),
}));
