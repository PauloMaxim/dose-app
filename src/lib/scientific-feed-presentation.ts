import type { StudyType } from "@/server/scientific/classification";
import type { RankedFeedItem } from "@/server/scientific/feed";

export interface ScientificFeedPresentation {
  id: string;
  title: string;
  authors: string[];
  journal: string | null;
  publisher: string | null;
  publishedAt: string;
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  publicationTypes: string[];
  abstract: string | null;
  sourceLinks: Array<{ label: string; url: string }>;
  studyType: StudyType;
  matchedTopics: Array<{ topicId: string; specialtyId: string | null; confidence: number }>;
  relevance: {
    score: number;
    rank: number;
    topicMatch: number;
    savedPreference: number;
  };
}

const safeSourceLink = (label: string, value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? { label, url: value } : null;
  } catch {
    return null;
  }
};

export function presentScientificFeedItem(item: RankedFeedItem): ScientificFeedPresentation {
  const article = item.article;
  const links = [
    safeSourceLink("Fonte original", article.originalUrl),
    safeSourceLink("PubMed", article.pubmedUrl),
    safeSourceLink("PubMed Central", article.pmcUrl),
    safeSourceLink("DOI", article.doiUrl),
  ].filter((link): link is { label: string; url: string } => Boolean(link));

  return {
    id: article.id,
    title: article.title,
    authors: article.authors
      .map(
        (author) =>
          author.collectiveName ?? [author.given, author.family].filter(Boolean).join(" "),
      )
      .filter(Boolean),
    journal: article.journal,
    publisher: article.publisher,
    publishedAt: article.publishedAt!,
    doi: article.doi,
    pmid: article.pmid,
    pmcid: article.pmcid,
    publicationTypes: [...article.publicationTypes],
    abstract: article.abstract,
    sourceLinks: links.filter(
      (link, index) => links.findIndex((candidate) => candidate.url === link.url) === index,
    ),
    studyType: item.classification.studyType,
    matchedTopics: item.matchedTopics.map((topic) => ({
      topicId: topic.topicId,
      specialtyId: topic.specialtyId,
      confidence: topic.confidence,
    })),
    relevance: {
      score: item.scoreTotal,
      rank: item.rank,
      topicMatch: item.scoreComponents.topicMatch,
      savedPreference: item.scoreComponents.savedPreference,
    },
  };
}
