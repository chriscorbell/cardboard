import { ClerkProvider, SignIn, useAuth as useClerkAuth, useUser } from "@clerk/react";
import { useCallback, useEffect, type ReactNode } from "react";
import { ClerkBridge, clerkPublishableKey } from "./auth";
import { setTokenProvider } from "./api";

function Bridge({ children }: { children: ReactNode }) {
  const { getToken, signOut, isLoaded, isSignedIn } = useClerkAuth();
  const { user } = useUser();
  const get = useCallback(() => getToken(), [getToken]);
  const out = useCallback(async () => {
    await signOut();
  }, [signOut]);
  useEffect(() => {
    setTokenProvider(get);
  }, [get]);
  if (!isLoaded) return null;
  if (!isSignedIn || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg p-6">
        <SignIn routing="hash" />
      </div>
    );
  }
  return (
    <ClerkBridge getToken={get} signOut={out}>
      {children}
    </ClerkBridge>
  );
}

export default function ClerkAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey!}
      appearance={{
        variables: {
          colorBackground: "#191816",
          colorForeground: "#ece7de",
          colorMutedForeground: "#a69f93",
          colorPrimary: "#d9a05b",
          colorPrimaryForeground: "#1b1710",
          colorInput: "#121110",
          colorInputForeground: "#ece7de",
          colorBorder: "#3b3833",
          borderRadius: "10px",
          fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif",
        },
      }}
    >
      <Bridge>{children}</Bridge>
    </ClerkProvider>
  );
}
