import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const EVENTS_DEMO_FPS = 30;
// Scenes:
// S1 0-4s   Painel Redes Sociais -> clique em "Eventos"
// S2 4-9s   Lista de eventos sincronizados do IG (instagram_manage_events)
// S3 9-15s  Detalhe de um evento (RSVPs, alcance, interações)
// S4 15-20s Criar/Atualizar evento e sincronizar de volta ao IG
// S5 20-24s Confirmação + permissões usadas
export const EVENTS_DEMO_TOTAL_FRAMES = 24 * EVENTS_DEMO_FPS;

const Cursor: React.FC<{ x: number; y: number; click?: number | null }> = ({ x, y, click }) => {
  const frame = useCurrentFrame();
  const ripple = click != null ? interpolate(frame - click, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const rippleOpacity = click != null ? interpolate(frame - click, [0, 25], [0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 9999 }}>
      {ripple > 0 && (
        <div style={{
          position: "absolute", left: -ripple * 40, top: -ripple * 40,
          width: ripple * 80, height: ripple * 80, borderRadius: "50%",
          border: "3px solid #E1306C", opacity: rippleOpacity,
        }} />
      )}
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }}>
        <path d="M5 3 L5 22 L10 18 L13 25 L16 24 L13 17 L20 17 Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

const useCursor = (waypoints: { f: number; x: number; y: number; click?: boolean }[]) => {
  const frame = useCurrentFrame();
  let prev = waypoints[0];
  let next = waypoints[0];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (frame >= waypoints[i].f && frame <= waypoints[i + 1].f) {
      prev = waypoints[i]; next = waypoints[i + 1]; break;
    }
    if (frame > waypoints[i + 1].f) { prev = waypoints[i + 1]; next = waypoints[i + 1]; }
  }
  const t = next.f === prev.f ? 1 : Math.min(1, Math.max(0, (frame - prev.f) / (next.f - prev.f)));
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const x = prev.x + (next.x - prev.x) * ease;
  const y = prev.y + (next.y - prev.y) * ease;
  const clickAt = waypoints.find((w) => w.click && Math.abs(frame - w.f) < 4)?.f ?? null;
  return { x, y, clickAt };
};

const BrowserChrome: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => (
  <div style={{ width: "100%", height: "100%", background: "#0e0e12", display: "flex", flexDirection: "column" }}>
    <div style={{ height: 56, background: "#1c1c22", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, borderBottom: "1px solid #2a2a32" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#28c840" }} />
      </div>
      <div style={{ flex: 1, marginLeft: 20, background: "#0e0e12", borderRadius: 8, padding: "8px 14px", color: "#8b8b95", fontSize: 14, fontFamily }}>
        🔒 {url}
      </div>
    </div>
    <div style={{ flex: 1, position: "relative", background: "#0a0a0e", overflow: "hidden" }}>{children}</div>
  </div>
);

const Sidebar: React.FC<{ active: "redes" | "eventos" }> = ({ active }) => (
  <div style={{ width: 240, background: "#13131a", height: "100%", padding: "24px 16px", borderRight: "1px solid #23232c", fontFamily, color: "#cfcfd6" }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Painel</div>
    {[
      { k: "redes", label: "Redes Sociais", icon: "🔗" },
      { k: "eventos", label: "Eventos do Instagram", icon: "📅" },
      { k: "x", label: "Relatórios", icon: "📊" },
      { k: "y", label: "Configurações", icon: "⚙️" },
    ].map((it) => (
      <div key={it.k} style={{
        padding: "12px 14px", borderRadius: 10, marginBottom: 6, fontSize: 15,
        background: active === it.k ? "#E1306C22" : "transparent",
        color: active === it.k ? "#fff" : "#9a9aa3",
        border: active === it.k ? "1px solid #E1306C55" : "1px solid transparent",
      }}>
        <span style={{ marginRight: 10 }}>{it.icon}</span>{it.label}
      </div>
    ))}
  </div>
);

const Title: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div style={{ padding: "28px 36px 8px 36px" }}>
    <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, fontFamily }}>{children}</div>
    {sub && <div style={{ color: "#8b8b95", fontSize: 15, marginTop: 6, fontFamily }}>{sub}</div>}
  </div>
);

