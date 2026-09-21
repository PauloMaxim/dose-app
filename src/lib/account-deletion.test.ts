import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeAccountDeletion, type AccountDeletionClientPort } from "./account-deletion.ts";

describe("account deletion client cleanup", () => {
  it("clears private state and storage before ending auth on a public route", async () => {
    const calls: string[] = [];
    const port: AccountDeletionClientPort = {
      deleteAccount: async () => void calls.push("delete"),
      clearPrivateState: () => void calls.push("reset"),
      clearPrivateStorage: async () => void calls.push("storage"),
      clearAuthAndRedirect: async (path) => void calls.push(`auth:${path}`),
    };

    await completeAccountDeletion(port);

    assert.deepEqual(calls, ["delete", "reset", "storage", "reset", "auth:/login"]);
  });

  it("keeps the session and rendered state when server deletion fails", async () => {
    const calls: string[] = [];
    await assert.rejects(() =>
      completeAccountDeletion({
        deleteAccount: async () => {
          throw new Error("server failed");
        },
        clearPrivateState: () => void calls.push("reset"),
        clearPrivateStorage: async () => void calls.push("storage"),
        clearAuthAndRedirect: async () => void calls.push("auth"),
      }),
    );
    assert.deepEqual(calls, []);
  });
});
