import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Minha Campanha — Hub de Inteligência Política e Militância Digital" },
      { name: "description", content: "A plataforma completa para gestão de campanha moderna. Inteligência de dados, automação de WhatsApp, gestão de militância e análise de sentimento em um só lugar." },
      { name: "author", content: "Minha Campanha" },
      { property: "og:title", content: "Minha Campanha — Inteligência e Mobilização Digital" },
      { property: "og:description", content: "Transforme sua base de apoiadores em uma força digital imparável com inteligência de dados e automação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Minha Campanha — Hub de Inteligência Política" },
      { name: "twitter:description", content: "Inteligência de dados, automação e militância digital para campanhas vencedoras." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f928377d-b6cd-40b3-8370-7e33af8b0fd9/id-preview-e6fcf61e--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app-1779325693098.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f928377d-b6cd-40b3-8370-7e33af8b0fd9/id-preview-e6fcf61e--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app-1779325693098.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
