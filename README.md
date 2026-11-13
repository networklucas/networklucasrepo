# Bússola de Produto

Espaço pessoal de decisões com projetos por objetivo, contexto compartilhado entre conversas, trilhas adaptativas e repertório com PDFs completos. Next.js / TypeScript. Uso privado, protegido pela Vercel.

Versão atual: **1.4.1**. A biblioteca contém seis livros e 2.266 páginas de origem, incluindo **Transformação Digital e Cultura de Produto**, de Joaquim Torres. O rodapé apresenta a versão, a data e a nota da atualização. Consulte `CHANGELOG.md` para o registro das versões.

## Executar

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Configure GEMINI_API_KEY em .env.local para desenvolvimento. Nunca publique esse arquivo. A chave de produção deve ser criada diretamente nas variáveis de ambiente da Vercel para Production e Preview. Sem chave, guia e biblioteca funcionam e o chat informa que a conexão está pendente.

## Biblioteca

A skill original está em ../.agents/skills/pm-especialista e os PDFs em ../Livros. Para reconstruir, use Python 3.12 com pypdf:

```powershell
python scripts/index_books.py
npm test
npm run build
```

O comando cria private-data/corpus.json e extraction-report.json. O diretório é ignorado pelo Git e incluído somente nas funções de servidor durante o deploy. Não coloque esses arquivos em public. A numeração das fontes corresponde à página do PDF. Páginas sem texto utilizável são registradas no relatório; OCR não é executado. Capas da interface são composições tipográficas próprias, não reproduções das capas editoriais.

Para reindexar apenas um livro cadastrado sem extrair novamente os demais PDFs, use `python scripts/index_books.py --book-id transformacao-digital`. Isso exige uma base anterior com os outros livros. A revisão da base é um hash de seu conteúdo; marcas de personalização do e-book são removidas antes da indexação. A implantação envia apenas a base compactada ao servidor, sem expor os livros em páginas públicas.

O build da Vercel executa `npm run check:release`: uma única consulta à rota real confirma que a fonte recém-incluída é citada com página válida, seguida da compilação. Esse teste usa o Gemini configurado e não grava perguntas, respostas ou chaves. Para esta atualização, não é necessário repetir a suíte ampliada de avaliações.

## Ativar Sol posteriormente

1. Confirme acesso oficial ao modelo gpt-6.1-sol na API OpenAI e o saldo/créditos da organização.
2. Configure OPENAI_API_KEY, OPENAI_ENABLED=true e OPENAI_DAILY_BUDGET_USD com o teto diário desejado.
3. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN em uma instância Redis própria. Não contratamos serviços pagos automaticamente.
4. Republique e confirme o indicador do provedor e /api/provider-status.

A API não usa automaticamente o limite desta conversa do Codex. O orçamento é do aplicativo, não do saldo total OpenAI. Aos 90%, ou quando não houver espaço para reservar a próxima resposta, novas chamadas usam Gemini. O contador usa America/Sao_Paulo e Redis com operações atômicas. Reserva baseada no máximo de saída, bytes de entrada e preços Standard do modelo; requisições de resultado incerto mantêm a reserva. Requisições concorrentes não podem ultrapassar o limiar reservado. Crédito promocional versus pago é decidido pela conta OpenAI. Não há compra ou recarga automática.

Mudanças de preço exigem revisar src/lib/budget.ts. A API OpenAI somente é habilitada com orçamento positivo e Redis configurado. Falha no Redis desabilita Sol. Estimativas não substituem o faturamento do provedor.

## Privacidade e proteção

- Proteção Vercel Authentication, All Deployments; conferir produção, preview e APIs. Não criar links de bypass.
- Acesso conforme permissões da equipe/projeto Vercel.
- Projetos, sessões e decisões são salvos em IndexedDB somente neste navegador. Chat avulso e anexos são temporários; o texto extraído de um anexo só é persistido mediante escolha explícita. Preferências de tema e tamanho continuam em localStorage, na chave `bussola:appearance:v1`.
- PDFs anexados: extração local, até 10 MB / 100 páginas / 100 mil caracteres. Sem OCR. Arquivo original não é enviado.
- store=false em ambos os provedores; sem busca web. Isso não elimina retenção legal/operacional ou tratamento de dados previsto nos contratos dos provedores.
- Gemini gratuito pode usar conteúdo para melhoria dos produtos. Não envie dados confidenciais, pessoais ou materiais sem autorização para esse tratamento.
- Sessões marcadas como confidenciais nunca são encaminhadas ao Gemini. Se Sol estiver indisponível, são bloqueadas.
- Nunca registrar prompts, respostas, anexos ou chaves em logs.
- Exposição local de desenvolvimento é em 127.0.0.1.
- Respostas de IA podem estar erradas; confira citações e evidências.

