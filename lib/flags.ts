// Pure flag generator — no DOM, runs in browser. Adds modern tuning beyond
// the original Aikar set: ZGC + Shenandoah for big heaps, OpenJ9 paradigm,
// Java 21 generational ZGC, transparent huge pages on big servers, Spigot-safe
// AVX defaults on AMD Zen 4/5.

export type ServerType = "paper" | "purpur" | "velocity" | "waterfall" | "fabric" | "forge" | "neoforge" | "vanilla";
export type Vendor    = "adoptium" | "graalvm" | "semeru" | "zulu" | "corretto" | "liberica" | "microsoft" | "sapmachine";
export type CpuTier   = "small" | "consumer" | "workstation" | "server";
export type CpuVendor = "intel" | "amd" | "arm" | "unknown";
export type GcChoice  = "auto" | "g1" | "zgc" | "shenandoah" | "openj9";

export interface Input {
  serverType: ServerType;
  memMB: number;
  javaVer: number;       // 8, 11, 17, 21, 23, 24, 25
  vendor: Vendor;
  cpuTier: CpuTier;
  cpuVendor: CpuVendor;
  cores: number;
  mcVersion: string;
  gc: GcChoice;
  jarFile: string;
}

export interface Output {
  flags: string[];
  startup: string;
  gcUsed: "G1" | "ZGC" | "ZGC-Gen" | "Shenandoah" | "OpenJ9-GenCon";
  notes: string[];
  warnings: string[];
}

/** Java version required by Minecraft version (verified against Mojang's
 *  piston-meta `javaVersion.majorVersion` field).
 *
 *  Mojang's baseline bumps:
 *    1.18      → Java 17
 *    1.20.5    → Java 21
 *    26.1      → Java 25  (year-based versioning started here)
 *
 *  After 1.21.11 (mid-2025), Mojang switched to year-based versioning:
 *  26.1, 26.2, … — these read as "first 2026 release", "second 2026 release".
 *  No leading "1." prefix. */
export function requiredJava(mc: string): number {
  if (!mc) return 25;

  // Year-based (2026+) — Mojang bumped the JVM baseline to Java 25.
  // Year prefix is any 2-digit number ≥ 26 (i.e. release year mod 100).
  const yearMatch = /^(\d{2})\.\d+/.exec(mc);
  if (yearMatch && parseInt(yearMatch[1], 10) >= 26) return 25;

  // Legacy 1.x.y line
  if (mc.startsWith("1.21")) return 21;
  if (mc.startsWith("1.20")) {
    const patch = parseInt(mc.split(".")[2] || "0", 10);
    return patch >= 5 ? 21 : 17;
  }
  if (mc.startsWith("1.19") || mc.startsWith("1.18")) return 17;
  if (mc.startsWith("1.17")) return 16;
  return 8;
}

export function pickGc(i: Input): Output["gcUsed"] {
  if (i.gc !== "auto") {
    if (i.gc === "g1") return "G1";
    if (i.gc === "zgc") return i.javaVer >= 21 ? "ZGC-Gen" : "ZGC";
    if (i.gc === "shenandoah") return "Shenandoah";
    if (i.gc === "openj9") return "OpenJ9-GenCon";
  }
  if (i.vendor === "semeru") return "OpenJ9-GenCon";
  // ≥24 GB heap on Java 21+ → ZGC generational (low pause, large heap friendly)
  if (i.memMB >= 24576 && i.javaVer >= 21) return "ZGC-Gen";
  // ≥32 GB on Java 17 without ZGC-Gen → Shenandoah (better than G1 at this size)
  if (i.memMB >= 32768 && i.javaVer >= 17) return "Shenandoah";
  return "G1";
}

