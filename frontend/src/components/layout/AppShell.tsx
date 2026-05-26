import { ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  showBack?: boolean;
  showSearch?: boolean;
  hideBottomNav?: boolean;
}

export function AppShell({ children, showBack, showSearch = true, hideBottomNav }: AppShellProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="relative flex min-h-screen w-full flex-col bg-background">
        <MobileHeader showBack={showBack} showSearch={showSearch} />
        <main className={`flex-1 ${hideBottomNav ? "pb-6" : "pb-24 md:pb-10"} animate-fade-in`}>
          {children}
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
