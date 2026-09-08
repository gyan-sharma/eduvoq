"use client";

import { useActionState } from "react";

import { TurnstileField } from "@/components/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitContact,
  type ContactState,
} from "@/server/actions/contact";

export function ContactForm({ siteKey }: { siteKey: string }) {
  const [state, formAction, pending] = useActionState<
    ContactState,
    FormData
  >(submitContact, null);

  return (
    <form action={formAction} className="relative flex flex-col gap-4">
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          aria-invalid={state?.fieldErrors?.name ? true : undefined}
        />
        {state?.fieldErrors?.name ? (
          <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state?.fieldErrors?.email ? true : undefined}
        />
        {state?.fieldErrors?.email ? (
          <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          aria-invalid={state?.fieldErrors?.message ? true : undefined}
        />
        {state?.fieldErrors?.message ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.message}
          </p>
        ) : null}
      </div>

      {siteKey ? <TurnstileField siteKey={siteKey} /> : null}

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
