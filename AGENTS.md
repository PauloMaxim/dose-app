# Regras permanentes para agentes — Dose

## Grounding e evidência

- Nunca invente arquivos, rotas, APIs, tabelas, colunas, migrations, variáveis de ambiente, configurações, comportamento do produto ou resultados de testes.
- Inspecione a implementação relevante antes de afirmar como algo funciona. Se algo não puder ser verificado, diga explicitamente que não foi verificado.
- Distinga claramente comportamento existente verificado, inferência, recomendação e implementação proposta.
- Nunca afirme que um teste passou sem executá-lo ou observar evidência verificável.
- Nunca afirme que uma migration foi aplicada apenas porque o arquivo existe, nem que um deployment está saudável sem evidência correspondente.

## Disciplina de arquitetura

- Faça a menor alteração que satisfaça o requisito aprovado e reutilize a arquitetura e a infraestrutura existentes antes de criar novas abstrações.
- Não crie serviços, dependências, tabelas, migrations ou infraestrutura especulativos.
- Não faça refactors cosméticos, alterações não relacionadas ou “future-proofing” sem necessidade concreta.
- Diante de ambiguidade material, pare e relate-a em vez de inventar uma decisão.

## Git e fluxo de mudança

- O branch `main` é a fonte de verdade do código do Dose.
- Antes de implementar uma mudança, parta da `origin/main` remota atual, salvo instrução explícita em contrário.
- Não faça push direto para `main`. Desenvolva em branch própria e prepare PR separado, salvo autorização explícita diferente.
- Não faça merge sem autorização explícita.
- Não reescreva histórico, use force push, faça reset destrutivo ou apague trabalho existente sem autorização explícita.
- Antes de concluir, verifique o diff e confirme que somente arquivos pertencentes ao escopo foram alterados.

## Invariantes de segurança do Dose

- A sessão validada do Supabase é a autoridade de identidade; `user_id` fornecido pelo cliente nunca é autoridade de autenticação.
- Estado local nunca é autoridade para autenticação, onboarding concluído, Premium ou entitlements.
- Secrets privilegiados nunca devem chegar ao browser ou bundle cliente. Service Role e outros privilégios permanecem server-side.
- Preserve RLS e limites de confiança existentes, salvo mudança explicitamente aprovada.
- Nunca modifique retroativamente uma migration já aplicada nem reaplique cegamente migrations históricas.

## Invariantes atuais de Auth

- A sessão validada do Supabase é a autoridade de identidade.
- `profiles.onboarding_completed_at` é a autoridade remota para onboarding concluído.
- Estado ou cache local nunca pode liberar Home para usuário autenticado cujo onboarding remoto esteja incompleto.
- Dados locais de onboarding são somente draft/cache até persistência e revalidação remotas.
- Dados locais de um usuário nunca podem ser tratados como autoridade para outro usuário.
- Em recuperação de senha, parâmetros de URL não constituem prova de recovery.
- Preserve o recovery gate: uma sessão de recuperação não pode obter acesso normal à aplicação antes da conclusão válida da troca de senha.
- Preserve as fronteiras de confiança e as provas de callback/recovery existentes, salvo alteração explicitamente solicitada.
- Não enfraqueça mecanismos de confirmação, recuperação, revalidação de identidade ou isolamento entre usuários sem requisito explicitamente aprovado.

## Conteúdo científico

- Nunca apresente conteúdo científico de demonstração/protótipo como literatura real.
- Nunca apresente resumo de IA como resumo científico real se ele não tiver sido produzido pelo pipeline real correspondente.
- Preserve a distinção entre metadata, abstract e full text e suas permissões/licenças.
- Não introduza chamadas pagas de IA implicitamente em feed, navegação ou renderização.

## Validação

- Execute os testes relevantes à alteração quando o ambiente permitir.
- Para fluxos críticos de usuário, testes de regras/unitários não substituem validação comportamental da interação quando esta for necessária.
- Separe falhas novas de falhas legadas ou preexistentes. Nunca oculte ou reinterprete teste falhando como sucesso.
- Informe explicitamente tudo que permaneceu sem validação.
- Não altere código apenas para fazer um teste ou alerta desaparecer sem compreender a causa.
- Não declare sucesso de integração externa apenas com base em mocks ou testes locais quando a conclusão depender do ambiente remoto.

## Migrations e produção

- Trate migrations aplicadas como histórico imutável; mudanças posteriores de schema devem usar migrations aditivas novas.
- Não execute operações remotas em Supabase, Vercel ou outros ambientes sem autorização explícita da tarefa.
- A existência de código, migration ou configuração no repositório não prova que esteja aplicada em produção.
- Não presuma que migrations históricas estejam ou não aplicadas; verifique o estado remoto quando a tarefa exigir essa conclusão.
- Não modifique secrets, variáveis de produção ou configurações remotas sem autorização explícita.

## Escopo

- Antes de codificar, identifique a implementação existente relevante e a infraestrutura reutilizável.
- Permaneça estritamente no escopo solicitado e não aproveite uma tarefa para “limpar” outras áreas.
- Se descobrir problema fora do escopo, registre-o separadamente sem corrigi-lo.
- Não adicione dependências, arquivos auxiliares ou documentação não solicitada sem necessidade concreta para cumprir a tarefa.