// ---------- Scene 1: clicar em Eventos ----------
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1500, y: 700 },
    { f: 60, x: 180, y: 250, click: true },
    { f: 120, x: 180, y: 250 },
  ]);
  const highlight = interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais">
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ position: "relative" }}>
          <Sidebar active="redes" />
          <div style={{
            position: "absolute", left: 12, top: 86, width: 216, height: 46,
            border: `2px solid rgba(225,48,108,${highlight})`, borderRadius: 10, pointerEvents: "none",
            boxShadow: `0 0 ${highlight * 24}px rgba(225,48,108,${highlight * 0.6})`,
          }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title sub="Selecione um módulo para gerenciar">Redes Sociais conectadas</Title>
          <div style={{ padding: "24px 36px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {["Instagram Business", "Facebook Page"].map((n) => (
              <div key={n} style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 14, padding: 20, fontFamily }}>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>{n}</div>
                <div style={{ color: "#22c55e", fontSize: 13, marginTop: 6 }}>● Conectado</div>
                <div style={{ color: "#8b8b95", fontSize: 13, marginTop: 10 }}>@meunegocio.oficial</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 2: lista de eventos do IG ----------
const events = [
  { name: "Workshop de Fotografia", date: "28 Mai 2026 · 19:00", rsvps: 142, status: "Publicado" },
  { name: "Live: Tendências 2026", date: "02 Jun 2026 · 20:00", rsvps: 87, status: "Publicado" },
  { name: "Lançamento Coleção Inverno", date: "10 Jun 2026 · 18:30", rsvps: 311, status: "Rascunho" },
  { name: "Meet & Greet Loja Pinheiros", date: "15 Jun 2026 · 16:00", rsvps: 54, status: "Publicado" },
];

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 180, y: 250 },
    { f: 40, x: 900, y: 420 },
    { f: 110, x: 900, y: 520, click: true },
    { f: 150, x: 900, y: 520 },
  ]);
  return (
    <BrowserChrome url="painel.meuapp.com/eventos-instagram">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar active="eventos" />
        <div style={{ flex: 1 }}>
          <Title sub="Sincronizados via permissão instagram_manage_events">Eventos do Instagram</Title>
          <div style={{ padding: "20px 36px" }}>
            {events.map((e, i) => {
              const appear = spring({ frame: frame - 10 - i * 8, fps: 30, config: { damping: 18 } });
              return (
                <div key={e.name} style={{
                  opacity: appear, transform: `translateY(${(1 - appear) * 20}px)`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#15151c", border: "1px solid #25252e", borderRadius: 12,
                  padding: "16px 20px", marginBottom: 10, fontFamily,
                }}>
                  <div>
                    <div style={{ color: "#fff", fontSize: 17, fontWeight: 600 }}>{e.name}</div>
                    <div style={{ color: "#8b8b95", fontSize: 13, marginTop: 4 }}>{e.date}</div>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ color: "#E1306C", fontSize: 14, fontWeight: 600 }}>{e.rsvps} RSVPs</div>
                    <div style={{
                      fontSize: 12, padding: "4px 10px", borderRadius: 999,
                      background: e.status === "Publicado" ? "#16331f" : "#3a2f12",
                      color: e.status === "Publicado" ? "#4ade80" : "#fbbf24",
                    }}>{e.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 3: detalhe do evento ----------
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 900, y: 520 },
    { f: 60, x: 1100, y: 700 },
    { f: 140, x: 1620, y: 880, click: true },
    { f: 180, x: 1620, y: 880 },
  ]);
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  return (
    <BrowserChrome url="painel.meuapp.com/eventos-instagram/lancamento-colecao-inverno">
      <div style={{ display: "flex", height: "100%", opacity: fadeIn }}>
        <Sidebar active="eventos" />
        <div style={{ flex: 1, padding: "28px 36px", fontFamily }}>
          <div style={{ color: "#8b8b95", fontSize: 13 }}>← Eventos do Instagram</div>
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 700, marginTop: 10 }}>Live: Tendências 2026</div>
          <div style={{ color: "#8b8b95", fontSize: 15, marginTop: 6 }}>02 Jun 2026 · 20:00 · @meunegocio.oficial</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 22 }}>
            {[
              { l: "RSVPs", v: "87", c: "#E1306C" },
              { l: "Interessados", v: "243", c: "#8b5cf6" },
              { l: "Alcance", v: "12.4k", c: "#22c55e" },
              { l: "Comentários", v: "56", c: "#f59e0b" },
            ].map((m) => (
              <div key={m.l} style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 12, padding: 18 }}>
                <div style={{ color: "#8b8b95", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{m.l}</div>
                <div style={{ color: m.c, fontSize: 30, fontWeight: 700, marginTop: 6 }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, background: "#15151c", border: "1px solid #25252e", borderRadius: 12, padding: 20 }}>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Participantes confirmados</div>
            {["@ana.fotografia", "@marcos.creative", "@studio.luz", "@helena.makeup"].map((u, i) => {
              const appear = spring({ frame: frame - 30 - i * 6, fps: 30, config: { damping: 18 } });
              return (
                <div key={u} style={{ opacity: appear, display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #20202a" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,#E1306C,#833AB4)` }} />
                  <div style={{ color: "#cfcfd6", fontSize: 14 }}>{u}</div>
                  <div style={{ marginLeft: "auto", color: "#4ade80", fontSize: 12 }}>● confirmado</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22, gap: 12 }}>
            <button style={{ background: "transparent", color: "#cfcfd6", border: "1px solid #2c2c36", borderRadius: 10, padding: "12px 18px", fontFamily, fontSize: 14 }}>Editar</button>
            <button style={{ background: "linear-gradient(135deg,#E1306C,#833AB4)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontFamily, fontSize: 14, fontWeight: 600 }}>
              Sincronizar com Instagram
            </button>
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 4: sincronizando ----------
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [10, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <BrowserChrome url="painel.meuapp.com/eventos-instagram/sincronizar">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar active="eventos" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily }}>
          <div style={{ width: 180, height: 180, borderRadius: "50%", background: "conic-gradient(#E1306C " + progress * 360 + "deg, #23232c 0deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 150, height: 150, borderRadius: "50%", background: "#0a0a0e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 32, fontWeight: 700 }}>
              {Math.round(progress * 100)}%
            </div>
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 600, marginTop: 30 }}>
            Sincronizando evento com Instagram…
          </div>
          <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 8, maxWidth: 560, textAlign: "center" }}>
            Usando <span style={{ color: "#E1306C", fontWeight: 600 }}>instagram_manage_events</span> para criar / atualizar o evento na conta @meunegocio.oficial.
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
};

// ---------- Scene 5: sucesso ----------
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: 30, config: { damping: 12 } });
  return (
    <BrowserChrome url="painel.meuapp.com/eventos-instagram">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar active="eventos" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily, padding: 40 }}>
            <div style={{ transform: `scale(${pop})`, width: 110, height: 110, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 56, fontWeight: 700 }}>
              ✓
            </div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginTop: 22 }}>Evento sincronizado com sucesso</div>
            <div style={{ color: "#8b8b95", fontSize: 15, marginTop: 8, textAlign: "center", maxWidth: 620 }}>
              Os dados de RSVPs, alcance e participantes serão atualizados automaticamente a partir do Instagram.
            </div>
            <div style={{
              marginTop: 30, background: "#15151c", border: "1px solid #25252e", borderRadius: 14,
              padding: 22, width: 680,
            }}>
              <div style={{ color: "#8b8b95", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Permissões da Meta utilizadas</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {["instagram_manage_events", "instagram_business_basic", "pages_show_list"].map((p) => (
                  <div key={p} style={{ background: "#E1306C22", color: "#E1306C", border: "1px solid #E1306C55", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontFamily }}>{p}</div>
                ))}
              </div>
            </div>
        </div>
      </div>
    </BrowserChrome>
  );
};

