## Validação da versão 1.4.1 — 11/11/2026

- 73 testes determinísticos aprovados; typecheck e build local concluídos.
- Histórico verificado com IndexedDB real: salvar avulsas automaticamente, reabrir após recarregar, continuar mensagens com fontes, preservar contexto do projeto, pesquisar sem acentos, filtrar, exportar/restaurar em outro perfil e excluir avulsas.
- 12 combinações de layout do histórico (1440/390/320 px, dois temas e dois tamanhos), sem overflow ou controles cortados.
- Respostas de navegador são fixtures explícitas de transporte; sem chamadas externas de modelo nesses testes. A publicação mantém o teste real de IA antes do build de produção.
- Evidências: artifacts/history-1.4.1/browser-report.json, historico-desktop.png e historico-celular.png.

## Validação da versão 1.4 — 10/11/2026

- Typecheck e build de produção concluídos; 67 testes determinísticos aprovados.
- Produção local em http://127.0.0.1:3106. Nenhuma publicação na Vercel foi realizada.
- Verificação de projetos v2: 64 combinações de largura, tema, tamanho e tela, sem overflow, controles cortados ou cores cromáticas; contraste AA verificado.
- Fluxos: projeto com nome/objetivo, memória entre conversas, recuperação explícita de falha da memória, isolamento entre projetos, exportação individual e importação em outro perfil, migração de IndexedDB v1, revisão da trilha, proposta final gerada com respostas, confirmação explícita de resolução e trilha independente convertida em projeto.
- Os seis PDFs completos foram comparados byte a byte com os arquivos privados preparados. GET, HEAD, Range, faixa inválida, ID desconhecido e link de uma referência por página foram verificados. O manifesto de build inclui seis PDFs privados; public contém zero PDFs.
- Armazenamento v2: falha de quota preserva trabalho em memória e permite exportar o projeto; conflito entre abas impede sobrescrever o trabalho da outra aba.
- Regressão: 48 layouts, 12 cenários equivalentes a zoom de 200%, teclado, foco, temas e transporte. Menor contraste textual observado: 6,8566:1.
- IA em navegador: fixtures explícitas, zero chamadas externas. Avaliação real separada em npm run eval:projects; registrada como not_run porque nenhuma credencial de modelo está configurada neste ambiente. Fidelidade textual tem testes determinísticos; qualidade e relevância dos modelos continuam pendentes.
- Evidências: artifacts/projects-1.4/browser-report.json, storage-report.json, model-evaluation.json, conversar-desktop.png, projeto-resumo-desktop.png, trilha-inicio-desktop.png e projeto-celular.png. Regressão em artifacts/improvements/browser-report.json.

## Validação da versão 1.3 — 10/11/2026

- Typecheck e build otimizado concluídos. Suíte determinística: 55 testes aprovados.
- Produção local testada em http://127.0.0.1:3101, com Microsoft Edge headless e IndexedDB nativo.
- verify-workspace: 48 combinações de largura (320, 390, 720, 1440), tema e tamanho do texto; cores monocromáticas e ausência de controles cortados.
- Fluxos verificados: três jornadas, retomada após recarregar, edição de contexto, persistência explícita de texto de PDF, exclusão de anexos temporários do backup, documento editável e confirmação invalidada por edição, impressão somente do documento selecionado, Markdown, backup/restauração como cópia, arquivo inválido, nova sessão com síntese revisada, fontes editoriais, exclusão completa, falha de espaço e conflito entre abas.
- verify-improvements: 48 verificações de layout e contraste, 12 cenários equivalentes a zoom de 200%, foco dos modais, navegação por teclado, preferências e transporte. Menor contraste textual observado: 6,8566:1.
- Chamadas externas de modelo: zero. Respostas de chat nos testes de navegador são fixtures identificadas. Esta validação não atesta qualidade comportamental de modelos reais com as novas jornadas.
- Evidências: artifacts/workspace-1.3/browser-report.json, projetos-escuro-desktop.png, jornada-priorizacao-celular.png e leituras-curadas-desktop.png; regressão em artifacts/improvements/browser-report.json.
- Implementação local concluída; nenhuma publicação ou alteração de configuração da Vercel foi realizada.

# Validação — Bússola de Produto

## Versão 1.2 — novo livro e rodapé — 9/11/2026

