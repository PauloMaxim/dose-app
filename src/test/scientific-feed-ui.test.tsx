// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScientificFeedCard, ScientificFeedStatus } from "@/components/scientific-feed";
import type { ScientificFeedPresentation } from "@/lib/scientific-feed-presentation";

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

describe("scientific feed classification presentation", () => {
  it("shows study type without claiming evidence certainty", () => {
    const item: ScientificFeedPresentation = {
      id: "article",
      title: "Original title",
      authors: [],
      journal: "Journal",
      publisher: null,
      publishedAt: "2026-09-01",
      doi: null,
      pmid: "123",
      pmcid: null,
      publicationTypes: ["Randomized Controlled Trial"],
      abstract: null,
      sourceLinks: [{ label: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/123/" }],
      studyType: "randomized_trial",
      matchedTopics: [{ topicId: "topic", specialtyId: "specialty", confidence: 0.8 }],
      relevance: { score: 1, rank: 1, topicMatch: 1, savedPreference: 0 },
    };

    render(<ScientificFeedCard item={item} />);
    expect(screen.getByText("Ensaio randomizado")).toBeTruthy();
    expect(screen.queryByText(/Evidência (alta|moderada|baixa|muito baixa)/i)).toBeNull();
  });
});
