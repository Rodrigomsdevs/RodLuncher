import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const assetPath = (asset: string) => path.resolve(projectRoot, asset);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'RodLauncher',
    name: 'RodLauncher',
    appVersion: '0.1.0',

    // Electron usa automaticamente:
    // macOS: icon.icns
    // Windows: icon.ico
    // Linux: icon.png
    icon: assetPath('src/renderer/assets/icon'),
  },

  rebuildConfig: {},

  makers: [
    // Windows .exe
    new MakerSquirrel({
      name: 'RodLauncher',
      setupExe: 'RodLauncher-Setup.exe',
      setupIcon: assetPath('src/renderer/assets/icon.ico'),
      loadingGif: assetPath('src/renderer/assets/installer-loading.gif'),
      noMsi: true,
    }),

    // macOS .zip e Windows .zip
    new MakerZIP({}, ['darwin', 'win32']),

    // macOS .dmg
    new MakerDMG(
      {
        name: 'RodLauncher',
        icon: assetPath('src/renderer/assets/icon.icns'),
        format: 'ULFO',
      },
      ['darwin']
    ),

    // Linux .rpm
    new MakerRpm({
      options: {
        name: 'rodlauncher',
        productName: 'RodLauncher',
        bin: 'RodLauncher',
        icon: 'src/renderer/assets/icon.png',
        categories: ['Game'],
      },
    }),

    // Linux .deb
    new MakerDeb({
      options: {
        name: 'rodlauncher',
        productName: 'RodLauncher',
        bin: 'RodLauncher',
        icon: 'src/renderer/assets/icon.png',
        categories: ['Game'],
      },
    }),
  ],

  plugins: [
    new AutoUnpackNativesPlugin({}),

    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/main/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],

      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;