// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScientificFeedCard, ScientificFeedStatus } from "@/components/scientific-feed";
import { ScientificArticleDetailView } from "@/components/scientific-article-detail";
import type { ScientificFeedPresentation } from "@/lib/scientific-feed-presentation";
import type { ScientificArticleDetail } from "@/server/scientific/article-detail";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, ...props }: any) => (
    <a href={params ? to.replace("$id", params.id) : to} {...props}>
      {children}
    </a>
  ),
}));

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
    expect(screen.getByRole("link", { name: "Original title" }).getAttribute("href")).toBe(
      "/artigo/article",
    );
    expect(screen.getByRole("link", { name: "PubMed" }).getAttribute("target")).toBe("_blank");
  });
});

describe("scientific article detail", () => {
  it("renders an honest missing-abstract state without cover, summary or clinical evidence claims", () => {
    const article: ScientificArticleDetail = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Original title",
      authors: [],
      journal: null,
      publisher: null,
      publishedAt: null,
      doi: null,
      pmid: null,
      pmcid: null,
      abstract: null,
      publicationTypes: [],
      studyType: null,
      classificationVersion: null,
      provenance: [{ provider: "europe_pmc", externalId: "MED/1", sourceUrl: null }],
      sourceLinks: [],
      topics: [],
      specialties: [],
    };
    const { container } = render(<ScientificArticleDetailView article={article} />);
    expect(screen.getByRole("heading", { name: "Original title" })).toBeTruthy();
    expect(screen.getByText("Abstract não disponível neste registro.")).toBeTruthy();
    expect(screen.getByText(/Ainda não há resumo Dose/)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/Nível de evidência|1A|1B/)).toBeNull();
  });

  it("renders a DoseDocument as the primary reading experience and keeps the abstract secondary", () => {
    const article: ScientificArticleDetail = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Original mitiperstat trial title",
      authors: ["Researcher One"],
      journal: "Scientific journal",
      publisher: null,
      publishedAt: "2026-09-01",
      doi: "10.1000/mitiperstat",
      pmid: "42717033",
      pmcid: null,
      abstract: "Original English abstract with 3\u2009m spacing.",
      publicationTypes: ["Randomized Controlled Trial"],
      studyType: "randomized_trial",
      classificationVersion: "v1",
      provenance: [{ provider: "pubmed", externalId: "42717033", sourceUrl: null }],
      sourceLinks: [
        { kind: "pubmed", label: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/42717033/" },
      ],
      topics: [],
      specialties: [],
    };

    render(<ScientificArticleDetailView article={article} />);
    expect(screen.getByRole("heading", { name: /Mitiperstat não melhorou sintomas/ })).toBeTruthy();
    expect(screen.getByText("−1,4 ponto")).toBeTruthy();
    expect(screen.getAllByText("+3,8 m")).toHaveLength(2);
    expect(screen.getByText("Até onde esta Dose consegue ir?")).toBeTruthy();
    const abstractControl = screen.getByText("Ver abstract original em inglês").closest("details");
    expect(abstractControl?.hasAttribute("open")).toBe(false);
    expect(screen.getByText(/Original English abstract with 3\s*m spacing/)).toBeTruthy();
  });
});
