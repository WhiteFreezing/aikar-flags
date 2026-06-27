"use client";

import { useEffect, useMemo, useState } from "react";
import {
  generate, dockerCompose, dockerRun, ghcrImage, pterodactylEgg, systemdUnit,
  requiredJava,
  type CpuTier, type CpuVendor, type GcChoice, type Input, type ServerType, type Vendor,
} from "@/lib/flags";

const SERVER_TYPES: { id: ServerType; label: string; jar: string }[] = [
  { id: "paper",     label: "Paper",     jar: "paper.jar" },
  { id: "purpur",    label: "Purpur",    jar: "purpur.jar" },
  { id: "vanilla",   label: "Vanilla",   jar: "server.jar" },
  { id: "fabric",    label: "Fabric",    jar: "fabric-server-launch.jar" },
  { id: "forge",     label: "Forge",     jar: "server.jar" },
  { id: "neoforge",  label: "NeoForge",  jar: "server.jar" },
  { id: "velocity",  label: "Velocity",  jar: "velocity.jar" },
  { id: "waterfall", label: "Waterfall", jar: "waterfall.jar" },
];

const VENDORS: { id: Vendor; label: string; note: string }[] = [
  { id: "adoptium",   label: "Adoptium Temurin",  note: "Most popular, TCK-certified" },
  { id: "zulu",       label: "Azul Zulu",         note: "Long LTS support" },
  { id: "graalvm",    label: "GraalVM CE",        note: "Faster JIT" },
  { id: "semeru",     label: "IBM Semeru OpenJ9", note: "Lower memory" },
  { id: "liberica",   label: "BellSoft Liberica", note: "Wide arch support" },
  { id: "corretto",   label: "Amazon Corretto",   note: "AWS hardened" },
  { id: "microsoft",  label: "Microsoft OpenJDK", note: "Azure tuned" },
  { id: "sapmachine", label: "SAP Machine",       note: "Enterprise" },
];

// Real Mojang release versions (piston-meta version_manifest_v2).
// Mojang switched to year-based versioning in 2026 — after 1.21.11 comes 26.1.
const MC_VERSIONS = [
  // Year-based (Java 25 baseline)
  "26.2", "26.1",
  // 1.21.x line — Java 21 baseline
  "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6",
  "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  // 1.20.x — Java 17 (up to 1.20.4) or Java 21 (1.20.5+)
  "1.20.6", "1.20.5", "1.20.4", "1.20.2", "1.20.1",
  // Legacy
  "1.19.4", "1.19.2",
  "1.18.2",
  "1.17.1",
  "1.16.5",
  "1.12.2",
  "1.8.9",
];

// Java 25 is the current LTS (Sept 2025). Order matters — 25 first = default.
const JAVA_VERSIONS = [25, 24, 23, 21, 17, 11, 8];

const CPU_TIERS: { id: CpuTier; label: string; sub: string }[] = [
  { id: "small",       label: "Low-end / VPS",   sub: "1–4 cores" },
  { id: "consumer",    label: "Consumer desktop", sub: "5–12 cores" },
  { id: "workstation", label: "Workstation",     sub: "13–32 cores · Ryzen 9 / i9" },
  { id: "server",      label: "Server / HEDT",   sub: "33+ cores · Threadripper, Epyc, Xeon" },
];

const GC_OPTIONS: { id: GcChoice; label: string }[] = [
  { id: "auto",       label: "Auto (recommended)" },
  { id: "g1",         label: "G1GC" },
  { id: "zgc",        label: "ZGC" },
  { id: "shenandoah", label: "Shenandoah" },
  { id: "openj9",     label: "OpenJ9 GenCon" },
];

