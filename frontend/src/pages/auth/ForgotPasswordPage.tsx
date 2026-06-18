import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import api from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch {
      // axios interceptor handles API errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <a
          href="/login"
          className="flex items-center gap-2 text-void-muted hover:text-void-text mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-200" /> Back to login
        </a>
        <h1 className="text-2xl font-bold text-void-text mb-1">Forgot password</h1>
        <p className="text-void-muted mb-6">Enter your email to receive a reset link.</p>
        {submitted ? (
          <div className="p-4 border border-void-success/30 bg-void-success/10 text-void-success">
            If this email exists, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-void-muted"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email address"
                className="w-full pl-9 pr-4 py-3 bg-void-surface border border-void-border text-void-text focus:outline-none focus:border-void-accent focus:ring-2 focus:ring-void-accent/30 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-void-accent text-void-bg font-medium hover:bg-void-accent-dim disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
