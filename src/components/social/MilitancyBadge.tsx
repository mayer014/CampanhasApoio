import { Badge } from "@/components/ui/badge";
import { 
  Target, Sword, Moon, Diamond, Flame, 
  Megaphone, UserPlus, Eye 
} from "lucide-react";

export type BadgeType = 
  | 'hater' 
  | 'critico' 
  | 'sumido' 
  | 'tropa_elite' 
  | 'defensor' 
  | 'engajado' 
  | 'novo' 
  | 'observador';

export const MILITANCY_BADGES: Record<BadgeType, { 
  label: string, 
  icon: any, 
  color: string, 
  description: string 
}> = {
  hater: { 
    label: 'Hater Persistente', 
    icon: Target, 
    color: 'bg-rose-500 hover:bg-rose-600', 
    description: '10+ negativos no histórico' 
  },
  critico: { 
    label: 'Crítico Recorrente', 
    icon: Sword, 
    color: 'bg-orange-500 hover:bg-orange-600', 
    description: '3+ negativos nos últimos 30 dias' 
  },
  sumido: { 
    label: 'Sumido', 
    icon: Moon, 
    color: 'bg-slate-400 hover:bg-slate-500', 
    description: 'Era ativo, sumiu há 60+ dias' 
  },
  tropa_elite: { 
    label: 'Tropa de Elite', 
    icon: Diamond, 
    color: 'bg-indigo-600 hover:bg-indigo-700', 
    description: '15+ positivos e ZERO negativos' 
  },
  defensor: { 
    label: 'Defensor', 
    icon: Flame, 
    color: 'bg-emerald-500 hover:bg-emerald-600', 
    description: '5+ positivos nos últimos 30 dias' 
  },
  engajado: { 
    label: 'Engajado', 
    icon: Megaphone, 
    color: 'bg-sky-500 hover:bg-sky-600', 
    description: '10+ comentários totais' 
  },
  novo: { 
    label: 'Novo Rosto', 
    icon: UserPlus, 
    color: 'bg-amber-400 hover:bg-amber-500 text-black', 
    description: 'Primeiro comentário nos últimos 7 dias' 
  },
  observador: { 
    label: 'Observador', 
    icon: Eye, 
    color: 'bg-muted text-muted-foreground', 
    description: 'Poucos comentários, sem padrão' 
  },
};

export function MilitancyBadge({ type }: { type: string | null | undefined }) {
  const badge = MILITANCY_BADGES[type as BadgeType] || MILITANCY_BADGES.observador;
  const Icon = badge.icon;

  return (
    <Badge 
      className={`gap-1.5 px-2 py-0.5 text-[10px] font-medium transition-all ${badge.color}`}
      title={badge.description}
    >
      <Icon className="h-3 w-3" />
      {badge.label}
    </Badge>
  );
}
