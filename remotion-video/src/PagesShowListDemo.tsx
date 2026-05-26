import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const PAGES_DEMO_FPS = 30;
// S1 0-4s   Painel "Conectar Facebook" -> clique
// S2 4-8s   Popup Meta OAuth com pages_show_list destacado
// S3 8-15s  Lista das Páginas que o usuário gerencia (vinda da API)
// S4 15-20s Seleção de uma Página + confirmação
// S5 20-24s Sucesso + permissões usadas
export const PAGES_DEMO_TOTAL_FRAMES = 24 * PAGES_DEMO_FPS;

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

const Sidebar: React.FC = () => (
  <div style={{ width: 240, background: "#13131a", height: "100%", padding: "24px 16px", borderRight: "1px solid #23232c", fontFamily, color: "#cfcfd6" }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Painel</div>
    {[
      { label: "Redes Sociais", active: true },
      { label: "Páginas conectadas", active: false },
      { label: "Relatórios", active: false },
      { label: "Configurações", active: false },
    ].map((it) => (
      <div key={it.label} style={{
        padding: "12px 14px", borderRadius: 10, marginBottom: 6, fontSize: 15,
        background: it.active ? "#1877F222" : "transparent",
        color: it.active ? "#fff" : "#9a9aa3",
        border: it.active ? "1px solid #1877F255" : "1px solid transparent",
      }}>{it.label}</div>
    ))}
  </div>
);

const Title: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div style={{ padding: "28px 36px 8px 36px" }}>
    <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, fontFamily }}>{children}</div>
    {sub && <div style={{ color: "#8b8b95", fontSize: 15, marginTop: 6, fontFamily }}>{sub}</div>}
  </div>
);

