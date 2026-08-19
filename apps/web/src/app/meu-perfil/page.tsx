"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Save, UserCircle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { useAuth } from "@/features/auth/AuthProvider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

type ProfileForm = {
  login: string;
  name: string;
  email: string;
  professionalArea: string;
  professionalCouncil: string;
  professionalRegistration: string;
  professionalCouncilState: string;
  professionalSpecialty: string;
  password: string;
};

type Clinic = {
  id: string;
  name: string;
  code?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

const professionalAreaOptions = ["Administrador", "Gerente", "Médico", "Terapeuta", "Psicólogo", "Psiquiatra", "Assistente social", "Enfermagem"];
const professionalCouncilOptions = ["CRM", "CRP", "COREN", "CRESS", "Outro"];

function getDefaultProfessionalArea(userType?: string) {
  if (userType === "DOCTOR") return "Médico";
  if (userType === "NURSE") return "Enfermagem";
  return "";
}

function shouldShowProfessionalArea(userType: string | undefined, canViewMedicalInfo: boolean) {
  return canViewMedicalInfo || userType === "NURSE";
}

function shouldShowMedicalFields(canViewMedicalInfo: boolean) {
  return canViewMedicalInfo;
}

function getDefaultProfessionalCouncil(userType?: string) {
  return userType === "DOCTOR" ? "CRM" : "";
}

async function updateProfile(token: string, form: ProfileForm) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      login: form.login,
      name: form.name,
      email: form.email || undefined,
      professionalArea: form.professionalArea || undefined,
      professionalCouncil: form.professionalCouncil || undefined,
      professionalRegistration: form.professionalRegistration || undefined,
      professionalCouncilState: form.professionalCouncilState || undefined,
      professionalSpecialty: form.professionalSpecialty || undefined,
      password: form.password || undefined
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível atualizar o perfil.");
  }

  return response.json();
}

async function updateUserClinics(token: string, clinicIds: string[]) {
  const response = await fetch(`${API_BASE_URL}/api/access/users/me/clinics`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ clinicIds })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível atualizar as clínicas.");
  }

  return response.json();
}

