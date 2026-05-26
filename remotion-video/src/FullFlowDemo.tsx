import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const FULL_FLOW_FPS = 30;
// S1 0-4s    Login (digita email/senha e clica Entrar)
// S2 4-8s    Dashboard -> hover/click "Redes Sociais" no menu
// S3 8-12s   Página Redes Sociais -> clica "Conectar Facebook e Instagram"
// S4 12-17s  Popup Meta OAuth - seleção da Página do Facebook
// S5 17-21s  Seleção da conta do Instagram Business vinculada
// S6 21-26s  Tela de autorização OAuth (consentimento de permissões)
// S7 26-30s  Retorno ao sistema com badge "Conectado" + dados sincronizados
export const FULL_FLOW_TOTAL_FRAMES = 30 * FULL_FLOW_FPS;

// ---------------- Shared UI ----------------

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

const Sidebar: React.FC<{ active?: string }> = ({ active = "Início" }) => (
  <div style={{ width: 240, background: "#13131a", height: "100%", padding: "24px 16px", borderRight: "1px solid #23232c", fontFamily, color: "#cfcfd6" }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 24 }}>MeuApp</div>
    {["Início", "Redes Sociais", "Relatórios", "Configurações"].map((label) => {
      const isActive = label === active;
      return (
        <div key={label} style={{
          padding: "12px 14px", borderRadius: 10, marginBottom: 6, fontSize: 15,
          background: isActive ? "#1877F222" : "transparent",
          color: isActive ? "#fff" : "#9a9aa3",
          border: isActive ? "1px solid #1877F255" : "1px solid transparent",
        }}>{label}</div>
      );
    })}
  </div>
);

const ChapterLabel: React.FC<{ n: number; title: string }> = ({ n, title }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 10, 60, 75], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", left: 32, bottom: 32, zIndex: 10000,
      background: "rgba(0,0,0,.7)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12,
      padding: "10px 18px", fontFamily, color: "#fff", fontSize: 14, opacity: op,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{n}</div>
      {title}
    </div>
  );
};

