import { app } from 'electron';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  InstallPhase,
  InstallProgress,
  LaunchOptions,
  LaunchResult,
  MinecraftVersion,
} from '../shared/types';

const VERSION_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: Array<Omit<MinecraftVersion, 'installed'>>;
}

type ProgressCallback = (progress: InstallProgress) => void;

interface MinecraftRootCandidate {
  path: string;
  source: 'rodlauncher' | 'official' | 'custom';
  label: string;
}

interface InstalledVersion {
  root: MinecraftRootCandidate;
  versionPath: string;
}

let cachedManifest: VersionManifest | null = null;
let cachedAt = 0;

export function getMinecraftRoot() {
  return path.join(app.getPath('userData'), 'minecraft');
}

export async function listVersions(): Promise<MinecraftVersion[]> {
  const manifest = await getVersionManifest();

  return manifest.versions.map((version) => {
    const installedVersion = findInstalledVersion(version.id);

    return {
      ...version,
      installed: Boolean(installedVersion),
      installedPath: installedVersion?.versionPath,
      installedSource: installedVersion?.root.source,
    };
  });
}

export async function installVersion(versionId: string, onProgress?: ProgressCallback) {
  const minecraftRoot = getMinecraftRoot();
  const versionMeta = await getVersionMeta(versionId);

  await mkdir(minecraftRoot, { recursive: true });

  const installedVersion = findInstalledVersion(versionId);

  if (installedVersion) {
    onProgress?.({
      phase: 'ready',
      status: `Versao ${versionId} ja esta instalada em ${installedVersion.root.label}.`,
      percentage: 100,
      versionId,
    });
    return;
  }

  onProgress?.({
    phase: 'preparing',
    status: `Preparando instalacao da versao ${versionId}...`,
    percentage: 0,
    versionId,
  });

  const { installTask } = await import('@xmcl/installer');
  const rootTask = installTask(versionMeta as any, minecraftRoot as any) as any;

  await rootTask.startAndWait({
    onStart(task: any) {
      emitTaskProgress(rootTask, task, versionId, onProgress);
    },
    onUpdate(task: any) {
      emitTaskProgress(rootTask, task, versionId, onProgress);
    },
    onFailed(task: any, error: unknown) {
      onProgress?.({
        phase: 'error',
        status: getErrorMessage(error),
        percentage: progressOf(rootTask),
        versionId,
        taskName: getTaskLabel(task),
      });
    },
    onSucceed(task: any) {
      emitTaskProgress(rootTask, task, versionId, onProgress);
    },
  });

  onProgress?.({
    phase: 'ready',
    status: `Versao ${versionId} instalada com sucesso.`,
    percentage: 100,
    versionId,
  });
}

export async function launchGame(
  options: LaunchOptions,
  onProgress?: ProgressCallback,
): Promise<LaunchResult> {
  const username = normalizeUsername(options.username);

  if (!username) {
    throw new Error('Nickname invalido. Use 3 a 16 caracteres: letras, numeros e underline.');
  }

  let installedVersion = findInstalledVersion(options.versionId);

  if (!installedVersion) {
    await installVersion(options.versionId, onProgress);
    installedVersion = findInstalledVersion(options.versionId);
  }

  if (!installedVersion) {
    throw new Error(`A versao ${options.versionId} nao foi encontrada apos a instalacao.`);
  }

  onProgress?.({
    phase: 'java',
    status: 'Verificando Java instalado...',
    percentage: 100,
    versionId: options.versionId,
  });

  const javaPath = await resolveJavaPath();

  onProgress?.({
    phase: 'launching',
    status: `Iniciando com arquivos de ${installedVersion.root.label}...`,
    percentage: 100,
    versionId: options.versionId,
  });

  const { launch } = await import('@xmcl/core');
  const minecraftRoot = getMinecraftRoot();
  await mkdir(minecraftRoot, { recursive: true });

  const process = await launch({
    gamePath: minecraftRoot,
    resourcePath: installedVersion.root.path,
    javaPath,
    version: options.versionId,
    gameProfile: {
      name: username,
      id: createStableUuid(username).replaceAll('-', ''),
    },
    launcherName: 'RodLauncher',
    launcherBrand: 'RodLauncher',
    versionType: 'RodLauncher local',
    accessToken: 'rodlauncher-demo',
    userType: 'legacy',
    demo: true,
    minMemory: options.memory?.min ?? 512,
    maxMemory: options.memory?.max ?? 2048,
    extraExecOption: {
      detached: true,
      stdio: 'ignore',
    },
  } as any);

  process.unref();

  return {
    pid: process.pid,
    mode: 'demo-local',
    message: 'Minecraft foi iniciado em modo demo/local.',
  };
}