- Publicada em https://copiloto-produto.vercel.app/ . Deployment `dpl_GJvDNMnHgCWyxyUTqdUQD82XG4tA`, READY, promovido e confirmado no domínio principal.
- Base com seis livros e 2.266 páginas de origem. Transformação Digital e Cultura de Produto, de Joaquim Torres: 372 páginas, 370 com texto útil e 373 trechos. Marcas de identificação do comprador removidas na extração.
- Rodapé com versão 1.2, data 09/11/2026 e breve nota sobre a inclusão do livro. Biblioteca e contadores dinâmicos conferidos no site publicado.
- 46 testes determinísticos aprovados. Verificação de tipos e build local e remoto aprovados. Dois perfis visuais (1440 px escuro/padrão e 320 px claro/ampliado) aprovados, sem cortes horizontais e com texto mínimo de 14 px.
- Uma única avaliação real adicional: resposta concluída, semanticamente validada e com citação/página do novo livro; 3.408 ms, sem revisão. Não foram repetidos os seis cenários reais anteriores.
- Corpus comprimido enviado diretamente pela CLI oficial, sem exposição do conteúdo em saída de ferramentas. Login Vercel mantido. A CLI criou automaticamente um token auxiliar de bypass durante a consulta de conferência; o token auxiliar foi revogado em 10/11/2026 após autorização explícita. Confirmada a ausência de tokens de automação e a preservação da proteção para todos os deployments.
- Evidências locais: `artifacts/release-1.2/browser-report.json`, `rodape-1440.png`, `rodape-320.png` e `production-release.json`. Os registros abaixo são históricos.

## Publicação em produção — 9/11/2026

- Publicação autorizada pelo usuário e concluída no mesmo endereço: https://copiloto-produto.vercel.app/ .
- Deployment `dpl_7KdwxSZHRtJaCB6AHyKE7hsSQkR6`, target production, estado READY. O domínio foi conferido pela API e a versão foi aberta no Opera, com tema e tamanho de texto disponíveis e Gemini configurado.
- Build de produção criado a partir do preview validado `dpl_H7GPWWJrvJQcPPvxrMEJ2prjPXX7`. A promoção direta desse preview foi recusada pela Vercel com HTTP 422; foi feito o build de produção com os mesmos arquivos, sem repetir avaliações reais ou consumir novamente a API Gemini. Verificação de tipos e compilação passaram.
- A única variável do projeto é `GEMINI_API_KEY`, compartilhada entre Production e Preview como Secret; nenhum valor foi recuperado, alterado ou exposto. Vercel Authentication permanece habilitada para todos os deployments.
- Os resultados de 45 testes locais e seis cenários reais do preview estão registrados abaixo e em `artifacts/improvements/live-validation-report.json`. O preview continua disponível para referência; o endereço principal agora serve a versão final.

## Conclusão — pacote de melhorias de 9/11/2026

- Preview privado concluído: https://copiloto-produto-7b8o9acrr-wayne-enterprise3.vercel.app . Deployment `dpl_H7GPWWJrvJQcPPvxrMEJ2prjPXX7`, estado READY, protegido por Vercel Authentication. Aberto no Opera com a autenticação existente; tema escuro e texto ampliado conferidos visualmente.
- Produção preservada: o domínio continua no deployment `dpl_ERttUtCy5KS8ajPt7pnUfW2tUdBH`. Proteção em todos os deployments e comandos padrão do projeto mantidos.
- 45 testes locais aprovados; verificação de tipos e build aprovados. As 60 combinações visuais já verificadas continuam válidas, pois as correções finais alteraram recuperação, instruções, auditoria e execução dos testes, sem mudar o CSS ou os componentes visuais.
- Por solicitação do usuário, a execução real foi reduzida de 23 para seis cenários. A suíte ampliada permanece disponível, mas não foi repetida junto da validação final.
- Quatro pedidos reais à rota completa, na mesma conversa, passaram: duas perguntas no modo rápido (6.002 ms), mudança de assunto combinando conceitos e livros (4.578 ms), duas perguntas no modo aprofundado (11.880 ms) e continuação curta (5.854 ms). Histórico enviado: 0, 2, 4 e 6 mensagens, respectivamente. Todas as respostas foram validadas antes da publicação e suas citações correspondem às fontes retornadas.
- As duas verificações dirigidas passaram: aceitar a fórmula de RICE sustentada pela fonte e rejeitar uma garantia de receita sem suporte, mesmo com ID de fonte válido.
- A primeira rodada ampla identificou dois problemas de qualidade e foi bloqueada: a busca misturava termos do assunto com instruções como “livros”, “trechos” e “cite”; a revisão aprofundada nem sempre removia todas as afirmações sem suporte. A busca agora separa o assunto e expande apenas termos do vocabulário dos conceitos; a revisão remove afirmações sem suporte e privilegia uma resposta menor sustentada. A auditoria registra apenas tipos e quantidades de problemas, sem conteúdo.
- Uma rodada seguinte atingiu HTTP 429. O painel do Google mostrou pico de 16/15 requisições por minuto e 72/500 por dia. O espaçamento foi adicionado apenas aos scripts de avaliação, mantendo a latência do aplicativo. O conjunto final de seis cenários concluiu sem esse erro.
- Evidência sem perguntas, respostas ou credenciais: `artifacts/improvements/live-validation-report.json`. A validação semântica continua probabilística; os resultados não garantem ausência de falhas futuras do provedor ou de erros de conteúdo.

