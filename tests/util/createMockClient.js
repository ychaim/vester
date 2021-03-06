export default function createMockClient(fail = false) {
  let orderIdCounter = 0
  return ({ onFill }) => ({
    executeOrder: async (order) => {
      orderIdCounter += 1
      const builtOrder = { ...order, commission: 0, id: orderIdCounter.toString() }
      if (fail) {
        /* simulate network delay */
        await new Promise(r => setTimeout(r, 10))
        throw new Error()
      } else {
        /* simulate market delay */
        setTimeout(() => {
          onFill({
            ...builtOrder,
            expectedPrice: order.price,
            expectedQuantity: order.quantity,
            expectedCommission: order.commission
          })
        }, 200)
      }

      return { ...builtOrder }
    },
    cancelOrder: async ({ id }) => {
      /* simulate network delay */
      await new Promise(r => setTimeout(r, 10))

      if (fail) {
        throw new Error()
      } else {
        return id
      }
    },
    getMarketPrice: async (identifier) => {
      /* simulate network delay */
      await new Promise(r => setTimeout(r, 10))
      return {
        buy: 20,
        sell: 10
      }
    },
    calculateCommission: () => 0
  })
}