export function generate(i: Input): Output {
  const flags: string[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];

  const heap = i.memMB;
  const huge = heap >= 12288;
  const xl = heap >= 32768;

  // Java version sanity vs MC
  const need = requiredJava(i.mcVersion);
  if (i.javaVer < need) {
    warnings.push(
      `Minecraft ${i.mcVersion} needs Java ${need}+. Selected Java ${i.javaVer} will not boot.`,
    );
  }
  // 8 GB+ on Java 8 — switch to Java 17/21 strongly recommended
  if (i.javaVer === 8 && heap >= 8192) {
    warnings.push("Java 8 with 8GB+ is wasteful — G1GC was finalized in 9. Use Java 17/21.");
  }

  const gc = pickGc(i);

  // Always set Xms = Xmx so heap allocates upfront → smoother pauses
  flags.push(`-Xms${heap}M`, `-Xmx${heap}M`);

  if (gc === "OpenJ9-GenCon") {
    flags.push(
      "-Xshareclasses",
      "-Xquickstart",
      "-Xtune:virtualized",
      "-Xgcpolicy:gencon",
      `-Xgcthreads${Math.max(2, Math.min(8, Math.floor(i.cores / 2)))}`,
    );
    notes.push("OpenJ9's GenCon collector handles small heaps with lower RSS than HotSpot G1.");
    notes.push("'-Xtune:virtualized' is fine on bare metal too — it just lowers idle CPU.");
  }

  else if (gc === "ZGC-Gen" || gc === "ZGC") {
    flags.push("-XX:+UseZGC");
    // ZGC timeline (verified against Oracle migrate docs):
    //   JDK 21 — JEP 439: generational ZGC opt-in via -XX:+ZGenerational
    //   JDK 23 — JEP 474: generational becomes DEFAULT; non-gen deprecated
    //   JDK 24 — JEP 490: non-generational mode REMOVED entirely
    // So we only emit the flag on 21 + 22 (where it's opt-in); on 23+ it's
    // redundant, and on 24+ it's a harmless legacy alias.
    if (gc === "ZGC-Gen" && i.javaVer >= 21 && i.javaVer < 23) {
      flags.push("-XX:+ZGenerational");
    }
    flags.push(
      "-XX:ZAllocationSpikeTolerance=5",
      "-XX:-ZUncommit", // keep memory mapped, no return-to-OS oscillation
      "-XX:+AlwaysPreTouch",
      "-XX:+DisableExplicitGC",
      "-XX:+ParallelRefProcEnabled",
    );
    if (xl) flags.push("-XX:ZCollectionInterval=120");

    // Compact Object Headers (JEP 450 experimental in JDK 24, JEP 519 Product
    // in JDK 25). Disabled by default in both — explicit opt-in always required.
    // JDK 24 also requires -XX:+UnlockExperimentalVMOptions before the flag.
    if (heap >= 8192) {
      if (i.javaVer >= 25) {
        flags.push("-XX:+UseCompactObjectHeaders");
        notes.push("JEP 519 (JDK 25 Product): -XX:+UseCompactObjectHeaders shrinks the object header from 96-128 bits to 64 bits — ~4 bytes saved per object on average. Real RAM win on entity-heavy modpacks.");
      } else if (i.javaVer === 24) {
        flags.push("-XX:+UnlockExperimentalVMOptions", "-XX:+UseCompactObjectHeaders");
        notes.push("JEP 450 (JDK 24 experimental): -XX:+UseCompactObjectHeaders ~4 bytes saved per object on average. Promoted to Product (JEP 519) in JDK 25.");
      }
    } else if (i.javaVer >= 24) {
      // ZAllocationSpikeTolerance lives in ExperimentalVMOptions on some builds
      flags.push("-XX:+UnlockExperimentalVMOptions");
    } else {
      flags.push("-XX:+UnlockExperimentalVMOptions");
    }

    notes.push(
      i.javaVer >= 24
        ? "Generational ZGC: only mode available since JDK 24 (JEP 490 removed the non-generational variant). No flag needed."
        : i.javaVer === 23
        ? "Generational ZGC: default in JDK 23 (JEP 474). Non-gen deprecated; still selectable but slated for removal in 24."
        : gc === "ZGC-Gen"
        ? "Generational ZGC: opt-in for JDK 21–22 via -XX:+ZGenerational (JEP 439). Sub-ms pauses even at 64 GB+."
        : "Single-gen ZGC. Upgrade to JDK 21+ for the generational variant — much better throughput.",
    );
  }

  else if (gc === "Shenandoah") {
    flags.push(
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+UseShenandoahGC",
      "-XX:ShenandoahGCMode=generational",
      "-XX:+AlwaysPreTouch",
      "-XX:+DisableExplicitGC",
      "-XX:+ParallelRefProcEnabled",
    );
    notes.push("Shenandoah generational mode: predictable sub-10ms pauses up to ~64 GB. Production-readiness varies per OpenJDK build — confirm with your runtime if uncertain.");
    if (i.vendor !== "adoptium" && i.vendor !== "liberica") {
      warnings.push("Shenandoah needs an OpenJDK build that ships it (Adoptium Temurin and BellSoft Liberica do; some Oracle-derived builds don't).");
    }
  }

  else {
    // G1GC — Aikar's flags + modern bracket-specific tuning
    flags.push(
      "-XX:+UseG1GC",
      "-XX:+ParallelRefProcEnabled",
      "-XX:MaxGCPauseMillis=200",
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+DisableExplicitGC",
      "-XX:+AlwaysPreTouch",
      `-XX:G1NewSizePercent=${huge ? 40 : 30}`,
      `-XX:G1MaxNewSizePercent=${huge ? 50 : 40}`,
      `-XX:G1HeapRegionSize=${huge ? "16M" : "8M"}`,
      `-XX:G1ReservePercent=${huge ? 15 : 20}`,
      "-XX:G1HeapWastePercent=5",
      "-XX:G1MixedGCCountTarget=4",
      `-XX:InitiatingHeapOccupancyPercent=${huge ? 20 : 15}`,
      "-XX:G1MixedGCLiveThresholdPercent=90",
      "-XX:G1RSetUpdatingPauseTimePercent=5",
      "-XX:SurvivorRatio=32",
      "-XX:+PerfDisableSharedMem",
      "-XX:MaxTenuringThreshold=1",
      "-Dusing.aikars.flags=https://mcflags.emc.gs",
      "-Daikars.new.flags=true",
    );
    notes.push(
      huge
        ? "Aikar's huge-heap variant: bigger young gen + 16M regions for less GC bookkeeping."
        : "Aikar's standard tuning for ≤12 GB heaps.",
    );
  }

  // Modern hardware tuning — Java 17+
  if (i.javaVer >= 17 && i.cpuTier !== "small") {
    flags.push(
      "-XX:+UseTransparentHugePages",
      "-XX:+UseStringDeduplication",
    );
    notes.push("UseTransparentHugePages cuts TLB misses on workloads >4GB. Linux only; harmless on Win/macOS.");
  }
  // Compact object headers — G1 and Shenandoah benefit too. We already emit
  // them for ZGC above; here we handle the non-ZGC collectors and don't
  // double-emit.
  if (heap >= 8192 && (gc === "G1" || gc === "Shenandoah")) {
    if (i.javaVer >= 25) {
      flags.push("-XX:+UseCompactObjectHeaders");
      notes.push("JEP 519 (JDK 25 Product): compact object headers shrink the object header (96-128b → 64b) — ~4 bytes saved per object on average. Works with G1, ZGC, Shenandoah and Parallel.");
    } else if (i.javaVer === 24) {
      flags.push("-XX:+UnlockExperimentalVMOptions", "-XX:+UseCompactObjectHeaders");
      notes.push("JEP 450 (JDK 24 experimental): compact object headers ~4 bytes saved per object on average. Promoted to Product in JDK 25.");
    }
  }

  // Tune GC parallelism for large CPU counts (Ryzen 9 / Threadripper / Epyc)
  if (i.cores >= 16 && gc !== "OpenJ9-GenCon") {
    const parallel = Math.min(Math.floor(i.cores * 0.75), 32);
    const conc     = Math.max(2, Math.min(Math.floor(i.cores / 4), 8));
    flags.push(`-XX:ParallelGCThreads=${parallel}`, `-XX:ConcGCThreads=${conc}`);
    notes.push(`Set ParallelGCThreads=${parallel} ConcGCThreads=${conc} for your ${i.cores}-core CPU.`);
  }

  // Vendor-specific
  if (i.vendor === "graalvm" && i.serverType !== "vanilla") {
    flags.push("-Dgraal.SpeculativeGuardMovement=true");
    notes.push("GraalVM JIT can be 5-15% faster on plugin-heavy servers but uses more RAM during warmup.");
  }

  // AMD Zen 4/5 — AVX-512 path occasionally causes Spigot/Bukkit crashes on
  // older Java releases. Java 21+ HotSpot is fine; older builds may want this:
  if (i.cpuVendor === "amd" && i.javaVer < 21 && (gc === "G1" || gc === "ZGC")) {
    flags.push("-XX:UseAVX=2");
    notes.push("Capped AVX=2 — older Java + AMD Zen 4 occasionally crashed with AVX-512 (fixed in JDK 21).");
  }

  // Networking / NIO — bind to all interfaces is implicit, set DNS cache short
  flags.push("-Dnetworkaddress.cache.ttl=30");

  // Compose final STARTUP
  const startup = `java ${flags.join(" ")} -jar ${i.jarFile} nogui`;

  return { flags, startup, gcUsed: gc, notes, warnings };
}

