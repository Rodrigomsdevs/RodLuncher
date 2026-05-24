import 'dotenv/config';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
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