// ---------- Scene 1: clicar em Conectar ----------
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1600, y: 800 },
    { f: 70, x: 1350, y: 480, click: true },
    { f: 120, x: 1350, y: 480 },
  ]);
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.04, 1]);
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar />
        <div style={{ flex: 1 }}>
          <Title sub="Conecte sua conta Meta para gerenciar suas Páginas e contas profissionais">Conectar redes sociais</Title>
          <div style={{ padding: "28px 36px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 14, padding: 24, fontFamily }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 700 }}>f</div>
                <div>
                  <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>Facebook Pages</div>
                  <div style={{ color: "#8b8b95", fontSize: 13 }}>Nenhuma página conectada</div>
                </div>
              </div>
              <div style={{ color: "#8b8b95", fontSize: 13, marginTop: 16, lineHeight: 1.5 }}>
                Veja a lista de Páginas que você administra e escolha quais conectar ao app.
              </div>
              <button style={{
                marginTop: 18, background: "#1877F2", color: "#fff", border: "none",
                borderRadius: 10, padding: "12px 20px", fontFamily, fontSize: 14, fontWeight: 600,
                transform: `scale(${pulse})`, boxShadow: "0 8px 24px rgba(24,119,242,.35)",
              }}>
                Conectar com Facebook
              </button>
            </div>
            <div style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 14, padding: 24, fontFamily, opacity: 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#E1306C,#833AB4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>IG</div>
                <div>
                  <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>Instagram Business</div>
                  <div style={{ color: "#8b8b95", fontSize: 13 }}>Disponível após conectar o Facebook</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 2: popup OAuth com pages_show_list ----------
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const highlight = interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1350, y: 480 },
    { f: 60, x: 1100, y: 850 },
    { f: 110, x: 1240, y: 870, click: true },
    { f: 150, x: 1240, y: 870 },
  ]);
  return (
    <BrowserChrome url="facebook.com/v19.0/dialog/oauth">
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", opacity: fade }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%,-50%) scale(${interpolate(frame, [0, 20], [0.94, 1], { extrapolateRight: "clamp" })})`,
        width: 720, background: "#fff", borderRadius: 14, fontFamily, opacity: fade,
        boxShadow: "0 30px 80px rgba(0,0,0,.5)", overflow: "hidden",
      }}>
        <div style={{ background: "#1877F2", color: "#fff", padding: "16px 22px", fontSize: 18, fontWeight: 600 }}>
          Entrar com Facebook
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ color: "#1c1e21", fontSize: 16, fontWeight: 600 }}>MeuApp deseja acessar:</div>
          <div style={{ marginTop: 16 }}>
            {[
              { name: "Seu nome e foto do perfil", scope: "public_profile" },
              { name: "A lista de Páginas que você administra", scope: "pages_show_list", focus: true },
              { name: "Informações básicas das suas contas profissionais do Instagram", scope: "instagram_business_basic" },
            ].map((p) => (
              <div key={p.scope} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                border: `1px solid ${p.focus ? "#1877F2" : "#e4e6eb"}`, borderRadius: 10, marginBottom: 8,
                background: p.focus ? `rgba(24,119,242,${0.06 + highlight * 0.08})` : "#fff",
                boxShadow: p.focus ? `0 0 ${highlight * 18}px rgba(24,119,242,${highlight * 0.4})` : "none",
              }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#1c1e21", fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ color: "#65676b", fontSize: 12, marginTop: 2, fontFamily: "monospace" }}>{p.scope}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 18 }}>
            <button style={{ background: "#e4e6eb", color: "#050505", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
            <button style={{ background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 600 }}>Continuar como Bruno</button>
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 3: lista de Páginas administradas (GET /me/accounts) ----------
const pages = [
  { name: "Studio Bruno Fotografia", category: "Fotógrafo", followers: "24.1k", role: "Administrador" },
  { name: "Café da Esquina", category: "Cafeteria", followers: "8.3k", role: "Editor" },
  { name: "Pousada Vista Mar", category: "Hospedagem", followers: "12.7k", role: "Administrador" },
  { name: "Loja Vento Sul", category: "Moda & Acessórios", followers: "5.6k", role: "Administrador" },
  { name: "Clínica Vitalis", category: "Saúde", followers: "3.2k", role: "Moderador" },
];

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const apiFade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais/paginas">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: "28px 36px", fontFamily }}>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>Páginas que você administra</div>
          <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 6 }}>
            Lista obtida via <span style={{ color: "#1877F2", fontFamily: "monospace" }}>GET /me/accounts</span> usando a permissão <span style={{ color: "#1877F2", fontWeight: 600, fontFamily: "monospace" }}>pages_show_list</span>
          </div>

          <div style={{
            marginTop: 14, background: "#0c1320", border: "1px solid #1f2a44", borderRadius: 10,
            padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#7eb3ff", opacity: apiFade,
          }}>
            ▸ GET https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,fan_count,tasks
            <span style={{ color: "#4ade80", marginLeft: 12 }}>200 OK · {pages.length} resultados</span>
          </div>

          <div style={{ marginTop: 18 }}>
            {pages.map((p, i) => {
              const appear = spring({ frame: frame - 30 - i * 8, fps: 30, config: { damping: 18 } });
              return (
                <div key={p.name} style={{
                  opacity: appear, transform: `translateY(${(1 - appear) * 16}px)`,
                  display: "flex", alignItems: "center", gap: 16,
                  background: "#15151c", border: "1px solid #25252e", borderRadius: 12,
                  padding: "14px 18px", marginBottom: 10,
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>
                    {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: "#8b8b95", fontSize: 12, marginTop: 2 }}>{p.category} · {p.followers} seguidores</div>
                  </div>
                  <div style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 999,
                    background: "#1877F222", color: "#7eb3ff", border: "1px solid #1877F255",
                  }}>{p.role}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
};

// ---------- Scene 4: selecionar uma página ----------
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1700, y: 600 },
    { f: 45, x: 600, y: 400, click: true },
    { f: 120, x: 1500, y: 920, click: true },
    { f: 150, x: 1500, y: 920 },
  ]);
  const selected = frame >= 45;
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais/paginas">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: "28px 36px", fontFamily }}>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>Selecione as Páginas para conectar</div>
          <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 6 }}>Você pode selecionar uma ou mais Páginas. As demais permanecem privadas.</div>

          <div style={{ marginTop: 18 }}>
            {pages.map((p, i) => {
              const isSel = i === 0 && selected;
              return (
                <div key={p.name} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  background: isSel ? "rgba(24,119,242,0.08)" : "#15151c",
                  border: `1px solid ${isSel ? "#1877F2" : "#25252e"}`, borderRadius: 12,
                  padding: "14px 18px", marginBottom: 10,
                  boxShadow: isSel ? "0 0 24px rgba(24,119,242,.25)" : "none",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${isSel ? "#1877F2" : "#3a3a44"}`,
                    background: isSel ? "#1877F2" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14,
                  }}>{isSel ? "✓" : ""}</div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                    {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: "#8b8b95", fontSize: 12, marginTop: 2 }}>{p.category} · {p.followers} seguidores</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 12 }}>
            <button style={{ background: "transparent", color: "#cfcfd6", border: "1px solid #2c2c36", borderRadius: 10, padding: "12px 18px", fontSize: 14 }}>Cancelar</button>
            <button style={{
              background: selected ? "#1877F2" : "#1877F255", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 600,
              boxShadow: selected ? "0 8px 24px rgba(24,119,242,.4)" : "none",
            }}>
              Conectar {selected ? "1 Página" : "0 Páginas"}
            </button>
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------- Scene 5: sucesso + permissões ----------
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: 30, config: { damping: 12 } });
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily, padding: 40 }}>
          <div style={{ transform: `scale(${pop})`, width: 110, height: 110, borderRadius: "50%", background: "linear-gradient(135deg,#1877F2,#0a4cad)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 56, fontWeight: 700 }}>✓</div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginTop: 22 }}>Página conectada com sucesso</div>
          <div style={{ color: "#8b8b95", fontSize: 15, marginTop: 8, textAlign: "center", maxWidth: 640 }}>
            Studio Bruno Fotografia foi vinculada à sua conta no MeuApp. As outras Páginas continuam privadas até que você decida conectá-las.
          </div>

          <div style={{
            marginTop: 30, background: "#15151c", border: "1px solid #25252e", borderRadius: 14,
            padding: 22, width: 720,
          }}>
            <div style={{ color: "#8b8b95", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Permissões da Meta utilizadas</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {[
                { name: "pages_show_list", focus: true },
                { name: "public_profile", focus: false },
                { name: "instagram_business_basic", focus: false },
              ].map((p) => (
                <div key={p.name} style={{
                  background: p.focus ? "#1877F222" : "#23232c",
                  color: p.focus ? "#7eb3ff" : "#cfcfd6",
                  border: `1px solid ${p.focus ? "#1877F2" : "#2c2c36"}`,
                  borderRadius: 999, padding: "6px 14px", fontSize: 13, fontFamily,
                }}>{p.name}</div>
              ))}
            </div>
            <div style={{ color: "#8b8b95", fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
              A permissão <span style={{ color: "#7eb3ff", fontFamily: "monospace" }}>pages_show_list</span> é usada exclusivamente para exibir ao usuário a lista das Páginas que ele administra, permitindo escolher quais vincular ao app.
            </div>
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
};

const S1 = { from: 0, dur: 4 * PAGES_DEMO_FPS };
const S2 = { from: S1.from + S1.dur, dur: 4 * PAGES_DEMO_FPS };
const S3 = { from: S2.from + S2.dur, dur: 7 * PAGES_DEMO_FPS };
const S4 = { from: S3.from + S3.dur, dur: 5 * PAGES_DEMO_FPS };
const S5 = { from: S4.from + S4.dur, dur: 4 * PAGES_DEMO_FPS };

export const PagesShowListDemo: React.FC = () => {
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
