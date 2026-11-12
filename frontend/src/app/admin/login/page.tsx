"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Sign in failed. Check your details.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.svg" alt="Pandit Ji Express" className="h-11 w-auto" />
        </div>
        <div className="rounded-card border border-line bg-surface p-7 shadow-soft">
          <h1 className="font-display text-xl font-bold text-ink">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted">Manage services, content and enquiries.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
              <Input
                {...register("email")}
                type="email"
                autoComplete="username"
                placeholder="admin@panditjiexpress.in"
              />
              {errors.email && (
                <span className="mt-1 block text-xs text-tomato">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
              <Input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
              />
              {errors.password && (
                <span className="mt-1 block text-xs text-tomato">
                  {errors.password.message}
                </span>
              )}
            </label>

            {error && (
              <p className="rounded-lg bg-tomato/10 px-3 py-2 text-sm text-tomato">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
