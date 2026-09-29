import "../server-only";
import { chmod, mkdir, open, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ExperimentAttemptClaim,
  ExperimentAttemptCompletion,
  RestrictedExperimentAttemptLedger,
} from "./real-experiment.server";

interface PersistedAttempt extends ExperimentAttemptClaim {
  completion?: ExperimentAttemptCompletion;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * A deliberately small, server-only ledger for the one controlled experiment.
 *
 * The ledger directory must live on storage shared by every operator process. A mkdir lock makes
 * the read/check/write claim critical section atomic. The lock is intentionally never stolen: an
 * abandoned lock blocks execution rather than risking a second paid request after a crash.
 */
export class DurableRestrictedExperimentAttemptLedger implements RestrictedExperimentAttemptLedger {
  private readonly attemptsDirectory: string;
  private readonly lockDirectory: string;

  constructor(private readonly directory: string) {
    this.attemptsDirectory = join(directory, "attempts");
    this.lockDirectory = join(directory, "claim.lock");
  }

  private async initialize(): Promise<void> {
    await mkdir(this.attemptsDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    await chmod(this.attemptsDirectory, 0o700);
  }

  private attemptPath(confirmationId: string): string {
    return join(this.attemptsDirectory, `${safeSegment(confirmationId)}.json`);
  }

  private async records(): Promise<PersistedAttempt[]> {
    const indexPath = join(this.directory, "claims.jsonl");
    try {
      const content = await readFile(indexPath, "utf8");
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as PersistedAttempt);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async claim(attempt: ExperimentAttemptClaim): Promise<boolean> {
    await this.initialize();
    try {
      await mkdir(this.lockDirectory, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }

    // Do not remove the lock until the durable claim is on disk. A crash can therefore only fail
    // closed. Recovery requires a human ledger inspection, never an automatic retry.
    const records = await this.records();
    const duplicate = records.some(
      (record) =>
        record.confirmationId === attempt.confirmationId ||
        (record.experimentId === attempt.experimentId &&
          record.caseFingerprint === attempt.caseFingerprint &&
          record.label === attempt.label),
    );
    const experimentAttempts = records.filter(
      (record) =>
        record.experimentId === attempt.experimentId &&
        record.caseFingerprint === attempt.caseFingerprint,
    );
    if (duplicate || experimentAttempts.length >= 2) {
      await rmdir(this.lockDirectory);
      return false;
    }

    const record = `${JSON.stringify(attempt)}\n`;
    const index = await open(join(this.directory, "claims.jsonl"), "a", 0o600);
    try {
      await index.writeFile(record);
      await index.sync();
    } finally {
      await index.close();
    }
    const claimFile = await open(this.attemptPath(attempt.confirmationId), "wx", 0o600);
    try {
      await claimFile.writeFile(JSON.stringify(attempt, null, 2));
      await claimFile.sync();
    } finally {
      await claimFile.close();
    }
    const attemptsDirectory = await open(this.attemptsDirectory, "r");
    try {
      await attemptsDirectory.sync();
    } finally {
      await attemptsDirectory.close();
    }
    // An exception above deliberately leaves the lock in place: guessing whether a paid request
    // crossed the boundary would be less safe than requiring human ledger inspection.
    await rmdir(this.lockDirectory);
    return true;
  }

  async complete(completion: ExperimentAttemptCompletion): Promise<void> {
    await this.initialize();
    const path = this.attemptPath(completion.confirmationId);
    const current = JSON.parse(await readFile(path, "utf8")) as ExperimentAttemptClaim;
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify({ ...current, completion }, null, 2), {
      mode: 0o600,
    });
    await rename(temporary, path);
    const directory = await open(this.attemptsDirectory, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