// ---------------- Scene 1: Login ----------------
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const emailFull = "bruno@studio.com";
  const emailLen = Math.min(emailFull.length, Math.floor(interpolate(frame, [10, 45], [0, emailFull.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const passLen = Math.min(8, Math.floor(interpolate(frame, [55, 80], [0, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1700, y: 900 },
    { f: 8, x: 960, y: 470, click: true },
    { f: 50, x: 960, y: 560, click: true },
    { f: 95, x: 960, y: 660, click: true },
    { f: 120, x: 960, y: 660 },
  ]);
  return (
    <BrowserChrome url="meuapp.com/login">
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 20%, #1c1f3a 0%, #0a0a0e 60%)" }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
        width: 440, background: "#15151c", border: "1px solid #25252e", borderRadius: 16,
        padding: 32, fontFamily, boxShadow: "0 30px 80px rgba(0,0,0,.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#1877F2,#d62976)" }} />
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>MeuApp</div>
        </div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Entrar na sua conta</div>
        <div style={{ color: "#8b8b95", fontSize: 13, marginTop: 6 }}>Acesse seu painel de Redes Sociais</div>

        <div style={{ marginTop: 22 }}>
          <div style={{ color: "#cfcfd6", fontSize: 12, marginBottom: 6 }}>E-mail</div>
          <div style={{ background: "#0e0e12", border: "1px solid #2c2c36", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, minHeight: 22 }}>
            {emailFull.slice(0, emailLen)}<span style={{ opacity: (frame % 30) < 15 ? 1 : 0 }}>|</span>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ color: "#cfcfd6", fontSize: 12, marginBottom: 6 }}>Senha</div>
          <div style={{ background: "#0e0e12", border: "1px solid #2c2c36", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, minHeight: 22, letterSpacing: 4 }}>
            {"•".repeat(passLen)}<span style={{ opacity: (frame % 30) < 15 ? 1 : 0, letterSpacing: 0 }}>|</span>
          </div>
        </div>

        <button style={{
          marginTop: 22, width: "100%", background: "#1877F2", color: "#fff", border: "none",
          borderRadius: 10, padding: "14px", fontFamily, fontSize: 15, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(24,119,242,.35)",
        }}>Entrar</button>

        {frame > 95 && (
          <div style={{
            marginTop: 14, background: "rgba(74,222,128,.1)", border: "1px solid rgba(74,222,128,.3)",
            borderRadius: 10, padding: "10px 14px", color: "#4ade80", fontSize: 13,
            opacity: interpolate(frame, [95, 110], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            ✓ Autenticado com sucesso
          </div>
        )}
      </div>
      <ChapterLabel n={1} title="Login no sistema" />
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------------- Scene 2: Dashboard -> menu Redes Sociais ----------------
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1500, y: 800 },
    { f: 50, x: 130, y: 240, click: true },
    { f: 110, x: 130, y: 240 },
  ]);
  const hoverPulse = frame >= 30 && frame < 50 ? interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" }) : (frame >= 50 ? 1 : 0);
  return (
    <BrowserChrome url="painel.meuapp.com">
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ width: 240, background: "#13131a", height: "100%", padding: "24px 16px", borderRight: "1px solid #23232c", fontFamily, color: "#cfcfd6" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 24 }}>MeuApp</div>
          {["Início", "Redes Sociais", "Relatórios", "Configurações"].map((label) => {
            const isHover = label === "Redes Sociais" && hoverPulse > 0;
            const isActive = label === "Início" && frame < 50;
            const activeNow = label === "Redes Sociais" && frame >= 50;
            return (
              <div key={label} style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 6, fontSize: 15,
                background: activeNow ? "#1877F222" : isActive ? "#1877F222" : isHover ? `rgba(24,119,242,${0.08 * hoverPulse})` : "transparent",
                color: activeNow || isActive ? "#fff" : isHover ? "#fff" : "#9a9aa3",
                border: activeNow ? "1px solid #1877F255" : isActive ? "1px solid #1877F255" : "1px solid transparent",
                transition: "none",
              }}>{label}</div>
            );
          })}
        </div>
        <div style={{ flex: 1, padding: "28px 36px", fontFamily }}>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>Olá, Bruno 👋</div>
          <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 6 }}>Bem-vindo de volta ao seu painel.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 26 }}>
            {[
              { label: "Páginas conectadas", value: "0" },
              { label: "Posts analisados (mês)", value: "—" },
              { label: "Comentários respondidos", value: "—" },
            ].map((c) => (
              <div key={c.label} style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 14, padding: 22 }}>
                <div style={{ color: "#8b8b95", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
                <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginTop: 10 }}>{c.value}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 26, background: "linear-gradient(135deg, rgba(24,119,242,.1), rgba(214,41,118,.08))",
            border: "1px solid rgba(24,119,242,.3)", borderRadius: 14, padding: 22, color: "#fff",
          }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Você ainda não conectou suas redes sociais</div>
            <div style={{ color: "#cfcfd6", fontSize: 13, marginTop: 6 }}>Acesse o menu <strong>Redes Sociais</strong> para conectar sua Página do Facebook e sua conta profissional do Instagram.</div>
          </div>
        </div>
      </div>
      <ChapterLabel n={2} title="Acesso ao menu Redes Sociais" />
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------------- Scene 3: Página Redes Sociais -> Conectar ----------------
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1700, y: 900 },
    { f: 60, x: 960, y: 720, click: true },
    { f: 120, x: 960, y: 720 },
  ]);
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.04, 1]);
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar active="Redes Sociais" />
        <div style={{ flex: 1, padding: "28px 36px", fontFamily }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "linear-gradient(135deg, rgba(24,119,242,.2), rgba(214,41,118,.2))", padding: 12, borderRadius: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#1877F2,#d62976)" }} />
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>Redes Sociais</div>
              <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 4 }}>Conecte Facebook e Instagram para liberar métricas e análise de sentimento.</div>
            </div>
            <div style={{ marginLeft: "auto", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.4)", color: "#fbbf24", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>
              ⚠ Não conectado
            </div>
          </div>

          <div style={{ marginTop: 28, background: "#15151c", border: "2px solid #25252e", borderRadius: 16, padding: 36, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ display: "flex", gap: -8 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, fontWeight: 700, border: "3px solid #15151c" }}>f</div>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#feda75,#d62976,#4f5bd5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, marginLeft: -12, border: "3px solid #15151c" }}>IG</div>
            </div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginTop: 18 }}>Conecte suas contas em um clique</div>
            <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 8, maxWidth: 520 }}>
              Usamos o login oficial da Meta — não armazenamos sua senha. Você pode revogar o acesso a qualquer momento.
            </div>
            <button style={{
              marginTop: 22, background: "linear-gradient(90deg,#1877F2,#d62976)", color: "#fff", border: "none",
              borderRadius: 12, padding: "16px 28px", fontFamily, fontSize: 16, fontWeight: 600,
              transform: `scale(${pulse})`, boxShadow: "0 12px 32px rgba(24,119,242,.4)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>f</span>
              <span style={{ fontSize: 18 }}>IG</span>
              Conectar Facebook e Instagram
            </button>
            <div style={{ color: "#8b8b95", fontSize: 11, marginTop: 14 }}>
              Permissões: pages_show_list · instagram_basic · instagram_manage_insights · instagram_manage_comments
            </div>
          </div>
        </div>
      </div>
      <ChapterLabel n={3} title='Clique em "Conectar Facebook e Instagram"' />
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------------- Scene 4: OAuth - selecionar página ----------------
const fbPages = [
  { name: "Studio Bruno Fotografia", cat: "Fotógrafo" },
  { name: "Café da Esquina", cat: "Cafeteria" },
  { name: "Pousada Vista Mar", cat: "Hospedagem" },
];
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1500, y: 200 },
    { f: 55, x: 960, y: 470, click: true },
    { f: 115, x: 1180, y: 760, click: true },
    { f: 150, x: 1180, y: 760 },
  ]);
  const selected = frame >= 55;
  return (
    <BrowserChrome url="facebook.com/v19.0/dialog/oauth">
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", opacity: fade }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%,-50%) scale(${interpolate(frame, [0, 20], [0.94, 1], { extrapolateRight: "clamp" })})`,
        width: 680, background: "#fff", borderRadius: 14, fontFamily, opacity: fade,
        boxShadow: "0 30px 80px rgba(0,0,0,.5)", overflow: "hidden",
      }}>
        <div style={{ background: "#1877F2", color: "#fff", padding: "16px 22px", fontSize: 18, fontWeight: 600 }}>
          Qual Página você deseja conectar ao MeuApp?
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ color: "#65676b", fontSize: 13, marginBottom: 14 }}>
            Selecione a Página do Facebook vinculada à sua conta profissional do Instagram.
          </div>
          {fbPages.map((p, i) => {
            const isSel = i === 0 && selected;
            return (
              <div key={p.name} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 14px",
                border: `2px solid ${isSel ? "#1877F2" : "#e4e6eb"}`, borderRadius: 12, marginBottom: 8,
                background: isSel ? "rgba(24,119,242,.06)" : "#fff",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: `2px solid ${isSel ? "#1877F2" : "#bcc0c4"}`,
                  background: isSel ? "#1877F2" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13,
                }}>{isSel ? "●" : ""}</div>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#1c1e21", fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "#65676b", fontSize: 12 }}>{p.cat}</div>
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button style={{ background: "#e4e6eb", color: "#050505", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
            <button style={{ background: selected ? "#1877F2" : "#a4c8f5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 600 }}>Próximo</button>
          </div>
        </div>
      </div>
      <ChapterLabel n={4} title="Seleção da Página do Facebook" />
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------------- Scene 5: Selecionar Instagram ----------------
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1500, y: 200 },
    { f: 55, x: 960, y: 500, click: true },
    { f: 100, x: 1180, y: 740, click: true },
    { f: 130, x: 1180, y: 740 },
  ]);
  const selected = frame >= 55;
  return (
    <BrowserChrome url="facebook.com/v19.0/dialog/oauth">
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", opacity: fade }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%,-50%) scale(${interpolate(frame, [0, 20], [0.94, 1], { extrapolateRight: "clamp" })})`,
        width: 680, background: "#fff", borderRadius: 14, fontFamily, opacity: fade,
        boxShadow: "0 30px 80px rgba(0,0,0,.5)", overflow: "hidden",
      }}>
        <div style={{ background: "linear-gradient(90deg,#feda75,#d62976,#4f5bd5)", color: "#fff", padding: "16px 22px", fontSize: 18, fontWeight: 600 }}>
          Qual conta do Instagram você quer conectar?
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ color: "#65676b", fontSize: 13, marginBottom: 14 }}>
            Vinculada à Página <strong>Studio Bruno Fotografia</strong>.
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 14, padding: "16px 14px",
            border: `2px solid ${selected ? "#d62976" : "#e4e6eb"}`, borderRadius: 12,
            background: selected ? "rgba(214,41,118,.06)" : "#fff",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              border: `2px solid ${selected ? "#d62976" : "#bcc0c4"}`,
              background: selected ? "#d62976" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13,
            }}>{selected ? "●" : ""}</div>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#feda75,#d62976,#4f5bd5)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>SB</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#1c1e21", fontSize: 15, fontWeight: 600 }}>@studiobrunofoto</div>
              <div style={{ color: "#65676b", fontSize: 12 }}>Conta Profissional · 24.1k seguidores</div>
            </div>
            <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "#e4e6eb", color: "#1c1e21" }}>Business</div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button style={{ background: "#e4e6eb", color: "#050505", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600 }}>Voltar</button>
            <button style={{ background: selected ? "#1877F2" : "#a4c8f5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 600 }}>Próximo</button>
          </div>
        </div>
      </div>
      <ChapterLabel n={5} title="Seleção da conta do Instagram" />
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------------- Scene 6: Autorização OAuth ----------------
const scopes = [
  { name: "Seu nome e foto do perfil", scope: "public_profile" },
  { name: "Lista de Páginas que você administra", scope: "pages_show_list" },
  { name: "Informações básicas da conta profissional do Instagram", scope: "instagram_business_basic" },
  { name: "Comentários do Instagram", scope: "instagram_manage_comments" },
  { name: "Métricas e insights do Instagram", scope: "instagram_manage_insights" },
];
const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const { x, y, clickAt } = useCursor([
    { f: 0, x: 1500, y: 200 },
    { f: 105, x: 1180, y: 870, click: true },
    { f: 140, x: 1180, y: 870 },
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
          MeuApp solicita permissão
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ color: "#1c1e21", fontSize: 15 }}>
            <strong>MeuApp</strong> deseja acessar as seguintes informações da sua conta Meta:
          </div>
          <div style={{ marginTop: 14 }}>
            {scopes.map((s, i) => {
              const appear = spring({ frame: frame - 15 - i * 6, fps: 30, config: { damping: 18 } });
              return (
                <div key={s.scope} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  border: "1px solid #e4e6eb", borderRadius: 10, marginBottom: 6,
                  opacity: appear, transform: `translateY(${(1 - appear) * 8}px)`,
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#1c1e21", fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ color: "#65676b", fontSize: 11, fontFamily: "monospace" }}>{s.scope}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ color: "#65676b", fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
            Você pode revogar o acesso a qualquer momento em Configurações &gt; Aplicativos do Facebook.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button style={{ background: "#e4e6eb", color: "#050505", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
            <button style={{ background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 600, boxShadow: "0 6px 18px rgba(24,119,242,.4)" }}>Continuar</button>
          </div>
        </div>
      </div>
      <ChapterLabel n={6} title="Autorização OAuth · permissões concedidas" />
      <Cursor x={x} y={y} click={clickAt} />
    </BrowserChrome>
  );
};

// ---------------- Scene 7: Retorno ao sistema ----------------
const Scene7: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: 30, config: { damping: 12 } });
  const toastOp = interpolate(frame, [0, 10, 80, 100], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const toastY = interpolate(frame, [0, 14], [-20, 0], { extrapolateRight: "clamp" });
  return (
    <BrowserChrome url="painel.meuapp.com/redes-sociais">
      <div style={{ display: "flex", height: "100%" }}>
        <Sidebar active="Redes Sociais" />
        <div style={{ flex: 1, padding: "28px 36px", fontFamily, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "linear-gradient(135deg, rgba(24,119,242,.2), rgba(214,41,118,.2))", padding: 12, borderRadius: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#1877F2,#d62976)" }} />
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>Redes Sociais</div>
              <div style={{ color: "#8b8b95", fontSize: 14, marginTop: 4 }}>Suas contas foram conectadas com sucesso.</div>
            </div>
            <div style={{
              marginLeft: "auto", background: "rgba(74,222,128,.14)", border: "1px solid rgba(74,222,128,.5)",
              color: "#4ade80", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600,
              transform: `scale(${pop})`,
            }}>
              ✓ Conectado
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 28 }}>
            <div style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 14, padding: 22, opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" }) }}>
              <div style={{ color: "#8b8b95", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: "#1877F2", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>f</span>
                Página do Facebook
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>SB</div>
                <div>
                  <div style={{ color: "#fff", fontSize: 17, fontWeight: 600 }}>Studio Bruno Fotografia</div>
                  <div style={{ color: "#8b8b95", fontSize: 12 }}>ID: 1029384756102938</div>
                </div>
              </div>
            </div>
            <div style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 14, padding: 22, opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }) }}>
              <div style={{ color: "#8b8b95", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: "linear-gradient(135deg,#feda75,#d62976,#4f5bd5)", display: "inline-block" }} />
                Conta do Instagram
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#feda75,#d62976,#4f5bd5)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>SB</div>
                <div>
                  <div style={{ color: "#fff", fontSize: 17, fontWeight: 600 }}>@studiobrunofoto</div>
                  <div style={{ color: "#8b8b95", fontSize: 12 }}>Business ID: 178293847562039</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16, opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" }) }}>
            {[
              { l: "Status", v: "Conectado" },
              { l: "Expira em", v: "24 jun, 2026" },
              { l: "Conectado em", v: "26 mai, 2026" },
            ].map((t) => (
              <div key={t.l} style={{ background: "#15151c", border: "1px solid #25252e", borderRadius: 10, padding: 14 }}>
                <div style={{ color: "#8b8b95", fontSize: 11 }}>{t.l}</div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600, marginTop: 4 }}>{t.v}</div>
              </div>
            ))}
          </div>

          <div style={{
            position: "absolute", top: 24, right: 36,
            background: "#0f1e14", border: "1px solid rgba(74,222,128,.5)", borderRadius: 12,
            padding: "12px 18px", display: "flex", alignItems: "center", gap: 12,
            color: "#fff", fontSize: 14, opacity: toastOp, transform: `translateY(${toastY}px)`,
            boxShadow: "0 12px 30px rgba(0,0,0,.4)",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#4ade80", color: "#052e16", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</div>
            Página conectada: Studio Bruno Fotografia
          </div>
        </div>
      </div>
      <ChapterLabel n={7} title="Retorno ao sistema · conexão ativa" />
    </BrowserChrome>
  );
};

// ---------------- Composition ----------------
const S1 = { from: 0, dur: 4 * FULL_FLOW_FPS };
const S2 = { from: S1.from + S1.dur, dur: 4 * FULL_FLOW_FPS };
const S3 = { from: S2.from + S2.dur, dur: 4 * FULL_FLOW_FPS };
const S4 = { from: S3.from + S3.dur, dur: 5 * FULL_FLOW_FPS };
const S5 = { from: S4.from + S4.dur, dur: 4 * FULL_FLOW_FPS };
const S6 = { from: S5.from + S5.dur, dur: 5 * FULL_FLOW_FPS };
const S7 = { from: S6.from + S6.dur, dur: 4 * FULL_FLOW_FPS };

export const FullFlowDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      <Sequence from={S1.from} durationInFrames={S1.dur}><Scene1 /></Sequence>
      <Sequence from={S2.from} durationInFrames={S2.dur}><Scene2 /></Sequence>
      <Sequence from={S3.from} durationInFrames={S3.dur}><Scene3 /></Sequence>
      <Sequence from={S4.from} durationInFrames={S4.dur}><Scene4 /></Sequence>
      <Sequence from={S5.from} durationInFrames={S5.dur}><Scene5 /></Sequence>
      <Sequence from={S6.from} durationInFrames={S6.dur}><Scene6 /></Sequence>
      <Sequence from={S7.from} durationInFrames={S7.dur}><Scene7 /></Sequence>
    </AbsoluteFill>
  );
};
