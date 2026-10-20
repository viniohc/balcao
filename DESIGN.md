# Direção visual da demonstração — Balcão

## Escopo e marca

Somente a demonstração da cópia festa-camarao-melhorado. Balcão é nome próprio em português e inglês. Interface em português.

- Português: “Vendas e comandas para feiras e eventos.”
- English: “Point of sale and order pickup for local fairs.”

A descrição em inglês permanece na documentação do portfólio. Um aviso estático por tela informa sobre dados fictícios e armazenamento local; o login explica o acesso simulado. Confirmações de operações permanecem junto das ações.

## Referência e decisão

Referência somente para leitura: C:/Users/vinicius/dev/prototipos/docs/estudos/vinculoo/README.md. O estudo aponta para o Elo em src/projects/vinculoo-estudo, com 21 rotas.

Foram comparados no navegador a página inicial, a Biblioteca e Escolas Privadas. A Biblioteca foi a referência principal: busca junto dos filtros, catálogo de objetos selecionáveis, superfícies claras e contornos suaves. Os formulários das soluções e a composição dividida orientaram o cadastro e o login. O cabeçalho horizontal foi adaptado para as cinco tarefas da feira, com navegação inferior no celular.

A home apresenta conteúdo de divulgação, ilustrações e cenas por rolagem. A demo operacional usa os padrões de catálogo e formulário para manter produtos, valores e ações de retirada próximos. Não foram copiados dados, textos, regras, componentes React, animações ou funcionalidades educacionais. A única cópia de asset é a Albert Sans aberta, acompanhada de sua licença.

## Contrato visual

- Fundo --ground #f5f9f9; superfície --surface #ffffff; áreas agrupadas --raised #eef5f5; seleção suave --active #e0eff0.
- Texto --ink #1e2b2d; auxiliar --muted #53666a; bordas --border #dce7e8; controles --control #9aafb2.
- Petróleo --accent #007e89 e hover #006570 para marca, seleção e ações secundárias. Amarelo --action #f5c518 e hover #e4b50a para concluir ou salvar, com texto escuro. As duas cores vêm da referência fornecida.
- Sucesso #236044 sobre #eaf4ed; erro #9b3535 sobre #fbeeee, sempre acompanhado de texto.
- Albert Sans variável, local em src/demo/assets/albert-sans.ttf; licença SIL OFL 1.1 no mesmo diretório e emitida em dist-demo/assets/albert-sans-OFL.txt. Nenhuma fonte de rede.
- Corpo 15 px; dados 14–16 px; auxiliares 12–13 px; títulos operacionais 26–30 px; número de comanda e total 26–30 px. Login usa título 36–52 px como apresentação. Algarismos tabulares em quantidades e valores.
- Base de 4 px; grupos com 8–12 px; controles e campos separados por 16–20 px; painéis separados por 24 px. Painéis 16 px de raio, campos e botões 10 px; filtros em cápsula conforme a referência. Sem sombras ou gradientes.
- Conteúdo limitado a 1180 px: em 1440 px, margens de 130 px. Venda: catálogo de 804 px + intervalo de 24 px + pedido de 352 px. Painéis preservam a altura natural do seu conteúdo.
- Tablet: navegação horizontal em segunda linha, catálogo e pedido lado a lado. Celular: margem de 20 px, conteúdo empilhado, navegação inferior e atalho ao pedido quando há itens. Cabeçalho da feira e formulário mantêm a mesma largura do conteúdo.
- Rótulos permanentes, áreas de toque de pelo menos 44 px, foco de 2 px com distância de 3 px, estados vazios e de erro. Movimento limitado a feedback de 140 ms; respeitar prefers-reduced-motion.

## Organização por tarefa

Venda responde qual pedido registrar: busca, categoria, produtos e recibo com pagamento. Comandas priorizam número, preparo, chamada e retirada. Histórico mantém identidade, data, pagamento, situação, total e cancelamento; no celular os campos viram lista sem desaparecer. Produtos reúne catálogo e editor. Minha feira separa configuração do nome, criação de feira e administração com confirmações. Login usa apresentação à esquerda e acesso fictício à direita, empilhados no celular.

## Contrato técnico

Manter Vue 3, TypeScript e Dexie, todas as funções e dados fictícios existentes. Não mudar festa-camarao-portfolio-demo, chaves locais, IDs, schemas, versão ou seed. Nenhuma restauração automática. Não importar estilos ou runtime do app normal, Firebase, APIs, fontes externas, service worker ou dados reais. Não abrir .env*. A Vercel continua com build:demo e dist-demo. O build normal é independente.

## Validação desta adaptação

15 testes locais aprovados; tipos e build da demo aprovados. Navegador Chromium isolado em 390, 768 e 1440 px: 212 verificações dos fluxos, marca, fonte local, armazenamento e rede. Incluem login inválido, login e saída, busca e categoria, quantidade e total, comanda, chamada e retirada, cancelamento com confirmação, produto criado/editado/excluído, configuração, criação/renomeação/exclusão de feira, isolamento entre feiras e persistência após recarregar. Restauração foi apenas recusada; não houve reset automático nem acesso aos dados do navegador pessoal.

As 18 telas principais foram capturadas e revistas. Sem rolagem horizontal, exceções JavaScript ou tentativas externas. A inspeção com as bibliotecas probe/rules da design-taste-frontend teve zero FAIL nas telas operacionais. Avisos: alturas distintas entre catálogo e pedido/editor e espaço livre após listas curtas. Mantidos: são painéis com tarefas e quantidades diferentes, sem esticar listas ou inventar conteúdo. O scanner avoid-ai-design mantém K7 no App.vue por não resolver o CSS externo; foco por teclado confirmado nas três larguras. Lint sem FAIL/WARN.

Evidências e scripts descartáveis em node_modules/.cache/balcao-vinculoo, ignorados pelo Git. Nada dessas evidências entra no artefato publicado. Não houve commit, push ou deploy.
