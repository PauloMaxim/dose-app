import type { Session } from "@supabase/supabase-js";
import { createContext } from "react";

export type AuthContextValue = { session: Session | null; isPending: boolean };
export const AuthContext = createContext<AuthContextValue>({ session: null, isPending: true });
