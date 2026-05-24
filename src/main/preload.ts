import { contextBridge, ipcRenderer } from 'electron';
import type {
  InstallProgress,
  LaunchOptions,
  LaunchResult,
  MinecraftVersion,
} from '../shared/types';

const rodlauncher = {
  listVersions: (): Promise<MinecraftVersion[]> => ipcRenderer.invoke('versions:list'),
  getInstallDirectory: (): Promise<string> => ipcRenderer.invoke('minecraft:get-install-dir'),
  installVersion: (versionId: string): Promise<void> =>
    ipcRenderer.invoke('minecraft:install', versionId),
  launchGame: (options: LaunchOptions): Promise<LaunchResult> =>
    ipcRenderer.invoke('minecraft:launch', options),
  onInstallProgress: (callback: (progress: InstallProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: InstallProgress) => {
      callback(progress);
    };

    ipcRenderer.on('minecraft:install-progress', listener);

    return () => {
      ipcRenderer.removeListener('minecraft:install-progress', listener);
    };
  },
  onGameClosed: (callback: (data: { code: number | null }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { code: number | null }) => {
      callback(data);
    };

    ipcRenderer.on('minecraft:game-closed', listener);

    return () => {
      ipcRenderer.removeListener('minecraft:game-closed', listener);
    };
  },
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
};

contextBridge.exposeInMainWorld('rodlauncher', rodlauncher);

export type RodLauncherApi = typeof rodlauncher;
