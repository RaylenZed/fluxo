export {};

declare global {
  interface Window {
    fluxoDesktop?: {
      platform: NodeJS.Platform;
      openDataDir: () => Promise<void>;
      revealGeneratedConfig: () => Promise<void>;
      saveGeneratedConfig: (yaml: string) => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}
