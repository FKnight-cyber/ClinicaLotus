# Plano de implementacao - Evolucoes clinicas

**Criado em:** 23/07/2026  
**Modulo:** Prontuario / Atendimento clinico  
**Objetivo:** orientar a implementacao incremental da parte de evolucoes clinicas, permitindo testar cada etapa e marcar o progresso conforme as alteracoes forem validadas.

---

## 1. Contexto atual

O sistema ja possui:

- autenticacao interna com JWT;
- controle de usuarios, grupos e permissoes;
- auditoria basica em `AuditLog`;
- cadastro simples de pacientes;
- modulo de anamnese com rascunho, finalizacao e documento rastreavel;
- endpoint de prontuario do paciente em `GET /api/patients/:patientId/prontuario`;
- timeline inicial baseada em `MedicalRecordEntry`;
- tela `/modulos/prontuario` com busca de paciente e exibicao de eventos clinicos;
- criacao automatica de evento no prontuario ao finalizar anamnese vinculada a paciente.

A parte de evolucoes passou a ser implementada como **Evolucao** generica/multiprofissional, com campo explicito de area profissional. A area nao deve ser inferida por grupo de acesso, porque o mesmo usuario ou permissao pode nao representar corretamente a categoria clinica usada no registro.

---

## 2. Escopo da primeira entrega

### Incluido

- Criar evolucao vinculada a paciente.
- Informar area profissional da evolucao: Medico, Terapeuta, Psicologo, Psiquiatra, Assistente social ou Enfermagem.
- Salvar evolucao como rascunho.
- Editar rascunho.
- Finalizar evolucao.
- Cancelar evolucao finalizada ou rascunho com motivo.
- Exibir evolucoes no historico do paciente.
- Exibir evolucoes finalizadas na timeline do prontuario.
- Registrar auditoria das acoes principais.
- Controlar acesso por permissoes no backend e na interface.

### Fora da primeira entrega

- Prescricao medica.
- CID-10.
- Problemas ativos.
- Sinais vitais.
- Impressao/PDF rastreavel de evolucao.
- Assinatura digital.
- Integracoes externas.

Registro de enfermagem e outras areas profissionais entram no mesmo fluxo de Evolucao por meio do campo `professionalArea`. Tipos clinicos mais especializados, como prescricao, CID-10 e sinais vitais, devem ser tratados como proximas fatias.

### Observacao sobre certificado digital

Nos documentos do projeto, certificado digital aparece como item **fora do MVP**. Existem tres assuntos diferentes que nao devem ser misturados:

- **Assinatura simples pelo usuario:** pode entrar antes, junto da finalizacao de evolucoes/consultas, registrando usuario, profissional, data/hora e auditoria. Nao usa certificado digital.
- **Assinatura digital certificada/ICP-Brasil:** deve ser uma fase futura, depois que evolucoes, documentos/PDF rastreaveis e fluxo de finalizacao estiverem estaveis.
- **Login por certificado digital:** pertence ao modulo de autenticacao/acesso, nao a evolucoes. Tambem esta fora do MVP e deve ser avaliado como melhoria futura de seguranca/autenticacao.

Para a primeira entrega de evolucoes, manter apenas finalizacao com usuario autenticado, bloqueio de edicao, auditoria e rastreabilidade interna.

---

## 3. Modelo funcional esperado

### Status da evolucao

Usar status explicitos:

- `DRAFT`: rascunho editavel;
- `FINALIZED`: registro clinico finalizado, nao editavel livremente;
- `CANCELED`: registro cancelado/inativado, preservado no historico.

### Regras principais

- Evolucao deve estar vinculada a um paciente.
- Area profissional deve ser informada explicitamente pelo usuario e validada pelo backend.
- Texto livre e obrigatorio para finalizar.
- Data/hora da evolucao deve ser informada; se nao informada, usar data/hora atual.
- Rascunho pode ser editado por usuario autorizado.
- Evolucao finalizada nao deve ser editada livremente.
- Cancelamento deve exigir motivo.
- Cancelamento nao deve excluir fisicamente o registro.
- Evolucao finalizada deve aparecer na timeline clinica do paciente.
- Evolucao cancelada deve permanecer no historico, mas precisa ser claramente identificada.
- Todas as mutacoes clinicas devem gerar auditoria.

---

## 4. Permissoes necessarias

Adicionar permissoes granulares no seed:

```txt
medical_evolutions.read
medical_evolutions.create
medical_evolutions.update
medical_evolutions.finalize
medical_evolutions.cancel
medical_evolutions.print
```

Na primeira entrega, `medical_evolutions.print` pode ser criada apenas para preparar o sistema, sem interface funcional ainda.

### Checklist

