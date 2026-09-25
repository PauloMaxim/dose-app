import { createFileRoute } from "@tanstack/react-router";
import { ScientificEditorialPreview } from "@/components/scientific-editorial-preview";
import type {
  PreviewPmid,
  PreviewVersion,
} from "@/server/scientific/dose-document/editorial-preview";

const pmids = new Set<PreviewPmid>(["42717033", "41910396", "42670964"]);

export const Route = createFileRoute("/internal/scientific-preview")({
  validateSearch: (search: Record<string, unknown>) => ({
    pmid: pmids.has(search.pmid as PreviewPmid)
      ? (search.pmid as PreviewPmid)
      : ("42717033" as const),
    version: search.version === "generic" ? ("generic" as const) : ("approved" as const),
  }),
  head: () => ({
    meta: [
      { title: "Laboratório editorial RCT — Dose" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ScientificPreviewRoute,
});

function ScientificPreviewRoute() {
  const search = Route.useSearch() as { pmid: PreviewPmid; version: PreviewVersion };
  return <ScientificEditorialPreview pmid={search.pmid} version={search.version} />;
}
