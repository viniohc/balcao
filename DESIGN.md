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

Manter Vue 3, TypeScript e Dexie, todas as funções e dados fictícios existentes. Não mudar festa-camarao-portfolio-demo, chaves locais, IDs legados, schemas ou versão. Os três produtos e as duas vendas originais continuam com os mesmos IDs. Novos exemplos usam IDs próprios e um marcador na tabela meta existente. Nenhuma restauração automática. Não importar estilos ou runtime do app normal, Firebase, APIs, fontes externas, service worker ou dados reais. Não abrir .env*. A Vercel continua com build:demo e dist-demo. O build normal é independente.

## Conteúdo ampliado e seletores personalizados

A base completa para um navegador novo tem quatro feiras, 60 produtos e 96 vendas/comandas. Feira da Praça: 24 produtos e 36 registros; Festival do Jardim: 16 e 24; Sabores da Vila: 12 e 24; Feira Criativa do Coreto: 8 e 12. Preços, pagamentos, cancelamentos, observações e estados de comanda são fictícios. Quantidades e totais são calculados a partir dos itens.

sampleData.ts contém 57 produtos, 94 registros e duas feiras adicionais. Na primeira abertura da versão, a transação acrescenta apenas registros novos em feiras que existem. O marcador examples-october-2026 evita repetir a inclusão. Feiras antigas removidas não são recriadas; configurações e produtos editados são preservados. Uma exclusão posterior do visitante permanece excluída após recarregar. Nenhuma chave de armazenamento ou schema foi alterado. Restaurar dados continua sendo uma ação manual com confirmação.

A venda mostra valor confirmado, pedidos confirmados, itens vendidos e comandas a retirar. O histórico detalha valores confirmados por pagamento e quantidade de cancelamentos. Esses números refletem os registros atuais da feira ativa.

DemoSelect é o controle compartilhado para todos os dropdowns deste layout: Feira ativa, em todas as páginas, e Categoria do produto. Não restam selects nativos na demo. O controle usa combobox/listbox, marca a opção selecionada e oferece setas, Home/End, busca pelo início do texto, Enter/Espaço, Escape, Tab, clique fora e estado desabilitado. Foco permanece no gatilho durante a navegação. O menu é uma camada branca com seleção petróleo, contorno e sombra de sobreposição; a sombra é reservada a esse menu flutuante. Posicionamento acompanha os limites do viewport e pode abrir acima; o menu fecha quando o conteúdo externo é rolado ou a janela é redimensionada.

O app normal dentro da cópia e o projeto original continuam fora deste escopo.

## Validação da ampliação

21 testes aprovados, incluindo preservação de dados, idempotência, integridade de totais e comportamento do componente. Tipos e build da demo aprovados. 157 verificações em Chromium isolado em 390, 768 e 1440 px, com mouse, teclado e toque sintetizado no viewport móvel. Incluem menus abertos, opções, busca, troca entre as quatro feiras, cadastro com categoria, venda, chamada e retirada, cancelamento, exclusão, recarga e persistência. Sem rolagem horizontal, exceções JavaScript ou tentativas externas. Não substitui uma verificação em aparelho físico ou Safari.

Evidências descartáveis em node_modules/.cache/balcao-expanded, ignoradas pelo Git e excluídas do envio à Vercel. Os avisos K7 dos scanners decorrem de CSS externo; foco de teclado foi exercitado no navegador. A sombra sinalizada pelo lint pertence ao listbox flutuante.

Publicação prevista no projeto Vercel balcao-ohc, mantendo build:demo, dist-demo e o repositório viniohc/balcao. Arquivos de ambiente continuam excluídos tanto do Git quanto do envio à Vercel.
