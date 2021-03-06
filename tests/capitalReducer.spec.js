import test from 'ava'
import { Map, List, is } from 'immutable'

import reducer from '../lib/reducers/capitalReducer'
import {
  INITIALIZED,
  ORDER_PLACED,
  ORDER_FILLED,
  ORDER_CANCELLED,
  BAR_RECEIVED
} from '../lib/constants'

test('return the initial state', (t) => {
  const actual = reducer(undefined, {})
  const expect = Map({
    cash: 0,
    commission: 0,
    reservedCash: 0,
    history: List()
  })
  t.deepEqual(actual.toJS(), expect.toJS())
})

test(`add initial state to history on ${INITIALIZED}`, (t) => {
  const initialState = reducer(undefined, {})
  const action = { type: INITIALIZED, payload: { timestamp: 100, initialStates: {} } }

  const actual = reducer(undefined, action).get('history')
  const expect = List([
    initialState
      .set('timestamp', 100)
      .delete('history')
  ])

  t.true(is(actual, expect))
})

test(`set initial values on ${INITIALIZED}`, (t) => {
  const action = {
    type: INITIALIZED,
    payload: {
      timestamp: 50,
      initialStates: {
        capital: {
          cash: 100,
          reservedCash: 101,
          commission: 102,
          history: ['foobar']
        }
      }
    }
  }

  const actual = reducer(undefined, action)
  const expect = Map({
    cash: 100,
    reservedCash: 101,
    commission: 102,
    history: List([
      'foobar',
      Map({
        cash: 100,
        reservedCash: 101,
        commission: 102,
        timestamp: 50
      })
    ])
  })

  t.true(is(actual, expect))
})

test(`${ORDER_PLACED} of a sell-side order correctly edits reservedCash`, (t) => {
  const order = {
    id: '1',
    identifier: 'MSFT',
    quantity: -50,
    price: 110,
    commission: 5.5
  }
  const action = { type: ORDER_PLACED, payload: order }

  const actual = reducer(undefined, action)
  const expect = Map({
    reservedCash: 5.5,
    cash: -5.5,
    commission: 0,
    history: List()
  })

  t.true(is(actual, expect))
})

test(`${ORDER_PLACED} of a buy-side order correctly edits cash, commission and reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: 100,
    price: 100,
    commission: 10
  }
  const action = { type: ORDER_PLACED, payload: order }

  const actual = reducer(undefined, action)
  const expect = reducer(undefined, {}).merge(Map({
    reservedCash: 10010,
    cash: -10010,
    commission: 0,
    history: List()
  }))

  t.true(is(actual, expect))
})

test(`${ORDER_CANCELLED} of a sell-side order does not modify anything`, (t) => {
  const order = {
    id: '1',
    identifier: 'MSFT',
    quantity: -50,
    price: 110,
    commission: 5.5,
    history: List()
  }
  const action = { type: ORDER_CANCELLED, payload: order }

  const actual = reducer(undefined, action)
  const expect = reducer(undefined, {})

  t.true(is(actual, expect))
})

test(`${ORDER_CANCELLED} of a buy-side order correctly reverts cash and reservedCash, also doesn't commission`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: 100,
    price: 100,
    commission: 10
  }
  const action = { type: ORDER_CANCELLED, payload: order }
  const initialState = Map({
    cash: 0,
    reservedCash: 10010,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = reducer(initialState, {}).merge(Map({
    cash: 10010,
    reservedCash: 0
  }))

  t.true(is(actual, expect))
})

