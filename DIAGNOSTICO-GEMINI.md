# Diagnóstico do chat — 9 de novembro de 2026

## Evidências confirmadas

- A imagem do AI Studio mostra 5 cancelamentos HTTP 499 no ponto selecionado (8/11). Isso não comprova cota esgotada. O tooltip mostra zero 503 naquele ponto, não ausência de 503 em todo o período.
- A consulta de modelos, usando a chave configurada no ambiente da Vercel, respondeu HTTP 200.
- Uma chamada mínima ao Gemini 3.8 Flash pela API Interactions respondeu HTTP 503 em 2.844 ms. A falha foi reproduzida sem documentos, livros, histórico ou recuperação da base.
- O log de produção às 11:35 UTC registrou falha em 14.614 ms. A versão anterior registrava apenas o nome minificado da classe do SDK, insuficiente para distinguir causas.
- Os timeouts anteriores e a interrupção da conexão explicam cancelamentos 499, mas não é possível associar cada evento do painel a uma requisição individual com a imagem disponível.

## Correções

- Mensagens distintas para 429 (limite de uso), 5xx (indisponibilidade), timeout, credencial/permissão, modelo inexistente e stream incompleto.
- Logs técnicos limitados à categoria, status HTTP e duração; sem corpo de erro, prompts, respostas, documentos ou credenciais.
- Uma nova tentativa com espera de 1 a 1,5 segundo somente para falha rápida de servidor, antes de qualquer texto. Sem repetição em 429, timeout, erros de credencial ou resposta parcial.
- Prazos independentes do SDK: 30 segundos em Ajuda rápida e 60 em Análise aprofundada por tentativa; limite global de 90 segundos. Esses prazos limitam a espera, não garantem resposta.
- Limpeza da resposta parcial ao falhar, impedindo que pareça uma recomendação completa.
- Heartbeat de 10 segundos preservado; sessões confidenciais continuam bloqueadas para Gemini.

## Alternativas avaliadas

1. Aumentar o timeout: rejeitado como correção principal, pois o pedido mínimo já retornou 503 e apenas esperar mais não garante recuperação.
2. Repetição limitada: implementada para falhas rápidas; sem laços longos que aumentem latência e pressão sobre a API.
3. Modelo/endpoint alternativo: só ativar após conclusão real e avaliação da qualidade, compatibilidade e limites do projeto. Um modelo listado pode não estar disponível no endpoint escolhido. O Gemini 2.5 Flash retornou 404 em Interactions; isso não implica indisponibilidade em GenerateContent.
4. Provedor independente: integração OpenAI preparada, mas segue desativada até credencial de API, orçamento e Redis serem configurados. Não é possível reutilizar automaticamente a cota deste chat.
5. Reduzir contexto: pode melhorar latência em chamadas bem-sucedidas; não explica o 503 no pedido mínimo. Não remover a biblioteca para tentar resolver este erro.

## Validação

TypeScript e 28 testes automatizados aprovados, incluindo falhas persistentes, cancelamento, resposta parcial e distinção de erros. Esses testes não comprovam disponibilidade nem qualidade semântica do modelo real.

Referências oficiais: https://ai.google.dev/gemini-api/docs/api-errors e https://ai.google.dev/gemini-api/docs/rate-limits . Os limites são por projeto; trocar uma chave do mesmo projeto não amplia a cota.

## Comparação de alternativas no mesmo ambiente

- Gemini 3.8 Flash / Interactions: HTTP 503 em 2.844 ms no teste mínimo; GenerateContent também não concluiu em 15 segundos.
- Gemini 3.7 Flash / Interactions: não concluiu no prazo independente de 12 segundos.
- Gemini 2.5 Flash: HTTP 404 nos dois endpoints testados, embora listado no catálogo.
- Gemini 3.5 Flash Lite / Interactions: pedido mínimo concluído em 658 ms, primeiro evento em 652 ms. Os seis pedidos de produto concluíram; na primeira avaliação, cinco passaram nas verificações automáticas e um não passou no critério conjunto qualidade/custo/latência. A ativação foi bloqueada até nova avaliação.
- Instruções de avaliação e produção unificadas. Adicionada orientação explícita de qualidade/custo/latência para decisões sobre IA.

Não é possível inferir taxas globais de erro ou percentis a partir desses poucos testes. A disponibilidade real pode variar.

## Resultado final

O modelo padrão foi alterado para gemini-3.5-flash-lite. A rota completa concluiu, com fontes e sinal terminal, nos dois modos: rápido em 2.440 ms (primeiro texto 1.311 ms), aprofundado em 8.086 ms (primeiro texto 5.391 ms). Na avaliação final, cinco casos passaram e um terminou sem resposta completa; o caso afetado foi revalidado isoladamente e passou em 1.871 ms. Os seis critérios tiveram aprovação, porém em execuções diferentes. Isso evidencia melhora, não ausência de falhas intermitentes. Não houve compra de créditos, troca de plano ou ativação OpenAI.

Publicação com modelo alternativo: dpl_9Pv96kgEjKmM85cns4fuRMkZmZnA, concluída. URL: https://copiloto-produto.vercel.app . Acesso via navegador protegido não foi revalidado neste diagnóstico; os testes de rota foram executados diretamente no ambiente da Vercel.
