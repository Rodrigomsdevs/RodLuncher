import 'dotenv/config';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  getMinecraftRoot,
  installVersion,
  launchOffline,
  listVersions,
} from './minecraft';
import type { LaunchOptions } from '../shared/types';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (handleWindowsSquirrelEvent()) {
  app.quit();
}

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 680,
    show: false,
    frame: false,
    icon: getWindowIconPath(),
    backgroundColor: '#0D1117',
    title: 'RodLauncher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

function getWindowIconPath() {
  const candidates = [
    path.join(app.getAppPath(), 'src', 'renderer', 'assets', 'icon.png'),
    path.join(process.cwd(), 'src', 'renderer', 'assets', 'icon.png'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function handleWindowsSquirrelEvent() {
  if (process.platform !== 'win32') return false;

  const squirrelEvent = process.argv[1];
  if (!squirrelEvent?.startsWith('--squirrel-')) return false;

  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const exeName = path.basename(process.execPath);
  const shortcutLocations = 'Desktop,StartMenu';

  const runUpdate = (args: string[]) => {
    try {
      spawn(updateExe, args, { detached: true });
    } catch {
      // Squirrel events should never open the app UI, even if shortcut creation fails.
    }
  };

  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      runUpdate(['--createShortcut', exeName, '--shortcut-locations', shortcutLocations]);
      setTimeout(() => app.quit(), 1000);
      return true;
    case '--squirrel-uninstall':
      runUpdate(['--removeShortcut', exeName, '--shortcut-locations', shortcutLocations]);
      setTimeout(() => app.quit(), 1000);
      return true;
    case '--squirrel-obsolete':
      return true;
    default:
      return false;
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const getFocusedWindow = () => BrowserWindow.getFocusedWindow();

function registerIpcHandlers() {
  ipcMain.handle('window:minimize', () => getFocusedWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const window = getFocusedWindow();
    if (!window) return false;

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });
  ipcMain.handle('window:close', () => getFocusedWindow()?.close());
  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (url.startsWith('https://')) {
      return shell.openExternal(url);
    }

    throw new Error('URL externa bloqueada.');
  });

  ipcMain.handle('versions:list', () => listVersions());
  ipcMain.handle('minecraft:get-install-dir', () => getMinecraftRoot());
  ipcMain.handle('minecraft:install', async (event, versionId: string) => {
    return installVersion(versionId, (progress) => {
      event.sender.send('minecraft:install-progress', progress);
    });
  });
  ipcMain.handle('minecraft:launch', async (event, options: LaunchOptions) => {
    return launchOffline(
      options,
      (progress) => event.sender.send('minecraft:install-progress', progress),
      (code) => event.sender.send('minecraft:game-closed', { code }),
    );
  });
}
