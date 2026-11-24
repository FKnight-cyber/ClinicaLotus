---
description: "Fluxos de Meu Perfil e Prontuário: sincronização, salvamento, cache, loading e validação"
applyTo: "apps/web/src/app/meu-perfil/page.tsx, apps/web/src/features/prontuario/**/*.{ts,tsx}, apps/web/src/features/anamnese/**/*.{ts,tsx}, apps/web/src/features/pacientes/**/*.{ts,tsx}, apps/web/src/features/auth/AuthProvider.tsx"
---

# Instruções para Meu Perfil e Prontuário

Use estas orientações junto com `web-data-loading-ux.instructions.md` ao alterar o perfil pessoal, as evoluções clínicas ou os registros do prontuário.

## Sincronização do perfil e rascunhos locais

- `AuthProvider` atualiza o perfil ao receber foco, ao voltar para uma aba visível e periodicamente. Uma sincronização pode fornecer novos objetos `user` e `clinics` mesmo quando os valores não mudaram.
- Não use a identidade do objeto completo `user` ou `clinics` como motivo para sobrescrever rascunhos do formulário. Atualizações de sessão não podem apagar campos que a pessoa já alterou e ainda não salvou.
- Mantenha separada a noção de rascunho alterado para dados do perfil e para clínicas. Uma atualização de perfil não deve descartar seleções locais de clínicas, nem o contrário.
- Quando um formulário estiver limpo, sincronize valores atualizados da sessão sem produzir atualizações de estado desnecessárias. Quando estiver alterado, preserve seus valores até a operação terminar ou a pessoa descartá-los explicitamente.
- Após salvar o perfil ou as clínicas, sincronize o estado local com a resposta atualizada de `refreshProfile()`. Limpe a senha digitada somente depois que a atualização e a sincronização terminarem com sucesso.

## Meu Perfil

- A atualização de dados pessoais usa `PATCH /api/auth/me` e depois `refreshProfile()`. Mantenha o estado de salvamento ativo durante as duas etapas, não apenas durante o `PATCH`.
- A atualização de clínicas usa `PATCH /api/access/users/me/clinics` e também deve aguardar `refreshProfile()` antes de indicar sucesso.
- As opções de clínicas vêm de `GET /api/access/users/clinic-options`. Diferencie carregamento de lista vazia: informe que as clínicas estão carregando e não permita salvar uma seleção incompleta antes da resposta.
- Enquanto uma operação estiver em andamento, desabilite os campos e ações relacionados, exponha `aria-busy`, use `ButtonSpinner` e um rótulo explícito como “Salvando...”.
- Use uma trava síncrona com `useRef` além do estado visual de loading para impedir chamadas duplicadas antes de o React renderizar o botão desabilitado.
- Em erro, preserve os valores digitados, mostre a mensagem em uma região acessível com `role="alert"` e libere os controles para uma nova tentativa. Não apresente estado de sucesso se o `PATCH` ou a sincronização posterior falhar.
- O cache de perfil da API usa a chave `auth:profile:${userId}`. Ao alterar o perfil, invalide essa mesma chave antes de recarregar o perfil para evitar que uma resposta antiga seja reaproveitada.

## Evoluções e registros do Prontuário

- A busca/lista de pacientes e a lista de evoluções têm estados de carregamento próprios. Mantenha os registros existentes visíveis durante atualizações quando possível e desabilite a paginação enquanto a página está sendo carregada.
- Erros na busca de pacientes ou na lista de evoluções não podem parecer uma busca sem resultados. Apresente a falha em uma região acessível, encerre o loading e ofereça retry; não mostre opções antigas como se correspondessem à busca atual.
- Criar uma evolução usa `POST /api/patients/:patientId/evolutions`; editar um rascunho usa `PATCH /api/medical-evolutions/:id`. Mantenha formulário, botão de salvar e fechamento do modal bloqueados até a gravação e a atualização da lista terminarem.
- Finalizar e cancelar evolução são operações distintas (`POST /api/medical-evolutions/:id/finalize` e `/cancel`). Use trava síncrona além do estado visual para impedir chamadas duplicadas e evitar finalização/cancelamento concorrentes; bloqueie os controles que poderiam trocar paciente, formulário ou motivo durante a operação. Para cancelar, exija o motivo antes de enviar e mantenha-o bloqueado durante a request.
- A geração de PDF busca a evolução atual e solicita o documento. Mantenha o botão de PDF desabilitado com loading até a geração e o início do download terminarem.
- Exiba spinner e texto de andamento no próprio botão, além de qualquer mensagem geral da tela. A pessoa deve conseguir distinguir “Salvar”, “Salvando...”, “Finalizar” e “Finalizando...”.
- Proteja o salvamento contra chamadas duplicadas com uma trava síncrona (`useRef`) além de `disabled`. Não dependa apenas do tempo de atualização visual do estado React.
- As listas de evoluções são cacheadas em `prontuarioStorage.ts`. Invalide o cache do paciente após criar, editar, finalizar ou cancelar uma evolução; depois atualize a lista antes de informar sucesso. Ao criar, volte à primeira página para que o registro mais novo apareça.
- Se a mutação tiver sido persistida mas a atualização da lista falhar, diferencie claramente “salvo” de “lista não atualizada” e preserve o identificador do rascunho para que uma nova tentativa atualize o mesmo registro em vez de criar outro.
- Em falha, informe o erro, preserve o rascunho e libere a operação para nova tentativa. Não limpe nem feche o formulário antes de confirmar a persistência.

## Anamnese

