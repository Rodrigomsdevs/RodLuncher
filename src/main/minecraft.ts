import { app } from 'electron';
import { ChildProcess, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
  InstallPhase,
  InstallProgress,
  LaunchOptions,
  LaunchResult,
  MinecraftVersion,
} from '../shared/types';

const VERSION_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const OFFICIAL_LIBRARY_HOST = 'https://libraries.minecraft.net';
const OFFICIAL_ASSET_HOST = 'https://resources.download.minecraft.net';

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
  label: string;
}

interface JavaCandidate {
  path: string;
  label: string;
}

interface DownloadItem {
  destination: string;
  label: string;
  size?: number;
  sha1?: string;
  urls: string[];
}

interface VersionJson {
  id: string;
  downloads?: {
    client?: {
      sha1?: string;
      size?: number;
      url: string;
    };
  };
  assetIndex?: {
    id: string;
    sha1?: string;
    size?: number;
    url: string;
  };
}

interface AssetIndexJson {
  objects: Record<string, { hash: string; size: number }>;
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

  try {
    await installVanillaVersion(versionMeta, minecraftRoot, onProgress);

    onProgress?.({
      phase: 'ready',
      status: `Versao ${versionId} instalada com sucesso.`,
      percentage: 100,
      versionId,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    onProgress?.({
      phase: 'error',
      status: message,
      percentage: 0,
      versionId,
    });

    throw new Error(message, { cause: error });
  }
}

export async function launchOffline(
  options: LaunchOptions,
  onProgress?: ProgressCallback,
  onExit?: (code: number | null) => void,
): Promise<LaunchResult> {
  const username = normalizeUsername(options.username);

  if (!username) {
    throw new Error('Nickname invalido. Use 3 a 16 caracteres: letras, numeros e underline.');
  }

  const minecraftRoot = getMinecraftRoot();
  await mkdir(minecraftRoot, { recursive: true });

  let installedVersion = findInstalledVersion(options.versionId);

  if (!installedVersion) {
    await installVersion(options.versionId, onProgress);
    installedVersion = findInstalledVersion(options.versionId);
  }

  if (!installedVersion) {
    throw new Error(`A versao ${options.versionId} nao foi encontrada apos a instalacao.`);
  }

  const launchVersionId =
    options.graphicsApi === 'vulkan'
      ? await ensureVulkanSetup(options.versionId, minecraftRoot, onProgress)
      : options.versionId;

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

  const extraJVMArgs =
    options.graphicsApi === 'vulkan' ? ['-Dorg.lwjgl.vulkan.libname=vulkan-1'] : [];

  const childProcess = await launch({
    gamePath: minecraftRoot,
    resourcePath: installedVersion.root.path,
    javaPath: java.path,
    version: launchVersionId,
    gameProfile: {
      name: username,
      id: createStableUuid(username).replaceAll('-', ''),
    },
    launcherName: 'RodLauncher',
    launcherBrand: 'RodLauncher',
    versionType: 'RodLauncher local',
    accessToken: 'offline',
    userType: 'legacy',
    minMemory: options.memory?.min ?? 512,
    maxMemory: options.memory?.max ?? 2048,
    extraJVMArgs,
    extraExecOption: {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  } as any);

  await waitForMinecraftStartup(childProcess, createMinecraftProcessWatcher, options.versionId, onProgress);

  childProcess.once('exit', (code) => onExit?.(code));

  return {
    pid: childProcess.pid,
    mode: 'offline',
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

async function installVanillaVersion(
  versionMeta: Omit<MinecraftVersion, 'installed'>,
  minecraftRoot: string,
  onProgress?: ProgressCallback,
) {
  const versionId = versionMeta.id;
  const versionRoot = path.join(minecraftRoot, 'versions', versionId);
  const versionJsonPath = path.join(versionRoot, `${versionId}.json`);
  const versionJarPath = path.join(versionRoot, `${versionId}.jar`);

  await mkdir(versionRoot, { recursive: true });

  onProgress?.({
    phase: 'version',
    status: 'Baixando metadados da versao...',
    percentage: 2,
    versionId,
  });

  const versionJson = await downloadJson<VersionJson>({
    destination: versionJsonPath,
    label: `${versionId}.json`,
    sha1: versionMeta.sha1,
    urls: [versionMeta.url],
  });

  const clientDownload = versionJson.downloads?.client;

  if (!clientDownload?.url) {
    throw new Error(`A versao ${versionId} nao possui client jar no manifesto oficial.`);
  }

  await downloadMany(
    [
      {
        destination: versionJarPath,
        label: `${versionId}.jar`,
        size: clientDownload.size,
        sha1: clientDownload.sha1,
        urls: [clientDownload.url],
      },
    ],
    {
      basePercentage: 2,
      spanPercentage: 18,
      phase: 'version',
      status: 'Baixando client jar...',
      versionId,
      onProgress,
    },
  );

  const { Version } = await import('@xmcl/core');
  const resolvedVersion = await Version.parse(minecraftRoot, versionId);

  await downloadMany(
    resolvedVersion.libraries
      .filter((library: any) => library.download?.path)
      .map((library: any) => ({
        destination: path.join(minecraftRoot, 'libraries', library.download.path),
        label: library.name,
        size: library.download.size,
        sha1: library.download.sha1,
        urls: uniqueUrls([
          library.download.url,
          `${OFFICIAL_LIBRARY_HOST}/${library.download.path}`,
        ]),
      })),
    {
      basePercentage: 20,
      spanPercentage: 35,
      phase: 'libraries',
      status: 'Baixando bibliotecas...',
      versionId,
      onProgress,
    },
  );

  await installAssets(versionJson, resolvedVersion.assets, minecraftRoot, versionId, onProgress);
}

async function installAssets(
  versionJson: VersionJson,
  assetsId: string,
  minecraftRoot: string,
  versionId: string,
  onProgress?: ProgressCallback,
) {
  const assetIndex = versionJson.assetIndex;

  if (!assetIndex?.url) {
    onProgress?.({
      phase: 'assets',
      status: 'Versao sem asset index.',
      percentage: 100,
      versionId,
    });
    return;
  }

  const assetIndexByIdPath = path.join(minecraftRoot, 'assets', 'indexes', `${assetsId}.json`);
  const assetIndexByHashPath = assetIndex.sha1
    ? path.join(minecraftRoot, 'assets', 'indexes', `${assetIndex.sha1}.json`)
    : assetIndexByIdPath;

  onProgress?.({
    phase: 'assets',
    status: 'Baixando indice de assets...',
    percentage: 55,
    versionId,
  });

  const assetIndexJson = await downloadJson<AssetIndexJson>({
    destination: assetIndexByIdPath,
    label: `assets ${assetsId}`,
    size: assetIndex.size,
    sha1: assetIndex.sha1,
    urls: [assetIndex.url],
  });

  if (assetIndexByHashPath !== assetIndexByIdPath) {
    await mkdir(path.dirname(assetIndexByHashPath), { recursive: true });
    await writeFile(assetIndexByHashPath, JSON.stringify(assetIndexJson));
  }

  const assetItems = Object.entries(assetIndexJson.objects).map(([name, asset]) => {
    const head = asset.hash.slice(0, 2);

    return {
      destination: path.join(minecraftRoot, 'assets', 'objects', head, asset.hash),
      label: name,
      size: asset.size,
      sha1: asset.hash,
      urls: [`${OFFICIAL_ASSET_HOST}/${head}/${asset.hash}`],
    };
  });

  await downloadMany(assetItems, {
    basePercentage: 56,
    spanPercentage: 44,
    phase: 'assets',
    status: 'Baixando assets...',
    versionId,
    onProgress,
  });
}

async function downloadJson<T>(item: DownloadItem): Promise<T> {
  await downloadFile(item, () => undefined);

  try {
    return JSON.parse(await readFile(item.destination, 'utf-8')) as T;
  } catch {
    await unlink(item.destination).catch(() => undefined);
    await downloadFile(item, () => undefined);
    return JSON.parse(await readFile(item.destination, 'utf-8')) as T;
  }
}

async function downloadMany(
  items: DownloadItem[],
  options: {
    basePercentage: number;
    spanPercentage: number;
    phase: InstallPhase;
    status: string;
    versionId: string;
    onProgress?: ProgressCallback;
  },
) {
  if (items.length === 0) {
    options.onProgress?.({
      phase: options.phase,
      status: options.status,
      percentage: options.basePercentage + options.spanPercentage,
      versionId: options.versionId,
    });
    return;
  }

  const totals = items.map((item) => Math.max(1, item.size ?? 1));
  const progress = items.map(() => 0);
  const total = totals.reduce((sum, value) => sum + value, 0);

  const updateProgress = (index: number, written: number) => {
    progress[index] = Math.min(totals[index], Math.max(progress[index], written));

    const transferred = progress.reduce((sum, value) => sum + value, 0);
    const percentage = Math.round(
      options.basePercentage + (transferred / total) * options.spanPercentage,
    );

    options.onProgress?.({
      phase: options.phase,
      status: `${options.status} ${Math.min(items.length, progress.filter(Boolean).length)}/${items.length}`,
      percentage: Math.max(0, Math.min(100, percentage)),
      versionId: options.versionId,
      transferred,
      total,
    });
  };

  await runWithConcurrency(items, 8, async (item, index) => {
    await downloadFile(item, (written) => updateProgress(index, written));
    updateProgress(index, totals[index]);
  });
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  const errors: unknown[] = [];
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length && errors.length === 0) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        await worker(items[index], index);
      } catch (error) {
        errors.push(error);
      }
    }
  });

