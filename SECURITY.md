# Política de segurança

Não abra uma issue pública para divulgar credenciais, dados pessoais ou detalhes exploráveis de uma vulnerabilidade ainda não corrigida. Entre em contato com o mantenedor por um canal privado disponível no perfil/repositório e inclua passos para reproduzir, impacto e mitigação sugerida.

- Nunca versione credenciais AWS, tokens Cognito ou arquivos `.env`.
- Use GitHub Actions OIDC e IAM de privilégio mínimo.
- Restrinja os alvos monitorados a sistemas autorizados e implemente allowlist/egress control.
- Execute testes de segurança e integração em ambiente isolado antes de produção.
