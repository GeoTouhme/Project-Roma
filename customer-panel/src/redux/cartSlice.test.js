import reducer, { applyPriceRefresh, removeFromCart, updateQuantity } from './cartSlice';

const id = '0123456789abcdef01234567';
const otherId = '1123456789abcdef01234567';
const line = { id, quantity: 2, price: 999, salePrice: 1, type: 'product', custom: { keep: true } };
const update = { id, price: 20, priceSale: 12, salePrice: 12, saleEndsAt: null, name: 'Fresh', slug: 'fresh', image: 'fresh.jpg', available: 5, pricingStatus: 'ready' };
beforeEach(() => localStorage.clear());

test('refreshes every still-existing duplicate ID without merging unrelated IDs', () => {
  const state = { cartItems: [line, { ...line, quantity: 4 }, { ...line, id: otherId }] };
  const next = reducer(state, applyPriceRefresh([update, { ...update, id: 123 }]));
  expect(next.cartItems).toEqual([{ ...line, ...update }, { ...line, ...update, quantity: 4 }, { ...line, id: otherId }]);
});

test('does not resurrect a removed line when its in-flight refresh finishes', () => {
  const removed = reducer({ cartItems: [line, { ...line, id: otherId }] }, removeFromCart(id));
  const next = reducer(removed, applyPriceRefresh([update]));
  expect(next.cartItems).toEqual([{ ...line, id: otherId }]);
  expect(JSON.parse(localStorage.getItem('cartItems'))).toEqual(next.cartItems);
});

test('preserves quantities changed while the refresh was in flight', () => {
  const changed = reducer({ cartItems: [line] }, updateQuantity({ id, quantity: 7 }));
  const next = reducer(changed, applyPriceRefresh([update]));
  expect(next.cartItems).toEqual([{ ...line, ...update, quantity: 7 }]);
});

test('restores persisted cart lines and allows unavailable refresh to clear stale display prices', () => {
  localStorage.setItem('cartItems', JSON.stringify([{ ...line, pricingStatus: 'ready', verifiedAt: '2999-01-01' }]));
  jest.isolateModules(() => {
    const restoredSlice = require('./cartSlice');
    const restored = restoredSlice.default(undefined, { type: 'init' });
    expect(restored.cartItems[0].quantity).toBe(2);
    const unavailable = { id, price: null, priceSale: null, salePrice: null, saleEndsAt: null, available: 0, pricingStatus: 'unavailable' };
    const next = restoredSlice.default(restored, restoredSlice.applyPriceRefresh([unavailable]));
    expect(next.cartItems[0]).toEqual({ ...restored.cartItems[0], ...unavailable });
    expect(JSON.parse(localStorage.getItem('cartItems'))).toEqual(next.cartItems);
  });
});

test('refresh merges only allowed fields and persists without replacing quantity, ID or unrelated data', () => {
  const state = { cartItems: [line], unrelated: 'keep' };
  const next = reducer(state, applyPriceRefresh([{ ...update, quantity: 99, type: 'bundle', custom: 'overwrite', verifiedAt: 'future' }]));
  expect(next).toEqual({ cartItems: [{ ...line, ...update }], unrelated: 'keep' });
  expect(state.cartItems[0]).toEqual(line);
  expect(JSON.parse(localStorage.getItem('cartItems'))).toEqual(next.cartItems);
});
