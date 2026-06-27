"use client";

import { useMemo, useState } from "react";
import { Generator } from "@/components/Generator";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="max-w-6xl mx-auto px-5 pb-24 pt-6 md:pt-10">
        <Generator />
      </section>
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="max-w-6xl mx-auto px-5 pt-10 pb-4">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-dim mb-2">
            wfrz.eu · open source
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Aikar Flags
            <span className="text-brand">.</span>
            <span className="text-dim text-2xl md:text-3xl ml-3 font-bold">
              Minecraft JVM tuner
            </span>
          </h1>
          <p className="text-dim mt-3 max-w-2xl">
            Pick a server type, RAM and Java version. Get tuned JVM flags, a
            ready-to-import Pterodactyl egg, a docker run command and a systemd
            unit — copy and ship. Up to date for <span className="text-brand font-semibold">Minecraft 26.2</span> + <span className="text-brand font-semibold">Java 25 LTS</span> (Mojang switched to year-based versioning in 2026 — after 1.21.11 came 26.1).
          </p>
        </div>
        <a
          href="https://github.com/WhiteFreezing/aikar-flags"
          target="_blank"
          rel="noopener"
          className="btn"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          GitHub
        </a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/70 py-8 text-sm text-dim">
      <div className="max-w-6xl mx-auto px-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          Built with the same{" "}
          <a
            href="https://github.com/WhiteFreezing/Dockers"
            target="_blank"
            rel="noopener"
            className="text-brand hover:underline"
          >
            whitefreezing/Dockers
          </a>{" "}
          images this tool recommends. Free, no tracking, runs entirely in your
          browser.
        </div>
        <div>
          flags adapted from{" "}
          <a
            href="https://docs.papermc.io/paper/aikars-flags"
            target="_blank"
            rel="noopener"
            className="hover:text-text"
          >
            PaperMC docs
          </a>
        </div>
      </div>
    </footer>
  );
}
