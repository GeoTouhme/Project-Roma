const test = require('node:test');
const assert = require('node:assert/strict');
const { pageHarness } = require('./page-harness.cjs');
for (const [page, apiName, getMethod, updateMethod, label] of [
  ['MainCategoryForm', 'categoriesAPI', 'getCategoryBySlug', 'updateCategory', 'Save Category'],
  ['SubCategoryForm', 'subCategoriesAPI', 'getSubCategoryBySlug', 'updateSubCategory', 'Save Sub Category'],
]) test(`${page} edits preserve SEO fields and cover metadata`, async () => {
  let saved;
  const cover = { _id: 'fixture-cover', url: '/api/images/fixture.jpg', blurDataURL: 'fixture-blur', fallbackUrl: '/api/images/fixture-original.jpg' };
  const data = { name: 'Wine', status: 'Active', parentCategory: 'a'.repeat(24), cover, description: 'Custom description', metaTitle: 'Custom title', metaDescription: 'Custom meta' };
  const h = pageHarness(`src/pages/${page}.tsx`, {
    'react-router-dom': { useParams: () => ({ id: 'wine' }), useNavigate: () => () => {} },
    '@/lib/api': {
      categoriesAPI: { getAllCategories: async () => ({ data: { success: true, data: [] } }), ...(apiName === 'categoriesAPI' ? { [getMethod]: async () => ({ data: { success: true, data } }), [updateMethod]: async (id, payload) => { saved = payload; } } : {}) },
      subCategoriesAPI: { [getMethod]: async () => ({ data: { success: true, data } }), [updateMethod]: async (id, payload) => { saved = payload; } },
    },
  });
  await h.settle();
  const save = h.nodes(n => n.type === 'Button' && n.children.some(c => typeof c === 'string' && c.includes(label)))[0];
  assert.ok(save); await save.props.onClick();
  assert.ok(saved);
  assert.equal(saved.metaTitle, undefined);
  assert.equal(saved.description, undefined);
  assert.equal(saved.metaDescription, undefined);
  assert.equal(saved.cover._id, cover._id);
  assert.equal(saved.cover.fallbackUrl, cover.fallbackUrl);
});
