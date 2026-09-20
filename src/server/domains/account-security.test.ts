import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { revokeSessionsAndDeleteUser, type AccountDeletionPort } from "./account-security.ts";

describe("account deletion security", () => {
  it("revokes every refresh session before deleting the session-derived user", async () => {
    const calls: string[] = [];
    const port: AccountDeletionPort = {
      async revokeSessions(token) {
        calls.push(`revoke:${token}`);
        return { error: null };
      },
      async deleteUser(userId) {
        calls.push(`delete:${userId}`);
        return { error: null };
      },
    };
    await revokeSessionsAndDeleteUser(port, {
      userId: "verified-user",
      accessToken: "verified-token",
    });
    assert.deepEqual(calls, ["revoke:verified-token", "delete:verified-user"]);
  });

  it("does not delete when session revocation fails", async () => {
    let deleted = false;
    await assert.rejects(() =>
      revokeSessionsAndDeleteUser(
        {
          async revokeSessions() {
            return { error: new Error("unavailable") };
          },
          async deleteUser() {
            deleted = true;
            return { error: null };
          },
        },
        { userId: "verified-user", accessToken: "verified-token" },
      ),
    );
    assert.equal(deleted, false);
  });
});
