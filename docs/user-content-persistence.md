# Persistência de uso do usuário

Quando Supabase Auth está configurado e existe sessão válida, biblioteca,
progresso, notas e coleções são carregados do backend e o Zustand funciona
somente como cache de renderização. Sem sessão, operações persistentes falham
fechadas. O modo local permanece apenas quando o Supabase está deliberadamente
desabilitado para a demonstração.

O conteúdo legado de `dose-app-v2` não é importado automaticamente porque não
possui identificação segura de proprietário. Antes da primeira substituição
pelo snapshot remoto, uma cópia não autoritativa é preservada em
`dose-legacy-content-v1`. O marcador `dose-content-sync-v1:<user-id>` só é
gravado depois que a leitura remota termina com sucesso.

O cache nunca fornece `user_id`, plano, assinatura, papel ou entitlement para
o servidor. Uma falha de rede mantém a última visualização local, mas não a
promove para o banco. No próximo carregamento bem-sucedido, o snapshot remoto
volta a prevalecer.

O campo visual `plan` é sempre reidratado como `free` e não é persistido como
autoridade. Com Auth configurado, a tela de pagamento protótipo não desbloqueia
premium; isso dependerá de entitlement server-side em uma fase posterior.

O progresso de rolagem é enviado após 1,2 segundo sem nova alteração. O banco
mantém o maior percentual e os maiores minutos já confirmados, evitando que um
dispositivo atrasado faça o progresso retroceder. Conclusões são enviadas
imediatamente.