// ── Output helpers ────────────────────────────────────────────────────────

export function ghcrImage(vendor: Vendor, javaVer: number): string {
  const map: Record<Vendor, string> = {
    adoptium: "adoptium", corretto: "corretto", liberica: "liberica",
    zulu: "zulu", graalvm: "graalvm", semeru: "semeru",
    microsoft: "microsoft", sapmachine: "sapmachine",
  };
  return `ghcr.io/whitefreezing/java:${map[vendor]}-${javaVer}`;
}

export function pterodactylEgg(i: Input, out: Output): string {
  const egg = {
    _comment: "Generated by aikar.wfrz.eu",
    meta: { version: "PTDL_v2", update_url: null },
    exported_at: new Date().toISOString(),
    name: serverLabel(i.serverType),
    author: "aikar.wfrz.eu",
    description: `${serverLabel(i.serverType)} server tuned by aikar.wfrz.eu — ${out.gcUsed} GC, ${i.memMB} MB heap`,
    features: ["eula", "java_version", "pid_limit"],
    docker_images: {
      [ghcrImage(i.vendor, i.javaVer)]: ghcrImage(i.vendor, i.javaVer),
    },
    file_denylist: [],
    startup: `java ${out.flags.join(" ")} -jar {{SERVER_JARFILE}} nogui`,
    config: {
      files: '{}',
      startup: '{"done": ")! For help, type "}',
      logs: "{}",
      stop: "stop",
    },
    variables: [
      {
        name: "Server jar",
        description: "Server jar filename.",
        env_variable: "SERVER_JARFILE",
        default_value: i.jarFile,
        user_viewable: true,
        user_editable: true,
        rules: "required|string",
        field_type: "text",
      },
      {
        name: "EULA acceptance",
        description: "Must be 'true' to start.",
        env_variable: "EULA",
        default_value: "false",
        user_viewable: true,
        user_editable: true,
        rules: "required|in:true,false",
        field_type: "text",
      },
    ],
  };
  return JSON.stringify(egg, null, 4);
}

