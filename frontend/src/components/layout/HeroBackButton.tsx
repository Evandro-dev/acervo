import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

type HeroBackButtonProps = {
  className?: string;
  fallback?: string;
};

export function HeroBackButton({ className, fallback }: HeroBackButtonProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fallbackPath = fallback ?? (pathname.startsWith("/admin") ? (pathname === "/admin" ? "/" : "/admin") : "/");

  const goBack = () => {
    const historyIndex = window.history.state?.idx;

    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath, { replace: true });
  };

  return (
    <button
      type="button"
      aria-label="Voltar para a página anterior"
      onClick={goBack}
      className={cn(
        "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
