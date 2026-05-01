import { useEffect, useRef } from "react";
import { renderTemplate, type PhotoState, type TemplateData } from "@/lib/template-renderer";

type Props = {
  template: TemplateData;
  photo?: PhotoState | null;
  className?: string;
  showPhotoGuide?: boolean;
};

export function TemplateCanvas({ template, photo, className, showPhotoGuide }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) {
      renderTemplate(ref.current, template, photo ?? null, { showPhotoGuide });
    }
  }, [template, photo, showPhotoGuide]);

  return (
    <canvas
      ref={ref}
      className={className ?? "w-full aspect-square rounded-lg border bg-card"}
    />
  );
}

export { type TemplateData, type PhotoState };
