export type AccountDeletionPort = {
  revokeSessions: (accessToken: string) => Promise<{ error: unknown | null }>;
  deleteUser: (userId: string) => Promise<{ error: unknown | null }>;
};

/** Revokes refresh sessions before deletion so a partial failure always fails closed. */
export async function revokeSessionsAndDeleteUser(
  port: AccountDeletionPort,
  identity: { userId: string; accessToken: string },
): Promise<void> {
  const revoked = await port.revokeSessions(identity.accessToken);
  if (revoked.error) throw new Error("session revocation failed");
  const deleted = await port.deleteUser(identity.userId);
  if (deleted.error) throw new Error("account deletion failed");
}