- A lista e o editor dependem de permissões e de requests distintos. Se a carga falhar, encerre o loading, mostre o erro e ofereça retry; não deixe a tela presa em “Carregando” nem apresente uma falha como uma lista vazia.
- A criação começa pela seleção de um paciente ativo. Debounce a busca, mostre seu loading e erro no seletor e não mantenha opções antigas como se fossem resultados da busca atual.
- O editor salva rascunhos automaticamente após uma pausa na edição e também permite salvar manualmente. Os autosaves devem ser serializados; uma resposta atrasada só pode atualizar a tela se ainda representar o rascunho atual, nunca substituir alterações mais recentes.
- Antes de salvar manualmente, concluir uma ficha ou finalizar a anamnese, cancele o timer pendente, invalide callbacks antigos e aguarde um autosave em andamento. Se o snapshot atual já tiver sido persistido por esse autosave, não envie a mesma mutação novamente. Use trava síncrona além do estado React para impedir mutações duplicadas.
- Enquanto uma mutação explícita estiver pendente, desabilite os campos e ações relacionadas, apresente spinner/rótulo no próprio botão e exponha `aria-busy`. Em erro, mantenha o rascunho editável e informe a falha.
- Cada ficha precisa passar pela validação dos campos obrigatórios antes de ser concluída. A conclusão bloqueia aquela ficha; a anamnese completa só pode ser finalizada quando todas as fichas visíveis estiverem concluídas e os campos obrigatórios estiverem preenchidos.
- A geração de PDF registra o documento na API e então gera/baixa o arquivo no cliente. Trate falhas de ambas as etapas, bloqueie pedidos repetidos até o fim e mostre loading tanto para o PDF completo quanto para o parcial.
- Ao alterar pacientes, fichas, respostas ou status, preserve o rascunho e invalide/atualize os caches de anamnese e prontuário relevantes; não feche nem substitua o editor antes da confirmação da persistência.
- Valide a lista, criação por paciente, busca de paciente, edição/autosave com atraso, salvamento manual, conclusão de ficha, finalização, PDF e exclusão de rascunho usando somente fixtures sintéticas. Durante cada mutação, confirme `disabled`, `aria-busy`, indicação de andamento e apenas uma request; teste também erro de carga e retry.

## Pacientes

- Mantenha listagem, busca, filtros, ordenação e paginação no servidor; use limite inicial de `40`, máximo `100`, componentes compartilhados de filtros e estados separados para valores aplicados e rascunhos do drawer.
- Não persista o texto de busca de pacientes em `localStorage`: pode conter nome, CPF, RG ou outro identificador. Persista somente filtros operacionais que não contenham dados identificáveis e remova o termo de busca salvo por versões anteriores.
- Se a lista falhar, diferencie erro de zero resultados, limpe resultados de uma consulta anterior e ofereça retry. Após mutações que removam registros do conjunto filtrado, ajuste a página para a última página válida.
- Ao abrir cadastro, mantenha loading enquanto atualiza o perfil e as clínicas disponíveis; não esconda falhas nem crie com uma clínica desatualizada.
- Use trava síncrona além de `disabled` para salvar cadastro, status e arquivos. Desabilite os campos e controles de fechar relacionados enquanto a mutation estiver pendente e exponha loading/`aria-busy`.
- A troca de clínica exige uma consulta prévia dos registros em andamento. Mostre erro e retry no preview; não permita confirmar a troca enquanto o preview necessário não tiver carregado com sucesso.
- Se o cadastro do paciente for persistido e um upload de arquivo falhar, preserve o ID e o formulário; retries devem atualizar o mesmo paciente, não criar outro. Envie arquivos de modo que sucessos parciais fiquem refletidos e apenas os pendentes sejam reenviados.
- No detalhe, não exiba os dados de um paciente anterior quando a rota mudar ou a nova carga falhar; mostre erro com retry. Relatório e downloads de arquivos precisam de loading, bloqueio contra duplicidade e feedback de falha/sucesso.
- Valide filtros e persistência sem salvar busca identificável, criação, edição/transferência com preview, upload parcial e retry, status em página final, detalhe, relatório e download usando fixtures sintéticas.

## Validação das alterações

- Execute `npm.cmd run typecheck --workspace @clinica/web` e o lint focado nos arquivos alterados, por exemplo `npm.cmd run lint --workspace @clinica/web -- src/app/meu-perfil/page.tsx`.
- Ao validar interações, use dados de teste e uma API isolada ou mocks com atraso deliberado; não use dados reais de pacientes.
- Para o perfil, verifique carregamento das opções de clínicas, preservação de campos e seleções durante uma sincronização periódica, salvamento pessoal, atualização de clínicas, estado desabilitado/loading, erro seguido de nova tentativa e reflexão dos dados atualizados na tela.
- Para o prontuário, verifique busca e retry de pacientes, erro/retry da lista, criação e edição de rascunho, finalização, cancelamento e PDF. Durante cada request, confirme o texto/spinner, `aria-busy` e os controles desabilitados; envie uma segunda ação enquanto a primeira está pendente e confirme que apenas uma mutação foi enviada.
- Para Anamnese, verifique a criação a partir de um paciente ativo, preservação da edição durante autosaves atrasados, salvamento manual, conclusão de cada ficha, finalização, PDF e exclusão de rascunho. Simule erro inicial e retry; confirme que respostas antigas não substituem o rascunho mais novo.
- Para Pacientes, verifique limite padrão e máximo, busca/filtros e status `Todos` após reload sem persistir o termo de busca, erro/retry da lista e detalhe, criação/edição/status, paginação após inativar os últimos registros, preview/retry de transferência, upload parcial seguido de retry, relatório e download de arquivo.
- Confirme que cada fluxo termina em sucesso ou em erro visível, que os controles são liberados ao final e que o estado final mostrado corresponde à resposta atualizada.
