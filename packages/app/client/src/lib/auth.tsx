import { createContext, useContext, useMemo, type ReactNode } from "react";

// Two auth modes. Dev: the server signs every request in as the seeded Admin. Clerk: the client
// obtains a session token and sends it as a bearer. The Clerk provider is only loaded when a key exists.
export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

type AuthValue = {
  mode: "dev" | "clerk";
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  mode: "dev",
  getToken: async () => null,
  signOut: async () => {},
});

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthValue>(() => ({ mode: "dev", getToken: async () => null, signOut: async () => {} }), []);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function ClerkBridge({ children, getToken, signOut }: { children: ReactNode; getToken: () => Promise<string | null>; signOut: () => Promise<void> }) {
  const value = useMemo<AuthValue>(() => ({ mode: "clerk", getToken, signOut }), [getToken, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
