import {
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FolderCog,
  HeartPulse,
  Hospital,
  NotebookTabs,
  Settings,
  Stethoscope,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModuleItem = {
  slug: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status: "active" | "locked";
  actions: string[];
};

export const moduleItems: ModuleItem[] = [
  {
    slug: "anamnese",
    label: "Anamnese",
    description: "Fluxo inicial funcional com fichas dos PDFs do cliente.",
    href: "/anamnese",
    icon: ClipboardList,
    status: "active",
    actions: ["Nova anamnese", "Salvar rascunho", "Finalizar"]
  },
  {
    slug: "acolhimento",
    label: "Acolhimento",
    description: "Pesquisa de paciente, atendimento inicial e dados de convênio.",
    href: "/modulos/acolhimento",
    icon: HeartPulse,
    status: "locked",
    actions: ["Pesquisar paciente", "Criar atendimento", "Registrar alta"]
  },
  {
    slug: "prontuario",
    label: "Prontuário",
    description: "Timeline clínica, evolução, fichas, problemas e documentos.",
    href: "/modulos/prontuario",
    icon: NotebookTabs,
    status: "locked",
    actions: ["Abrir prontuário", "Nova evolução", "Emitir documento"]
  },
  {
    slug: "agendamento",
    label: "Agendamento",
    description: "Agenda interna, horários, reservas, confirmação e reagendamento.",
    href: "/modulos/agendamento",
    icon: CalendarDays,
    status: "locked",
    actions: ["Novo agendamento", "Buscar horário", "Bloquear horário"]
  },
  {
    slug: "atendimento",
    label: "Atendimento",
    description: "Fila ambulatorial, consulta, triagem, finalização e alta.",
    href: "/modulos/atendimento",
    icon: Stethoscope,
    status: "locked",
    actions: ["Chamar paciente", "Iniciar consulta", "Finalizar atendimento"]
  },
  {
    slug: "cadastros",
    label: "Cadastros",
    description: "Usuários, profissionais, permissões e cadastros auxiliares.",
    href: "/modulos/cadastros",
    icon: FolderCog,
    status: "locked",
    actions: ["Cadastrar usuário", "Cadastrar profissional", "Gerenciar permissões"]
  },
  {
    slug: "relatorios",
    label: "Relatórios",
    description: "Listagens, histórico operacional e auditoria para fases futuras.",
    href: "/modulos/relatorios",
    icon: FileBarChart,
    status: "locked",
    actions: ["Gerar relatório", "Exportar", "Ver auditoria"]
  },
  {
    slug: "pacientes",
    label: "Pacientes",
    description: "Cadastro e histórico de pacientes previsto para evolução do MVP.",
    href: "/modulos/pacientes",
    icon: UsersRound,
    status: "locked",
    actions: ["Novo paciente", "Editar cadastro", "Ver histórico"]
  },
  {
    slug: "configuracoes",
    label: "Configurações",
    description: "Parâmetros operacionais, integrações e regras por local.",
    href: "/modulos/configuracoes",
    icon: Settings,
    status: "locked",
    actions: ["Alterar parâmetro", "Configurar local", "Ver logs"]
  },
  {
    slug: "institucional",
    label: "Clínica",
    description: "Visão administrativa da operação clínica.",
    href: "/modulos/institucional",
    icon: Hospital,
    status: "locked",
    actions: ["Abrir painel", "Editar unidade", "Gerenciar documentos"]
  }
];

export function getModuleBySlug(slug: string) {
  return moduleItems.find((item) => item.slug === slug);
}