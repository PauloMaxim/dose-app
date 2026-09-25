// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScientificEditorialPreview } from "@/components/scientific-editorial-preview";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("scientific editorial preview lab", () => {
  it.each([
    ["42717033", "approved"],
    ["42717033", "generic"],
    ["42717033", "experimental"],
    ["41910396", "generic"],
    ["42670964", "generic"],
  ] as const)("renders PMID %s in its %s version", (pmid, version) => {
    render(<ScientificEditorialPreview pmid={pmid} version={version} />);
    expect(screen.getByText("Preview editorial — não publicado")).toBeTruthy();
    expect(screen.getByText("Cobertura da fonte")).toBeTruthy();
    const selector = screen.getByRole("navigation", { name: "Selecionar estudo canário" });
    expect(
      within(selector)
        .getByRole("link", { name: new RegExp(`PMID ${pmid}`) })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("keeps validation metadata out of the primary editorial opening", () => {
    const { container } = render(<ScientificEditorialPreview pmid="41910396" version="generic" />);
    const opening = container.querySelector('[aria-labelledby="opening-heading"]');
    expect(opening).not.toBeNull();
    expect(
      within(opening as HTMLElement).queryByText(/reviewStatus|operationalStatus|ready_for_review/),
    ).toBeNull();
    expect(screen.getByText("Informações de validação")).toBeTruthy();
    expect(screen.getByText(/full text autorizado: não/i)).toBeTruthy();
  });

  it("offers all three versions only for Mitiperstat", () => {
    const { rerender } = render(<ScientificEditorialPreview pmid="42717033" version="approved" />);
    expect(screen.getByRole("link", { name: "Versão aprovada" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Composer determinístico" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Editorial profundo experimental" })).toBeTruthy();

    rerender(<ScientificEditorialPreview pmid="42717033" version="experimental" />);
    expect(screen.getByText("Editorial profundo — experimental — revisão pendente")).toBeTruthy();

    rerender(<ScientificEditorialPreview pmid="42670964" version="generic" />);
    expect(screen.queryByRole("link", { name: "Versão aprovada" })).toBeNull();
  });
});