## Validação

```powershell
npm run typecheck
npm test
npm run build
```

Os testes verificam recuperação, limites de documentos, regras de fallback, confidencialidade e cálculo do orçamento. Eles não substituem avaliações comportamentais com os modelos ativos nem testes de integração com um Redis real.

## Autoria e licenças

A curadoria da skill PM Especialista é do Product Guru’s. Os originais, suas referências e termos são preservados em private-data/skill. A licença PolyForm Internal Use 1.0.0 permite uso pessoal/interno; não distribua o pacote nem disponibilize o serviço a terceiros sem as permissões aplicáveis. Os livros são fontes privadas fornecidas pelo usuário. Os PDFs completos podem ser lidos somente nas rotas privadas do aplicativo, sob a proteção de acesso existente. Os nomes dos autores e métodos são atribuídos aos respectivos titulares.


## Configuração Gemini

GEMINI_API_KEY contém somente a chave copiada do Google AI Studio, sem código Python, aspas ou quebras de linha. Configure Production e, opcionalmente, Preview. Alterar variáveis na Vercel exige um novo deploy para aplicar os valores. O aplicativo valida o formato sem revelar o valor. Os testes reais só podem ser concluídos após a credencial válida estar configurada.

## Recuperação de falhas do Gemini

O modelo padrão foi ajustado para gemini-3.5-flash-lite após reproduzir HTTP 503 no 3.8 Flash. GEMINI_MODEL permite configurar outro modelo, mas confirme sua compatibilidade e disponibilidade antes. Não alteramos o plano de faturamento.

O aplicativo distingue HTTP 429, HTTP 5xx, timeout e transmissão incompleta. Uma falha rápida de servidor pode ser repetida uma vez, antes de qualquer texto; nunca repete automaticamente uma resposta parcial ou um erro de cota. Prazos por tentativa: 30 segundos no modo rápido, 60 no aprofundado; limite global de 90 segundos. Logs incluem apenas categoria, status e duração.

## Leitura e respostas fundamentadas

Tema Claro/Escuro/Sistema (padrão Escuro para novas instalações) e texto Padrão/Ampliado são ajustáveis no cabeçalho. Corpo de 16/18 px, textos auxiliares a partir de 14 px e cores semânticas com contraste AA. Modais e navegação móvel oferecem foco gerenciado e fechamento por Escape.

O chat utiliza exclusivamente os conceitos, suas referências completas, os trechos dos livros e as fichas editoriais disponíveis. A pergunta atual orienta a busca; continuações explícitas usam a pergunta anterior, e perguntas distintas recebem recuperação por assunto. Histórico contém apenas pares de turnos concluídos, com IDs de fontes anteriores removidos. Nova tentativa reutiliza a pergunta, modo, anexo e confidencialidade originais, sem duplicar mensagens.

Respostas permanecem ocultas durante geração e validação semântica. O verificador recebe a pergunta, histórico, resposta candidata e trechos recuperados, e verifica sustentação e cobertura das perguntas. Há no máximo uma revisão e uma segunda verificação; ausência de evidência ou validação malsucedida produz uma mensagem de limitação. Apenas referências usadas são retornadas. Essa verificação é um controle probabilístico, não garantia de ausência de erros.

Geração, verificação e revisão compartilham o prazo global de 90 segundos. Cada chamada ao Sol passa por reserva de orçamento; confidencialidade continua bloqueando o Gemini em todas as etapas. A saída máxima do modo rápido é 4.096 tokens, incluindo raciocínio, com resposta visível orientada a aproximadamente 400 palavras. O modo aprofundado mantém 8.192 tokens. Logs registram fase, categoria, status, duração e quantidade de fontes, sem conteúdo.

