"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proxiesApi, groupsApi, rulesApi, settingsApi, profilesApi, mihomoApi } from '../api';
import { toast } from 'sonner';

// --- Proxies ---
export function useProxies() {
  return useQuery({ queryKey: ['proxies'], queryFn: proxiesApi.list, staleTime: 30_000 });
}

export function useCreateProxy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: proxiesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proxies'] }); toast.success('Proxy node added'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useUpdateProxy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof proxiesApi.update>[1] }) =>
      proxiesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proxies'] }); toast.success('Proxy node updated'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteProxy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: proxiesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proxies'] }); toast.success('Proxy node deleted'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

// --- Groups ---
export function useGroups() {
  return useQuery({ queryKey: ['groups'], queryFn: groupsApi.list, staleTime: 30_000 });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast.success('Policy group created'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => groupsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast.success('Policy group updated'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast.success('Group deleted'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

// --- Rules ---
export function useRules() {
  return useQuery({ queryKey: ['rules'], queryFn: rulesApi.list, staleTime: 30_000 });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rulesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); toast.success('Rule added'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof rulesApi.update>[1] }) =>
      rulesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rulesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); toast.success('Rule deleted'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useReorderRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rulesApi.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

// --- Settings ---
export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsApi.get, staleTime: 60_000 });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useApplyConfig() {
  return useMutation({
    mutationFn: settingsApi.applyConfig,
    onSuccess: () => toast.success('Config applied to Mihomo'),
    onError: (e: Error) => toast.error(`Apply failed: ${e.message}`),
  });
}

// --- Profiles ---
export function useProfiles() {
  return useQuery({ queryKey: ['profiles'], queryFn: profilesApi.list, staleTime: 30_000 });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profilesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }); toast.success('Profile created'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profilesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }); toast.success('Profile deleted'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

export function useActivateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profilesApi.activate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }); toast.success('Profile activated'); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
}

// --- Mihomo ---
export function useMihomoStatus() {
  return useQuery({
    queryKey: ['mihomo', 'status'],
    queryFn: mihomoApi.status,
    refetchInterval: 10_000,
    retry: false,
  });
}

// --- Real-time WebSocket hooks (re-exported from dedicated files) ---
export { useRealtimeTraffic } from './use-traffic';
export type { TrafficPoint } from './use-traffic';

export { useRealtimeConnections } from './use-connections';
export type { Connection, ConnectionsState } from './use-connections';
