import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fluxoDesktop', {
  platform: process.platform,
  openDataDir: () => ipcRenderer.invoke('desktop:open-data-dir'),
  revealGeneratedConfig: () => ipcRenderer.invoke('desktop:reveal-generated-config'),
  saveGeneratedConfig: (yaml: string) => ipcRenderer.invoke('desktop:save-generated-config', yaml),
});
