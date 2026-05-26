import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, FileText, Info, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

const baseItems = [
  { to: "/", label: "Início", icon: Home },
  { to: "/eventos", label: "Eventos", icon: BookOpen },
  { to: "/publicacoes", label: "Publicações", icon: FileText },
  { to: "/sobre", label: "Sobre", icon: Info },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isPrivileged = user?.role === "ADMIN" || user?.role === "COORDENADOR";
  const items = isPrivileged
    ? [...baseItems, { to: "/admin", label: "Painel", icon: LayoutDashboard }]
    : baseItems;

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 bg-brand text-primary-foreground shadow-elevated md:hidden">
      <ul className={cn("grid", isPrivileged ? "grid-cols-5" : "grid-cols-4")}>
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-opacity",
                  active ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow")} />
                <span>{label}</span>
                {active && <span className="absolute bottom-0 h-0.5 w-8 rounded-t bg-primary-foreground" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
