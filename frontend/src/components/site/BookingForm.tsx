"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  phone: z
    .string()
    .min(6, "Please enter a valid phone number")
    .regex(/^[+]?[0-9 -]+$/, "Please enter a valid phone number"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  city: z.string().max(120).optional(),
  preferred_date: z.string().optional(),
  message: z.string().max(2000).optional(),
  website: z.string().max(0).optional(), // honeypot — must stay empty
});

type FormValues = z.infer<typeof schema>;

export function BookingForm({
  serviceSlug,
  serviceTitle,
}: {
  serviceSlug: string;
  serviceTitle: string;
}) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await api.post("/api/v1/public/enquiries", {
        service_slug: serviceSlug,
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        city: values.city || null,
        preferred_date: values.preferred_date || null,
        message: values.message || null,
        website: values.website || null,
      });
      setDone(true);
      toast.success("Enquiry received — we'll be in touch shortly.");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      toast.error(msg);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-forest/30 bg-forest/5 p-8 text-center">
        <CheckCircle2 className="mx-auto text-forest" size={40} />
        <h2 className="mt-3 font-display text-xl font-semibold text-ink">
          Thank you — enquiry received
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Our team will contact you shortly to confirm the date, pandit and
          samagri for your {serviceTitle}.
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
      {/* Honeypot: visually hidden, off the tab order. Bots fill it; humans don't. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message} required>
          <Input {...register("name")} placeholder="Full name" autoComplete="name" />
        </Field>
        <Field label="Phone" error={errors.phone?.message} required>
          <Input
            {...register("phone")}
            placeholder="+91 …"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
        <Field label="Email (optional)" error={errors.email?.message}>
          <Input
            {...register("email")}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label="City (optional)" error={errors.city?.message}>
          <Input {...register("city")} placeholder="City / area" />
        </Field>
        <Field label="Preferred date (optional)" error={errors.preferred_date?.message}>
          <Input {...register("preferred_date")} type="date" />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Message (optional)" error={errors.message?.message}>
          <Textarea
            {...register("message")}
            placeholder="Anything we should know — timing, address area, special requests…"
          />
        </Field>
      </div>

      <Button type="submit" variant="accent" size="lg" className="mt-5 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : "Send booking enquiry"}
      </Button>
      <p className="mt-3 text-center text-xs text-muted">
        No payment now. We confirm availability and details with you first.
      </p>
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