export function dockerRun(i: Input, out: Output): string {
  const img = ghcrImage(i.vendor, i.javaVer);
  return [
    `docker run -d \\`,
    `  --name minecraft \\`,
    `  --restart unless-stopped \\`,
    `  -p 25565:25565 \\`,
    `  -v $(pwd)/server:/home/container \\`,
    `  -e EULA=true \\`,
    `  -e SERVER_MEMORY=${i.memMB} \\`,
    `  -e SERVER_JARFILE=${i.jarFile} \\`,
    `  -e STARTUP="${out.startup.replaceAll('"', '\\"')}" \\`,
    `  ${img}`,
  ].join("\n");
}

export function dockerCompose(i: Input, out: Output): string {
  const img = ghcrImage(i.vendor, i.javaVer);
  return [
    `services:`,
    `  minecraft:`,
    `    image: ${img}`,
    `    container_name: minecraft`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "25565:25565"`,
    `    volumes:`,
    `      - ./server:/home/container`,
    `    environment:`,
    `      EULA: "true"`,
    `      SERVER_MEMORY: "${i.memMB}"`,
    `      SERVER_JARFILE: "${i.jarFile}"`,
    `      STARTUP: '${out.startup.replaceAll("'", "'\\''")}'`,
    `    stop_grace_period: 30s`,
  ].join("\n");
}

export function systemdUnit(i: Input, out: Output): string {
  return [
    `[Unit]`,
    `Description=Minecraft ${serverLabel(i.serverType)} server (${out.gcUsed} GC, ${i.memMB} MB)`,
    `After=network.target`,
    ``,
    `[Service]`,
    `Type=simple`,
    `User=minecraft`,
    `WorkingDirectory=/opt/minecraft`,
    `ExecStart=/usr/bin/screen -DmS mc ${out.startup}`,
    `ExecStop=/usr/bin/screen -p 0 -S mc -X eval 'stuff "stop"\\015'`,
    `Restart=on-failure`,
    `RestartSec=20s`,
    ``,
    `[Install]`,
    `WantedBy=multi-user.target`,
  ].join("\n");
}

function serverLabel(t: ServerType): string {
  return ({
    paper: "PaperMC", purpur: "PurpurMC", velocity: "Velocity",
    waterfall: "Waterfall", fabric: "Fabric", forge: "Forge",
    neoforge: "NeoForge", vanilla: "Vanilla",
  } as const)[t];
}