export function Generator() {
  const [serverType, setServerType] = useState<ServerType>("paper");
  const [memMB, setMemMB]   = useState(4096);
  const [javaVer, setJava]  = useState(25);                 // current LTS
  const [vendor, setVendor] = useState<Vendor>("adoptium");
  const [cpuTier, setCpuTier] = useState<CpuTier>("consumer");
  const [cpuVendor, setCpuVendor] = useState<CpuVendor>("amd");
  const [cores, setCores]    = useState(16);
  const [mcVersion, setMc]   = useState("26.2");            // current Mojang release
  const [gc, setGc]          = useState<GcChoice>("auto");
  const [jarFile, setJarFile] = useState("paper.jar");
  const [tab, setTab] = useState<"startup" | "egg" | "docker" | "compose" | "systemd">("startup");

  // Detect CPU on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      const n = navigator.hardwareConcurrency;
      setCores(n);
      if (n <= 4) setCpuTier("small");
      else if (n <= 12) setCpuTier("consumer");
      else if (n <= 32) setCpuTier("workstation");
      else setCpuTier("server");
    }
  }, []);

  // Update jarFile default when server type changes
  useEffect(() => {
    const def = SERVER_TYPES.find((s) => s.id === serverType)?.jar;
    if (def) setJarFile(def);
  }, [serverType]);

  // Auto-bump Java if MC needs higher
  useEffect(() => {
    const need = requiredJava(mcVersion);
    if (javaVer < need) setJava(need);
  }, [mcVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const input: Input = useMemo(
    () => ({ serverType, memMB, javaVer, vendor, cpuTier, cpuVendor, cores, mcVersion, gc, jarFile }),
    [serverType, memMB, javaVer, vendor, cpuTier, cpuVendor, cores, mcVersion, gc, jarFile],
  );
  const out = useMemo(() => generate(input), [input]);

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      {/* ── Left: form ──────────────────────────────────────────────── */}
      <div className="card p-5 lg:sticky lg:top-5 self-start">
        <SectionLabel>Server</SectionLabel>
        <ChipRow>
          {SERVER_TYPES.map((s) => (
            <Chip key={s.id} on={serverType === s.id} onClick={() => setServerType(s.id)}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>

        <SectionLabel className="mt-5">
          Memory <span className="text-brand font-mono">{prettyMem(memMB)}</span>
        </SectionLabel>
        <input
          type="range" min={512} max={131072} step={memMB < 8192 ? 256 : 1024}
          value={memMB} onChange={(e) => setMemMB(parseInt(e.target.value, 10))}
          className="w-full accent-brand cursor-pointer"
        />
        <div className="text-xs text-dim flex justify-between mt-1">
          <span>512 MB</span><span>128 GB</span>
        </div>

        <SectionLabel className="mt-5">Minecraft version</SectionLabel>
        <select value={mcVersion} onChange={(e) => setMc(e.target.value)} className="input">
          {MC_VERSIONS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <SectionLabel className="mt-5">Java version <span className="text-dim/70 normal-case font-normal">(25 = LTS)</span></SectionLabel>
        <ChipRow>
          {JAVA_VERSIONS.map((v) => (
            <Chip key={v} on={javaVer === v} onClick={() => setJava(v)} title={
              v === 25 ? "LTS — required by MC 26.x. Compact object headers GA, ZGC-Gen only." :
              v === 24 ? "non-LTS — ZGC generational became the default here." :
              v === 23 ? "non-LTS" :
              v === 21 ? "LTS — required by MC 1.20.5 – 1.21.11. ZGC-Gen opt-in." :
              v === 17 ? "LTS — required by MC 1.18 – 1.20.4." :
              v === 11 ? "LTS — required by MC 1.17." :
              v === 8  ? "LTS — legacy MC 1.16 and older." : undefined
            }>
              {v}
            </Chip>
          ))}
        </ChipRow>

        <SectionLabel className="mt-5">JVM vendor</SectionLabel>
        <select value={vendor} onChange={(e) => setVendor(e.target.value as Vendor)} className="input">
          {VENDORS.map((v) => (
            <option key={v.id} value={v.id}>{v.label} — {v.note}</option>
          ))}
        </select>

        <SectionLabel className="mt-5">CPU tier</SectionLabel>
        <ChipRow>
          {CPU_TIERS.map((t) => (
            <Chip key={t.id} on={cpuTier === t.id} onClick={() => setCpuTier(t.id)} title={t.sub}>
              {t.label}
            </Chip>
          ))}
        </ChipRow>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-dim">Cores</span>
            <input type="number" min={1} max={256} value={cores}
              onChange={(e) => setCores(parseInt(e.target.value || "1", 10))}
              className="input !py-1" />
          </label>
          <select value={cpuVendor} onChange={(e) => setCpuVendor(e.target.value as CpuVendor)} className="input">
            <option value="amd">AMD</option>
            <option value="intel">Intel</option>
            <option value="arm">ARM</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <SectionLabel className="mt-5">GC strategy</SectionLabel>
        <select value={gc} onChange={(e) => setGc(e.target.value as GcChoice)} className="input">
          {GC_OPTIONS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>

        <SectionLabel className="mt-5">Server jar filename</SectionLabel>
        <input
          type="text" value={jarFile} onChange={(e) => setJarFile(e.target.value)}
          className="input font-mono" placeholder="server.jar"
        />
      </div>

      {/* ── Right: output ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Status bar */}
        <div className="card p-4 flex items-center gap-4 flex-wrap">
          <Badge tone="brand">{out.gcUsed} GC</Badge>
          <Badge>{prettyMem(memMB)} heap</Badge>
          <Badge>Java {javaVer}</Badge>
          <Badge>{cores} cores</Badge>
          <code className="ml-auto text-xs text-dim font-mono truncate max-w-[55%]" title={ghcrImage(vendor, javaVer)}>
            {ghcrImage(vendor, javaVer)}
          </code>
        </div>

        {/* Warnings */}
        {out.warnings.length > 0 && (
          <div className="card p-4 border-red-500/40 bg-red-500/5">
            <div className="text-sm font-semibold text-red-400 mb-2">⚠ Warnings</div>
            <ul className="space-y-1 text-sm">
              {out.warnings.map((w, i) => <li key={i} className="text-red-200/90">• {w}</li>)}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-border/70 overflow-x-auto">
            <TabBtn id="startup"  cur={tab} setTab={setTab}>STARTUP line</TabBtn>
            <TabBtn id="egg"      cur={tab} setTab={setTab}>Pterodactyl egg</TabBtn>
            <TabBtn id="docker"   cur={tab} setTab={setTab}>docker run</TabBtn>
            <TabBtn id="compose"  cur={tab} setTab={setTab}>docker compose</TabBtn>
            <TabBtn id="systemd"  cur={tab} setTab={setTab}>systemd unit</TabBtn>
          </div>
          <CodeBlock
            text={
              tab === "startup" ? out.startup
              : tab === "egg" ? pterodactylEgg(input, out)
              : tab === "docker" ? dockerRun(input, out)
              : tab === "compose" ? dockerCompose(input, out)
              : systemdUnit(input, out)
            }
          />
        </div>

        {/* Notes */}
        {out.notes.length > 0 && (
          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Why these flags</div>
            <ul className="space-y-1 text-sm text-dim">
              {out.notes.map((n, i) => <li key={i}>· {n}</li>)}
            </ul>
          </div>
        )}

        {/* Flag breakdown */}
        <div className="card p-4">
          <div className="text-sm font-semibold mb-2">All flags ({out.flags.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {out.flags.map((f, i) => (
              <code key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono">
                {f}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── small components ────────────────────────────────────────────────────

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-xs uppercase tracking-wider text-dim mb-2 ${className}`}>{children}</div>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={`chip cursor-pointer ${on ? "chip-on" : ""}`}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" }) {
  const cls = tone === "brand"
    ? "bg-brand text-black"
    : "bg-muted text-text border border-border";
  return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}>{children}</span>;
}

function TabBtn({ id, cur, setTab, children }: { id: any; cur: string; setTab: (id: any) => void; children: React.ReactNode }) {
  const active = cur === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
        active ? "border-brand text-text" : "border-transparent text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="absolute top-3 right-3 z-10 btn-brand text-xs"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="p-5 pr-24 text-sm overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed bg-muted/40 max-h-[60vh] overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

function prettyMem(mb: number): string {
  if (mb >= 1024) {
    const g = mb / 1024;
    return g % 1 === 0 ? `${g} GB` : `${g.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}