const S1 = { from: 0, dur: 4 * EVENTS_DEMO_FPS };
const S2 = { from: S1.from + S1.dur, dur: 5 * EVENTS_DEMO_FPS };
const S3 = { from: S2.from + S2.dur, dur: 6 * EVENTS_DEMO_FPS };
const S4 = { from: S3.from + S3.dur, dur: 5 * EVENTS_DEMO_FPS };
const S5 = { from: S4.from + S4.dur, dur: 4 * EVENTS_DEMO_FPS };

const SceneSlot: React.FC<{ from: number; dur: number; children: React.ReactNode }> = ({ from, dur, children }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= from + dur) return null;
  // Render with relative frame using a wrapper component
  return <RelativeFrame from={from}>{children}</RelativeFrame>;
};

const RelativeFrame: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => {
  // Use Remotion Sequence semantics via a context trick: simplest is to render inside a Sequence
  return <SeqWrap from={from}>{children}</SeqWrap>;
};

import { Sequence } from "remotion";
const SeqWrap: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => (
  <Sequence from={from}>{children}</Sequence>
);

export const EventsReviewDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      <Sequence from={S1.from} durationInFrames={S1.dur}><Scene1 /></Sequence>
      <Sequence from={S2.from} durationInFrames={S2.dur}><Scene2 /></Sequence>
      <Sequence from={S3.from} durationInFrames={S3.dur}><Scene3 /></Sequence>
      <Sequence from={S4.from} durationInFrames={S4.dur}><Scene4 /></Sequence>
      <Sequence from={S5.from} durationInFrames={S5.dur}><Scene5 /></Sequence>
    </AbsoluteFill>
  );
};
