import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";

function ScrollIndicatorHarness() {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

  return (
    <div className="relative">
      <div ref={setViewport} data-testid="scroll-viewport" />
      <ScrollIndicator viewport={viewport} />
    </div>
  );
}

describe("ScrollIndicator", () => {
  it("shows a synchronized thumb only when the viewport has overflow", () => {
    render(<ScrollIndicatorHarness />);
    const viewport = screen.getByTestId("scroll-viewport");

    expect(document.querySelector('[data-slot="select-scroll-indicator"]')).not.toBeInTheDocument();

    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 50, writable: true },
    });

    fireEvent.scroll(viewport);

    const indicator = document.querySelector('[data-slot="select-scroll-indicator"]');
    const thumb = document.querySelector('[data-slot="select-scroll-thumb"]');

    expect(indicator).toBeInTheDocument();
    expect(thumb).toHaveStyle({ height: "24px", transform: "translateY(11.333333333333332px)" });
  });
});
