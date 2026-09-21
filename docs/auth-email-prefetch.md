# Links de autenticação resistentes a prefetch

Os emails de autenticação devem abrir `/auth/action`. Essa página apenas valida
o formato dos parâmetros e explica a ação ao usuário. Ela não chama o Supabase,
não cria sessão e não persiste o token. Somente um clique explícito encaminha os
mesmos dados para `/auth/confirm`, onde permanece o pipeline de validação.

## Configuração manual dos templates do Supabase

O aplicativo fornece `emailRedirectTo`/`redirectTo` como uma URL completa no
formato `{{ .SiteURL }}/auth/action?kind=...` (com a origem real do navegador).
Depois de permitir essas URLs na configuração de redirect URLs do projeto,
substitua somente o `href` de cada template pelos valores abaixo:

- **Confirm signup**

  ```html
  <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=signup"
    >Confirmar meu e-mail</a
  >
  ```

- **Reset password**

  ```html
  <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery"
    >Redefinir minha senha</a
  >
  ```

- **Change email address**

  ```html
  <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email_change"
    >Confirmar alteração de e-mail</a
  >
  ```

`TokenHash`, `RedirectTo` e `SiteURL` são variáveis de template do Supabase;
`RedirectTo` já contém a URL baseada em `SiteURL`/origem autorizada que a Dose
enviou para a operação. Não use `ConfirmationURL`, pois ela verifica o token
antes de chegar à barreira de clique.

Ao configurar Resend ou outro SMTP customizado, mantenha **email click tracking
desativado**. Reescrita de links por tracking pode impedir a validação correta.

Esta alteração no repositório não modifica templates remotos, redirect URLs,
SMTP ou qualquer outra configuração do projeto Supabase/Vercel.
