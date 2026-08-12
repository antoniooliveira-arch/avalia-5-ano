# Project TODO

## Fundação e segurança

- [x] Definir modelo de dados para escolas, professores, turmas, alunos, disciplinas, questões, avaliações, tentativas, respostas e auditoria.
- [x] Aplicar migração do banco de dados e manter o schema Drizzle sincronizado.
- [x] Implementar autenticação administrativa com controle de perfil administrador/professor.
- [x] Garantir que professores só consultem e operem suas próprias turmas e alunos no backend.
- [x] Mascarar CPF em toda a interface e em relatórios exportados.
- [x] Registrar ações sensíveis em log de auditoria.

## Gestão acadêmica

- [x] Criar CRUD de escolas com status e busca.
- [x] Criar CRUD de professores vinculados a escolas e turmas.
- [x] Criar CRUD de turmas vinculadas a escolas, professores e ano letivo.
- [x] Criar CRUD de alunos vinculados a escola e turma, com CPF protegido.
- [x] Criar cadastro de disciplinas de Língua Portuguesa e Matemática.

## Banco de questões e avaliações

- [x] Criar banco de questões com alternativas A-E, imagem, habilidade, descritor, dificuldade, tipo e gabarito.
- [x] Criar fluxo de montagem de avaliações a partir de questões do banco.
- [x] Implementar publicação, datas de início/fim e tempo limite da avaliação.
- [x] Implementar configurações de tentativa única, embaralhamento e revisão antes do envio.

## Aplicação da prova

- [x] Criar fluxo público de identificação obrigatória por escola, turma e CPF, nessa ordem.
- [x] Criar tela responsiva de prova com navegação entre questões.
- [x] Criar revisão das respostas e confirmação antes do envio.
- [x] Implementar salvamento de respostas e envio automático ao fim do tempo.
- [x] Implementar correção automática das questões objetivas, percentual e nota.

## Dashboards e análises

- [x] Criar dashboard administrativo com alunos, avaliações, média geral e participação.
- [x] Criar gráficos por disciplina, turma e faixa de aproveitamento.
- [x] Criar resultados individuais por aluno e consolidados por turma.
- [x] Criar análise por questão, habilidade e histórico de evolução.
- [x] Criar filtros por escola, turma, professor, disciplina, avaliação, período, habilidade e faixa.

## Relatórios e experiência

- [x] Gerar relatório individual em PDF e CSV.
- [x] Gerar relatório por turma em PDF e CSV.
- [x] Gerar relatório geral filtrado em PDF e CSV.
- [x] Criar interface elegante, sofisticada, acessível e responsiva para desktop, tablet e celular.
- [x] Adicionar estados de carregamento, vazio, erro e feedback de sucesso.
- [x] Escrever e executar testes Vitest para regras de domínio e permissões.
- [x] Validar visualmente os fluxos principais e corrigir problemas encontrados.
- [x] Criar checkpoint final após verificar este checklist.


## Complementos identificados antes da validação final

- [x] Completar UI de CRUD para professores e disciplinas, incluindo edição e status; escolas, turmas e alunos já possuem cadastro, busca/arquivamento ou criação conforme o módulo.
- [x] Completar o cadastro de questões com alternativa E, imagem, tipo e todos os metadados exigidos.
- [x] Adicionar datas de início/fim e configurações avançadas da avaliação na UI, sem valores hardcoded.
- [x] Criar revisão real das respostas antes do envio, com navegação por questões.
- [x] Implementar páginas/visões dedicadas para resultado individual, consolidação por turma e evolução histórica.
- [x] Completar filtros avançados por professor, período e habilidade.
- [x] Implementar exportações dedicadas individual e por turma em PDF e CSV, com datasets agregados próprios; manter relatório geral filtrado.
- [x] Criar seed idempotente para as disciplinas Língua Portuguesa e Matemática.

## Validação complementar

- [x] Adicionar testes de autorização e escopo para diferenciar perfis administrador e professor.
- [x] Implementar visão dedicada de consolidação por turma com participação, distribuição e evolução.
- [x] Implementar filtros avançados reais na tela de desempenho por habilidade, período e faixa.
- [x] Validar visualmente as rotas autenticadas do painel administrativo quando houver sessão disponível.
- [x] Ampliar exportações para relatórios individual e por turma dedicados, além do relatório geral filtrado.

## Edição de cadastros

- [x] Implementar edição de nome, CPF, e-mail e escola dos professores no painel.
- [x] Implementar edição de nome e código das disciplinas no painel.
- [x] Validar visualmente o formulário de edição de disciplinas e os estados de status.

- [x] Revisar visualmente o fluxo de cadastro/edição de professores, o CPF protegido, as ações de status e a edição de disciplinas; a edição de disciplina foi aberta por URL e o formulário de professor foi aberto em estado interativo.
