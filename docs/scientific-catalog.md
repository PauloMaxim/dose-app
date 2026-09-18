# Catálogo científico V1

A identidade persistida é o UUID fixo; `slug` é a chave legível estável e `name` é somente apresentação. A V1 contém as 10 áreas e 12 interesses históricos, sem derivar tópicos de `ARTICLE_TAGS`.

Os vínculos claros são: insuficiência cardíaca, fibrilação atrial e doença coronariana → Cardiologia; obesidade/incretinas e diabetes → Endocrinologia; doença renal crônica → Nefrologia; Hepatologia (tópico, com UUID próprio) → Hepatologia (área). Prevenção cardiovascular, sepse/antibióticos, lipídios, hipertensão e vacinas no adulto permanecem transversais (`specialty_id NULL`).

Aliases legados são mapas exatos e fechados em `scientific-catalog.ts`; não há fuzzy matching. Eles preservam o `Profile` local, mas nunca promovem localStorage para uma conta. Para autenticados, catálogo e `user_interests` remotos são a fonte de verdade; eventual migração de dados locais exigirá confirmação futura.

O RPC `complete_my_onboarding` valida entidades ativas e grava área, tópicos e conclusão numa transação. UUID inválido/inativo, catálogo vazio/indisponível ou falha de persistência mantém o onboarding incompleto. RLS e `auth.uid()` vinculam a escrita ao usuário. O feed já lê esses IDs de `user_interests`; a troca do catálogo de artigos hardcoded pela leitura do feed fica para integração futura da tela principal.

`classification_rules` permanece `NULL`, portanto classificação automática fica desabilitada até curadoria clínica versionada e testada; associações editoriais continuam prevalecendo. Study type é separado de tópico: RCT, Meta-análise, Guideline e Coorte têm mapper explícito; `Review` deliberadamente não vira `systematic_review` sem evidência.
