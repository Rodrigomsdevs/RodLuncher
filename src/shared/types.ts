export type MinecraftVersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface MinecraftVersion {
  id: string;
  type: MinecraftVersionType;
  url: string;
  sha1?: string;
  time: string;
  releaseTime: string;
  installed: boolean;
  installedPath?: string;
  installedSource?: 'rodlauncher' | 'official' | 'custom';
}

export type InstallPhase =
  | 'idle'
  | 'checking'
  | 'preparing'
  | 'version'
  | 'assets'
  | 'libraries'
  | 'java'
  | 'mods'
  | 'launching'
  | 'ready'
  | 'error';

export interface InstallProgress {
  phase: InstallPhase;
  status: string;
  percentage: number;
  versionId?: string;
  taskName?: string;
  transferred?: number;
  total?: number;
}

export type GraphicsApi = 'opengl' | 'vulkan';

export interface LaunchOptions {
  username: string;
  versionId: string;
  graphicsApi?: GraphicsApi;
  memory?: {
    min?: number;
    max?: number;
  };
}

export interface LaunchResult {
  pid?: number;
  message: string;
  mode: 'offline';
}
