import type { RodLauncherApi } from '../main/preload';

declare global {
  interface Window {
    rodlauncher: RodLauncherApi;
  }
}

export {};