## Registro da implementação local anterior à avaliação real

- Implementação local; nenhuma publicação ou alteração de configuração de produção nesta sessão. Os registros abaixo desta seção descrevem validações históricas.
- 44 testes automatizados aprovados. Incluem histórico por pares concluídos, mudança de assunto, continuação curta, duas perguntas distintas, fontes de conceitos/livros/combinadas, citações inexistentes, sustentação rejeitada, revisão única e rejeição de respostas vazias ou sem citação.
- Parser do Gemini verificado com eventos tipados do SDK instalado: conclusão exige texto e `interaction.completed` com status `completed`. Limite de geração, interrupção, erro e cancelamento não produzem sucesso. A saída rápida passou de 2.048 para 4.096 tokens, mantendo os modelos configurados e os controles de orçamento/confidencialidade.
- Verificação de tipos e build de produção local aprovados. Cache gerado em `.next/static` precisou ser limpo após o OneDrive marcá-lo como somente leitura.
- Navegador Edge headless: 48 combinações aprovadas (1.440, 720, 390 e 320 px; claro/escuro; texto padrão/ampliado; chat/conceitos/biblioteca). Contraste mínimo medido de 5,29:1 entre os textos inspecionados; tokens de bordas e controles também testados com mínimo de 3:1.
- Mais 12 combinações aprovadas com viewport CSS de 720×500 e densidade 2, equivalentes à geometria de uma janela de 1.440×1.000 em zoom de 200%. Não foi usado o controle de zoom de uma janela interativa do navegador.
- Teclado: entrada e contenção de foco em modais, fechamento por Escape, retorno ao botão de origem, navegação móvel e link de salto aprovados. Preferências acompanham o tema do sistema e persistem; conversas não sobrevivem ao recarregamento.
- API local real: rejeição de entrada inválida e origem externa, e resposta de falta de evidência sem chamada a provedor, aprovadas.
- Chat no navegador: fixtures explícitas verificam geração/validação, ocultação de rascunho até conclusão, nova tentativa sem duplicação e exclusão de turnos com falha. Esses testes não medem a qualidade do modelo.
- Avaliação real deste pacote não executada. O pedido de continuação autorizou o envio dos testes ao Gemini, resolvendo a pendência anterior de autorização. A chave existente foi localizada no projeto Vercel, mas é Secret de Production/Preview e sua leitura não fornece o valor para execução local. A proteção Vercel Authentication está habilitada em todos os deployments. Foi preparado um preview privado, sem promoção ou mudança de produção; sua criação aguarda confirmação porque o plano aprovado excluía publicação. Não é possível afirmar que a falha original deixou de ocorrer com o provedor real.
- `scripts/evaluate-live.ts` foi ampliado para 15 casos e três verificações semânticas dirigidas. Os testes sequenciais agora utilizam respostas reais dos turnos anteriores, mantidas apenas em memória. Inclui dois modos, conceitos isolados, livros isolados e combinação das bases. `scripts/check-chat-route.ts` cobre cinco pedidos reais à rota completa, incluindo três turnos consecutivos e duas perguntas nos dois modos. Os scripts carregam a configuração local com `@next/env`, falham explicitamente quando falta credencial e não imprimem perguntas, respostas ou chaves. Os 44 testes locais, tipos e build foram revalidados após essas alterações.
- Evidências reproduzíveis: `artifacts/improvements/browser-report.json`, `inicio-dark-desktop.png`, `inicio-claro-celular-ampliado.png` e `conceito-dark-ampliado.png`. A verificação semântica continua probabilística e exige avaliação real e revisão de fidelidade antes de aprovação completa.

## Registros históricos

