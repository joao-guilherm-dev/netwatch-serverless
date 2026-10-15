# NetWatch Serverless 🇧🇷

Monitoramento de disponibilidade de sites e serviços TCP com AWS Lambda, TypeScript/Node.js, DynamoDB, Amazon SNS, API Gateway, Cognito e GitHub Actions.

> **Status:** projeto inicial / starter. Antes de usar em produção, execute os testes e siga o checklist de segurança. O deploy exige conta AWS, Cognito configurado e permissões IAM adequadas.

## Recursos

- Verificações HTTP/HTTPS e TCP agendadas a cada 5 minutos.
- Registro de latência, resultado e histórico com TTL de aproximadamente 30 dias.
- Alertas SNS nas transições `UP` ↔ `DOWN`.
- API REST protegida por JWT do Amazon Cognito para gerenciar alvos.
- Validação de entrada com Zod e logs estruturados.
- Testes automatizados, lint, verificação de tipos e build.
- CI e deploy manual via GitHub Actions OIDC (credenciais temporárias).
- DynamoDB com criptografia, recuperação point-in-time e proteção contra exclusão configurável.

## Arquitetura

```text
EventBridge (5 min) -> Lambda Monitor -> probes HTTP/TCP
                                  |-> DynamoDB (alvos e histórico)
                                  |-> SNS (alertas)
Operador -> API Gateway -> Cognito JWT -> Lambda API -> DynamoDB
GitHub Actions -> OIDC -> IAM Role -> Serverless Framework -> CloudFormation
```

## Requisitos

- Node.js 20+ e npm.
- Conta AWS e AWS CLI v2 para deploy local.
- User Pool e App Client do Cognito. Configure `COGNITO_ISSUER` e `COGNITO_CLIENT_ID`.
- Serverless Framework v4; pode solicitar login/conta dependendo do ambiente.

## Rodar localmente e testar

```bash
nvm use
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Versione `package-lock.json` após gerar o lockfile com `npm install`, para builds reprodutíveis. Os testes unitários devem ser executados antes de qualquer deploy.

## Configurar e implantar na AWS

Não coloque credenciais reais em arquivos versionados. Configure no terminal ou em um gerenciador de segredos:

```bash
export COGNITO_ISSUER='https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SEU_POOL'
export COGNITO_CLIENT_ID='SEU_APP_CLIENT_ID'
export ENABLE_DELETION_PROTECTION=false

npm run typecheck && npm run lint && npm test && npm run build
npx serverless deploy --stage dev --region us-east-1
```

Para produção, use conta/credenciais separadas, aprovação manual e `ENABLE_DELETION_PROTECTION=true`. Revise permissões IAM e outputs do CloudFormation.

### Receber alertas

Copie o `AlertsTopicArn` do deploy e execute; confirme a assinatura por e-mail:

```bash
aws sns subscribe --topic-arn 'SEU_ALERTS_TOPIC_ARN' --protocol email --notification-endpoint 'seu-email@exemplo.com' --region us-east-1
```

## Exemplo de cadastro de alvo

Use um JWT válido para o autorizador Cognito e o endpoint retornado no deploy:

```bash
curl -X POST "$API_ENDPOINT/targets" \
  -H "Authorization: Bearer $COGNITO_JWT" \
  -H 'content-type: application/json' \
  -d '{"name":"Site principal","type":"http","host":"https://example.com/","expectedStatus":200,"intervalSeconds":300,"enabled":true}'
```

Exemplo TCP: `{"name":"Servidor SSH","type":"tcp","host":"server.example.com","port":22,"intervalSeconds":300,"enabled":true}`. Monitore apenas sistemas que você possui ou tem autorização para testar.

## Endpoints

| Método | Rota | Finalidade |
|---|---|---|
| POST | `/targets` | Cadastrar alvo |
| GET | `/targets` | Listar alvos |
| PATCH | `/targets/{id}` | Alterar configurações |
| DELETE | `/targets/{id}` | Excluir alvo |
| GET | `/targets/{id}/checks?limit=50` | Consultar histórico |

Todas as rotas exigem JWT Cognito válido.

## CI/CD no GitHub Actions

O workflow `.github/workflows/ci.yml` executa em pull requests e push para `main`. O workflow `.github/workflows/deploy.yml` é manual (`Actions → Deploy → Run workflow`) e permite escolher `dev` ou `prod`.

1. Crie uma IAM Role confiável para `token.actions.githubusercontent.com`, limitada ao seu repositório e branch/ambiente.
2. Dê à role somente as permissões necessárias para CloudFormation, Lambda, API Gateway, EventBridge, DynamoDB, SNS, Logs e `iam:PassRole`.
3. Em **Settings → Secrets and variables → Actions**, crie os secrets `AWS_DEPLOY_ROLE_ARN`, `COGNITO_ISSUER` e `COGNITO_CLIENT_ID`.
4. Crie a variável `AWS_REGION` (opcional; padrão `us-east-1`).
5. Crie um ambiente `prod` com revisores obrigatórios.

Não use chaves AWS de longa duração como secrets se OIDC estiver disponível.

## Checklist antes de produção

- [ ] Validar build, lint e testes em ambiente limpo.
- [ ] Restringir destinos monitorados a uma allowlist de domínios aprovados.
- [ ] Endurecer proteção SSRF, incluindo destinos TCP, IPs privados, DNS rebinding e redirects.
- [ ] Restringir egress da rede; proteção em código não substitui controles de rede.
- [ ] Configurar alarmes CloudWatch para erros, throttling e duração de Lambda, API 5xx e throttling do DynamoDB.
- [ ] Testar Cognito, SNS e falhas/recuperação em conta sandbox.
- [ ] Configurar AWS Budgets, retenção, backups, incidentes e rollback.
- [ ] Revisar IAM, dependências e ações GitHub.
- [ ] Confirmar aprovação obrigatória para `prod`.

## Limitações conhecidas

- O monitor percorre o registro de alvos em lotes limitados; para escala maior, adicione paginação e índice/filas por alvo.
- `intervalSeconds` é armazenado, mas o agendamento padrão verifica todos os alvos habilitados a cada cinco minutos.
- A validação de IPs privados não substitui allowlist/egress; não use a API para sondar destinos arbitrários.
- Alarmes CloudWatch e testes de integração AWS precisam ser configurados/validados para cada ambiente.

## Remover ambiente de desenvolvimento

```bash
npx serverless remove --stage dev --region us-east-1
```

Não remova produção sem aprovação, retenção e plano de recuperação. Se a proteção contra exclusão estiver habilitada, desative-a de forma deliberada antes de remover tabelas.
