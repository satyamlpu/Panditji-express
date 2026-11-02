"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  phone: z
    .string()
    .min(6, "Please enter a valid phone number")
    .regex(/^[+]?[0-9 -]+$/, "Please enter a valid phone number"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  message: z.string().max(2000).optional(),
  website: z.string().max(0).optional(), // honeypot
});

type Values = z.infer<typeof schema>;

export function ContactForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    try {
      await api.post("/api/v1/public/enquiries", {
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        message: values.message || null,
        website: values.website || null,
      });
      setDone(true);
      toast.success("Message sent — we'll be in touch shortly.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-forest/30 bg-forest/5 p-8 text-center">
        <CheckCircle2 className="mx-auto text-forest" size={40} />
        <h2 className="mt-3 font-display text-xl font-semibold text-ink">
          Message received
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Thank you for reaching out. Our team will get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-card border border-line bg-surface p-6 shadow-soft"
      noValidate
    >
      <div
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message} required>
          <Input {...register("name")} autoComplete="name" placeholder="Full name" />
        </Field>
        <Field label="Phone" error={errors.phone?.message} required>
          <Input {...register("phone")} inputMode="tel" autoComplete="tel" placeholder="+91 …" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Email (optional)" error={errors.email?.message}>
          <Input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Message" error={errors.message?.message}>
          <Textarea {...register("message")} placeholder="How can we help?" />
        </Field>
      </div>
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : "Send message"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-tomato"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-tomato">{error}</span>}
    </label>
  );
}
