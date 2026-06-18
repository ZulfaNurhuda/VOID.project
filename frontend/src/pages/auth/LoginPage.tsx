import { useState } from "react";
import { ArrowLeft, User, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import SocialLoginButtons from "@/components/shared/SocialLoginButtons";


export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      if ((res as any).requiresTwoFactor) {
        sessionStorage.setItem("void-2fa-temp", (res as any).tempToken ?? "");
        window.location.href = "/verify-2fa";
        return;
      }
      useAuthStore.getState().setAuth((res as any).user);
      window.location.href = "/dashboard/secrets";
    } catch {
      // axios interceptor handles API errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-void-muted hover:text-void-accent transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          Back to VOID
        </a>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-void-text tracking-tight">Sign In</h1>
          <p className="text-void-muted mt-1">Welcome back</p>
        </div>

        <div className="bg-void-surface border border-void-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Username</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim">
                  <User className="w-4 h-4" />
                </div>
                <Input
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-void-muted">Passphrase</label>
                <a
                  href="/forgot-password"
                  className="text-xs text-void-accent hover:text-void-accent-dim font-medium transition-colors"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  type="password"
                  placeholder="Enter your passphrase"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-void-accent hover:bg-void-accent-dim text-void-bg font-medium border-0 mt-1"
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <SocialLoginButtons />

          <div className="mt-6 pt-5 border-t border-void-border text-center">
            <p className="text-void-muted">
              Don't have an account?{" "}
              <a href="/register" className="text-void-accent hover:text-void-accent-dim font-medium transition-colors">
                Sign Up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
