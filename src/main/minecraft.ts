import { app } from 'electron';
import { ChildProcess, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
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

interface JavaResolution {
  path: string;
  majorVersion: number;
  rawVersion: string;
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

  const requiredJavaMajor = await getRequiredJavaMajor(installedVersion);
  const java = await resolveJavaPath(requiredJavaMajor);

  onProgress?.({
    phase: 'launching',
    status: `Iniciando com arquivos de ${installedVersion.root.label}...`,
    percentage: 100,
    versionId: options.versionId,
  });

  const { createMinecraftProcessWatcher, launch } = await import('@xmcl/core');
  const minecraftRoot = getMinecraftRoot();
  await mkdir(minecraftRoot, { recursive: true });

  const childProcess = await launch({
    gamePath: minecraftRoot,
    resourcePath: installedVersion.root.path,
    javaPath: java.path,
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
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  } as any);

  await waitForMinecraftStartup(childProcess, createMinecraftProcessWatcher, options.versionId, onProgress);

  return {
    pid: childProcess.pid,
    mode: 'demo-local',
    message: `Processo do Minecraft iniciado com Java ${java.majorVersion || 'detectado'}.`,
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

async function getRequiredJavaMajor(installedVersion: InstalledVersion) {
  const versionId = path.basename(installedVersion.versionPath);
  const versionJsonPath = path.join(installedVersion.versionPath, `${versionId}.json`);

  try {
    const versionJson = JSON.parse(await readFile(versionJsonPath, 'utf-8')) as {
      javaVersion?: {
        majorVersion?: number;
      };
    };

    return versionJson.javaVersion?.majorVersion;
  } catch {
    return undefined;
  }
}

function waitForMinecraftStartup(
  childProcess: ChildProcess,
  createMinecraftProcessWatcher: (process: ChildProcess) => NodeJS.EventEmitter,
  versionId: string,
  onProgress?: ProgressCallback,
) {
  let recentOutput = '';

  const collectOutput = (chunk: Buffer) => {
    recentOutput = `${recentOutput}${chunk.toString()}`.slice(-3200);
  };

  childProcess.stdout?.on('data', collectOutput);
  childProcess.stderr?.on('data', collectOutput);

  const watcher = createMinecraftProcessWatcher(childProcess);

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        onProgress?.({
          phase: 'ready',
          status: 'Minecraft continua em execucao. Se a janela nao aparecer, veja o erro no console.',
          percentage: 100,
          versionId,
        });
        resolve();
      });
    }, 8000);

    watcher.once('minecraft-window-ready', () => {
      finish(() => {
        onProgress?.({
          phase: 'ready',
          status: 'Janela do Minecraft detectada.',
          percentage: 100,
          versionId,
        });
        resolve();
      });
    });

    childProcess.once('error', (error) => {
      finish(() => reject(error));
    });

    childProcess.once('exit', (code, signal) => {
      finish(() => {
        const exitReason = signal ? `sinal ${signal}` : `codigo ${code ?? 'desconhecido'}`;
        const output = simplifyMinecraftOutput(recentOutput);

        reject(
          new Error(
            `Minecraft fechou antes de abrir (${exitReason}).${output ? ` Ultima saida: ${output}` : ''}`,
          ),
        );
      });
    });
  });
}

function simplifyMinecraftOutput(output: string) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join(' | ')
    .slice(0, 1100);
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

async function resolveJavaPath(requiredMajor?: number): Promise<JavaResolution> {
  const preferredJava = process.env.RODLAUNCHER_JAVA?.trim() || 'java';

  const rawVersion = await new Promise<string>((resolve, reject) => {
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
        resolve(output);
        return;
      }

      reject(new Error(`Java retornou erro ao validar versao: ${output || code}`));
    });
  });

  const majorVersion = parseJavaMajorVersion(rawVersion);

  if (requiredMajor && majorVersion && majorVersion < requiredMajor) {
    throw new Error(
      `Esta versao do Minecraft exige Java ${requiredMajor}+, mas o launcher encontrou Java ${majorVersion}. Instale Java ${requiredMajor}+ ou defina RODLAUNCHER_JAVA.`,
    );
  }

  return {
    path: preferredJava,
    majorVersion: majorVersion || 0,
    rawVersion,
  };
}

function parseJavaMajorVersion(output: string) {
  const match = output.match(/version "(?<version>\d+(?:\.\d+)?)/);
  const version = match?.groups?.version;

  if (!version) return 0;

  if (version.startsWith('1.')) {
    return Number(version.split('.')[1]) || 0;
  }

  return Number(version.split('.')[0]) || 0;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
