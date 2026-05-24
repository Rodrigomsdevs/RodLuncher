# RodLauncher

![Electron](https://img.shields.io/badge/Electron-modern-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=111)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Minecraft](https://img.shields.io/badge/Minecraft-Java-5A9E4B?style=for-the-badge)

**RodLauncher** e um launcher desktop moderno para Minecraft Java, criado com Electron, React, TypeScript e Tailwind CSS 4. Ele lista versoes oficiais da Mojang, prepara uma instancia local isolada, mostra preview 3D de skin e oferece uma interface premium inspirada no visual do Minecraft.

> Projeto educacional e experimental. O RodLauncher nao redistribui arquivos do Minecraft e nao contorna autenticacao, licencas ou termos da Mojang/Microsoft. A implementacao atual inicia o jogo em modo demo/local. Para uso completo em producao, integre autenticacao oficial Microsoft/Minecraft.

## Preview

Adicione aqui um screenshot do app depois de rodar:

```md
![RodLauncher preview](./docs/preview.png)
```

## Recursos

- Interface Electron sem borda com titlebar customizada.
- React + TypeScript no renderer.
- Tailwind CSS 4 via plugin oficial do Vite.
- Listagem de versoes pelo manifesto oficial da Mojang.
- Filtro de releases e snapshots.
- Indicador de versao instalada localmente.
- Instalacao de client, assets e bibliotecas com `@xmcl/installer`.
- Launch com `@xmcl/core` em modo demo/local.
- Preview 3D interativo com `skinview3d`.
- Upload de skin PNG local com atualizacao instantanea.
- Barra de progresso via IPC entre main process e renderer.
- Tratamento de erros para nick invalido, falha de rede e Java ausente.

## Stack

- Electron Forge
- Vite
- React
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide React
- skinview3d
- `@xmcl/installer`
- `@xmcl/core`

## Estrutura

```text
rodlauncher/
├── forge.config.ts
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── tailwind.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── preload.ts
│   │   └── minecraft.ts
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── components/
│   │   ├── styles/
│   │   └── assets/
│   └── shared/
│       └── types.ts
└── README.md
```

## Requisitos

- Node.js 20+
- npm 10+
- Java 17+ no PATH

Caso o Java nao esteja no PATH, crie um `.env` baseado no `.env.example` ou defina a variavel antes de iniciar:

```bash
RODLAUNCHER_JAVA="C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe"
```

Se voce ja tem versoes baixadas em outra pasta, informe essa pasta para o RodLauncher verificar antes de baixar de novo:

```bash
RODLAUNCHER_MINECRAFT_DIR="C:\Users\seu-usuario\AppData\Roaming\.minecraft"
```

## Instalar

```bash
npm install
```

## Rodar em desenvolvimento

```bash
npm start
```

## Build

```bash
npm run make
```

Os artefatos ficam em:

```text
out/
```

## Scripts

```bash
npm start       # abre o app em modo desenvolvimento
npm run make    # gera instalador/pacote
npm run package # empacota sem gerar instalador
npm run typecheck
npm run lint
```

## Como funciona

O renderer chama APIs seguras expostas pelo preload:

```ts
window.rodlauncher.listVersions();
window.rodlauncher.installVersion(versionId);
window.rodlauncher.launchGame({ username, versionId });
window.rodlauncher.onInstallProgress(callback);
```

O main process centraliza:

- busca do manifesto oficial da Mojang;
- verificacao da pasta local da instancia;
- instalacao com `@xmcl/installer`;
- launch com `@xmcl/core`;
- eventos de progresso enviados ao renderer.

## Pasta local do Minecraft

O RodLauncher usa uma instancia isolada dentro de `app.getPath("userData")` para saves/logs do app, mas verifica tambem a `.minecraft` oficial do sistema e a pasta opcional `RODLAUNCHER_MINECRAFT_DIR` antes de baixar uma versao.

## Fontes e APIs

- Manifesto oficial de versoes da Mojang:
  `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
- Documentacao do XMCL:
  `https://xmcl.app/en/core/`
- Skin fallback:
  `https://minotar.net/skin/Steve`

## Roadmap

- Integracao com autenticacao Microsoft/Minecraft.
- Seletor de memoria RAM.
- Multiplas instancias.
- Suporte a Fabric/Forge.
- Tela de logs.
- Gerenciamento de mods.
- Screenshot automatica para README.

## Aviso legal

Minecraft e uma marca da Mojang/Microsoft. Este projeto nao e afiliado, aprovado ou endossado pela Mojang Studios ou Microsoft. Use somente com arquivos oficiais e respeitando os termos do jogo.

## Licenca

MIT.
