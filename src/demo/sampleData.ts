import type { Fair, Product, ProductCategory, Sale, Settings, CommandStatus, PaymentMethod } from '@/types/models'

export const DEMO_CONTENT_PACK_ID = 'examples-october-2026'
const timestamp = '2026-10-18T15:00:00.000Z'
const plaza = 'demo-feira-praca'
const garden = 'demo-feira-jardim'
const village = 'demo-feira-vila'
const crafts = 'demo-feira-coreto'

export const additionalFairs: Fair[] = [
  { id: village, name: 'Sabores da Vila', ownerId: 'demo-owner', members: {}, active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: crafts, name: 'Feira Criativa do Coreto', ownerId: 'demo-owner', members: {}, active: true, createdAt: timestamp, updatedAt: timestamp },
]
export const additionalSettings: Settings[] = [
  { id: village, fairId: village, storeName: 'Cozinha da Vila', currency: 'BRL' },
  { id: crafts, fairId: crafts, storeName: 'Ateliê do Coreto', currency: 'BRL' },
]
type ProductExample = [slug: string, name: string, price: number, category: ProductCategory]
const catalogues: Array<[string, ProductExample[]]> = [
  [plaza, [
    ['pastel-queijo', 'Pastel de queijo', 10, 'Comidas'],
    ['pastel-carne', 'Pastel de carne', 12, 'Comidas'],
    ['pastel-palmito', 'Pastel de palmito', 12, 'Comidas'],
    ['milho', 'Milho na manteiga', 8, 'Comidas'],
    ['espetinho-legumes', 'Espetinho de legumes', 14, 'Comidas'],
    ['espetinho-frango', 'Espetinho de frango', 16, 'Comidas'],
    ['tapioca-queijo', 'Tapioca de queijo coalho', 15, 'Comidas'],
    ['caldo-verde', 'Caldo verde', 18, 'Comidas'],
    ['pao-queijo', 'Porção de pão de queijo', 12, 'Comidas'],
    ['mandioca', 'Mandioca frita', 20, 'Comidas'],
    ['agua', 'Água mineral', 5, 'Bebidas'],
    ['agua-gas', 'Água com gás', 6, 'Bebidas'],
    ['suco-maracuja', 'Suco de maracujá', 10, 'Bebidas'],
    ['suco-laranja', 'Suco de laranja', 10, 'Bebidas'],
    ['cha-gelado', 'Chá gelado de pêssego', 8, 'Bebidas'],
    ['cafe', 'Café coado', 6, 'Bebidas'],
    ['brigadeiro', 'Brigadeiro de colher', 8, 'Sobremesas'],
    ['pudim', 'Fatia de pudim', 12, 'Sobremesas'],
    ['cocada', 'Cocada cremosa', 7, 'Sobremesas'],
    ['bolo-cenoura', 'Bolo de cenoura com chocolate', 10, 'Sobremesas'],
    ['brownie', 'Brownie de chocolate', 12, 'Sobremesas'],
    ['ecobag', 'Ecobag da feira', 25, 'Outros'],
  ]],
  [garden, [
    ['focaccia', 'Focaccia de alecrim', 16, 'Comidas'],
    ['quiche', 'Quiche de alho-poró', 18, 'Comidas'],
    ['sanduiche', 'Sanduíche de caponata', 20, 'Comidas'],
    ['empada', 'Empada de cogumelos', 12, 'Comidas'],
    ['pao-artesanal', 'Pão de fermentação natural', 24, 'Comidas'],
    ['suco-uva', 'Suco integral de uva', 12, 'Bebidas'],
    ['kombucha', 'Kombucha de hibisco', 16, 'Bebidas'],
    ['cafe-gelado', 'Café gelado', 12, 'Bebidas'],
    ['agua-coco', 'Água de coco', 10, 'Bebidas'],
    ['cookie', 'Cookie de chocolate', 9, 'Sobremesas'],
    ['torta-limao', 'Torta de limão', 14, 'Sobremesas'],
    ['geleia', 'Geleia de frutas vermelhas', 22, 'Outros'],
    ['granola', 'Granola artesanal', 20, 'Outros'],
    ['mel', 'Mel de flores silvestres', 28, 'Outros'],
    ['muda', 'Muda de manjericão', 12, 'Outros'],
  ]],
  [village, [
    ['baiao', 'Baião de dois', 28, 'Comidas'],
    ['arroz', 'Arroz de forno', 24, 'Comidas'],
    ['moqueca', 'Moqueca de banana-da-terra', 32, 'Comidas'],
    ['bolinho', 'Bolinho de mandioca', 18, 'Comidas'],
    ['cuscuz', 'Cuscuz com queijo coalho', 16, 'Comidas'],
    ['acaraje', 'Acarajé de feira', 22, 'Comidas'],
    ['suco-caju', 'Suco de caju', 9, 'Bebidas'],
    ['suco-graviola', 'Suco de graviola', 12, 'Bebidas'],
    ['refresco', 'Refresco de tamarindo', 8, 'Bebidas'],
    ['canjica', 'Canjica cremosa', 10, 'Sobremesas'],
    ['doce-abobora', 'Doce de abóbora com coco', 9, 'Sobremesas'],
    ['rapadura', 'Rapadura artesanal', 8, 'Outros'],
  ]],
  [crafts, [
    ['caneca', 'Caneca de cerâmica', 45, 'Outros'],
    ['vaso', 'Vaso de barro pequeno', 32, 'Outros'],
    ['vela', 'Vela de capim-limão', 28, 'Outros'],
    ['sabonete', 'Sabonete artesanal', 14, 'Outros'],
    ['caderno', 'Caderno de capa artesanal', 35, 'Outros'],
    ['marcador', 'Marcador de livro bordado', 16, 'Outros'],
    ['ecobag-estampada', 'Ecobag estampada', 38, 'Outros'],
    ['porta-copos', 'Conjunto de porta-copos', 26, 'Outros'],
  ]],
]
export const additionalProducts: Product[] = catalogues.flatMap(([fairId, rows]) => rows.map(([slug, name, price, category], index) => ({
  id: fairId + '-example-' + slug, fairId, name, price, category, active: true, sortOrder: index + 3,
  createdAt: timestamp, updatedAt: timestamp,
})))
const stages: CommandStatus[] = ['pendente', 'preparando', 'pronto', 'chamado', 'entregue']
const methods: PaymentMethod[] = ['pix', 'cash', 'card']
const batches: Array<[string, number, string]> = [[plaza, 34, 'P'], [garden, 24, 'J'], [village, 24, 'V'], [crafts, 12, 'A']]
export const additionalSales: Sale[] = batches.flatMap(([fairId, count, prefix], fairIndex) => {
  const products = additionalProducts.filter(p => p.fairId === fairId)
  return Array.from({ length: count }, (_, index): Sale => {
    const id = fairId + '-example-sale-' + String(index + 1).padStart(3, '0')
    const createdAt = new Date(Date.UTC(2026, 9, 16 + Math.floor(index / 12), 16 + Math.floor(index % 12 / 4), (index % 4) * 14)).toISOString()
    const items = Array.from({ length: 1 + index % 3 }, (_, line) => {
      const product = products[(index * 3 + line * 5) % products.length]!
      const quantity = 1 + (index + line) % 3
      return { lineId: id + '-line-' + (line + 1), productId: product.id, productName: product.name, unitPrice: product.price, quantity, total: Math.round(product.price * quantity * 100) / 100 }
    })
    const total = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100
    const isCommand = index % 3 === 0
    const commandStatus = isCommand ? stages[(Math.floor(index / 3) + fairIndex) % stages.length] : undefined
    const cancelled = index % 13 === 12
    return {
      id, fairId, createdAt, dateKey: createdAt.slice(0, 10), items, subtotal: total, total,
      paymentMethod: methods[(index + fairIndex) % methods.length]!, status: cancelled ? 'cancelado' : 'confirmado',
      cancelledAt: cancelled ? createdAt : undefined,
      commandNumber: isCommand ? prefix + '-' + String(index + 20).padStart(3, '0') : undefined,
      commandStatus, commandUpdatedAt: isCommand ? createdAt : undefined,
      commandReturnedAt: commandStatus === 'entregue' ? createdAt : undefined,
      observation: isCommand ? ['Embalagem para viagem.', 'Retirar no balcão principal.', 'Pedido para compartilhar.', 'Retirar todos os itens juntos.'][Math.floor(index / 3) % 4] : undefined,
      amountReceived: methods[(index + fairIndex) % methods.length] === 'cash' ? Math.ceil(total / 10) * 10 : undefined,
      change: methods[(index + fairIndex) % methods.length] === 'cash' ? Math.ceil(total / 10) * 10 - total : undefined,
    }
  })
})