async function fetchAvailableClinics(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/access/users/clinic-options`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível carregar as clínicas.");
  }

  return response.json() as Promise<Clinic[]>;
}

export default function MeuPerfilPage() {
  const { clinics, hasPermission, refreshProfile, token, user } = useAuth();
  const [form, setForm] = useState<ProfileForm>({ login: "", name: "", email: "", professionalArea: "", professionalCouncil: "", professionalRegistration: "", professionalCouncilState: "", professionalSpecialty: "", password: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableClinics, setAvailableClinics] = useState<Clinic[]>([]);
  const [clinicIds, setClinicIds] = useState<string[]>([]);
  const [isSavingClinics, setIsSavingClinics] = useState(false);
  const canViewMedicalInfo = hasPermission("profile.medical_info.read");
  const canManageUserClinics = hasPermission("access.users.clinics.manage");
  const accessibleClinics = clinics.filter((clinic) => clinic.status === "ACTIVE");

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      login: user.login,
      name: user.name,
      email: user.email ?? "",
      professionalArea: user.professionalArea ?? getDefaultProfessionalArea(user.userType),
      professionalCouncil: user.professionalCouncil ?? getDefaultProfessionalCouncil(user.userType),
      professionalRegistration: user.professionalRegistration ?? "",
      professionalCouncilState: user.professionalCouncilState ?? "",
      professionalSpecialty: user.professionalSpecialty ?? "",
      password: ""
    });
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClinicIds(clinics.filter((clinic) => clinic.status === "ACTIVE").map((clinic) => clinic.id));
  }, [clinics]);

  useEffect(() => {
    if (!token || !canManageUserClinics) return;

    let isCurrent = true;
    fetchAvailableClinics(token).then((nextClinics) => {
      if (isCurrent) setAvailableClinics(nextClinics);
    }).catch((caughtError) => {
      if (isCurrent) setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar as clínicas.");
    });

    return () => {
      isCurrent = false;
    };
  }, [canManageUserClinics, token]);

  function toggleClinic(clinicId: string) {
    setClinicIds((currentClinicIds) => currentClinicIds.includes(clinicId)
      ? currentClinicIds.filter((currentClinicId) => currentClinicId !== clinicId)
      : [...currentClinicIds, clinicId]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      await updateProfile(token, form);
      await refreshProfile();
      setForm((currentForm) => ({ ...currentForm, password: "" }));
      setMessage("Perfil atualizado.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveClinics() {
    if (!token || !canManageUserClinics) return;
    setMessage(null);
    setError(null);
    setIsSavingClinics(true);

    try {
      await updateUserClinics(token, clinicIds);
      await refreshProfile();
      setMessage("Clínicas com acesso atualizadas.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar as clínicas.");
    } finally {
      setIsSavingClinics(false);
    }
  }

  return (
    <AppShell activeSlug="meu-perfil">
      <section className="user-detail-page">
        <div className="list-header">
          <div>
            <span className="eyebrow">Meu Perfil</span>
            <h2>{user?.name ?? "Meus dados"}</h2>
            <p>Atualize os dados usados no cadastro e no acesso ao sistema.</p>
          </div>
          <span className="status-badge"><UserCircle aria-hidden="true" size={17} />Conta pessoal</span>
        </div>

        {message ? <div className="access-message" role="status"><CheckCircle2 aria-hidden="true" size={17} />{message}</div> : null}
        {error ? <div className="login-error" role="alert"><span>{error}</span></div> : null}

        <div className="access-single-panel-layout">
          <section className="plain-panel">
            <h3>Dados do cadastro</h3>
            <form className="access-form" onSubmit={handleSubmit}>
              <label><span>Login</span><input autoComplete="username" disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))} required value={form.login} /></label>
              <label><span>Nome completo</span><input autoComplete="name" disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></label>
              <label><span>Email</span><input autoComplete="email" disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" value={form.email} /></label>
              {canManageUserClinics ? (
                <fieldset className="clinic-scope-picker">
                  <legend>Clínicas com acesso</legend>
                  <div className="access-checklist">
                    {availableClinics.map((clinic) => (
                      <label className="choice-pill" key={clinic.id} title={clinic.code ?? clinic.name}>
                        <input checked={clinicIds.includes(clinic.id)} disabled={isSavingClinics} onChange={() => toggleClinic(clinic.id)} type="checkbox" />
                        {clinic.name}{clinic.code ? ` (${clinic.code})` : ""}
                      </label>
                    ))}
                    {availableClinics.length === 0 ? <span>Nenhuma clínica ativa encontrada.</span> : null}
                  </div>
                  <button className="secondary-button" disabled={isSavingClinics} onClick={handleSaveClinics} type="button"><Save aria-hidden="true" size={17} />{isSavingClinics ? "Salvando..." : "Salvar clínicas"}</button>
                </fieldset>
              ) : (
                <div className="profile-readonly-field">
                  <span>Clínicas com acesso</span>
                  <div className="access-checklist compact-checklist">
                    {accessibleClinics.length > 0 ? accessibleClinics.map((clinic) => (
                      <span className="choice-pill" key={clinic.id}>{clinic.name}{clinic.code ? ` (${clinic.code})` : ""}</span>
                    )) : <span>Nenhuma clínica vinculada.</span>}
                  </div>
                </div>
              )}
              {shouldShowProfessionalArea(user?.userType, canViewMedicalInfo) ? <label><span>Área profissional</span><select disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, professionalArea: event.target.value }))} value={form.professionalArea}>
                <option value="">Selecione</option>
                {professionalAreaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
              </select></label> : null}
              {shouldShowMedicalFields(canViewMedicalInfo) ? <>
                <label><span>Conselho profissional</span><select disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, professionalCouncil: event.target.value }))} value={form.professionalCouncil}>
                  <option value="">Selecione</option>
                  {professionalCouncilOptions.map((council) => <option key={council} value={council}>{council}</option>)}
                </select></label>
                <label><span>Número do registro profissional</span><input disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, professionalRegistration: event.target.value }))} placeholder="Ex.: 123456" value={form.professionalRegistration} /></label>
                <label><span>UF do conselho</span><input disabled={isSaving} maxLength={2} onChange={(event) => setForm((current) => ({ ...current, professionalCouncilState: event.target.value.toUpperCase() }))} placeholder="Ex.: SP" value={form.professionalCouncilState} /></label>
                <label><span>Especialidade</span><input disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, professionalSpecialty: event.target.value }))} placeholder="Ex.: Psiquiatria" value={form.professionalSpecialty} /></label>
              </> : null}
              <label><span>Nova senha</span><input autoComplete="new-password" disabled={isSaving} minLength={6} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Deixe em branco para manter a senha atual" type="password" value={form.password} /></label>
              <button className="primary-button" disabled={isSaving} type="submit"><Save aria-hidden="true" size={17} />{isSaving ? "Salvando..." : "Salvar perfil"}</button>
            </form>
          </section>
        </div>
      </section>
    </AppShell>
  );
}