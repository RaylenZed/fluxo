"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect away if setup is already done
  useEffect(() => {
    authApi.me().then((res) => {
      if (res.authenticated) router.replace("/");
      else if (!res.setupRequired) router.replace("/login");
    }).catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await authApi.setup(password);
      router.replace("/");
    } catch (err) {
      toast.error((err as Error).message ?? "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--canvas)]">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-[var(--background)] shadow-[0_4px_32px_rgba(0,0,0,0.10)]">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Welcome to Fluxo</h1>
        <p className="text-sm text-[var(--muted)] mb-6">Set a password to protect your dashboard</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Setting up…" : "Set password & continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
