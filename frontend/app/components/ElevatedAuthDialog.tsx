"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { registerElevatedAuthHandler, type ElevatedAuthRequest } from "@/lib/elevated-auth";

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />

      <path d="m9.5 12 1.7 1.7 3.8-4" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c5.2 0 8.7 4.4 9.8 6.5a1 1 0 0 1 0 1c-.5.9-1.7 2.7-3.7 4.2" />
        <path d="M6.1 6.1C4.1 7.5 2.9 9.3 2.2 10.5a1 1 0 0 0 0 1C3.3 13.6 6.8 18 12 18c1 0 2-.2 2.9-.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.2 12c1.1-2.1 4.6-6.5 9.8-6.5s8.7 4.4 9.8 6.5c-1.1 2.1-4.6 6.5-9.8 6.5S3.3 14.1 2.2 12Z" />

      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export default function ElevatedAuthDialog() {
  const [request, setRequest] = useState<ElevatedAuthRequest | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(
    (reason: string) => {
      if (!request) {
        return;
      }

      request.reject(new Error(reason));

      setRequest(null);
      setPassword("");
      setShowPassword(false);
    },
    [request],
  );

  useEffect(() => {
    return registerElevatedAuthHandler((nextRequest) => {
      setRequest(nextRequest);
      setPassword("");
      setShowPassword(false);
    });
  }, []);

  useEffect(() => {
    if (!request) {
      return;
    }

    const timer = window.setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [request]);

  useEffect(() => {
    if (!request) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close("Elevated authentication cancelled.");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [request, close]);

  if (!request) {
    return null;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedPassword = password;

    if (!trimmedPassword) {
      passwordInputRef.current?.focus();
      return;
    }

    request.resolve(trimmedPassword);

    setRequest(null);
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div
      className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-md"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="elevated-auth-title"
        aria-describedby="elevated-auth-description"
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900 shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10 text-yellow-300">
              <ShieldIcon />
            </div>

            <div className="min-w-0">
              <h2
                id="elevated-auth-title"
                className="text-lg font-semibold tracking-tight text-zinc-100"
              >
                Elevated access required
              </h2>

              <p id="elevated-auth-description" className="mt-1.5 text-sm leading-6 text-zinc-500">
                This action requires administrator privileges on your Linux VPS.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-400" />

              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Linux authentication
              </p>
            </div>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Confirm this operation using the password of your authenticated Linux user.
            </p>
          </div>

          <form onSubmit={submit} className="mt-6">
            <label htmlFor="elevated-auth-password" className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Linux VPS password
              </span>

              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="elevated-auth-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Enter your password"
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 pr-12 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
                />

                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                >
                  <EyeIcon hidden={!showPassword} />
                </button>
              </div>
            </label>

            <p className="mt-3 text-xs leading-5 text-zinc-600">
              Your password is used only to verify this elevated operation and is not stored by the
              panel.
            </p>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => close("Elevated authentication cancelled.")}
                className="min-h-11 rounded-xl bg-zinc-800 px-5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 active:scale-[0.98]"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!password}
                className="min-h-11 rounded-xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                Authenticate
              </button>
            </div>
          </form>
        </div>

        <div className="border-t border-zinc-800 bg-zinc-950/40 px-6 py-3.5">
          <p className="text-center text-[11px] text-zinc-700">VPS Panel · Privileged operation</p>
        </div>
      </div>
    </div>
  );
}
