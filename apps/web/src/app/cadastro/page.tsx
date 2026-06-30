"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import Link from "next/link";
import { ClinicLogo } from "@/components/brand/ClinicLogo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export default function RegisterPage() {
  const [form, setForm] = useState({ login: "", name: "", email: "", password: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email || undefined })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Nao foi possivel enviar o cadastro.");
      }

      setForm({ login: "", name: "", email: "", password: "" });
      setMessage(payload?.message ?? "Cadastro enviado para aprovacao do administrador.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel enviar o cadastro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="register-title">
        <div className="login-brand">
          <div className="login-logo"><ClinicLogo /></div>
          <div>
            <span className="eyebrow">Solicitacao de acesso</span>
            <h1 id="register-title">Novo cadastro</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label><span>Usuario</span><input autoComplete="username" onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))} required value={form.login} /></label>
          <label><span>Nome</span><input autoComplete="name" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></label>
          <label><span>Email</span><input autoComplete="email" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" value={form.email} /></label>
          <label><span>Senha</span><input autoComplete="new-password" minLength={6} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required type="password" value={form.password} /></label>

          {message ? <div className="login-success" role="status"><CheckCircle2 aria-hidden="true" size={17} /><span>{message}</span></div> : null}
          {error ? <div className="login-error" role="alert"><span>{error}</span></div> : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            <UserPlus aria-hidden="true" size={18} />
            {isSubmitting ? "Enviando..." : "Enviar para aprovacao"}
          </button>
          <Link className="secondary-button auth-link-button" href="/login">Voltar para login</Link>
        </form>
      </section>
    </main>
  );
}