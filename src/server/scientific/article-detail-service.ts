import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { scientificArticleIdSchema } from "./article-detail";

export const readMyScientificArticleDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => scientificArticleIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { readScientificArticleDetailForAuthenticatedUser } =
      await import("./article-detail.server");
    return readScientificArticleDetailForAuthenticatedUser(data, context);
  });
