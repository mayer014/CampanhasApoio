import type { TemplateData } from "@/lib/template-renderer";

export const DEFAULT_TEMPLATE_NAME = "Padrão do Sistema";

// Snapshot do template "Padrão do Sistema" criado pelo admin.
// Toda nova conta recebe automaticamente uma cópia ativa deste template,
// faltando apenas trocar a logo (opcional).
export const DEFAULT_TEMPLATE: TemplateData & { name: string } = {
  name: DEFAULT_TEMPLATE_NAME,
  background_url:
    "https://pfppmkqsdqawvykkgafe.supabase.co/storage/v1/object/public/template-layers/a7e0432d-6231-4d04-9e48-e11ed9e37961/background-1777664667392.png",
  base_circle_url:
    "https://pfppmkqsdqawvykkgafe.supabase.co/storage/v1/object/public/template-layers/a7e0432d-6231-4d04-9e48-e11ed9e37961/base_circle-1777664679215.png",
  element_url:
    "https://pfppmkqsdqawvykkgafe.supabase.co/storage/v1/object/public/template-layers/a7e0432d-6231-4d04-9e48-e11ed9e37961/element-1777664692313.png",
  logo_url: null,
  background_transform: { x: 0, y: 0, scale: 1 },
  base_circle_transform: { x: 540, y: 540, scale: 1 },
  element_transform: { x: 540, y: 540, scale: 1 },
  logo_transform: { x: 540, y: 540, scale: 1 },
  photo_circle: { x: 540, y: 540, radius: 481 },
};
