"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { useAuth } from "@/features/auth/AuthProvider";

export default function LoginPage() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const [loginValue, setLoginValue] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace("/anamnese");
    }
  }, [router, status, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(loginValue, password);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel entrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="login-logo">
            <ClinicLogo />
          </div>
          <div>
            <span className="eyebrow">Acesso interno</span>
            <h1 id="login-title">Flor de Lotus</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Usuario</span>
            <input
              autoComplete="username"
              onChange={(event) => setLoginValue(event.target.value)}
              required
              value={loginValue}
            />
          </label>

          <label>
            <span>Senha</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <div className="login-error" role="alert">
              <LockKeyhole aria-hidden="true" size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            <LogIn aria-hidden="true" size={18} />
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}