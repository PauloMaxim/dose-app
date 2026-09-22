import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../../lib/auth/middleware";

const inputSchema = z
  .object({
    asOf: z.string().datetime(),
    cursor: z.string().optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    mode: z.enum(["recent", "classics"]).optional(),
    recentDays: z.number().int().positive().optional(),
  })
  .strict();

export type ScientificFeedInput = z.infer<typeof inputSchema>;

/** Authenticated server function; user identity is derived exclusively from the validated session. */
export const readMyScientificFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { readScientificFeedForAuthenticatedUser } = await import("./feed-service.server");
    return readScientificFeedForAuthenticatedUser(data, context);
  });
