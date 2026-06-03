## Problema
O Nitro mudou o diretório de saída de `dist/` para `.output/` (padrão do preset `cloudflare-module`). O Dockerfile ainda copia `/app/dist`, que não existe mais → build do Docker falha.

## Correção
Atualizar o `Dockerfile` para usar o novo layout `.output/`:

1. Substituir `COPY --from=builder /app/dist ./dist` por `COPY --from=builder /app/.output ./.output`
2. Atualizar o `CMD` para apontar para `.output/server/wrangler.json`:
   ```
   CMD ["wrangler", "dev", "--ip", "0.0.0.0", "--port", "3000", "--local", "--no-show-interactive-dev-session", "--config", ".output/server/wrangler.json"]
   ```

Nenhuma outra alteração necessária — o `vite.config.ts` e o build em si estão corretos, apenas o Dockerfile precisa acompanhar o novo caminho de saída.