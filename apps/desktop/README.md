# Fluxo Desktop

Electron desktop shell for Fluxo's local Mihomo configuration workbench.

The desktop app starts a local Fluxo API and Web UI, stores data under
`~/Library/Application Support/Fluxo`, and defaults to manual apply mode. It is
intended for building and exporting Mihomo YAML files, not for controlling a
system Mihomo service directly.

## Commands

```bash
pnpm desktop:dev
pnpm desktop:pack
pnpm desktop:dist
```

`desktop:pack` creates an unpacked macOS app at
`apps/desktop/release/mac-arm64/Fluxo.app`.

