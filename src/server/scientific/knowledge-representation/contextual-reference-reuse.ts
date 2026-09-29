import "../server-only";
import { z } from "zod";
import { normalizeDoi } from "../identity";
import { normalizePmcid, normalizePmid } from "../persistence-boundary";
import { contextualNeedId } from "./contextual-authorization";
import {
  bibliographicCandidateSchema,
  type BibliographicCandidate,
} from "./contextual-bibliographic-discovery";
import { contextualNeedSchema, type ContextualNeed } from "./contextual-need";
import {
  externalContextAcquisitionSchema,
  type ExternalContextAcquisition,
} from "./external-context-acquisition";
import {
  externalContextReferenceSchema,
  type ExternalContextReference,
} from "./external-context-reference";

export const CONTEXTUAL_REFERENCE_REUSE_POLICY_VERSION =
  "contextual-reference-reuse-policy.v1" as const;
export const CONTEXTUAL_REFERENCE_REUSE_EVALUATION_VERSION =
  "contextual-reference-reuse-evaluation.v1" as const;
export const VERIFIED_SOURCE_OBSERVATION_VERSION = "verified-source-observation.v1" as const;

const id = z.string().trim().min(1).max(500);
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const contentScopeSchema = z.enum([
  "metadata",
  "abstract",
  "excerpt",
  "page_or_section",
  "full_text",
]);

export const contextualReferenceReusePolicySchema = z
  .object({
    schemaVersion: z.literal(CONTEXTUAL_REFERENCE_REUSE_POLICY_VERSION),
    maximumAgeDays: z.number().int().nonnegative().nullable(),
    maximumObservationAgeDays: z.number().int().nonnegative(),
    acceptedContentScopes: z.array(contentScopeSchema).min(1),
    allowedAccessStatuses: z.array(z.enum(["publicly_accessible", "restricted", "unknown"])).min(1),
    requireDeclaredLicense: z.boolean(),
  })
  .strict()
  .superRefine((policy, context) => {
    for (const field of ["acceptedContentScopes", "allowedAccessStatuses"] as const)
      if (new Set(policy[field]).size !== policy[field].length)
        context.addIssue({ code: "custom", path: [field], message: `${field} must be unique` });
  });

export type ContextualReferenceReusePolicy = z.infer<typeof contextualReferenceReusePolicySchema>;

