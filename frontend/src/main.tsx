import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { router } from "./router";
import { fetchSession } from "./lib/api";
import { useAuthStore } from "./store/auth";
import { ErrorDisplay } from "./components/shared/ErrorDisplay";
import api from "./lib/api";
import "./index.css";


async function bootstrap() {
  // Check if setup is needed (no users yet)
  try {
    const { data } = await api.get<{ completed: boolean }>("/auth/setup/status");
    if (!data.completed && !window.location.pathname.startsWith("/setup")) {
      window.location.replace("/setup");
      return;
    }
  } catch {
    // If the request fails, proceed normally
  }

  // Restore session from server cookie on page load
  const user = await fetchSession().catch(() => null);
  if (user) useAuthStore.getState().setAuth(user);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ErrorDisplay />
        <Toaster position="top-right" theme="dark" richColors />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
