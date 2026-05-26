import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const META_DEMO_FPS = 30;
export const META_DEMO_TOTAL_FRAMES = 27 * META_DEMO_FPS; // 27s

// Scene timings (frames)
const S1 = { from: 0, dur: 5 * META_DEMO_FPS };                       // 0–150  Painel "não conectado" + clique
const S2 = { from: S1.from + S1.dur, dur: 5 * META_DEMO_FPS };        // 150–300 Popup Meta: selecionar Página FB
const S3 = { from: S1.dur + S2.dur, dur: 5 * META_DEMO_FPS };         // 300–450 Selecionar conta IG Business
const S4 = { from: S1.dur + S2.dur + S3.dur, dur: 4 * META_DEMO_FPS };// 450–570 Tela de permissões
const S5 = { from: S1.dur + S2.dur + S3.dur + S4.dur, dur: 8 * META_DEMO_FPS }; // 570–810 Painel conectado mostrando perfil

// ---------- helpers ----------
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
          border: "3px solid #1877F2", opacity: rippleOpacity,
        }} />
      )}
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }}>
        <path d="M5 3 L5 22 L10 18 L13 25 L16 24 L13 17 L20 17 Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// Animated cursor that moves between waypoints
const useCursor = (waypoints: { f: number; x: number; y: number; click?: boolean }[]) => {
  const frame = useCurrentFrame();
  // find segment
  let prev = waypoints[0];
  let next = waypoints[0];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (frame >= waypoints[i].f && frame <= waypoints[i + 1].f) {
      prev = waypoints[i];
      next = waypoints[i + 1];
      break;
    }
    if (frame > waypoints[i + 1].f) {
      prev = waypoints[i + 1];
      next = waypoints[i + 1];
    }
  }
  const t = next.f === prev.f ? 1 : Math.min(1, Math.max(0, (frame - prev.f) / (next.f - prev.f)));
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const x = prev.x + (next.x - prev.x) * ease;
  const y = prev.y + (next.y - prev.y) * ease;
  const clickAt = waypoints.find((w) => w.click && Math.abs(frame - w.f) < 4)?.f ?? null;
  return { x, y, clickAt };
};

// ---------- Browser chrome ----------
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
    <div style={{ flex: 1, position: "relative", background: "#0a0a0e" }}>{children}</div>
  </div>
);