async function getVersionManifest(): Promise<VersionManifest> {
  const cacheLifetime = 1000 * 60 * 10;

  if (cachedManifest && Date.now() - cachedAt < cacheLifetime) {
    return cachedManifest;
  }

  const response = await fetch(VERSION_MANIFEST_URL);

  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar versoes da Mojang (${response.status}).`);
  }

  cachedManifest = (await response.json()) as VersionManifest;
  cachedAt = Date.now();
  return cachedManifest;
}

async function getVersionMeta(versionId: string) {
  const manifest = await getVersionManifest();
  const version = manifest.versions.find((entry) => entry.id === versionId);

  if (!version) {
    throw new Error(`Versao ${versionId} nao encontrada no manifesto oficial.`);
  }

  return version;
}

function findInstalledVersion(versionId: string): InstalledVersion | undefined {
  for (const root of getMinecraftRoots()) {
    const versionPath = path.join(root.path, 'versions', versionId);

    if (isCompleteVersionPath(versionPath, versionId)) {
      return {
        root,
        versionPath,
      };
    }
  }

  return undefined;
}

function isCompleteVersionPath(versionPath: string, versionId: string) {
  return (
    existsSync(path.join(versionPath, `${versionId}.json`)) &&
    existsSync(path.join(versionPath, `${versionId}.jar`))
  );
}

function getMinecraftRoots(): MinecraftRootCandidate[] {
  const candidates: MinecraftRootCandidate[] = [
    {
      path: getMinecraftRoot(),
      source: 'rodlauncher',
      label: 'RodLauncher',
    },
  ];

  const customRoot = process.env.RODLAUNCHER_MINECRAFT_DIR?.trim();

  if (customRoot) {
    candidates.push({
      path: customRoot,
      source: 'custom',
      label: 'pasta customizada',
    });
  }

  candidates.push({
    path: getDefaultMinecraftRoot(),
    source: 'official',
    label: '.minecraft oficial',
  });

  const uniqueCandidates = new Map<string, MinecraftRootCandidate>();

  for (const candidate of candidates) {
    const normalizedPath = path.resolve(candidate.path).toLowerCase();
    if (!uniqueCandidates.has(normalizedPath)) {
      uniqueCandidates.set(normalizedPath, candidate);
    }
  }

  return [...uniqueCandidates.values()];
}

function getDefaultMinecraftRoot() {
  if (process.platform === 'win32') {
    return path.join(app.getPath('appData'), '.minecraft');
  }

  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
  }

  return path.join(app.getPath('home'), '.minecraft');
}

function emitTaskProgress(
  rootTask: any,
  task: any,
  versionId: string,
  onProgress?: ProgressCallback,
) {
  const percentage = progressOf(rootTask);
  const taskName = getTaskLabel(task);

  onProgress?.({
    phase: getTaskPhase(task),
    status: taskName,
    percentage,
    versionId,
    taskName,
    transferred: Number(rootTask?.progress ?? 0),
    total: Number(rootTask?.total ?? 0),
  });
}

function progressOf(task: any) {
  const progress = Number(task?.progress ?? 0);
  const total = Number(task?.total ?? 0);

  if (!Number.isFinite(progress) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
}

function getTaskPhase(task: any): InstallPhase {
  const fingerprint = `${task?.path ?? ''} ${task?.name ?? ''}`.toLowerCase();

  if (fingerprint.includes('asset')) return 'assets';
  if (fingerprint.includes('librar')) return 'libraries';
  if (fingerprint.includes('java')) return 'java';
  if (fingerprint.includes('version') || fingerprint.includes('jar') || fingerprint.includes('json')) {
    return 'version';
  }

  return 'preparing';
}

function getTaskLabel(task: any) {
  const rawName = String(task?.name || task?.path || 'Instalando arquivos oficiais...');
  const normalized = rawName.replaceAll('.', ' ').replaceAll('-', ' ').trim();

  if (!normalized) return 'Instalando arquivos oficiais...';
  if (normalized.toLowerCase().includes('asset')) return 'Baixando assets do jogo...';
  if (normalized.toLowerCase().includes('librar')) return 'Baixando bibliotecas...';
  if (normalized.toLowerCase().includes('jar')) return 'Baixando client jar...';
  if (normalized.toLowerCase().includes('json')) return 'Baixando metadados da versao...';

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeUsername(username: string) {
  const value = username.trim();
  return /^[A-Za-z0-9_]{3,16}$/.test(value) ? value : '';
}

function createStableUuid(username: string) {
  const hash = crypto.createHash('md5').update(`RodLauncher:${username}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

async function resolveJavaPath() {
  const preferredJava = process.env.RODLAUNCHER_JAVA?.trim() || 'java';

  await new Promise<void>((resolve, reject) => {
    const child = spawn(preferredJava, ['-version']);
    let output = '';

    child.stderr?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', () => {
      reject(
        new Error(
          'Java nao encontrado. Instale o Java 17+ ou defina RODLAUNCHER_JAVA com o caminho do java.exe.',
        ),
      );
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Java retornou erro ao validar versao: ${output || code}`));
    });
  });

  return preferredJava;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
