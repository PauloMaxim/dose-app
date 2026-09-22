// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScientificFeedStatus } from "@/components/scientific-feed";

afterEach(cleanup);

describe("scientific feed states", () => {
  it("announces loading", () => {
    render(<ScientificFeedStatus status="loading" />);
    expect(screen.getByRole("status").textContent).toContain("Carregando");
  });

  it("shows an honest empty state", () => {
    render(<ScientificFeedStatus status="empty" />);
    expect(screen.getByRole("status").textContent).toContain("Nenhum artigo encontrado");
  });

  it("shows an error without demo fallback and retries explicitly", () => {
    const retry = vi.fn();
    render(<ScientificFeedStatus status="error" onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Nenhum conteúdo de demonstração foi usado",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