test(`${ORDER_FILLED}, sell-side, should increase cash and commission, and decrease reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: -100,
    price: 100,
    commission: 10,
    expectedQuantity: -100,
    expectedPrice: 100,
    expectedCommission: 10,
    timestamp: 100
  }
  const action = { type: ORDER_FILLED, payload: order }
  const initialState = Map({
    cash: -10,
    reservedCash: 10,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = Map({
    cash: 9990,
    reservedCash: 0,
    commission: 10,
    history: List([Map({
      cash: -10,
      reservedCash: 10,
      commission: 0,
      timestamp: 100
    })])
  })

  t.true(is(actual, expect))
})

test(`${ORDER_FILLED}, buy-side, should increase commission and decrease reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: 100,
    price: 100,
    commission: 10,
    expectedQuantity: 100,
    expectedPrice: 100,
    expectedCommission: 10,
    timestamp: 100
  }
  const action = { type: ORDER_FILLED, payload: order }
  const initialState = Map({
    cash: 0,
    reservedCash: 10010,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = Map({
    cash: 0,
    reservedCash: 0,
    commission: 10,
    history: List([Map({
      cash: 0,
      reservedCash: 10010,
      commission: 0,
      timestamp: 100
    })])
  })

  t.true(is(actual, expect))
})

test(`${ORDER_FILLED}, buy-side, partial fill, should increase commission and decrease reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: 50,
    price: 100,
    commission: 5,
    expectedQuantity: 100,
    expectedPrice: 100,
    expectedCommission: 10,
    timestamp: 100
  }
  const action = { type: ORDER_FILLED, payload: order }
  const initialState = Map({
    cash: 0,
    reservedCash: 10010,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = Map({
    cash: 0,
    reservedCash: 5005,
    commission: 5,
    history: List([Map({
      cash: 0,
      reservedCash: 10010,
      commission: 0,
      timestamp: 100
    })])
  })

  t.true(is(actual, expect))
})

test(`${ORDER_FILLED}, sell-side, partial fill, increase cash and commission, and decrease reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: -50,
    price: 100,
    commission: 5,
    expectedQuantity: -100,
    expectedPrice: 100,
    expectedCommission: 10,
    timestamp: 100
  }
  const action = { type: ORDER_FILLED, payload: order }
  const initialState = Map({
    cash: -10,
    reservedCash: 10,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = Map({
    cash: 4990,
    reservedCash: 5,
    commission: 5,
    history: List([Map({
      cash: -10,
      reservedCash: 10,
      commission: 0,
      timestamp: 100
    })])
  })

  t.true(is(actual, expect))
})

test(`${ORDER_FILLED}, buy-side, better price, should increase commission and decrease reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: 100,
    price: 90,
    commission: 9,
    expectedQuantity: 100,
    expectedPrice: 100,
    expectedCommission: 10,
    timestamp: 100
  }
  const action = { type: ORDER_FILLED, payload: order }
  const initialState = Map({
    cash: 0,
    reservedCash: 10010,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = Map({
    cash: 0,
    reservedCash: 0,
    commission: 9,
    history: List([Map({
      cash: 0,
      reservedCash: 10010,
      commission: 0,
      timestamp: 100
    })])
  })

  t.true(is(actual, expect))
})

test(`${ORDER_FILLED}, sell-side, better price, increase cash and commission, and decrease reservedCash`, (t) => {
  const order = {
    id: '0',
    identifier: 'MSFT',
    quantity: -100,
    price: 110,
    commission: 11,
    expectedQuantity: -100,
    expectedPrice: 100,
    expectedCommission: 10,
    timestamp: 100
  }
  const action = { type: ORDER_FILLED, payload: order }
  const initialState = Map({
    cash: -10,
    reservedCash: 10,
    commission: 0,
    history: List()
  })

  const actual = reducer(initialState, action)
  const expect = Map({
    cash: 10979,
    reservedCash: 0,
    commission: 11,
    history: List([Map({
      cash: -10,
      reservedCash: 10,
      commission: 0,
      timestamp: 100
    })])
  })

  t.true(is(actual, expect))
})

test(`update history on ${BAR_RECEIVED}`, (t) => {
  const action = {
    type: BAR_RECEIVED,
    payload: {
      identifier: 'MSFT',
      open: 110,
      high: 120,
      low: 90,
      close: 100,
      timestamp: 200
    }
  }

  const actual = reducer(undefined, action).get('history')
  const expected = List([
    Map({
      cash: 0,
      reservedCash: 0,
      commission: 0,
      timestamp: 200
    })
  ])

  t.true(is(actual, expected))
})
