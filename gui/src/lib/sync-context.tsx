"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiClient } from "./api-client";
import { useAuth } from "./auth-context";

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";

export interface Conflict {
  entityType: string;
  entityId: string;
  field?: string;
  clientValue: any;
  serverValue: any;
  clientVersion?: number;
  serverVersion?: number;
}

interface SyncContextType {
  status: SyncStatus;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  conflicts: Conflict[];
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  resolveConflict: (entityType: string, entityId: string, resolution: "server" | "client", field?: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiClient<any>("/sync/status");
      setPendingCount(data.pending || 0);
      setSyncedCount(data.synced || 0);
      setFailedCount(data.failed || 0);
      setConflicts(data.conflicts > 0 ? (data.failedRecords || []).map((r: any) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        clientValue: "Unknown",
        serverValue: "Unknown",
        clientVersion: 0,
        serverVersion: 0
      })) : []);
    } catch (e) {
      console.error("Failed to fetch sync status", e);
    }
  }, [isAuthenticated]);

  const syncNow = useCallback(async () => {
    if (!isAuthenticated) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    
    setStatus("syncing");
    try {
      // In a real app we'd fetch local pending changes from IndexedDB and POST to /sync/push
      // For now, we simulate a pull
      const pullResponse = await apiClient<any>("/sync/pull?since=" + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      setLastSyncTime(new Date());
      setStatus("success");
      await refreshStatus();
    } catch (e) {
      console.error("Sync failed", e);
      setStatus("error");
    }
  }, [isAuthenticated, refreshStatus]);

  const resolveConflict = useCallback(async (entityType: string, entityId: string, resolution: "server" | "client", field?: string) => {
    // In a full implementation, we'd apply this to the local DB then retry push
    // Here we just remove from state to simulate resolution
    setConflicts(prev => prev.filter(c => !(c.entityType === entityType && c.entityId === entityId && c.field === field)));
    setPendingCount(prev => prev - 1);
    setSyncedCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshStatus();
      
      const interval = setInterval(() => {
         if (navigator.onLine) {
            refreshStatus();
         }
      }, 30000); // 30s polling
      
      const handleOnline = () => {
        setStatus("idle");
        syncNow();
      };
      const handleOffline = () => setStatus("offline");
      
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [isAuthenticated, refreshStatus, syncNow]);

  return (
    <SyncContext.Provider value={{
      status, pendingCount, syncedCount, failedCount, conflicts, lastSyncTime, syncNow, resolveConflict, refreshStatus
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
