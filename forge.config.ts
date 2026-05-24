import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'RodLauncher',
    name: 'RodLauncher',
    appVersion: '0.1.0',
    icon: 'src/renderer/assets/icon.png',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'RodLauncher',
      setupExe: 'RodLauncher-Setup.exe',
      setupIcon: 'src/renderer/assets/icon.ico',
      noMsi: true,
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({
      options: {
        name: 'rodlauncher',
        productName: 'RodLauncher',
        bin: 'RodLauncher',
        icon: 'src/renderer/assets/icon.png',
        categories: ['Game'],
      },
    }),
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
