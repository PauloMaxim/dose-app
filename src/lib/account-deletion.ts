export type AccountDeletionClientPort = {
  deleteAccount: () => Promise<unknown>;
  clearPrivateState: () => void;
  clearPrivateStorage: () => Promise<void>;
  clearAuthAndRedirect: (path: string) => Promise<void>;
};

/** Runs client cleanup only after the privileged server operation reports success. */
export async function completeAccountDeletion(port: AccountDeletionClientPort): Promise<void> {
  await port.deleteAccount();
  port.clearPrivateState();
  try {
    await port.clearPrivateStorage();
  } catch {
    // Storage APIs can be unavailable in hardened/private browser contexts.
    // Continue with the in-memory and authentication cleanup.
  } finally {
    // Clearing persisted storage can trigger middleware writes; reset once more
    // so neither rendered nor subsequently persisted state contains user data.
    port.clearPrivateState();
  }
  await port.clearAuthAndRedirect("/login");
}

/** Clears only Dose-owned device data; it deliberately has no remote account/auth dependency. */
export async function clearLocalDeviceCache(port: {
  clearPrivateState: () => void;
  clearPrivateStorage: () => Promise<void>;
}): Promise<void> {
  port.clearPrivateState();
  try {
    await port.clearPrivateStorage();
  } finally {
    port.clearPrivateState();
  }
}
