// HTML autocontido — NÃO importa nada do app, para sobreviver a falhas de init.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Erro inesperado</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:#0f172a; color:#f1f5f9; padding:24px; }
  .card { max-width:480px; text-align:center; background:#1e293b;
    border:1px solid #334155; border-radius:16px; padding:40px 32px;
    box-shadow:0 10px 40px rgba(0,0,0,0.3); }
  h1 { margin:0 0 12px; font-size:24px; }
  p { margin:0 0 24px; color:#94a3b8; line-height:1.6; }
  .actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
  button { font:inherit; padding:10px 20px; border-radius:8px; cursor:pointer;
    border:1px solid #334155; background:#0f172a; color:#f1f5f9; }
  button.primary { background:#3b82f6; border-color:#3b82f6; }
  button:hover { opacity:0.9; }
</style>
</head>
<body>
  <div class="card">
    <h1>Algo deu errado</h1>
    <p>Encontramos um erro inesperado ao processar sua requisição. Nossa equipe foi notificada.</p>
    <div class="actions">
      <button class="primary" onclick="location.reload()">Tentar novamente</button>
      <button onclick="location.href='/'">Ir para o início</button>
    </div>
  </div>
</body>
</html>`;
}