Para repetir a validação de navegador, inicie o app e execute `node scripts/verify-improvements.cjs`, com Playwright disponível. O argumento opcional é o caminho do pacote Playwright; `TEST_BASE_URL` define a URL local (padrão `http://127.0.0.1:3100`) e `TEST_BROWSER_CHANNEL` define o canal (padrão `msedge`). Resultados e capturas ficam em `artifacts/improvements`. As respostas do chat nesse teste são fixtures explícitas de transporte; não são avaliações do modelo.

`npm run eval:live` avalia geração e sustentação com o Gemini configurado, consumindo cota e enviando perguntas, histórico e trechos privados ao provedor. Inclui mudança de assunto, duas perguntas e continuação curta. Sem chave válida, termina com status de falha e informa que a avaliação foi pulada. Não execute sem autorização para enviar esse conteúdo. O resultado não substitui revisão humana de fidelidade às fontes.

Os casos de conversa usam respostas reais dos turnos anteriores, mantidas apenas em memória, e são interrompidos quando um turno necessário falha. A avaliação cobre os modos rápido/aprofundado, conceitos isolados, livros isolados, combinação das bases e verificador com afirmação sustentada, afirmação sem suporte e citação inexistente. Os scripts carregam `.env.local` por meio de `@next/env`; os valores não são impressos. `EVAL_CASE_ID=subject_change` ou `short_followup` também executa os turnos anteriores necessários. Um identificador desconhecido falha explicitamente.

Para a validação usual, execute `npm run eval:smoke`. O teste exercita a rota completa em quatro pedidos reais na mesma conversa: duas perguntas no modo rápido, mudança de tema com combinação de conceitos e livros, duas perguntas no modo aprofundado e continuação curta. Acrescenta apenas duas chamadas dirigidas ao verificador: uma afirmação sustentada e outra sem suporte com ID válido. Confere evento final, correspondência entre citações e fontes e ausência de texto publicado antes da validação. Os 45 testes locais cobrem os demais casos determinísticos, sem consumir a API. A suíte `eval:live` é ampliada e opcional; não é executada junto do smoke no preview. Nenhum histórico, resposta ou credencial é gravado no relatório.

As avaliações espaçam chamadas para respeitar o limite observado de 15 requisições/minuto do projeto gratuito. Esse espaçamento pertence aos scripts de teste e não adiciona espera ao chat do aplicativo.

Os scripts scripts/diagnose-gemini.mjs, scripts/evaluate-live.ts e scripts/check-chat-route.ts fazem chamadas reais e consomem a cota configurada quando executados. Execute-os manualmente para diagnóstico; não são necessários no build normal. Não imprimem prompts, respostas ou credenciais. Consulte DIAGNOSTICO-GEMINI.md para as evidências e os limites da análise.

## Projetos e jornadas — versão 1.3

A página inicial oferece projetos locais e jornadas de priorização, discovery e direção. Cada etapa faz até três perguntas e aceita lacunas explícitas. O contexto pode ser revisado ou excluído antes da consulta à IA. Os controles de confidencialidade continuam ativos; armazenamento local não significa processamento local da IA.

IndexedDB usa o banco bussola-workspace-v1, versão 1. Salvamentos são atômicos e detectam conflito entre abas; em falha, o trabalho permanece em memória e pode ser exportado. Não há sincronização nem backup automático. O backup JSON versionado aceita até 20 MB; identificadores repetidos entram como cópias. Existem limites de 200 projetos, 200 sessões e 200 decisões por projeto. Dados de retomada, primeiro registro e utilidade são apenas sinais locais, sem envio de analytics.

Documentos exigem confirmação explícita para serem marcados como decisão. Qualquer edição volta o documento a rascunho. Exportação Markdown preserva fontes e links; impressão usa apenas o documento selecionado. Novas sessões podem receber uma síntese revisada.

Repertório reúne os conceitos, seis livros e cinco sínteses editoriais autorais com links para os artigos originais. As sínteses são identificadas como curadoria da Bússola e participam da recuperação e da verificação semântica. Os artigos completos não são copiados. Licenças e atribuições das fontes originais foram preservadas.

Para verificar os novos fluxos de navegador, execute node scripts/verify-workspace.cjs CAMINHO_DO_PLAYWRIGHT. TEST_BASE_URL permite apontar para um servidor local. O script usa IndexedDB real, verifica backup, restauração, conflitos entre abas e falta de espaço. O chat usa fixture explícita de transporte; nenhuma chamada de modelo é feita. Evidências ficam em artifacts/workspace-1.3. O script verify-improvements.cjs continua verificando contraste, foco e transporte, com a navegação atualizada.