- TypeScript: aprovado.
- Testes automatizados: 15 aprovados.
- Build Next.js local e Vercel: compilação aprovada.
- Guia: 28 conceitos e referências originais preservadas.
- Biblioteca: cinco livros, 1.894 páginas de origem e 2.115 trechos incluindo as referências da skill.
- APIs locais: conceitos, pesquisa e status responderam; ausência de chave e sessão confidencial retornaram orientação sem chamada ao provedor.
- Arquivo privado solicitado como URL: 404.
- Tracing das funções chat e pesquisa: base compactada e instruções incluídas.
- Produção: Vercel Authentication habilitada para All Deployments; acessos anônimos à página e às APIs foram encaminhados à Vercel.
- Equipe: um membro autorizado, papel Owner.
- Gemini: testes reais identificaram código Python no valor de GEMINI_API_KEY. É necessário substituir por somente a chave do Google AI Studio e gerar um novo deploy.
- Os seis casos foram validados quanto a roteamento, mas a avaliação semântica das respostas reais está pendente de credencial válida.
- Sol: adaptador e controle de orçamento preparados; desativado até configurar chave, teto diário e Redis. Integração real com OpenAI e concorrência em Redis não foi executada porque esses serviços não estão configurados.
- Validação visual: a ferramenta de navegador encerrou o uso por não conseguir confirmar a URL no Windows. Não foi concluída a inspeção visual em desktop/celular nem a interação real com upload de PDF.
- Conversas, anexos e resultados de IA não são persistidos. Os contadores de orçamento só são usados quando Sol é ativado.

Projeto Vercel: https://vercel.com/wayne-enterprise3/copiloto-produto
Aplicação: https://copiloto-produto.vercel.app
Documentação de configuração: README.md

## Revalidação da chave e da geração

- A chave atual foi aceita pelo Google: consulta de modelos retornou HTTP 200, com Gemini 3.8 Flash disponível. Nenhum valor da chave foi obtido ou exibido.
- Corrigido o validador local que supunha o comprimento e o alfabeto das chaves antigas. Novas chaves com pontuação e comprimento diferente são aceitas sintaticamente; a autenticidade é validada pelo provedor.
- TypeScript e 16 testes locais aprovados.
- SDK configurado com timeout explícito de 60 segundos e repetição automática desativada.
- Teste mínimo de geração REST: não concluiu em 20 segundos (TimeoutError). A geração ponta a ponta ainda não foi confirmada.
- Correção publicada em produção: dpl_Au8AwZp16ZJSHGRDRb6sa2tgVXFg, estado READY.

## Correção de interrupção do chat

- Logs de produção confirmaram encerramentos da função após 120 segundos.
- Adicionado limite de 90 segundos independente do SDK, com sinalização explícita de erro antes de encerrar o fluxo.
- Adicionados heartbeats a cada 10 segundos e descarte de emissões tardias após fechamento.
- TypeScript e 20 testes automatizados aprovados, incluindo provedor que ignora cancelamento e rejeição tardia.
- Testes reais de geração pelas APIs Interactions e GenerateContent não concluíram no prazo de 20/25 segundos, respectivamente. A autenticação e a disponibilidade do modelo foram confirmadas antes por HTTP 200.
- Não é possível afirmar que a geração de respostas está operacional; a correção evita o encerramento abrupto sem explicação.
- Publicação: dpl_7qqHCeuWZaTVghziXTp7gZBLqg7K.

## Diagnóstico e recuperação — 9/11/2026

- HTTP 503 reproduzido em chamada mínima ao 3.8 Flash; a mensagem anterior confundia indisponibilidade, cota e stream incompleto.
- Gemini 3.5 Flash Lite concluiu chamadas reais. A rota de chat, chamada no ambiente de build da Vercel com a base real, concluiu em 2.440 ms no modo rápido (primeiro texto 1.311 ms) e 8.086 ms no aprofundado (primeiro texto 5.391 ms), com evento final e fontes. Isso não valida a interação no navegador nem representa percentis de produção.
- Prazos independentes: 30/60 segundos por tentativa; repetição única limitada a falhas rápidas 5xx sem texto. Logs técnicos sem conteúdo.
- Respostas parciais são limpas quando há falha. Cabeçalho exibe o modelo configurado.
- TypeScript e 28 testes automatizados aprovados. Avaliações reais anteriores concluíram os seis pedidos, mas duas execuções tiveram 5/6 verificações comportamentais aprovadas; o build bloqueou essas publicações. Instruções unificadas e reforçadas para decisões sobre IA e PRDs com contexto escasso; avaliação final em andamento.
- Diagnóstico detalhado: DIAGNOSTICO-GEMINI.md.

### Resultado da revalidação final

- Os cinco casos completos passaram; o caso simple_reversible_decision falhou por encerramento incompleto e, revalidado isoladamente, passou em 1.871 ms. Não houve uma execução única com os seis casos aprovados juntos; ainda existe intermitência do provedor.
- Modelo padrão gemini-3.5-flash-lite publicado com sucesso. A configuração da API Key foi preservada; não há GEMINI_MODEL sobrepondo o padrão na Vercel.
- A mensagem da interface exibe o modelo configurado; diagnóstico registra status HTTP em vez de nome minificado da classe.
- Build normal restaurado para npm run build, sem avaliações reais a cada deploy.
