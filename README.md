# Aikar Flags Generator — aikar.wfrz.eu

JVM flags, Pterodactyl egg JSON, docker run + docker-compose snippets and a
systemd unit for any Minecraft server. Pure-browser, no backend.

## Inputs

- **Server type** — Paper / Purpur / Velocity / Waterfall / Fabric / Forge /
  NeoForge / Vanilla
- **Memory** — 512 MB → 128 GB slider
- **MC version** — auto-bumps required Java if you pick an old version
- **Java version** — 8, 11, 17, 21, 23, 24, 25
- **JVM vendor** — Adoptium · Zulu · GraalVM · Semeru (OpenJ9) · Liberica ·
  Corretto · Microsoft · SapMachine
- **CPU tier + cores + vendor (AMD / Intel / ARM)** — drives parallel GC
  threads and AVX caps on Zen 4 quirks
- **GC strategy** — Auto picks G1 / ZGC-Gen / Shenandoah / OpenJ9 based on
  heap size & Java version. Override per environment.

## Outputs

- **STARTUP line** — single-line argv ready for Pterodactyl
- **Pterodactyl egg JSON** — full importable egg using
  `ghcr.io/whitefreezing/java:<vendor>-<version>`
- **docker run** — single command
- **docker compose** — drop-in service definition
- **systemd unit** — for bare metal / VPS hosting under `screen`

## Smart logic beyond stock Aikar

- ≥ 24 GB heap + Java 21 → **Generational ZGC** (sub-ms pauses at 64 GB+)
- ≥ 32 GB heap + Java 17 → **Shenandoah generational**
- Semeru vendor → **OpenJ9 GenCon** with `-Xshareclasses -Xquickstart`
- ≥ 16 cores (Ryzen 9 / Threadripper / Epyc) → tuned `ParallelGCThreads` +
  `ConcGCThreads`
- AMD Zen 4 + Java < 21 → `-XX:UseAVX=2` (legacy crash workaround)
- Linux servers → `UseTransparentHugePages` + `UseStringDeduplication` on
  Java 17+
- GraalVM → `SpeculativeGuardMovement` JIT hint

## Tech

- Next.js 15 (static export, output: 'export')
- React 19
- Tailwind 3
- Zero JS deps for the flag logic (`lib/flags.ts` is pure TypeScript)

## Build

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm build   # → ./out static HTML
```

Deploy `out/` to any static host (Cloudflare Pages, Vercel, GitHub Pages,
nginx). Production deployment lives at <https://aikar.wfrz.eu>, served from a
Raspberry Pi behind Cloudflare.

## Why

Aikar's flags were canonical for years but assume HotSpot G1 only and
small-to-medium heaps. Modern Java 21 + ZGC, 64-core EPYC servers and 128 GB
heaps need different tuning — this picks the right collector and per-CPU
thread counts automatically.

## License

MIT.
