"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, LogIn, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { getDefaultModuleHrefForPermissions } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthProvider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export default function LoginPage() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [recoveryLogin, setRecoveryLogin] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(getDefaultModuleHrefForPermissions(user.permissions));
    }
  }, [router, status, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(loginValue, password);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível entrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);
    setIsRecoverySubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: recoveryLogin, password: recoveryPassword })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Não foi possível solicitar a alteração de senha.");
      }

      const payload = await response.json() as { message?: string };
      setRecoveryPassword("");
      setRecoveryMessage(payload.message ?? "Pedido de alteração de senha enviado para aprovação.");
    } catch (caughtError) {
      setRecoveryError(caughtError instanceof Error ? caughtError.message : "Não foi possível solicitar a alteração de senha.");
    } finally {
      setIsRecoverySubmitting(false);
    }
  };

  const openPasswordRecovery = () => {
    setRecoveryLogin(loginValue);
    setRecoveryPassword("");
    setRecoveryError(null);
    setRecoveryMessage(null);
    setIsRecoveringPassword(true);
  };

  const closePasswordRecovery = () => {
    setIsRecoveringPassword(false);
    setRecoveryError(null);
    setRecoveryMessage(null);
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

        {isRecoveringPassword ? (
          <form className="login-form" onSubmit={handleRecoverySubmit}>
            <label>
              <span>Login</span>
              <input
                autoComplete="username"
                onChange={(event) => setRecoveryLogin(event.target.value)}
                required
                value={recoveryLogin}
              />
            </label>

            <label>
              <span>Nova senha</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setRecoveryPassword(event.target.value)}
                required
                type="password"
                value={recoveryPassword}
              />
            </label>

            {recoveryError ? (
              <div className="login-error" role="alert">
                <LockKeyhole aria-hidden="true" size={17} />
                <span>{recoveryError}</span>
              </div>
            ) : null}

            {recoveryMessage ? (
              <div className="login-success" role="status">
                <CheckCircle2 aria-hidden="true" size={17} />
                <span>{recoveryMessage}</span>
              </div>
            ) : null}

            <button className="primary-button" disabled={isRecoverySubmitting} type="submit">
              <KeyRound aria-hidden="true" size={18} />
              {isRecoverySubmitting ? "Enviando..." : "Solicitar alteração"}
            </button>
            <button className="secondary-button" disabled={isRecoverySubmitting} onClick={closePasswordRecovery} type="button">
              <RotateCcw aria-hidden="true" size={18} />
              Voltar para login
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Login</span>
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
          <button className="secondary-button" disabled={isSubmitting} onClick={openPasswordRecovery} type="button">
            <KeyRound aria-hidden="true" size={18} />
            Recuperar senha
          </button>
          <Link className="secondary-button auth-link-button" href="/cadastro">
            Solicitar cadastro
          </Link>
        </form>
        )}
      </section>
    </main>
  );
}