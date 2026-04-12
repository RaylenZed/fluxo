"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If setup is required, redirect to /setup
  useEffect(() => {
    authApi.me().then((res) => {
      if (res.authenticated) router.replace("/");
      else if (res.setupRequired) router.replace("/setup");
    }).catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.login(password);
      router.replace("/");
    } catch {
      toast.error("Invalid password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--canvas)]">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-[var(--background)] shadow-[0_4px_32px_rgba(0,0,0,0.10)]">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Fluxo</h1>
        <p className="text-sm text-[var(--muted)] mb-6">Enter your password to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value="admin"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            autoComplete="username"
            className="sr-only"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
