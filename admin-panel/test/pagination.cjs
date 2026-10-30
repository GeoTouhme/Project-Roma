const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadAPI(get) {
  const source = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_URL', JSON.stringify('/'));
  const exports = {};
  const axios = { create: () => ({ get, interceptors: { response: { use() {} } } }) };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: name => {
      assert.equal(name, 'axios');
      return axios;
    },
  });
  return exports;
}

for (const [apiName, method, endpoint] of [
  ['categoriesAPI', 'getAllCategories', '/api/admin/categories'],
  ['subCategoriesAPI', 'getAllSubCategories', '/api/admin/subcategories'],
]) {
  test(`${method} collects every page with bounded requests and preserves filters`, async () => {
    const calls = [];
    const items = Array.from({ length: 205 }, (_, _id) => ({ _id }));
    const api = loadAPI(async (url, { params }) => {
      assert.equal(url, endpoint);
      assert.equal(params.limit, 100);
      assert.equal(params.parentCategory, 'parent-id');
      calls.push(params.page);
      return { status: 201, data: {
        success: true,
        // Subcategory pagination metadata is currently null: do not rely on count.
        count: null,
        data: items.slice((params.page - 1) * 100, params.page * 100),
      } };
    });
    const response = await api[apiName][method]({ parentCategory: 'parent-id' });
    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(response.data.data.length, 205);
    assert.equal(response.data.data[204]._id, 204);
    assert.equal(response.status, 201);
  });

  for (const size of [0, 100]) {
    test(`${method} terminates for ${size} items`, async () => {
      let calls = 0;
      const api = loadAPI(async () => ({ data: {
        success: true,
        data: calls++ === 0 ? Array.from({ length: size }, (_, _id) => ({ _id })) : [],
      } }));
      const response = await api[apiName][method]();
      assert.equal(response.data.data.length, size);
      assert.equal(calls, size === 0 ? 1 : 2);
    });
  }

  test(`${method} propagates a later page failure rather than returning a partial list`, async () => {
    const api = loadAPI(async (_, { params }) => {
      if (params.page === 2) throw new Error('Request failed with status code 400');
      return { data: { success: true, data: Array(100).fill({ _id: 'id' }) } };
    });
    await assert.rejects(api[apiName][method](), /status code 400/);
  });

  test(`${method} rejects an unsuccessful API response`, async () => {
    const api = loadAPI(async () => ({ data: { success: false, message: 'Invalid limit' } }));
    await assert.rejects(api[apiName][method](), /Invalid limit/);
  });

  if (process.env.ROMA_API_ORIGIN) {
    test(`${method} loads real production taxonomy through the shared public read controller`, async () => {
      const api = loadAPI(async (_, { params }) => {
        const publicPath = apiName === 'categoriesAPI' ? '/api/categories' : '/api/subcategories/all';
        const url = new URL(publicPath, process.env.ROMA_API_ORIGIN);
        url.search = new URLSearchParams(params).toString();
        const response = await fetch(url);
        assert.equal(response.status, 201);
        return { status: response.status, data: await response.json() };
      });
      const response = await api[apiName][method]();
      assert.ok(response.data.data.length > 0);
      console.log(`${method}: ${response.data.data.length} real records`);
    });
  }
}

for (const page of ['ProductForm', 'Products', 'SubCategoryForm', 'Deals']) {
  test(`${page} does not request more than the API's 100-item limit`, () => {
    const source = fs.readFileSync(path.join(root, 'src/pages', `${page}.tsx`), 'utf8');
    const limits = [...source.matchAll(/limit:\s*(\d+)/g)].map(match => Number(match[1]));
    assert.ok(limits.every(limit => limit <= 100), `Oversized limit in ${page}: ${limits}`);
    if (page !== 'Deals') assert.match(source, /categoriesAPI\.getAllCategories\(\)/);
    if (page === 'ProductForm') assert.match(source, /subCategoriesAPI\.getAllSubCategories\(/);
  });
}