## Projetos e trilhas — versão 1.4

Projetos são criados com nome e objetivo. Cada projeto tem suas conversas e memória compartilhada, editável em Contexto do projeto. Antes de uma consulta, turnos concluídos ainda não incorporados passam pela síntese. A seleção usa trechos literais, com verificação de origem, limites de frase e separação entre informação relatada e proposta da IA. Isso controla fidelidade textual; não garante que o modelo selecionou tudo que importa. Resultados só são decisões confirmadas após ação do usuário. A memória não usa informações de outros projetos.

A atualização da memória compartilha provedores, orçamento, prazos e bloqueio de dados confidenciais com o chat. Se falhar, o usuário escolhe tentar novamente ou continuar com a memória anterior. Objetivo, memória, histórico recente e resultados/trilhas incluídos no contexto respeitam limites explícitos; o sistema não corta silenciosamente um contexto acima do limite. Informações confidenciais marcadas nas mensagens ou trilhas propagam a exigência de Sol ao contexto do projeto.

O formato de dados é versão 2, no mesmo banco IndexedDB anterior. Dados v1 e backups antigos são migrados sem remover conversas, contextos ou documentos. Questionários antigos tornam-se registros de trilha. Objetivos ausentes precisam ser completados pelo usuário. Exportar projeto cria um arquivo individual com objetivo, conversas, memória, fontes, resultados e trilhas. Importar projeto em outro navegador não exige um backup de todos os projetos. Colisões entram como cópias.

Trilha de resolução de problemas recebe um problema e pode ser vinculada a um projeto. A IA propõe de três a cinco etapas, com até três perguntas por etapa, métodos, dicas e atividades fundamentadas nos conceitos, livros e fichas disponíveis. A estrutura, os conceitos e as referências são verificados antes de exibir o caminho. O usuário pode voltar, editar e pedir um novo caminho com suas respostas. Estados: em andamento, proposta pronta, em validação e resolução confirmada pelo usuário. Uma trilha independente pode virar projeto.

Os seis PDFs são preparados por scripts/prepare-books.cjs em private-data/books e nunca em public. npm run build e npm run dev executam a preparação automaticamente. A rota /api/books/[id]/pdf aceita somente IDs do cadastro, GET/HEAD e Range, e usa Cache-Control privado. A proteção de autenticação permanece a da implantação Vercel; o servidor local só escuta em loopback. Nenhum deploy é realizado por essa atualização.

Verificação de navegador: node scripts/verify-projects-v2.cjs CAMINHO_DO_PLAYWRIGHT, com TEST_BASE_URL apontando para o servidor local. O teste usa IndexedDB e PDFs reais, mas fixtures identificadas nas rotas de IA. A avaliação real, separada, é npm run eval:projects; usa conversas sintéticas e fichas editoriais, sem enviar trechos de livros. Sem credencial, registra not_run e termina com código 1. Relatórios e capturas ficam em artifacts/projects-1.4.

Ao concluir a última etapa da trilha, a proposta é gerada novamente com as respostas coletadas e passa pela validação nas fontes. Revisões preservam as respostas anteriores em histórico; alterações no contexto invalidam a confirmação da proposta até uma nova revisão.

## Histórico local — versão 1.4.1

Histórico reúne conversas de projetos e conversas avulsas salvas em IndexedDB, com busca por título/conteúdo, filtros, agrupamento por data e atalhos recentes na barra lateral. Novas conversas avulsas são salvas automaticamente após o primeiro envio. Retomar uma conversa restaura mensagens, fontes, rascunho, confidencialidade e anexos cujo texto foi explicitamente salvo. Conversas de projeto mantêm seu contexto compartilhado.

O formato v2 aceita o novo campo opcional chats, sem invalidar dados e backups existentes. O backup completo inclui avulsas; importações com identificadores repetidos criam cópias. Conversas avulsas podem ser excluídas pelo histórico. Conversas antigas que eram somente temporárias e não foram salvas não podem ser reconstruídas. O histórico pertence ao navegador e à origem do site, sem sincronização com servidor.

Verificação específica: node scripts/verify-chat-history.cjs CAMINHO_DO_PLAYWRIGHT. O script usa IndexedDB real e respostas de transporte simuladas, sem chamadas a modelos. Evidências em artifacts/history-1.4.1.
