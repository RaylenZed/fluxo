import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getLatencyColor(ms: number): string {
  if (ms === 0) return "text-muted-foreground";
  if (ms < 100) return "text-emerald-500";
  if (ms < 300) return "text-amber-500";
  return "text-red-500";
}

export function getLatencyBg(ms: number): string {
  if (ms === 0) return "bg-muted";
  if (ms < 100) return "bg-emerald-500/10 text-emerald-600";
  if (ms < 300) return "bg-amber-500/10 text-amber-600";
  return "bg-red-500/10 text-red-600";
}
