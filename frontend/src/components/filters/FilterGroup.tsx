import type { ReactNode } from "react";

type FilterGroupProps = {
  title: string;
  children: ReactNode;
};

export function FilterGroup({ title, children }: FilterGroupProps) {
  return (
    <section>
      <div className="mb-4 block text-sm font-semibold text-black">{title}</div>
      {children}
    </section>
  );
}
