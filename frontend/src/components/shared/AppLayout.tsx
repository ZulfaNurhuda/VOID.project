import { Outlet } from "@tanstack/react-router";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps = {}) {
  return (
    <div className="flex h-screen overflow-hidden bg-void-bg">
      {/* Background grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <Sidebar />
      <main className="relative z-10 ml-64 flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
