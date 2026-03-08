import { create } from "zustand";

type ActiveView = "home" | "topic";

interface WorkspaceLayoutState {
  isSidebarCollapsed: boolean;
  isChatCollapsed: boolean;
  activeView: ActiveView;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChatCollapsed: (collapsed: boolean) => void;
  setActiveView: (view: ActiveView) => void;
}

export const useWorkspaceLayoutStore = create<WorkspaceLayoutState>((set) => ({
  isSidebarCollapsed: window.innerWidth < 768,
  isChatCollapsed: false,
  activeView: "home",
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setChatCollapsed: (collapsed) => set({ isChatCollapsed: collapsed }),
  setActiveView: (view) => set({ activeView: view }),
}));
