import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EDITORIAL_PREVIEWS, resolveEditorialPreview } from "./editorial-preview";

test("editorial lab exposes exactly the three canaries and all three Mitiperstat versions", () => {
  assert.deepEqual(Object.keys(EDITORIAL_PREVIEWS).sort(), ["41910396", "42670964", "42717033"]);
  const approved = resolveEditorialPreview("42717033", "approved");
  const generic = resolveEditorialPreview("42717033", "generic");
  const experimental = resolveEditorialPreview("42717033", "experimental");
  assert.notEqual(approved.document.id, generic.document.id);
  assert.notEqual(approved.document.id, experimental.document.id);
  assert.notEqual(generic.document.id, experimental.document.id);
  assert.equal(approved.version, "approved");
  assert.equal(generic.version, "generic");
  assert.equal(experimental.version, "experimental");
  assert.match(experimental.document.id, /experimental-projection-v1$/);
});

test("Iptacopan and clopidogrel previews are generic composer documents", () => {
  for (const pmid of ["41910396", "42670964"] as const) {
    const preview = resolveEditorialPreview(pmid, "approved");
    assert.equal(preview.version, "generic");
    assert.match(preview.document.id, /generic-v1$/);
    assert.match(preview.document.sourceCoverage.statement, /resumo indexado/i);
    assert.match(
      preview.document.sourceCoverage.statement,
      /Não houve revisão autorizada do texto completo/i,
    );
  }
});

test("the internal route is not linked from Home, feed, navigation, or catalog", async () => {
  const publicSurfaces = await Promise.all(
    [
      "src/routes/_app/index.tsx",
      "src/components/scientific-feed.tsx",
      "src/components/bottom-nav.tsx",
      "src/lib/scientific-catalog.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const source of publicSurfaces) assert.doesNotMatch(source, /scientific-preview/);
});

test("the generic composer remains PMID-agnostic", async () => {
  const composer = await readFile("src/server/scientific/dose-document/rct-composer.ts", "utf8");
  assert.doesNotMatch(composer, /41910396|42670964|42717033/);
});