// ---------- Scene 1: Painel "não conectado" ----------
const Scene1Panel: React.FC = () => {
  const frame = useCurrentFrame();
  const wp = useCursor([
    { f: 0, x: 1700, y: 900 },
    { f: 90, x: 960, y: 680, click: true },
    { f: 150, x: 960, y: 680 },
  ]);
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  return (
    <BrowserChrome url="https://fotodeapoio.easychain.com.br/painel/redes-sociais">
      <div style={{ position: "absolute", inset: 0, padding: "40px 60px", fontFamily, color: "#fff", opacity: fadeIn }}>
        {/* Sidebar */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 240, background: "#13131a", borderRight: "1px solid #23232c", padding: "24px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 24, color: "#1877F2" }}>FotoDeApoio</div>
          {["Início", "Templates", "Leads", "WhatsApp"].map((s) => (
            <div key={s} style={{ padding: "10px 12px", color: "#7e7e88", fontSize: 14, marginBottom: 4 }}>{s}</div>
          ))}
          <div style={{ padding: "10px 12px", color: "#fff", fontSize: 14, marginBottom: 4, background: "#1877F2", borderRadius: 8 }}>Redes Sociais</div>
        </div>

        <div style={{ marginLeft: 280 }}>
          {/* Header card */}
          <div style={{ background: "linear-gradient(135deg, rgba(24,119,242,.18), rgba(214,41,118,.08))", border: "1px solid #23232c", borderRadius: 16, padding: 32, marginBottom: 28 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Redes Sociais</h1>
            <p style={{ color: "#9999a3", marginTop: 8, fontSize: 16, maxWidth: 600 }}>
              Conecte sua página do Facebook e seu Instagram profissional para liberar métricas e gestão de comentários com IA.
            </p>
            <span style={{ display: "inline-block", marginTop: 16, padding: "6px 12px", border: "1px solid #f59e0b", borderRadius: 999, color: "#f59e0b", fontSize: 13 }}>
              ⚠ Não conectado
            </span>
          </div>

          {/* Connection card */}
          <div style={{ background: "#13131a", border: "2px solid #23232c", borderRadius: 16, padding: 40, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: -8, marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #13131a", fontSize: 24 }}>📘</div>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #feda75, #d62976, #4f5bd5)", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #13131a", marginLeft: -12, fontSize: 24 }}>📷</div>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, margin: "12px 0 6px" }}>Conecte suas contas em um clique</h3>
            <p style={{ color: "#9999a3", fontSize: 14, marginBottom: 24 }}>Login oficial da Meta · não armazenamos sua senha</p>
            <button style={{
              background: "linear-gradient(90deg, #1877F2, #d62976)",
              color: "white", border: "none", padding: "14px 32px", borderRadius: 10, fontSize: 16, fontWeight: 600, fontFamily,
              boxShadow: "0 8px 24px rgba(24,119,242,.4)",
              transform: frame > 85 && frame < 100 ? "scale(0.97)" : "scale(1)",
              transition: "transform .1s",
            }}>
              📘  📷  Conectar Facebook e Instagram
            </button>
            <p style={{ color: "#666", fontSize: 12, marginTop: 18 }}>
              Permissões: <code>pages_show_list</code>, <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>instagram_manage_comments</code>
            </p>
          </div>
        </div>
      </div>
      <Cursor x={wp.x} y={wp.y} click={wp.clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 2: Popup Meta - Selecionar Página ----------
const MetaPopup: React.FC<{ title: string; subtitle: string; items: { name: string; sub: string; emoji: string; highlight?: boolean }[]; cursor: { x: number; y: number; clickAt: number | null }; buttonLabel?: string }> = ({ title, subtitle, items, cursor, buttonLabel = "Continuar" }) => {
  const frame = useCurrentFrame();
  const popupScale = spring({ frame, fps: META_DEMO_FPS, config: { damping: 18, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 540, background: "white", borderRadius: 12, overflow: "hidden", fontFamily,
        transform: `scale(${popupScale})`, boxShadow: "0 30px 80px rgba(0,0,0,.5)",
      }}>
        <div style={{ background: "#1877F2", color: "white", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
          <span style={{ fontSize: 22 }}>📘</span> Facebook
          <span style={{ marginLeft: "auto", opacity: .8, fontSize: 13 }}>fotodeapoio.easychain.com.br</span>
        </div>
        <div style={{ padding: 28, color: "#1c1e21" }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{title}</h2>
          <p style={{ color: "#65676b", fontSize: 14, marginTop: 6 }}>{subtitle}</p>
          <div style={{ marginTop: 20, border: "1px solid #dadde1", borderRadius: 8, overflow: "hidden" }}>
            {items.map((it, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                borderBottom: i < items.length - 1 ? "1px solid #f0f2f5" : "none",
                background: it.highlight ? "#e7f3ff" : "white",
              }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{it.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#050505" }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "#65676b" }}>{it.sub}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: "2px solid " + (it.highlight ? "#1877F2" : "#ccd0d5"),
                  background: it.highlight ? "#1877F2" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {it.highlight && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 10 }}>
            <button style={{ padding: "10px 18px", background: "#e4e6eb", color: "#050505", border: "none", borderRadius: 6, fontWeight: 600, fontFamily }}>Cancelar</button>
            <button style={{ padding: "10px 18px", background: "#1877F2", color: "white", border: "none", borderRadius: 6, fontWeight: 600, fontFamily }}>{buttonLabel}</button>
          </div>
        </div>
      </div>
      <Cursor x={cursor.x} y={cursor.y} click={cursor.clickAt} />
    </AbsoluteFill>
  );
};

const Scene2FBPage: React.FC = () => {
  // popup centered at (960, 540); list items roughly y=420..560
  const wp = useCursor([
    { f: 0, x: 960, y: 680 },
    { f: 30, x: 820, y: 470 },
    { f: 75, x: 820, y: 555, click: true },           // click "Campanha Vereador 2026"
    { f: 110, x: 1140, y: 660, click: true },          // click "Continuar"
    { f: 150, x: 1140, y: 660 },
  ]);
  return (
    <BrowserChrome url="https://www.facebook.com/v23.0/dialog/oauth">
      <div style={{ position: "absolute", inset: 0 }} />
      <MetaPopup
        title="Quais Páginas você quer usar com FotoDeApoio?"
        subtitle="Você pode selecionar a Página do Facebook conectada à sua conta profissional do Instagram."
        items={[
          { name: "Minha Página Pessoal", sub: "Página · 1.2 mil curtidas", emoji: "👤" },
          { name: "Campanha Vereador 2026", sub: "Página · 8.4 mil curtidas", emoji: "🗳", highlight: true },
          { name: "Loja Doces da Maria", sub: "Página · 540 curtidas", emoji: "🍰" },
        ]}
        cursor={wp}
      />
    </BrowserChrome>
  );
};

// ---------- Scene 3: Selecionar conta IG Business ----------
const Scene3IG: React.FC = () => {
  const wp = useCursor([
    { f: 0, x: 1140, y: 660 },
    { f: 30, x: 820, y: 470 },
    { f: 75, x: 820, y: 470, click: true },           // click "@campanha.vereador26"
    { f: 110, x: 1140, y: 620, click: true },          // click "Continuar"
    { f: 150, x: 1140, y: 620 },
  ]);
  return (
    <BrowserChrome url="https://www.facebook.com/v23.0/dialog/oauth">
      <MetaPopup
        title="Selecione a conta do Instagram para conectar"
        subtitle="Apenas contas profissionais (Business ou Creator) vinculadas à Página podem ser conectadas."
        items={[
          { name: "@campanha.vereador26", sub: "Instagram Business · 12,4 mil seguidores", emoji: "📷", highlight: true },
        ]}
        cursor={wp}
      />
    </BrowserChrome>
  );
};

// ---------- Scene 4: Permissões ----------
const Scene4Perms: React.FC = () => {
  const frame = useCurrentFrame();
  const popupScale = spring({ frame, fps: META_DEMO_FPS, config: { damping: 18, stiffness: 200 } });
  const wp = useCursor([
    { f: 0, x: 1140, y: 620 },
    { f: 60, x: 1140, y: 760, click: true },
    { f: 120, x: 1140, y: 760 },
  ]);
  const perms = [
    ["pages_show_list", "Mostrar a lista de Páginas que você gerencia"],
    ["pages_read_engagement", "Ler dados de engajamento das suas Páginas"],
    ["instagram_business_basic", "Acessar dados básicos da conta profissional do Instagram"],
    ["instagram_manage_comments", "Ler e responder comentários no Instagram"],
    ["instagram_manage_insights", "Acessar métricas e insights do Instagram"],
  ];
  return (
    <BrowserChrome url="https://www.facebook.com/v23.0/dialog/oauth">
      <AbsoluteFill style={{ background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 580, background: "white", borderRadius: 12, overflow: "hidden", fontFamily, transform: `scale(${popupScale})`, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
          <div style={{ background: "#1877F2", color: "white", padding: "14px 20px", fontWeight: 600 }}>
            📘  Facebook · FotoDeApoio
          </div>
          <div style={{ padding: 28, color: "#1c1e21" }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>FotoDeApoio quer acessar</h2>
            <p style={{ color: "#65676b", fontSize: 14, marginTop: 6 }}>Você pode revogar essas permissões a qualquer momento nas configurações do Facebook.</p>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {perms.map(([k, d]) => (
                <div key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: "#1877F2", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✓</div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: "#1877F2", fontWeight: 600 }}>{k}</div>
                    <div style={{ fontSize: 13, color: "#65676b" }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 10 }}>
              <button style={{ padding: "10px 18px", background: "#e4e6eb", color: "#050505", border: "none", borderRadius: 6, fontWeight: 600, fontFamily }}>Cancelar</button>
              <button style={{ padding: "10px 18px", background: "#1877F2", color: "white", border: "none", borderRadius: 6, fontWeight: 600, fontFamily }}>Continuar como Você</button>
            </div>
          </div>
        </div>
        <Cursor x={wp.x} y={wp.y} click={wp.clickAt} />
      </AbsoluteFill>
    </BrowserChrome>
  );
};

// ---------- Scene 5: Painel conectado ----------
const Scene5Connected: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const toastY = spring({ frame, fps: META_DEMO_FPS, config: { damping: 18 } });
  return (
    <BrowserChrome url="https://fotodeapoio.easychain.com.br/painel/redes-sociais">
      <div style={{ position: "absolute", inset: 0, padding: "40px 60px", fontFamily, color: "#fff", opacity: fadeIn }}>
        {/* Sidebar (same) */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 240, background: "#13131a", borderRight: "1px solid #23232c", padding: "24px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 24, color: "#1877F2" }}>FotoDeApoio</div>
          {["Início", "Templates", "Leads", "WhatsApp"].map((s) => (
            <div key={s} style={{ padding: "10px 12px", color: "#7e7e88", fontSize: 14, marginBottom: 4 }}>{s}</div>
          ))}
          <div style={{ padding: "10px 12px", color: "#fff", fontSize: 14, marginBottom: 4, background: "#1877F2", borderRadius: 8 }}>Redes Sociais</div>
        </div>

        <div style={{ marginLeft: 280 }}>
          <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,.2), rgba(24,119,242,.1))", border: "1px solid #23232c", borderRadius: 16, padding: 32, marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Redes Sociais</h1>
              <p style={{ color: "#9999a3", marginTop: 8, fontSize: 16 }}>Sua conta Meta está conectada.</p>
            </div>
            <span style={{ padding: "8px 16px", background: "rgba(16,185,129,.15)", color: "#10b981", borderRadius: 999, fontSize: 14, fontWeight: 600, border: "1px solid #10b981" }}>
              ✓ Conectado
            </span>
          </div>

          {/* Connection details */}
          <div style={{ background: "#13131a", border: "2px solid #23232c", borderRadius: 16, padding: 32 }}>
            <h3 style={{ fontSize: 16, color: "#9999a3", margin: "0 0 18px", fontWeight: 500 }}>Meta Business · contas conectadas</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {/* Facebook page card */}
              <div style={{ background: "#0e0e13", border: "1px solid #23232c", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7e7e88", fontSize: 12, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>📘 Página do Facebook</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🗳</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>Campanha Vereador 2026</div>
                    <div style={{ fontSize: 13, color: "#7e7e88", fontFamily: "monospace" }}>ID: 102458936741289</div>
                  </div>
                </div>
              </div>

              {/* Instagram card */}
              <div style={{ background: "#0e0e13", border: "1px solid #23232c", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7e7e88", fontSize: 12, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>📷 Conta do Instagram</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #feda75, #d62976, #4f5bd5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>📷</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>@campanha.vereador26</div>
                    <div style={{ fontSize: 13, color: "#7e7e88", fontFamily: "monospace" }}>Business ID: 17841405822304914</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 18 }}>
              {[
                ["Status", "connected"],
                ["Expira em", "24 jul 2026"],
                ["Conectado em", "26 mai 2026"],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "#0e0e13", border: "1px solid #23232c", borderRadius: 10, padding: 14 }}>
                  <div style={{ color: "#7e7e88", fontSize: 12 }}>{k}</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* toast */}
      <div style={{
        position: "absolute", right: 32, top: 32,
        background: "#10b981", color: "white",
        padding: "14px 22px", borderRadius: 10, fontFamily, fontWeight: 600,
        boxShadow: "0 12px 30px rgba(0,0,0,.4)",
        transform: `translateX(${(1 - toastY) * 400}px)`,
      }}>
        ✓ Página conectada: Campanha Vereador 2026
      </div>
    </BrowserChrome>
  );
};

// ---------- Caption strip ----------
const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,.78)", color: "white", padding: "14px 28px", borderRadius: 12,
      fontFamily, fontSize: 22, fontWeight: 500, opacity: o, maxWidth: 1100, textAlign: "center",
      backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)",
      zIndex: 10000,
    }}>{text}</div>
  );
};

// ---------- Root composition ----------
export const MetaReviewDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={S1.from} durationInFrames={S1.dur}>
        <Scene1Panel />
        <Caption text="1. Usuário acessa o painel e clica em “Conectar Facebook e Instagram”." />
      </Sequence>

      <Sequence from={S2.from} durationInFrames={S2.dur}>
        <Scene2FBPage />
        <Caption text="2. O fluxo OAuth oficial da Meta abre. O usuário seleciona a Página do Facebook." />
      </Sequence>

      <Sequence from={S3.from} durationInFrames={S3.dur}>
        <Scene3IG />
        <Caption text="3. O usuário seleciona a conta profissional do Instagram (Business) vinculada à Página." />
      </Sequence>

      <Sequence from={S4.from} durationInFrames={S4.dur}>
        <Scene4Perms />
        <Caption text="4. O usuário revisa e concede as permissões solicitadas." />
      </Sequence>

      <Sequence from={S5.from} durationInFrames={S5.dur}>
        <Scene5Connected />
        <Caption text="5. O sistema exibe as informações básicas do perfil: username, foto, ID e nome da conta." />
      </Sequence>
    </AbsoluteFill>
  );
};
