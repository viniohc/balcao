[English](README.md) · [Português brasileiro](README.pt-BR.md)

# Balcão

Vendas e comandas para feiras e eventos.

Balcão é uma aplicação web para quem opera barracas em feiras e eventos. Reúne seleção de produtos, registro de vendas e retirada de pedidos em uma interface, permitindo atender tanto compras com entrega imediata quanto pedidos que precisam de preparo.

A demonstração pública permite experimentar esses fluxos com dados fictícios salvos no navegador. A interface está em português brasileiro; **Balcão** é o nome do projeto nos dois idiomas.

## Acesse a demonstração

**[Abrir o Balcão](https://balcao-ohc.vercel.app/)**

Na tela de login, clique em **Preencher campos** para usar as credenciais fictícias exibidas e depois em **Entrar no Balcão**. O acesso é simulado: nenhuma conta é criada e você não deve informar credenciais reais.

## Vendas com e sem comanda

Os dois fluxos começam pela escolha da feira, busca ou filtro de produtos, inclusão dos itens no pedido, ajuste de quantidades e seleção da forma de pagamento.

| Fluxo | Como funciona na demo |
| --- | --- |
| Venda direta | Deixe **Registrar como comanda** desmarcado e clique em **Concluir venda**. A venda entra no histórico sem passar pela fila de retirada. |
| Pedido com comanda | Marque **Registrar como comanda**, acrescente uma observação se necessário e clique em **Registrar comanda**. O pedido recebe um número e aparece em **Comandas**, onde é possível consultar seus itens e situação, chamar para retirada e marcar como entregue. |

Neste fluxo, a comanda é um pedido numerado para acompanhar a retirada. Pix, dinheiro e cartão são registrados como formas de pagamento; a demo não processa pagamentos.

## Recursos

- **Vendas:** busca de produtos, filtros por categoria, ajuste de quantidades e cálculo do total do pedido.
- **Comandas:** número, observações e situação do pedido, com filtros para pedidos a retirar, concluídos ou todos; ações para chamar e confirmar a retirada.
- **Histórico:** itens, data e hora, forma de pagamento, valor e situação da venda; cancelamento com confirmação e totais por forma de pagamento.
- **Produtos:** cadastro, edição e exclusão de produtos com nome, preço e categoria.
- **Feiras:** troca entre catálogos e registros de vendas separados; criação, renomeação e exclusão de feiras e configuração do nome da barraca.
- **Resumo do movimento:** valor das vendas confirmadas, pedidos confirmados, itens vendidos e comandas a retirar, calculados a partir dos registros da feira ativa.
- **Interface:** layouts responsivos, campos com rótulos e dropdowns personalizados com suporte a mouse, toque e teclado.

## Execute a demo localmente

Use Node.js 24.x e npm, além de Git para clonar o repositório. Essa versão do Node atende aos requisitos das dependências registrados no lockfile.

```bash
git clone https://github.com/viniohc/balcao.git
cd balcao
npm ci
npm run dev:demo
```

Abra o endereço local informado pelo Vite. A demo não exige configuração do Firebase nem arquivo de ambiente; sua configuração do Vite desativa a leitura desses arquivos.

Outros comandos relacionados à demo em [package.json](package.json):

| Comando | Finalidade |
| --- | --- |
| `npm run test` | Executa a suíte local do Vitest. Os testes com emulador do Firestore ficam fora dessa suíte. |
| `npm run build:demo` | Verifica os tipos do projeto e gera a demo em `dist-demo`. |

Os scripts `dev`, `build` e `preview` usam a configuração do outro aplicativo, descrito a seguir.

## Dados de demonstração e armazenamento

Uma base nova da demo contém **4 feiras, 60 produtos e 96 registros de vendas/comandas**. São exemplos fictícios, com diferentes formas de pagamento, cancelamentos e situações de retirada. Esses números não representam estatísticas de uso.

- O **IndexedDB**, acessado pelo Dexie, guarda feiras, produtos, vendas e configurações no banco chamado `festa-camarao-portfolio-demo`.
- O **localStorage** guarda a sessão simulada e a feira selecionada. Sair da demonstração não apaga os registros salvos.
- As alterações salvas permanecem após recarregar a página. O carrinho ainda não concluído fica em memória e não é mantido entre recargas.
- O pacote adicional de exemplos é inserido uma única vez. Edições existentes são preservadas, e as recargas seguintes não recriam exemplos excluídos nem duplicam o pacote.
- **Restaurar dados** pede confirmação e substitui todos os registros da demo daquela origem do navegador pelos exemplos.

O armazenamento pertence a um perfil de navegador e a uma origem. Localhost, outro domínio ou outro dispositivo têm dados separados. Limpar os dados do site remove os registros salvos da demo; não há cópia de segurança em servidor nem sincronização na demonstração.

Os exemplos e a inicialização estão em [sampleData.ts](src/demo/sampleData.ts) e [database.ts](src/demo/database.ts).

## Tecnologias e organização do repositório

A demo usa **Vue 3**, **TypeScript**, **Vite 8**, CSS e **Dexie/IndexedDB**. A configuração de build também carrega o plugin do Tailwind CSS 4 para Vite. Os testes usam **Vitest**, **jsdom** e **fake-indexeddb**.

O repositório contém duas entradas de aplicação:

| Área | Demo publicada | Código do outro aplicativo |
| --- | --- | --- |
| Entrada | `demo.html` → `src/demo/main.ts` | `index.html` → `src/main.ts` |
| Código principal | `src/demo/` | `src/views/`, `src/stores/`, `src/services/` e `src/router/` |
| Dados e acesso | Repositório local da demo e login simulado | Firebase Authentication, integração com Firestore e armazenamento local separado |
| Infraestrutura adicional | Sem runtime do Firebase, API de backend ou service worker | Vue Router, Pinia e configuração de PWA |
| Build | `npm run build:demo` → `dist-demo` | `npm run build` → `dist` |

A demo pública não expõe todos os recursos presentes no outro aplicativo. Seus fluxos e dados ficam em `src/demo`; os tipos são compartilhados a partir de `src/types/models.ts`. O outro aplicativo tem requisitos próprios de configuração do Firebase e não está coberto pelas instruções de execução da demo acima.

[vercel.json](vercel.json) executa `npm run build:demo` e publica somente `dist-demo`. As rotas de início e login servem a entrada da demo. [vite.demo.config.ts](vite.demo.config.ts) não copia a pasta pública do outro aplicativo nem carrega seus arquivos de ambiente. O outro build permanece configurado em [vite.config.ts](vite.config.ts).

As convenções visuais e notas de implementação estão em [DESIGN.md](DESIGN.md).

## Fonte

A Albert Sans é distribuída localmente. Sua [SIL Open Font License 1.1](src/demo/assets/albert-sans-OFL.txt) está no repositório e acompanha o build da demonstração.