  await Promise.all(workers);

  if (errors.length > 0) {
    throw new Error(formatInstallError(errors[0]));
  }
}

async function downloadFile(item: DownloadItem, onProgress: (written: number) => void) {
  if (await isFileValid(item.destination, item.sha1, item.size)) {
    onProgress(item.size ?? 1);
    return;
  }

  const errors: unknown[] = [];
  const pendingFile = `${item.destination}.rodlauncher`;

  await mkdir(path.dirname(item.destination), { recursive: true });

  for (const url of item.urls) {
    try {
      await unlink(pendingFile).catch(() => undefined);

      const response = await fetch(url);

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} ao baixar ${url}`);
      }

      let written = 0;
      const writeStream = createWriteStream(pendingFile);
      const readable = Readable.fromWeb(response.body as any);

      readable.on('data', (chunk: Buffer) => {
        written += chunk.length;
        onProgress(written);
      });

      await pipeline(readable, writeStream);
      await rename(pendingFile, item.destination);

      if (!(await isFileValid(item.destination, item.sha1, item.size))) {
        throw new Error(`Arquivo baixado falhou na validacao: ${item.label}`);
      }

      onProgress((item.size ?? written) || 1);
      return;
    } catch (error) {
      errors.push(
        Object.assign(error instanceof Error ? error : new Error(String(error)), {
          url,
          destination: item.destination,
          label: item.label,
        }),
      );
      await unlink(pendingFile).catch(() => undefined);
    }
  }

  throw new Error(formatInstallError(new AggregateError(errors, `Falha ao baixar ${item.label}`)));
}

async function isFileValid(file: string, sha1?: string, expectedSize?: number) {
  const fileStat = await stat(file).catch(() => undefined);

  if (!fileStat) return false;

  if (expectedSize && fileStat.size !== expectedSize) {
    return false;
  }

  if (sha1) {
    return (await sha1File(file)) === sha1;
  }

  return fileStat.size > 0;
}

function sha1File(file: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = createReadStream(file);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function uniqueUrls(urls: Array<string | undefined>) {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function formatInstallError(error: unknown): string {
  const errors = flattenErrors(error);
  const details = errors
    .slice(0, 5)
    .map((entry) => {
      const anyError = entry as any;
      const label = anyError.label ? `${anyError.label}: ` : '';
      const destination = anyError.destination ? ` -> ${anyError.destination}` : '';
      const url = anyError.url ? ` (${anyError.url})` : '';
      return `${label}${getErrorMessage(entry)}${url}${destination}`;
    })
    .join(' | ');

  if (details) {
    return `Falha ao instalar arquivos do Minecraft: ${details}`;
  }

  return getErrorMessage(error);
}

function flattenErrors(error: unknown): unknown[] {
  if (error instanceof AggregateError) {
    return error.errors.flatMap((entry) => flattenErrors(entry));
  }

  const anyError = error as { cause?: unknown };

  if (anyError?.cause instanceof AggregateError) {
    return flattenErrors(anyError.cause);
  }

  return [error];
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
  const candidates = await getJavaCandidates();
  const validJavaVersions: JavaResolution[] = [];

  for (const candidate of candidates) {
    const java = await inspectJavaCandidate(candidate).catch(() => undefined);

    if (!java) continue;

    validJavaVersions.push(java);

    if (!requiredMajor || java.majorVersion >= requiredMajor) {
      return java;
    }
  }

  if (validJavaVersions.length > 0) {
    const foundVersions = validJavaVersions
      .map((java) => `Java ${java.majorVersion || '?'} (${java.label})`)
      .join(', ');

    throw new Error(
      `Esta versao do Minecraft exige Java ${requiredMajor}+, mas o launcher encontrou ${foundVersions}. O Minecraft Launcher oficial pode abrir porque usa um Java proprio embutido. Instale Java ${requiredMajor}+ ou defina RODLAUNCHER_JAVA com o caminho do java.exe compativel.`,
    );
  }

  throw new Error(
    `Java nao encontrado. Instale Java ${requiredMajor ? `${requiredMajor}+` : '17+'} ou defina RODLAUNCHER_JAVA com o caminho do java.exe.`,
  );
}

async function inspectJavaCandidate(candidate: JavaCandidate): Promise<JavaResolution> {
  const rawVersion = await new Promise<string>((resolve, reject) => {
    const child = spawn(candidate.path, ['-version']);
    let output = '';

    child.stderr?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', () => {
      reject(new Error(`Java nao encontrado em ${candidate.label}.`));
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

  return {
    path: candidate.path,
    majorVersion: majorVersion || 0,
    rawVersion,
    label: candidate.label,
  };
}

async function getJavaCandidates(): Promise<JavaCandidate[]> {
  const candidates: JavaCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (candidatePath: string | undefined, label: string) => {
    const normalizedCandidate = normalizeJavaExecutable(candidatePath);

    if (!normalizedCandidate) return;

    const key = normalizedCandidate.toLowerCase();

    if (seen.has(key)) return;

    seen.add(key);
    candidates.push({
      path: normalizedCandidate,
      label,
    });
  };

  addCandidate(process.env.RODLAUNCHER_JAVA, 'RODLAUNCHER_JAVA');
  addCandidate(process.env.JAVA_HOME, 'JAVA_HOME');

  for (const root of getJavaSearchRoots()) {
    const javaExecutables = await findJavaExecutables(root.path, 8);

    for (const javaExecutable of javaExecutables) {
      addCandidate(javaExecutable, root.label);
    }
  }

  addCandidate('java', 'PATH');

  return candidates;
}

function getJavaSearchRoots() {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env['ProgramFiles(x86)'];

  return [
    {
      path: path.join(getDefaultMinecraftRoot(), 'runtime'),
      label: 'runtime da .minecraft',
    },
    localAppData
      ? {
          path: path.join(
            localAppData,
            'Packages',
            'Microsoft.4297127D64EC6_8wekyb3d8bbwe',
            'LocalCache',
            'Local',
            'runtime',
          ),
          label: 'runtime do Minecraft Launcher',
        }
      : undefined,
    localAppData
      ? {
          path: path.join(
            localAppData,
            'Packages',
            'Microsoft.4297127D64EC6_8wekyb3d8bbwe',
            'LocalCache',
            'Roaming',
            '.minecraft',
            'runtime',
          ),
          label: 'runtime do Minecraft Launcher',
        }
      : undefined,
    localAppData
      ? {
          path: path.join(localAppData, 'Programs', 'Eclipse Adoptium'),
          label: 'Eclipse Adoptium',
        }
      : undefined,
    localAppData
      ? {
          path: path.join(localAppData, 'Programs', 'Java'),
          label: 'Java em AppData',
        }
      : undefined,
    programFiles
      ? {
          path: path.join(programFiles, 'Eclipse Adoptium'),
          label: 'Eclipse Adoptium',
        }
      : undefined,
    programFiles
      ? {
          path: path.join(programFiles, 'Java'),
          label: 'Java em Program Files',
        }
      : undefined,
    programFiles
      ? {
          path: path.join(programFiles, 'Microsoft', 'jdk'),
          label: 'Microsoft JDK',
        }
      : undefined,
    programFilesX86
      ? {
          path: path.join(programFilesX86, 'Minecraft Launcher', 'runtime'),
          label: 'runtime do Minecraft Launcher',
        }
      : undefined,
    programFiles
      ? {
          path: path.join(programFiles, 'Minecraft Launcher', 'runtime'),
          label: 'runtime do Minecraft Launcher',
        }
      : undefined,
  ].filter((root): root is { path: string; label: string } => Boolean(root));
}

async function findJavaExecutables(root: string, maxDepth: number): Promise<string[]> {
  if (!root || maxDepth < 0 || !existsSync(root)) return [];

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const executables: string[] = [];

  const javaExecutable = path.join(root, process.platform === 'win32' ? 'java.exe' : 'java');

  if (existsSync(javaExecutable)) {
    executables.push(javaExecutable);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const childPath = path.join(root, entry.name);
    executables.push(...(await findJavaExecutables(childPath, maxDepth - 1)));
  }

  return executables;
}

function normalizeJavaExecutable(candidatePath?: string) {
  const value = candidatePath?.trim();

  if (!value) return undefined;

  const executableName = process.platform === 'win32' ? 'java.exe' : 'java';

  if (value === 'java') return value;

  if (existsSync(value) && !value.toLowerCase().endsWith(executableName)) {
    const javaFromHome = path.join(value, 'bin', executableName);

    if (existsSync(javaFromHome)) {
      return javaFromHome;
    }
  }

  return value;
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

async function ensureVulkanSetup(
  mcVersionId: string,
  minecraftRoot: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const fabricVersionId = await ensureFabricVersion(mcVersionId, minecraftRoot, onProgress);
  await ensureVulkanMod(mcVersionId, minecraftRoot, onProgress);
  return fabricVersionId;
}

async function ensureFabricVersion(
  mcVersionId: string,
  minecraftRoot: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const existing = await findFabricVersionId(mcVersionId, minecraftRoot);
  if (existing) return existing;

  onProgress?.({ phase: 'mods', status: 'Baixando Fabric Loader...', percentage: 0, versionId: mcVersionId });

  const metaResponse = await fetch(
    `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mcVersionId)}?limit=1`,
    { headers: { 'User-Agent': 'RodLauncher/1.0' } },
  );

  if (!metaResponse.ok) {
    throw new Error(`Fabric nao disponivel para Minecraft ${mcVersionId} (${metaResponse.status}).`);
  }

  const loaders = (await metaResponse.json()) as Array<{ loader: { version: string } }>;

  if (!loaders.length) {
    throw new Error(`Nenhum Fabric Loader disponivel para Minecraft ${mcVersionId}.`);
  }

  const loaderVersion = loaders[0].loader.version;

  const profileResponse = await fetch(
    `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mcVersionId)}/${encodeURIComponent(loaderVersion)}/profile/json`,
    { headers: { 'User-Agent': 'RodLauncher/1.0' } },
  );

  if (!profileResponse.ok) {
    throw new Error(`Falha ao baixar perfil do Fabric (${profileResponse.status}).`);
  }

  const profile = (await profileResponse.json()) as {
    id: string;
    libraries: Array<{ name: string; url: string; sha1?: string; size?: number }>;
  };

  const fabricVersionId = profile.id;
  const versionDir = path.join(minecraftRoot, 'versions', fabricVersionId);
  await mkdir(versionDir, { recursive: true });
  await writeFile(path.join(versionDir, `${fabricVersionId}.json`), JSON.stringify(profile));

  const libraryItems: DownloadItem[] = profile.libraries.map((lib) => {
    const libPath = mavenNameToPath(lib.name);
    const baseUrl = lib.url.endsWith('/') ? lib.url : `${lib.url}/`;
    return {
      destination: path.join(minecraftRoot, 'libraries', libPath),
      label: lib.name,
      sha1: lib.sha1,
      size: lib.size,
      urls: uniqueUrls([baseUrl + libPath, `${OFFICIAL_LIBRARY_HOST}/${libPath}`]),
    };
  });

  await downloadMany(libraryItems, {
    basePercentage: 10,
    spanPercentage: 90,
    phase: 'mods',
    status: 'Baixando bibliotecas do Fabric...',
    versionId: mcVersionId,
    onProgress,
  });

  onProgress?.({ phase: 'mods', status: `Fabric ${loaderVersion} instalado.`, percentage: 100, versionId: mcVersionId });

  return fabricVersionId;
}

async function findFabricVersionId(mcVersionId: string, minecraftRoot: string): Promise<string | undefined> {
  const versionsDir = path.join(minecraftRoot, 'versions');
  const entries = await readdir(versionsDir).catch(() => [] as string[]);

  for (const entry of entries) {
    if (!entry.toLowerCase().includes('fabric')) continue;
    if (!entry.includes(mcVersionId)) continue;
    if (existsSync(path.join(versionsDir, entry, `${entry}.json`))) return entry;
  }

  return undefined;
}

async function ensureVulkanMod(
  mcVersionId: string,
  minecraftRoot: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const modsDir = path.join(minecraftRoot, 'mods');
  const entries = await readdir(modsDir).catch(() => [] as string[]);
  const alreadyInstalled = entries.some((e) => /vulkan/i.test(e) && e.endsWith('.jar'));

  if (alreadyInstalled) return;

  onProgress?.({ phase: 'mods', status: 'Baixando VulkanMod...', percentage: 0, versionId: mcVersionId });

  const query = new URLSearchParams({
    game_versions: JSON.stringify([mcVersionId]),
    loaders: JSON.stringify(['fabric']),
  });

  const response = await fetch(
    `https://api.modrinth.com/v2/project/vulkanmod/version?${query}`,
    { headers: { 'User-Agent': 'RodLauncher/1.0' } },
  );

  if (!response.ok) {
    throw new Error(`Nao foi possivel buscar VulkanMod na Modrinth (${response.status}).`);
  }

  const versions = (await response.json()) as Array<{
    files: Array<{ url: string; filename: string; primary: boolean }>;
  }>;

  if (!versions.length) {
    throw new Error(`VulkanMod ainda nao suporta Minecraft ${mcVersionId}. Veja: https://modrinth.com/mod/vulkanmod`);
  }

  const file = versions[0].files.find((f) => f.primary) ?? versions[0].files[0];

  await mkdir(modsDir, { recursive: true });
  await downloadFile(
    { destination: path.join(modsDir, file.filename), label: 'VulkanMod', urls: [file.url] },
    () => undefined,
  );

  onProgress?.({ phase: 'mods', status: 'VulkanMod baixado.', percentage: 100, versionId: mcVersionId });
}

function mavenNameToPath(name: string): string {
  const [group, artifact, version] = name.split(':');
  const groupPath = group.replace(/\./g, '/');
  return `${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
