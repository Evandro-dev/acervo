import type { ReactNode } from "react";
import { StatePanel } from "@/components/ui/state-panel";

type QueryStateProps = {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  loadingMessage: string;
  errorMessage: string;
  emptyMessage?: string;
  panelClassName?: string;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  isError,
  isEmpty,
  loadingMessage,
  errorMessage,
  emptyMessage = "Nenhum dado encontrado.",
  panelClassName,
  children,
}: QueryStateProps) {
  if (isError) {
    return <StatePanel className={panelClassName}>{errorMessage}</StatePanel>;
  }

  if (isLoading) {
    return <StatePanel className={panelClassName}>{loadingMessage}</StatePanel>;
  }

  if (isEmpty) {
    return <StatePanel className={panelClassName}>{emptyMessage}</StatePanel>;
  }

  return <>{children}</>;
}