export const verifiedSourceObservationSchema = z
  .object({
    schemaVersion: z.literal(VERIFIED_SOURCE_OBSERVATION_VERSION),
    id,
    referenceId: id,
    acquisitionId: id.optional(),
    observedAt: z.iso.datetime({ offset: true }),
    verifiedBy: z.object({ id }).strict(),
    sourceState: z.enum(["unchanged", "changed", "unknown"]),
    sourceVersion: z.string().trim().min(1).max(200).nullable(),
    declaredSourceChecksum: checksum.nullable(),
    declaredAnchorsIntegrity: z.enum(["valid", "invalid", "unknown"]),
    externalVerification: z.discriminatedUnion("status", [
      z.object({ status: z.literal("not_provided") }).strict(),
      z
        .object({
          status: z.literal("source_checked"),
          method: z.literal("manual_source_comparison"),
          evidenceLocator: z
            .url()
            .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
          comparedContentScope: contentScopeSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export type VerifiedSourceObservation = z.infer<typeof verifiedSourceObservationSchema>;

export const CONTEXTUAL_REFERENCE_REUSE_REASON_CODES = [
  "ACQUISITION_ABSENT",
  "ACQUISITION_ARTIFACT_INVALID",
  "ACQUISITION_FUTURE_DATED",
  "ACQUISITION_OUTSIDE_TEMPORAL_POLICY",
  "ANCHORS_INVALID",
  "ANCHORS_UNCONFIRMED",
  "ARTICLE_SCOPE_MISMATCH",
  "BIBLIOGRAPHIC_IDENTITY_CONFLICT",
  "BIBLIOGRAPHIC_IDENTITY_UNCONFIRMED",
  "CHECKSUM_CHANGED",
  "CONTENT_SCOPE_INSUFFICIENT",
  "EXTERNAL_CURRENCY_UNCONFIRMED",
  "LICENSE_INCOMPATIBLE_WITH_POLICY",
  "REFERENCE_ACQUISITION_MISMATCH",
  "REFERENCE_ARTIFACT_INVALID",
  "SOURCE_CHANGED",
  "SOURCE_VERSION_CHANGED",
  "SOURCE_VERSION_UNCONFIRMED",
  "OBSERVATION_CHECKSUM_UNAVAILABLE",
  "OBSERVATION_EVIDENCE_INSUFFICIENT",
  "OBSERVATION_OUTSIDE_TEMPORAL_POLICY",
  "OBSERVATIONS_CONTRADICTORY",
  "TEMPORAL_POLICY_SATISFIED",
  "TEMPORAL_STATUS_UNDETERMINED",
  "ACCESS_INCOMPATIBLE_WITH_POLICY",
  "VERIFIED_OBSERVATION_FUTURE_DATED",
  "VERIFIED_OBSERVATION_INVALID",
  "VERIFIED_OBSERVATION_SCOPE_MISMATCH",
] as const;

const reasonCodeSchema = z.enum(CONTEXTUAL_REFERENCE_REUSE_REASON_CODES);
export type ContextualReferenceReuseReasonCode = z.infer<typeof reasonCodeSchema>;

export const contextualReferenceReuseEvaluationSchema = z
  .object({
    schemaVersion: z.literal(CONTEXTUAL_REFERENCE_REUSE_EVALUATION_VERSION),
    evaluatedAt: z.iso.datetime({ offset: true }),
    state: z.enum([
      "candidate_for_reuse_with_human_review",
      "update_or_reverification_required",
      "reuse_blocked",
    ]),
    temporalPolicyCompliance: z.enum(["compliant", "noncompliant", "indeterminate"]),
    externalSourceCurrency: z.enum(["confirmed_current", "known_changed", "unconfirmed"]),
    evidenceAssessment: z
      .object({
        localAcquisitionIntegrity: z.enum(["valid", "invalid", "not_available"]),
        localAnchorIntegrity: z.enum(["valid", "invalid", "not_available"]),
        externalObservationEvidence: z.enum(["sufficient", "insufficient", "not_available"]),
      })
      .strict(),
    artifactIds: z
      .object({
        articleId: id,
        contextualNeedId: id,
        referenceId: id,
        acquisitionId: id.nullable(),
        bibliographicCandidateIdentifier: z.string().nullable(),
        observationIds: z.array(id),
      })
      .strict(),
    reasonCodes: z.array(reasonCodeSchema).min(1),
    createsEditorialAuthorization: z.literal(false),
  })
  .strict();

export type ContextualReferenceReuseEvaluation = z.infer<
  typeof contextualReferenceReuseEvaluationSchema
>;

export interface EvaluateContextualReferenceReuseInput {
  contextualNeed: ContextualNeed;
  reference: ExternalContextReference;
  acquisition?: ExternalContextAcquisition;
  bibliographicCandidate?: BibliographicCandidate;
  asOf: string;
  policy: ContextualReferenceReusePolicy;
  verifiedObservations?: readonly VerifiedSourceObservation[];
}

const blockedReasons = new Set<ContextualReferenceReuseReasonCode>([
  "ACQUISITION_ARTIFACT_INVALID",
  "ANCHORS_INVALID",
  "ARTICLE_SCOPE_MISMATCH",
  "BIBLIOGRAPHIC_IDENTITY_CONFLICT",
  "CHECKSUM_CHANGED",
  "REFERENCE_ACQUISITION_MISMATCH",
  "REFERENCE_ARTIFACT_INVALID",
  "SOURCE_CHANGED",
  "VERIFIED_OBSERVATION_INVALID",
  "VERIFIED_OBSERVATION_SCOPE_MISMATCH",
]);

const refreshReasons = new Set<ContextualReferenceReuseReasonCode>([
  "ACQUISITION_ABSENT",
  "ACQUISITION_FUTURE_DATED",
  "ACQUISITION_OUTSIDE_TEMPORAL_POLICY",
  "ANCHORS_UNCONFIRMED",
  "BIBLIOGRAPHIC_IDENTITY_UNCONFIRMED",
  "CONTENT_SCOPE_INSUFFICIENT",
  "EXTERNAL_CURRENCY_UNCONFIRMED",
  "LICENSE_INCOMPATIBLE_WITH_POLICY",
  "SOURCE_VERSION_CHANGED",
  "SOURCE_VERSION_UNCONFIRMED",
  "OBSERVATION_CHECKSUM_UNAVAILABLE",
  "OBSERVATION_EVIDENCE_INSUFFICIENT",
  "TEMPORAL_STATUS_UNDETERMINED",
  "ACCESS_INCOMPATIBLE_WITH_POLICY",
  "VERIFIED_OBSERVATION_FUTURE_DATED",
]);

function normalizeIdentifier(scheme: string, value: string | null | undefined) {
  if (!value) return null;
  const normalizedScheme = scheme.trim().toLowerCase();
  if (normalizedScheme === "doi") return normalizeDoi(value);
  if (normalizedScheme === "pmid") return normalizePmid(value);
  if (normalizedScheme === "pmcid") return normalizePmcid(value);
  return value.trim().toLowerCase();
}

function candidateKey(candidate: BibliographicCandidate | undefined) {
  return candidate
    ? `${candidate.canonicalIdentifier.scheme}:${candidate.canonicalIdentifier.value}`
    : null;
}

function localAnchorsAreValid(acquisition: ExternalContextAcquisition) {
  const content = Array.from(acquisition.content.value);
  const anchorIds = new Set<string>();
  return acquisition.anchors.every((anchor) => {
    if (anchorIds.has(anchor.id)) return false;
    anchorIds.add(anchor.id);
    return (
      anchor.acquisitionId === acquisition.id &&
      anchor.locator.end > anchor.locator.start &&
      content.slice(anchor.locator.start, anchor.locator.end).join("") === anchor.excerpt
    );
  });
}

/**
 * Offline, deterministic advisory boundary. It never mutates inputs and never creates or reuses a
 * claim, authorization, human approval, contextual material, or scientific fact.
 */
export function evaluateContextualReferenceReuse(
  input: EvaluateContextualReferenceReuseInput,
): ContextualReferenceReuseEvaluation {
  const need = contextualNeedSchema.parse(structuredClone(input.contextualNeed));
  const policy = contextualReferenceReusePolicySchema.parse(structuredClone(input.policy));
  const asOf = z.iso.datetime({ offset: true }).parse(input.asOf);
  const asOfTime = Date.parse(asOf);
  const exactNeedId = contextualNeedId(need);
  const reasons = new Set<ContextualReferenceReuseReasonCode>();

  const referenceResult = externalContextReferenceSchema.safeParse(
    structuredClone(input.reference),
  );
  const reference = referenceResult.success ? referenceResult.data : undefined;
  if (!reference) reasons.add("REFERENCE_ARTIFACT_INVALID");

  const acquisitionResult = input.acquisition
    ? externalContextAcquisitionSchema.safeParse(structuredClone(input.acquisition))
    : undefined;
  const acquisition = acquisitionResult?.success ? acquisitionResult.data : undefined;
  if (input.acquisition && !acquisition) reasons.add("ACQUISITION_ARTIFACT_INVALID");
  if (!input.acquisition) reasons.add("ACQUISITION_ABSENT");

  const candidateResult = input.bibliographicCandidate
    ? bibliographicCandidateSchema.safeParse(structuredClone(input.bibliographicCandidate))
    : undefined;
  const candidate = candidateResult?.success ? candidateResult.data : undefined;
  if (input.bibliographicCandidate && !candidate) reasons.add("BIBLIOGRAPHIC_IDENTITY_UNCONFIRMED");

  if (candidate) {
    if (
      candidate.contextualNeed.articleId !== need.articleId ||
      contextualNeedId(candidate.contextualNeed) !== exactNeedId ||
      candidate.discoveryProvenance.contextualNeedId !== exactNeedId
    )
      reasons.add("ARTICLE_SCOPE_MISMATCH");

    if (reference) {
      const referenceScheme = reference.canonicalIdentifier.scheme.toLowerCase();
      const referenceValue = normalizeIdentifier(
        referenceScheme,
        reference.canonicalIdentifier.value,
      );
      const canonicalMatches =
        referenceScheme === candidate.canonicalIdentifier.scheme &&
        referenceValue ===
          normalizeIdentifier(
            candidate.canonicalIdentifier.scheme,
            candidate.canonicalIdentifier.value,
          );
      const identifierConflicts = (["doi", "pmid", "pmcid"] as const).some((scheme) => {
        if (referenceScheme !== scheme || !candidate.identifiers[scheme]) return false;
        return referenceValue !== normalizeIdentifier(scheme, candidate.identifiers[scheme]);
      });
      if (!canonicalMatches || identifierConflicts) reasons.add("BIBLIOGRAPHIC_IDENTITY_CONFLICT");
    }
  } else reasons.add("BIBLIOGRAPHIC_IDENTITY_UNCONFIRMED");

  let temporalPolicyCompliance: ContextualReferenceReuseEvaluation["temporalPolicyCompliance"] =
    "indeterminate";
  if (acquisition) {
    if (reference && acquisition.externalContextReferenceId !== reference.id)
      reasons.add("REFERENCE_ACQUISITION_MISMATCH");
    const retrievedAt = Date.parse(acquisition.retrievedAt);
    if (!Number.isFinite(retrievedAt)) reasons.add("TEMPORAL_STATUS_UNDETERMINED");
    else if (retrievedAt > asOfTime) reasons.add("ACQUISITION_FUTURE_DATED");
    else if (
      policy.maximumAgeDays !== null &&
      asOfTime - retrievedAt > policy.maximumAgeDays * 86_400_000
    ) {
      temporalPolicyCompliance = "noncompliant";
      reasons.add("ACQUISITION_OUTSIDE_TEMPORAL_POLICY");
    } else {
      temporalPolicyCompliance = "compliant";
      reasons.add("TEMPORAL_POLICY_SATISFIED");
    }

    if (!policy.acceptedContentScopes.includes(acquisition.contentScope))
      reasons.add("CONTENT_SCOPE_INSUFFICIENT");
    if (!policy.allowedAccessStatuses.includes(acquisition.accessAndLicensing.accessStatus))
      reasons.add("ACCESS_INCOMPATIBLE_WITH_POLICY");
    if (
      policy.requireDeclaredLicense &&
      acquisition.accessAndLicensing.license.status !== "declared"
    )
      reasons.add("LICENSE_INCOMPATIBLE_WITH_POLICY");
  } else reasons.add("TEMPORAL_STATUS_UNDETERMINED");

  let externalSourceCurrency: ContextualReferenceReuseEvaluation["externalSourceCurrency"] =
    "unconfirmed";
  const observations = [...(input.verifiedObservations ?? [])]
    .map((observation) => verifiedSourceObservationSchema.safeParse(structuredClone(observation)))
    .sort((left, right) =>
      JSON.stringify(left.success ? left.data : left.error.issues).localeCompare(
        JSON.stringify(right.success ? right.data : right.error.issues),
        "en",
      ),
    );
  const validObservations: VerifiedSourceObservation[] = [];
  const scopedObservations: VerifiedSourceObservation[] = [];
  for (const observationResult of observations) {
    if (!observationResult.success) {
      reasons.add("VERIFIED_OBSERVATION_INVALID");
      continue;
    }
    const observation = observationResult.data;
    validObservations.push(observation);
    if (
      !reference ||
      observation.referenceId !== reference.id ||
      (observation.acquisitionId !== undefined && observation.acquisitionId !== acquisition?.id)
    ) {
      reasons.add("VERIFIED_OBSERVATION_SCOPE_MISMATCH");
      continue;
    }
    if (Date.parse(observation.observedAt) > asOfTime) {
      reasons.add("VERIFIED_OBSERVATION_FUTURE_DATED");
      continue;
    }
    scopedObservations.push(observation);
  }

  const recentObservations = scopedObservations.filter((observation) => {
    const isRecent =
      asOfTime - Date.parse(observation.observedAt) <=
      policy.maximumObservationAgeDays * 86_400_000;
    if (!isRecent) reasons.add("OBSERVATION_OUTSIDE_TEMPORAL_POLICY");
    return isRecent;
  });
  const declaredStates = new Set(
    recentObservations.map(({ sourceState }) => sourceState).filter((state) => state !== "unknown"),
  );
  if (declaredStates.size > 1) reasons.add("OBSERVATIONS_CONTRADICTORY");

  for (const observation of recentObservations) {
    if (observation.sourceState === "changed") reasons.add("SOURCE_CHANGED");
    if (observation.declaredAnchorsIntegrity === "invalid") reasons.add("ANCHORS_INVALID");
    if (observation.sourceVersion && reference?.sourceVersion) {
      if (observation.sourceVersion !== reference.sourceVersion)
        reasons.add("SOURCE_VERSION_CHANGED");
    }
    if (
      observation.declaredSourceChecksum &&
      acquisition &&
      observation.declaredSourceChecksum !== acquisition.checksum.value
    )
      reasons.add("CHECKSUM_CHANGED");
  }

  const completeCurrentObservations = recentObservations.filter(
    (observation) =>
      acquisition !== undefined &&
      observation.acquisitionId === acquisition.id &&
      observation.sourceState === "unchanged" &&
      observation.declaredSourceChecksum === acquisition.checksum.value &&
      observation.declaredAnchorsIntegrity === "valid" &&
      observation.externalVerification.status === "source_checked" &&
      observation.externalVerification.comparedContentScope === acquisition.contentScope &&
      (!reference?.sourceVersion || observation.sourceVersion === reference.sourceVersion),
  );
  if (recentObservations.some(({ sourceState }) => sourceState === "changed"))
    externalSourceCurrency = "known_changed";
  else if (completeCurrentObservations.length > 0) externalSourceCurrency = "confirmed_current";
  else {
    reasons.add("EXTERNAL_CURRENCY_UNCONFIRMED");
    if (
      reference?.sourceVersion &&
      !recentObservations.some(({ sourceVersion }) => sourceVersion === reference.sourceVersion)
    )
      reasons.add("SOURCE_VERSION_UNCONFIRMED");
    for (const observation of recentObservations) {
      if (!observation.declaredSourceChecksum) reasons.add("OBSERVATION_CHECKSUM_UNAVAILABLE");
      if (observation.declaredAnchorsIntegrity === "unknown") reasons.add("ANCHORS_UNCONFIRMED");
      if (
        observation.externalVerification.status !== "source_checked" ||
        observation.acquisitionId !== acquisition?.id ||
        (acquisition &&
          observation.externalVerification.status === "source_checked" &&
          observation.externalVerification.comparedContentScope !== acquisition.contentScope)
      )
        reasons.add("OBSERVATION_EVIDENCE_INSUFFICIENT");
    }
  }

  if (reasons.size === 0) reasons.add("EXTERNAL_CURRENCY_UNCONFIRMED");
  const reasonCodes = [...reasons].sort();
  const state = reasonCodes.some((reason) => blockedReasons.has(reason))
    ? "reuse_blocked"
    : reasonCodes.some((reason) => refreshReasons.has(reason))
      ? "update_or_reverification_required"
      : "candidate_for_reuse_with_human_review";

  return contextualReferenceReuseEvaluationSchema.parse({
    schemaVersion: CONTEXTUAL_REFERENCE_REUSE_EVALUATION_VERSION,
    evaluatedAt: asOf,
    state,
    temporalPolicyCompliance,
    externalSourceCurrency,
    evidenceAssessment: {
      localAcquisitionIntegrity: input.acquisition
        ? acquisition
          ? "valid"
          : "invalid"
        : "not_available",
      localAnchorIntegrity: input.acquisition
        ? localAnchorsAreValid(input.acquisition)
          ? "valid"
          : "invalid"
        : "not_available",
      externalObservationEvidence:
        externalSourceCurrency === "confirmed_current"
          ? "sufficient"
          : validObservations.length > 0
            ? "insufficient"
            : "not_available",
    },
    artifactIds: {
      articleId: need.articleId,
      contextualNeedId: exactNeedId,
      referenceId: reference?.id ?? input.reference.id,
      acquisitionId: acquisition?.id ?? input.acquisition?.id ?? null,
      bibliographicCandidateIdentifier: candidateKey(candidate),
      observationIds: validObservations.map(({ id }) => id).sort(),
    },
    reasonCodes,
    createsEditorialAuthorization: false,
  });
}
