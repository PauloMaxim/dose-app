import { z } from "zod";

const serverEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});
const authEnvSchema = serverEnvSchema.pick({ VITE_SUPABASE_URL: true, VITE_SUPABASE_PUBLISHABLE_KEY: true });

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;

function parseEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  if (typeof window !== "undefined") throw new Error("Server environment cannot be read in the browser.");
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid server configuration: ${names}`);
  }
  return result.data;
}

/** Parse sensitive configuration only when server functionality is invoked. */
export function getServerEnv(): ServerEnv {
  return parseEnv(serverEnvSchema);
}

export function getAuthEnv(): AuthEnv {
  return parseEnv(authEnvSchema);
}
