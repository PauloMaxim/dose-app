import assert from "node:assert/strict";
import test from "node:test";
import { mockEvent } from "h3";
import editorialGenerationHandler from "../../../../server/api/scientific-editorial-generation.post";

const MAX_BODY_BYTES = 512;
const token = "test-only-editorial-operation-token-123456789";
const validPayload = JSON.stringify({
  articleId: "pmid:42717033",
  confirmRealGeneration: true,
});

const invoke = async (body: string, headers: Record<string, string> = {}) => {
  const event = mockEvent("http://localhost/api/scientific-editorial-generation", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
  const response = await editorialGenerationHandler(event);
  return { status: event.res.status, response };
};

test.before(() => {
  process.env.SCIENTIFIC_INGESTION_TOKEN = token;
  delete process.env.OPENAI_API_KEY;
});

test("rejects a declared Content-Length above 512 bytes", async () => {
  const result = await invoke("{}", { "content-length": String(MAX_BODY_BYTES + 1) });
  assert.equal(result.status, 413);
  assert.deepEqual(result.response, { ok: false, error: "request_too_large" });
});

test("rejects an oversized body without Content-Length", async () => {
  const result = await invoke("x".repeat(MAX_BODY_BYTES + 1));
  assert.equal(result.status, 413);
  assert.deepEqual(result.response, { ok: false, error: "request_too_large" });
});

test("rejects an oversized body with a subdeclared Content-Length", async () => {
  const result = await invoke("x".repeat(MAX_BODY_BYTES + 1), { "content-length": "2" });
  assert.equal(result.status, 413);
  assert.deepEqual(result.response, { ok: false, error: "request_too_large" });
});

test("rejects an oversized chunked body", async () => {
  const result = await invoke("x".repeat(MAX_BODY_BYTES + 1), {
    "transfer-encoding": "chunked",
  });
  assert.equal(result.status, 413);
  assert.deepEqual(result.response, { ok: false, error: "request_too_large" });
});

test("allows the legitimate payload through the size, auth, and schema gates", async () => {
  assert.ok(Buffer.byteLength(validPayload, "utf8") < MAX_BODY_BYTES);
  const result = await invoke(validPayload);
  assert.equal(result.status, 502);
  assert.equal(result.response.ok, false);
  assert.ok("result" in result.response && result.response.result);
  assert.equal(result.response.result.validationStatus, "not_run");
  assert.equal(result.response.result.error?.code, "configuration");
});

test("continues to reject an invalid payload within the size limit", async () => {
  const result = await invoke(JSON.stringify({ articleId: "pmid:42717033" }));
  assert.equal(result.status, 400);
  assert.deepEqual(result.response, {
    ok: false,
    error: "explicit_confirmation_and_authorized_canary_required",
  });
});