- [ ] Adicionar permissoes no seed.
- [ ] Vincular permissoes aos grupos `Administrador` e `Developer`.
- [ ] Validar que usuario sem permissao nao acessa as acoes.
- [ ] Validar que usuario com permissao consegue criar/finalizar/cancelar.

---

## 5. Banco de dados

### 5.1 Enums sugeridos

Adicionar enum no Prisma:

```prisma
enum MedicalEvolutionStatus {
  DRAFT
  FINALIZED
  CANCELED
}
```

### 5.2 Entidade principal

Adicionar modelo sugerido:

```prisma
model MedicalEvolution {
  id              String                 @id @default(uuid())
  patientId       String
  status          MedicalEvolutionStatus @default(DRAFT)
  evolutionDate   DateTime               @default(now())
  text            String
  professionalArea String?
  professionalName String?
  createdById     String?
  updatedById     String?
  finalizedById   String?
  canceledById    String?
  finalizedAt     DateTime?
  canceledAt      DateTime?
  cancelReason    String?
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  patient          Patient                @relation(fields: [patientId], references: [id], onDelete: Cascade)
  createdBy        User?                  @relation("MedicalEvolutionCreatedBy", fields: [createdById], references: [id])
  updatedBy        User?                  @relation("MedicalEvolutionUpdatedBy", fields: [updatedById], references: [id])
  finalizedBy      User?                  @relation("MedicalEvolutionFinalizedBy", fields: [finalizedById], references: [id])
  canceledBy       User?                  @relation("MedicalEvolutionCanceledBy", fields: [canceledById], references: [id])
  medicalRecordEntries MedicalRecordEntry[]

  @@index([patientId, evolutionDate])
  @@index([status])
}
```

### 5.3 Ajustes em modelos existentes

Adicionar relacoes em `Patient`, `User` e `MedicalRecordEntry`.

Em `MedicalRecordEntry`, adicionar referencia opcional:

```prisma
medicalEvolutionId String?
medicalEvolution   MedicalEvolution? @relation(fields: [medicalEvolutionId], references: [id], onDelete: SetNull)
```

### Checklist

- [ ] Adicionar enum `MedicalEvolutionStatus`.
- [ ] Adicionar modelo `MedicalEvolution`.
- [ ] Adicionar relacoes em `Patient`.
- [ ] Adicionar relacoes em `User`.
- [ ] Adicionar relacao opcional em `MedicalRecordEntry`.
- [ ] Rodar `prisma generate`.
- [ ] Rodar sincronizacao do banco no ambiente local.
- [ ] Validar que Prisma Client reconhece os novos modelos.

---

## 6. Backend/API

### 6.1 Estrutura sugerida

Criar modulo proprio para evolucoes ou prontuario clinico:

```txt
apps/api/src/modules/medical-evolutions/
  medical-evolutions.module.ts
  medical-evolutions.controller.ts
  medical-evolutions.service.ts
  dto/
    create-medical-evolution.dto.ts
    update-medical-evolution.dto.ts
    cancel-medical-evolution.dto.ts
```

### 6.2 DTOs

`CreateMedicalEvolutionDto`:

- `patientId` ou usar `patientId` pela rota;
- `text`;
- `evolutionDate` opcional;
- `professionalArea` obrigatorio.
- `professionalName` opcional.

`UpdateMedicalEvolutionDto`:

- `text` opcional;
- `professionalArea` opcional;
- `evolutionDate` opcional;
- `professionalName` opcional.

`CancelMedicalEvolutionDto`:

- `reason` obrigatorio.

### 6.3 Endpoints minimos

```txt
GET   /api/patients/:patientId/evolutions
POST  /api/patients/:patientId/evolutions
GET   /api/medical-evolutions/:id
PATCH /api/medical-evolutions/:id
POST  /api/medical-evolutions/:id/finalize
POST  /api/medical-evolutions/:id/cancel
```

### 6.4 Regras no service

- Validar existencia do paciente antes de criar.
- Bloquear edicao de evolucao `FINALIZED` ou `CANCELED`.
- Exigir texto nao vazio para finalizar.
- Exigir area profissional para criar/finalizar.
- Ao finalizar:
  - atualizar status para `FINALIZED`;
  - preencher `finalizedAt` e `finalizedById`;
  - criar `MedicalRecordEntry` com tipo `MEDICAL_EVOLUTION`;
  - invalidar cache do prontuario do paciente;
  - registrar auditoria.
- Ao cancelar:
  - exigir motivo;
  - atualizar status para `CANCELED`;
  - preencher `canceledAt`, `canceledById` e `cancelReason`;
  - invalidar cache do prontuario do paciente;
  - registrar auditoria.

### 6.5 Auditoria

Registrar acoes:

```txt
create_medical_evolution
update_medical_evolution
finalize_medical_evolution
cancel_medical_evolution
```

