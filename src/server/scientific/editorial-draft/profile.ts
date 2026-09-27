import { editorialGenerationProfileSchema, type EditorialGenerationProfile } from "./contracts";

/** Versioned editorial policy; it controls presentation, never scientific truth. */
export const DOSE_PROGRESSIVE_EDITORIAL_PROFILE: EditorialGenerationProfile =
  editorialGenerationProfileSchema.parse({
    version: "editorial-generation-profile.v1",
    targetLanguage: "pt-BR",
    audience: "health_professionals",
    comprehensionDepth: "progressive",
  });
