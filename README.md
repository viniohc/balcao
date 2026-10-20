# Balcão

Vendas e comandas para feiras e eventos.

## Apresentação para o portfólio

| Idioma | Nome | Descrição |
| --- | --- | --- |
| Português | Balcão | Vendas e comandas para feiras e eventos. |
| English | Balcão | Point of sale and order pickup for local fairs. |

Balcão é um nome próprio e permanece igual nos dois idiomas. A interface da demonstração está em português.

## Demonstração local

A demo permite experimentar vendas no balcão, comandas, chamada e retirada de pedidos, histórico com cancelamento, cadastro de produtos e configurações de feiras. Todos os dados de exemplo são inventados.

O acesso é simulado: as credenciais fictícias aparecem na tela de login e podem ser preenchidas pelo botão **Preencher campos**. Elas não protegem contas reais. Nenhum pagamento é processado.

As operações da demo usam somente o navegador, sem Firebase, backend ou APIs externas. O botão **Restaurar dados** pede confirmação e repõe os exemplos somente no armazenamento exclusivo da demo daquele navegador.

## Desenvolvimento e validação

Com as dependências do lockfile instaladas, inicie exclusivamente a demo:

```bash
npm run dev:demo
```

Para executar a suíte local e gerar o artefato da demo:

```bash
npm run test
npm run build:demo
```

O build inclui a verificação de tipos. A configuração específica da demo não carrega arquivos de ambiente locais nem copia a pasta pública do app normal. Não é necessário configurar Firebase para desenvolver ou compilar a demonstração.

## Publicação da demonstração

A entrada é `demo.html`, que carrega `src/demo/main.ts`. A interface usa Vue 3 e TypeScript; os dados locais usam Dexie/IndexedDB.

A configuração `vercel.json` executa `npm run build:demo` e serve exclusivamente `dist-demo`. As rotas `/` e `/login` apontam para o HTML da demo. Essa saída contém apenas a entrada e os assets da demonstração; não inclui o app normal, suas configurações Firebase ou seu service worker.

A pasta `dist-demo` é gerada e ignorada pelo Git. Este documento descreve a preparação local; não confirma um deploy publicado.

## Compatibilidade dos dados locais

A marca visível é Balcão. Os identificadores técnicos permanecem iguais para que a mudança de nome não afete os dados já salvos:

- IndexedDB: `festa-camarao-portfolio-demo`.
- Sessão local: `festa-camarao-portfolio-demo:session`.
- Feira selecionada: `festa-camarao-portfolio-demo:selectedFairId`.

O nome do banco, as chaves locais, os IDs dos exemplos e os schemas não devem ser renomeados como parte de uma alteração de marca. A demo não lê, migra ou limpa o armazenamento de outros modos do sistema.

## Código do app normal

O repositório também mantém o código do app normal e seus comandos `dev`, `build` e `preview`. Esse modo tem configuração e integração Firebase próprias. A publicação da Vercel seleciona a entrada e o build exclusivos da demo.

A direção visual e as regras de uso da marca estão em [DESIGN.md](DESIGN.md).

## Referência visual da demonstração

A interface adapta os padrões de catálogo e formulários do protótipo local Elo, documentado no estudo Vínculoo: navegação horizontal, busca com filtros, tipografia Albert Sans, petróleo e amarelo. O layout se ajusta à operação de vendas e retiradas. A implementação mantém Vue e seus dados locais; não inclui conteúdo ou funcionalidades educacionais.

A Albert Sans é servida localmente, sob [SIL Open Font License 1.1](src/demo/assets/albert-sans-OFL.txt). A licença também acompanha a fonte no artefato da demo, em assets/albert-sans-OFL.txt.
