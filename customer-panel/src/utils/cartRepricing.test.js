import ProductService from '../services/productService';
import { refreshCartProducts } from './cartRepricing';
import { sellingPrice } from './salePricing';

jest.mock('../services/productService', () => ({ __esModule: true, default: { allProducts: jest.fn() } }));
const id = '0123456789abcdef01234567';
const otherId = '1123456789abcdef01234567';
const product = { _id: id, price: '20', priceSale: '12', saleEndsAt: '2999-01-01', name: 'Fresh', slug: 'fresh', images: ['fresh.jpg'], available: 4 };
const stale = { id, price: 999, priceSale: 1, salePrice: 1, quantity: 3, pricingStatus: 'ready', verifiedAt: '2999-01-01' };
beforeEach(() => jest.resetAllMocks());

const expectUnavailable = update => expect(update).toMatchObject({ price: null, priceSale: null, salePrice: null, saleEndsAt: null, available: 0, pricingStatus: 'unavailable' });

test.each([
  ['deleted or omitted', []],
  ['unpriced', [{ ...product, price: null, priceSale: null }]],
  ['out of stock', [{ ...product, available: 0 }]],
  ['missing stock', [{ ...product, available: undefined }]],
  ['wrong ID', [{ ...product, _id: otherId }]],
])('%s product remains a line but is unavailable with cleared prices', async (_, products) => {
  ProductService.allProducts.mockResolvedValue({ success: true, data: products });
  const updates = await refreshCartProducts([stale]);
  expect(updates).toHaveLength(1);
  expect(updates[0].id).toBe(id);
  expectUnavailable(updates[0]);
});

test('deduplicates regular IDs into batches of at most 50 while preserving every original line', async () => {
  const ids = Array.from({ length: 51 }, (_, n) => n.toString(16).padStart(24, '0'));
  ProductService.allProducts.mockImplementation(async ({ ids }) => ({ success: true, data: ids.split(',').map(_id => ({ ...product, _id })) }));
  const items = [...ids.map(id => ({ id })), { id: ids[0] }, { id: 'bad' }, { id: otherId, type: 'bundle' }];
  const updates = await refreshCartProducts(items);
  expect(ProductService.allProducts.mock.calls.map(([params]) => params)).toEqual([
    { ids: ids.slice(0, 50).join(','), limit: 50, page: 1 },
    { ids: ids[50], limit: 1, page: 1 },
  ]);
  expect(updates.map(update => update.id)).toEqual(items.map(item => item.id));
  expect(updates.slice(0, 52).every(update => update.pricingStatus === 'ready')).toBe(true);
  updates.slice(52).forEach(expectUnavailable);
});

test.each([[], [{ id: 'bad' }, { id: '' }, {}, { id: 12 }, { id, type: 'bundle' }]].map(items => ({ items })))('does not query when no regular valid IDs exist: $items', async ({ items }) => {
  const updates = await refreshCartProducts(items);
  expect(ProductService.allProducts).not.toHaveBeenCalled();
  expect(updates).toHaveLength(items.length);
  updates.forEach(expectUnavailable);
});

test.each([
  { success: false, data: [product] },
  { data: [product] },
  { success: true, data: {} },
  { success: true, data: [product, null] },
  null,
  new Error('offline'),
])('fails the affected batch closed for invalid responses or network failures: %j', async response => {
  if (response instanceof Error) ProductService.allProducts.mockRejectedValue(response);
  else ProductService.allProducts.mockResolvedValue(response);
  const updates = await refreshCartProducts([stale, { ...stale, id: otherId }]);
  expect(updates.map(update => update.id)).toEqual([id, otherId]);
  updates.forEach(expectUnavailable);
});

test('a failed later batch cannot reuse an unsolicited product from an earlier batch', async () => {
  const ids = Array.from({ length: 51 }, (_, n) => n.toString(16).padStart(24, '0'));
  ProductService.allProducts.mockResolvedValueOnce({ success: true, data: ids.map(_id => ({ ...product, _id })) }).mockRejectedValueOnce(new Error('offline'));
  const updates = await refreshCartProducts(ids.map(id => ({ id })));
  expect(updates.slice(0, 50).every(update => update.pricingStatus === 'ready')).toBe(true);
  expectUnavailable(updates[50]);
});

test.each([
  { ...product, price: null, priceSale: '9' },
  { ...product, price: '20', priceSale: '9', saleEndsAt: '2000-01-01' },
  { ...product, price: '20', priceSale: undefined, saleEndsAt: undefined },
])('validates effective selling price without normalizing raw pricing: %j', async fresh => {
  ProductService.allProducts.mockResolvedValue({ success: true, data: [fresh] });
  const [update] = await refreshCartProducts([stale]);
  expect(update.pricingStatus).toBe('ready');
  expect(update.price).toBe(fresh.price ?? null);
  expect(update.priceSale).toBe(fresh.priceSale ?? null);
  expect(update.salePrice).toBe(fresh.priceSale ?? null);
  expect(update.saleEndsAt).toBe(fresh.saleEndsAt ?? null);
  expect(sellingPrice(update)).toBe(sellingPrice(fresh));
});

test('keeps unavailable line identity for removal while never preserving its saved prices', async () => {
  ProductService.allProducts.mockResolvedValue({ success: true, data: [] });
  const item = { ...stale, name: 'Saved product', slug: 'saved-product', image: 'saved.jpg' };
  const [update] = await refreshCartProducts([item]);
  expect(update).toMatchObject({ id, name: item.name, slug: item.slug, image: item.image });
  expectUnavailable(update);
});

test('replaces stale persisted pricing using raw public product fields', async () => {
  ProductService.allProducts.mockResolvedValue({ success: true, data: [product] });
  const items = [stale];
  expect(await refreshCartProducts(items)).toEqual([{ id, price: '20', priceSale: '12', salePrice: '12', saleEndsAt: '2999-01-01', name: 'Fresh', slug: 'fresh', image: 'fresh.jpg', available: 4, pricingStatus: 'ready' }]);
  expect(ProductService.allProducts).toHaveBeenCalledWith({ ids: id, limit: 1, page: 1 });
  expect(items).toEqual([stale]);
});
