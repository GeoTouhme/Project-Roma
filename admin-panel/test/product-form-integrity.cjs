const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');
const image = { url: 'https://res.cloudinary.com/fixture/image/upload/v1/products/one.jpg', _id: 'products/one', blurDataURL: 'fixture-blur', fallbackUrl: '/api/images/original.jpg' };
const product = { name: 'Fine Product', slug: 'fine-product-upc', sku: '0001', code: 'POS-123', category: 'a'.repeat(24), subCategory: 'b'.repeat(24), price: 12, priceSale: 10, available: 3, images: [image] };
function fixture(productData = product) {
  let deletes = 0, saved;
  const h = pageHarness('src/pages/ProductForm.tsx', {
    'react-router-dom': { useParams: () => ({ id: product.slug }), useNavigate: () => () => {} },
    '@/lib/api': {
      productsAPI: { getProductById: async () => ({ data: { success: true, data: productData } }), updateProduct: async (id, payload) => { saved = payload; return { data: { success: true } }; } },
      categoriesAPI: { getAllCategories: async () => ({ data: { success: true, data: [] } }) },
      subCategoriesAPI: { getAllSubCategories: async () => ({ data: { success: true, data: [] } }) },
      uploadAPI: { deleteImage: async () => { deletes++; } },
    },
  });
  return { h, deletes: () => deletes, saved: () => saved };
}
test('removing a saved product image is only a draft edit until Save', async () => {
  const f = fixture(); await f.h.settle();
  const remove = f.h.nodes(n => n.type === 'button' && n.props.className?.includes('bg-red-500'))[0];
  assert.ok(remove);
  await remove.props.onClick();
  assert.equal(f.deletes(), 0, 'unsaved form actions must not physically delete shared images');
});
test('editing preserves existing product slug and complete image metadata', async () => {
  const f = fixture(); await f.h.settle();
  const save = f.h.nodes(n => n.type === 'Button' && n.children.some(c => typeof c === 'string' && c.includes('Save Product')))[0];
  assert.ok(save);
  await save.props.onClick();
  assert.ok(f.saved());
  assert.ok(f.saved().slug === undefined || f.saved().slug === product.slug);
  assert.equal(f.saved().images[0]._id, image._id);
  assert.equal(f.saved().images[0].fallbackUrl, image.fallbackUrl);
});

test('saving a product does not overwrite its POS code with its UPC', async () => {
  const f = fixture(); await f.h.settle();
  const save = f.h.nodes(n => n.type === 'Button' && n.children.some(c => typeof c === 'string' && c.includes('Save Product')))[0];
  await save.props.onClick();
  assert.ok(f.saved().code === undefined || f.saved().code === product.code);
});

test('products without optional subcategories can still be edited', async () => {
  const f = fixture({ ...product, subCategory: null }); await f.h.settle();
  const save = f.h.nodes(n => n.type === 'Button' && n.children.some(c => typeof c === 'string' && c.includes('Save Product')))[0];
  await save.props.onClick();
  assert.ok(f.saved(), 'optional subcategory must not block saving');
});
