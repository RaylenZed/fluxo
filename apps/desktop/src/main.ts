import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.env.FLUXO_DESKTOP_DEV === '1' || !app.isPackaged;
const serverPort = Number(process.env.FLUXO_DESKTOP_SERVER_PORT ?? 19090);
const webPort = isDev ? 38080 : Number(process.env.FLUXO_DESKTOP_WEB_PORT ?? 18080);
const backendUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let webProcess: ChildProcess | null = null;

function repoRoot(): string {
  return path.resolve(__dirname, '../../..');
}

function desktopDataPaths() {
  const root = path.join(app.getPath('appData'), 'Fluxo');
  const dataDir = path.join(root, 'data');
  const profilesDir = path.join(root, 'profiles');
  return {
    root,
    dataDir,
    profilesDir,
    dbPath: path.join(dataDir, 'fluxo.db'),
    configPath: path.join(profilesDir, 'generated.yaml'),
  };
}

function serviceEnv(): NodeJS.ProcessEnv {
  const paths = desktopDataPaths();
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.profilesDir, { recursive: true });

  return {
    ...process.env,
    NODE_ENV: isDev ? 'development' : 'production',
    PORT: String(serverPort),
    BACKEND_URL: backendUrl,
    DB_PATH: paths.dbPath,
    CONFIG_PATH: paths.configPath,
    FLUXO_AUTH_DISABLED: '1',
    FLUXO_APPLY_MODE: 'manual',
    FLUXO_DEFAULT_APPLY_MODE: 'manual',
    CORS_ORIGIN: webUrl,
  };
}

function startLoggedProcess(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; name: string }): ChildProcess {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk) => console.log(`[${options.name}] ${chunk}`.trimEnd()));
  child.stderr?.on('data', (chunk) => console.error(`[${options.name}] ${chunk}`.trimEnd()));
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`[${options.name}] exited with code=${code} signal=${signal}`);
    }
  });

  return child;
}

function runNodeScript(script: string, cwd: string, env: NodeJS.ProcessEnv, name: string): ChildProcess {
  return startLoggedProcess(process.execPath, [script], {
    cwd,
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    name,
  });
}

async function waitForUrl(url: string, timeoutMs = 60_000): Promise<void> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function startServices(): Promise<void> {
  const env = serviceEnv();

  if (isDev) {
    const root = repoRoot();
    serverProcess = startLoggedProcess('pnpm', ['--filter', '@fluxo/server', 'dev'], { cwd: root, env, name: 'fluxo-api' });
    webProcess = startLoggedProcess('pnpm', ['--filter', 'web', 'dev'], { cwd: root, env, name: 'fluxo-web' });
  } else {
    const resourcesRoot = process.resourcesPath;
    const serverEntry = path.join(resourcesRoot, 'server', 'dist', 'index.js');
    const webEntry = path.join(resourcesRoot, 'web', 'server.js');

    if (!fs.existsSync(serverEntry)) throw new Error(`Bundled Fluxo API not found: ${serverEntry}`);
    if (!fs.existsSync(webEntry)) throw new Error(`Bundled Fluxo Web not found: ${webEntry}`);

    serverProcess = runNodeScript(serverEntry, path.dirname(serverEntry), env, 'fluxo-api');
    webProcess = runNodeScript(webEntry, path.dirname(webEntry), { ...env, PORT: String(webPort) }, 'fluxo-web');
  }

  await waitForUrl(`${backendUrl}/health`);
  await waitForUrl(webUrl);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'Fluxo',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#fbfbfd',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(webUrl)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  return window;
}

async function exportGeneratedConfigFromRenderer() {
  if (!mainWindow) return;
  try {
    const result = await mainWindow.webContents.executeJavaScript(`
      fetch('/api/config/generated', { credentials: 'include' }).then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.text();
      })
    `);
    await saveGeneratedConfig(String(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: '导出失败',
      message,
    });
  }
}

async function saveGeneratedConfig(yaml: string): Promise<{ canceled: boolean; filePath?: string }> {
  const { configPath } = desktopDataPaths();
  const options = {
    title: '导出 Mihomo YAML',
    defaultPath: path.join(path.dirname(configPath), 'mihomo-config.yaml'),
    filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }],
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, yaml, 'utf8');
  return { canceled: false, filePath: result.filePath };
}

function installIpcHandlers() {
  ipcMain.handle('desktop:open-data-dir', async () => {
    await shell.openPath(desktopDataPaths().root);
  });

  ipcMain.handle('desktop:reveal-generated-config', async () => {
    await revealGeneratedConfig();
  });

  ipcMain.handle('desktop:save-generated-config', async (_event, yaml: string) => saveGeneratedConfig(yaml));
}

async function revealGeneratedConfig() {
  const { configPath, profilesDir } = desktopDataPaths();
  if (fs.existsSync(configPath)) shell.showItemInFolder(configPath);
  else await shell.openPath(profilesDir);
}

function installMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '导出 Mihomo YAML...', accelerator: 'CmdOrCtrl+E', click: () => void exportGeneratedConfigFromRenderer() },
        { label: '显示生成的配置', click: () => void revealGeneratedConfig() },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function stopServices() {
  for (const child of [webProcess, serverProcess]) {
    if (child && !child.killed) child.kill('SIGTERM');
  }
  webProcess = null;
  serverProcess = null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.name = 'Fluxo';
  installIpcHandlers();
  installMenu();

  mainWindow = createWindow();
  try {
    await startServices();
    await mainWindow.loadURL(webUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Fluxo 启动失败',
      message,
    });
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      void mainWindow.loadURL(webUrl);
    }
  });
});

app.on('before-quit', stopServices);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
