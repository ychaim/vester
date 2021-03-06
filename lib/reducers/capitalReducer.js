import { Map, List, fromJS } from 'immutable'
import { add, subtract, chain, number as n, bignumber as b, sign } from 'mathjs'

import {
  INITIALIZED,
  ORDER_PLACED,
  ORDER_FILLED,
  ORDER_CANCELLED,
  BAR_RECEIVED
} from '../constants'

const initialState = Map({
  cash: 0,
  commission: 0,
  reservedCash: 0,
  history: List()
})

export default (state = initialState, action) => {
  switch (action.type) {
  case INITIALIZED: {
    if (action.payload.initialStates.capital) {
      // TODO validate supplied data
      const initial = action.payload.initialStates.capital
      for (const key of initialState.keys()) {
        if (typeof initial[key] !== 'undefined') {
          state = state.mergeIn([key], initial[key])
        }
      }
    }

    const history = state
      .set('timestamp', action.payload.timestamp)
      .delete('history')

    state = state.update('history', list => list.push(history))

    return state
  }
  case ORDER_PLACED: {
    const order = action.payload
    let cash
    let reservedCash

    if (sign(order.quantity) === 1) {
      /* cost = |price * quantity| */
      const cost = chain(b(order.price)).multiply(b(order.quantity)).abs().done()

      /* reservedCash = reservedCash + cost + commission */
      reservedCash = n(chain(b(state.get('reservedCash'))).add(b(cost)).add(b(order.commission)).done())

      /* cash = cash - cost - commission */
      cash = n(chain(b(state.get('cash'))).subtract(b(cost)).subtract(b(order.commission)).done())
    } else {
      /* reservedCash = reservedCash + commission */
      reservedCash = n(chain(b(state.get('reservedCash'))).add(b(order.commission)).done())

      /* cash = cash - commission */
      cash = n(chain(b(state.get('cash'))).subtract(b(order.commission)).done())
    }

    state = state.set('reservedCash', reservedCash)
    state = state.set('cash', cash)

    return state
  }

  case ORDER_FILLED: {
    const order = action.payload
    const direction = sign(order.quantity)

    /* update history */
    const history = state.delete('history').set('timestamp', order.timestamp)
    state = state.update('history', list => list.push(history))

    /* adjust commission for partially filled orders */
    /* adjustedCommission = expectedCommission * quantity / expectedQuantity */
    const adjustedCommission = chain(b(order.expectedCommission))
      .multiply(b(order.quantity))
      .divide(b(order.expectedQuantity))
      .done()

    if (direction === 1) {
      /* order.expectedQuantity not used as we can be partially filled as well. */
      /* cost = quantity * expectedPrice + adjustedCommission */
      const cost = n(chain(b(order.quantity))
        .multiply(b(order.expectedPrice))
        .add(b(adjustedCommission))
        .done())

      /* reservedCash = reservedCash - cost */
      const reservedCash = n(subtract(b(state.get('reservedCash')), cost))

      state = state.set('reservedCash', reservedCash)
    } else {
      /* we might get filled at a higher price than expected, and thus pay higher commission */
      /* extraCommission = max(0, (commission - expectedCommission) * quantity) */
      const extraCommission = chain(order.commission)
        .subtract(order.expectedCommission)
        .multiply(b(order.commission))
        .max(0)
        .done()

      /* receivedCash = |quantity * price| - extraCommission */
      const receivedCash = chain(b(order.quantity))
        .multiply(b(order.price))
        .abs()
        .subtract(extraCommission)
        .done()

      /* cash = cash + receivedCash */
      const cash = n(add(b(state.get('cash')), b(receivedCash)))

      /* reservedCash = reservedCash - adjustedCommission */
      const reservedCash = n(subtract(b(state.get('reservedCash')), adjustedCommission))

      state = state.set('cash', cash)
      state = state.set('reservedCash', reservedCash)
    }

    /* adjust commission */
    state = state.set('commission', n(add(b(state.get('commission')), b(order.commission))))

    return state
  }

  case ORDER_CANCELLED: {
    const cancelledOrder = action.payload

    /* buy-side order */
    if (sign(cancelledOrder.quantity) === 1) {
      /* cost = |price * quantity| */
      const cost = chain(b(cancelledOrder.price)).multiply(b(cancelledOrder.quantity)).abs().done()

      /* reservedCash = reservedCash - cost - commission */
      const reservedCash = n(chain(b(state.get('reservedCash')))
        .subtract(b(cost)).subtract(b(cancelledOrder.commission)).done())

      /* cash = cash + cost + commission */
      const cash = n(chain(b(state.get('cash')))
        .add(b(cost)).add(b(cancelledOrder.commission)).done())

      state = state.set('reservedCash', reservedCash)
      state = state.set('cash', cash)
    }
    return state
  }

  case BAR_RECEIVED: {
    const bar = action.payload
    const history = state.delete('history').set('timestamp', bar.timestamp)
    state = state.update('history', list => list.push(history))
    return state
  }

  default: {
    return state
  }
  }
}