Usar `entity = "medical_evolution"` e snapshots `beforeData`/`afterData` quando aplicavel.

### Checklist

- [ ] Criar modulo `medical-evolutions`.
- [ ] Criar controller.
- [ ] Criar service.
- [ ] Criar DTOs com validacoes.
- [ ] Registrar modulo no `AppModule` ou modulo raiz correspondente.
- [ ] Implementar listagem por paciente.
- [ ] Implementar criacao de rascunho.
- [ ] Implementar edicao de rascunho.
- [ ] Implementar finalizacao.
- [ ] Implementar cancelamento com motivo.
- [ ] Criar `MedicalRecordEntry` ao finalizar.
- [ ] Invalidar cache de prontuario apos criar/finalizar/cancelar.
- [ ] Escrever logs de auditoria.
- [ ] Validar permissoes no backend.
- [ ] Rodar typecheck da API.

---

## 7. Timeline do prontuario

O endpoint atual `GET /api/patients/:patientId/prontuario` deve continuar sendo a fonte da timeline.

### Ajustes esperados

- Incluir eventos de evolucao finalizada.
- Retornar `type = "MEDICAL_EVOLUTION"`.
- Retornar titulo amigavel, por exemplo `Evolucao - Psicologo`.
- Retornar resumo com trecho inicial do texto.
- Retornar usuario/profissional responsavel quando disponivel.
- Manter anamneses finalizadas aparecendo como hoje.

### Checklist

- [ ] Ajustar `MedicalRecordEntry` para referenciar evolucao medica.
- [ ] Criar evento na timeline ao finalizar evolucao.
- [ ] Garantir ordenacao decrescente por data.
- [ ] Garantir que eventos cancelados nao confundem a timeline.
- [ ] Testar prontuario de paciente com anamnese e evolucao.

---

## 8. Frontend

### 8.1 Organizacao sugerida

Criar uma feature propria:

```txt
apps/web/src/features/prontuario/
  ProntuarioPage.tsx
  prontuarioStorage.ts
  prontuarioTypes.ts
```

O arquivo atual `ProntuarioPage.tsx` ja existe. A recomendacao e mover chamadas especificas de prontuario para arquivos proprios, evitando aumentar o acoplamento com a feature de anamnese.

### 8.2 Experiencia esperada

Na tela `/modulos/prontuario`:

- buscar paciente;
- selecionar paciente;
- ver cabeçalho simples do paciente;
- ver timeline clinica;
- ver lista/historico de evolucoes;
- criar nova evolucao;
- salvar rascunho;
- editar rascunho;
- finalizar;
- cancelar com motivo;
- atualizar timeline apos finalizar.

### 8.3 Estados de UI

Separar estados:

- carregamento inicial de pacientes;
- carregamento da timeline;
- carregamento/listagem de evolucoes;
- salvando rascunho;
- finalizando;
- cancelando;
- erro de permissao;
- erro de validacao.

### 8.4 Permissoes no frontend

- `medical_evolutions.read`: listar evolucoes;
- `medical_evolutions.create`: exibir botao de nova evolucao;
- `medical_evolutions.update`: permitir editar rascunho;
- `medical_evolutions.finalize`: exibir acao de finalizar;
- `medical_evolutions.cancel`: exibir acao de cancelar.

### Checklist

- [ ] Criar tipos frontend de evolucao.
- [ ] Criar funcoes de API para evolucoes.
- [ ] Separar storage de prontuario, se conveniente.
- [ ] Adicionar botao `Nova evolucao`.
- [ ] Criar formulario de evolucao.
- [ ] Implementar salvar rascunho.
- [ ] Implementar edicao de rascunho.
- [ ] Implementar finalizacao.
- [ ] Implementar cancelamento com motivo.
- [ ] Atualizar lista de evolucoes apos mutacoes.
- [ ] Atualizar timeline apos finalizacao/cancelamento.
- [ ] Tratar estados de loading e erro.
- [ ] Respeitar permissoes na interface.
- [ ] Rodar typecheck do web.

---

## 9. Testes manuais por etapa

### Etapa 1 - Banco e permissoes

- [ ] Seed executa sem erro.
- [ ] Permissoes aparecem no controle de acesso.
- [ ] Prisma Client compila com `MedicalEvolution`.

### Etapa 2 - API

- [ ] Criar evolucao para paciente existente.
- [ ] Listar evolucoes do paciente.
- [ ] Editar evolucao em rascunho.
- [ ] Tentar finalizar evolucao sem texto e receber erro claro.
- [ ] Finalizar evolucao com texto.
- [ ] Confirmar criacao de entrada no prontuario.
- [ ] Cancelar evolucao com motivo.
- [ ] Tentar cancelar sem motivo e receber erro claro.
- [ ] Confirmar auditoria das acoes.
- [ ] Confirmar bloqueio por permissao no backend.

