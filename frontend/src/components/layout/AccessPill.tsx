import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Lock, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AccessPillProps = {
  isAuthenticated: boolean;
  isPrivileged: boolean;
  onLogout: () => void;
};

const brandRed = "#c1121f";
const collapsedWidth = 40;
const expandedWidth = 182;

export function AccessPill({ isAuthenticated, isPrivileged, onLogout }: AccessPillProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const { pathname } = useLocation();
  const menuId = useId();

  const closeMenu = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && menuRef.current?.contains(activeElement)) {
      triggerButtonRef.current?.focus();
    }

    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current?.contains(target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    closeMenu();
  }, [closeMenu, pathname]);

  if (!isAuthenticated) {
    return (
      <Link
  to="/admin/login"
  aria-label="Área restrita"
  title="Área restrita"
  className="flex h-10 w-10 items-center justify-center transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none"
>
  <Lock className="h-[20px] w-[20px] text-white" />
</Link>
    );
  }

  const actions = [
    ...(isPrivileged
      ? [
          {
            key: "dashboard",
            label: "Painel",
            icon: LayoutDashboard,
            to: "/admin",
          },
        ]
      : []),
    {
      key: "logout",
      label: "Sair",
      icon: LogOut,
      onClick: () => {
        closeMenu();
        onLogout();
      },
    },
  ];

  return (
    <div
      ref={containerRef}
      className="relative flex h-10 items-center justify-end"
      style={{ width: open ? expandedWidth : collapsedWidth }}
    >
      <div
        className="absolute right-0 top-0 flex h-10 items-center overflow-hidden rounded-full shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-[width] duration-300 ease-out"
        style={{ width: open ? expandedWidth : collapsedWidth, backgroundColor: "#ffffff" }}
      >
        <div
          ref={menuRef}
          id={menuId}
          aria-hidden={!open}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden transition-all duration-200 ease-out",
            open ? "max-w-[142px] pl-3 pr-2 opacity-100" : "max-w-0 pl-0 pr-0 opacity-0",
          )}
        >
          {actions.map((action) =>
            "to" in action ? (
              <Link
                key={action.key}
                to={action.to}
                tabIndex={open ? 0 : -1}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors"
                style={{ color: brandRed }}
                onClick={closeMenu}
              >
                <action.icon className="h-3.5 w-3.5" style={{ color: brandRed }} />
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                key={action.key}
                type="button"
                tabIndex={open ? 0 : -1}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors"
                style={{ color: brandRed }}
                onClick={action.onClick}
              >
                <action.icon className="h-3.5 w-3.5" style={{ color: brandRed }} />
                <span>{action.label}</span>
              </button>
            ),
          )}
        </div>

        <button
          ref={triggerButtonRef}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Fechar menu de acesso" : "Abrir menu de acesso"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none"
          style={{ backgroundColor: "#ffffff", color: brandRed }}
          onClick={() => {
            if (open) {
              closeMenu();
              return;
            }

            setOpen(true);
          }}
        >
          {open ? <X className="h-4 w-4" style={{ color: brandRed }} /> : <LayoutDashboard className="h-4 w-4" style={{ color: brandRed }} />}
        </button>
      </div>
    </div>
  );
}