### Etapa 3 - Frontend

- [ ] Abrir `/modulos/prontuario`.
- [ ] Buscar paciente.
- [ ] Criar nova evolucao.
- [ ] Selecionar area profissional da evolucao.
- [ ] Salvar rascunho.
- [ ] Reabrir paciente e confirmar rascunho listado.
- [ ] Editar rascunho.
- [ ] Finalizar evolucao.
- [ ] Confirmar evento na timeline.
- [ ] Cancelar evolucao com motivo.
- [ ] Confirmar exibicao de status cancelado no historico.
- [ ] Confirmar que botoes somem conforme permissoes.

---

## 10. Comandos de validacao

Usar `npm.cmd` e `npx.cmd` no Windows.

### API

```bash
npm.cmd run typecheck --workspace @clinica/api
```

Quando houver mudanca no Prisma:

```bash
npx.cmd prisma generate
```

No ambiente Docker/local usado pelo projeto, tambem validar o fluxo equivalente de sincronizacao do banco, por exemplo:

```bash
docker compose exec api sh -lc "cd apps/api && npx prisma generate && npx prisma db push"
docker compose exec api sh -lc "cd apps/api && npm run prisma:seed"
```

### Web

```bash
npm.cmd run typecheck --workspace @clinica/web
```

### Geral

```bash
git diff --check
```

---

## 11. Ordem sugerida de desenvolvimento

### Fase 1 - Fundacao backend

- [x] Atualizar Prisma schema.
- [x] Atualizar seed de permissoes.
- [x] Gerar Prisma Client.
- [x] Sincronizar banco local.
- [x] Criar modulo/API de evolucoes.
- [x] Validar API por typecheck.

### Fase 2 - Fluxo clinico minimo

- [x] Criar rascunho de evolucao.
- [x] Editar rascunho.
- [x] Finalizar evolucao.
- [x] Criar evento na timeline.
- [x] Registrar auditoria.
- [x] Testar manualmente no backend.

### Fase 3 - Interface minima

- [x] Criar tipos e storage de prontuario/evolucoes.
- [x] Adicionar formulario na tela de prontuario.
- [x] Listar evolucoes do paciente.
- [x] Permitir criar/editar/finalizar.
- [x] Atualizar timeline depois de finalizar.
- [x] Validar no navegador.

### Fase 4 - Cancelamento e acabamento

- [x] Implementar cancelamento com motivo no backend.
- [x] Implementar cancelamento com motivo no frontend.
- [x] Exibir status no historico.
- [x] Ajustar mensagens e estados de loading.
- [ ] Validar permissoes por perfil.

### Fase 5 - Proximas fatias

- [x] Impressao/PDF rastreavel de evolucao.
- [x] Assinatura simples pelo usuario.
- [ ] Assinatura digital certificada/ICP-Brasil, se confirmada pelo cliente.
- [x] Evolucao multiprofissional com area explicita.
- [x] Registro de enfermagem como area da evolucao.
- [ ] Problemas ativos.
- [ ] Diagnosticos/CID-10.
- [ ] Prescricao/conduta basica.

---

## 12. Registro de progresso

Use esta area para anotar decisoes e testes executados durante o desenvolvimento.

### Decisoes tomadas

- [x] Definir area profissional como campo explicito, independente dos grupos de acesso.
- [ ] Definir se `professionalName` sera texto livre temporario ou vinculo com cadastro de profissional.
- [ ] Definir se rascunho pode ser visto/editado por outro usuario autorizado.
- [ ] Definir se evolucao cancelada aparece ou nao na timeline principal.
- [ ] Definir quando implementar impressao/PDF rastreavel.

### Testes do usuario

| Data | Etapa | Resultado | Observacoes |
| --- | --- | --- | --- |
| 23/07/2026 | Smoke tecnico | OK | Criado rascunho pela interface, finalizado, exibido na timeline, cancelado com motivo e timeline atualizada. |
| 23/07/2026 | PDF rastreavel | OK | Criada evolucao finalizada pela interface, registrado documento `DOC-2026-0003`, exibido hash e acionado download do PDF. |
| 23/07/2026 | Area profissional | OK | Criada evolucao com area Psicologo, finalizada, exibida na timeline como `Evolucao - Psicologo` e PDF registrado como `DOC-2026-0005`. |
| 23/07/2026 | Assinatura simples | OK | Evolucao finalizada exibe assinatura pelo usuario e PDF inclui texto de assinatura simples interna. |
| 23/07/2026 | Auditoria | Parcial | Fluxo escreve auditoria no service e passou no typecheck; consulta direta pelo terminal foi limitada por escaping do PowerShell/psql. |
