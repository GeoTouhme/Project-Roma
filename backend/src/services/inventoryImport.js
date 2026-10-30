'use strict';
const { parseInventoryCSV } = require('../utils/inventoryCsv');

const STATUSES = new Set(['active', 'inactive', 'enabled', 'disabled']);
const BOOLEAN_VALUES = new Map([['true', true], ['yes', true], ['1', true], ['false', false], ['no', false], ['0', false]]);
function number(value, label, integer = false) {
  const pattern = integer ? /^\d+$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  const parsed = Number(value);
  if (!pattern.test(value) || !Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(parsed))) {
    throw new Error(`${label} must be a non-negative ${integer ? 'integer' : 'number'}`);
  }
  return parsed;
}
function boolean(value, label) {
  const parsed = BOOLEAN_VALUES.get(value.toLowerCase());
  if (parsed === undefined) throw new Error(`${label} must be true or false`);
  return parsed;
}
function imageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Image URL is required');
  if (value.startsWith('/api/images/') && !/[\r\n]/.test(value)) return value;
  try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return value; } catch {}
  throw new Error('Image URL must be an http(s) URL or /api/images/ path');
}
const plain = doc => doc.toObject ? doc.toObject() : doc;

// Every row is parsed and validated before the first write. The transaction also
// protects against database failures/conflicts during the commit, not just bad input.
function createInventoryImporter({ Product, Category, SubCategory, transaction, blurDataUrl, generateSlug }) {
  return async (req, res) => {
    const empty = () => ({ created: 0, updated: 0, errors: [] });
    let result = empty();
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded.', data: empty() });
      const records = await parseInventoryCSV(req.file.buffer);
      if (records.length < 2) throw new Error('CSV file is empty or has no data rows.');
      const headers = records[0].map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h).toLowerCase().trim());
      if (!headers.includes('upc')) throw new Error('CSV must have a "UPC" column.');
      if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('CSV headers must be non-empty and unique.');
      const seen = new Set();
      const rows = records.slice(1).map((values, i) => {
        if (values.length !== headers.length) throw new Error(`Row ${i + 2}: column count does not match headers`);
        const row = Object.fromEntries(headers.map((h, index) => [h, h === 'description' ? values[index] : values[index].trim()]));
        if (!row.upc) throw new Error(`Row ${i + 2}: UPC is required`);
        if (seen.has(row.upc)) throw new Error(`Row ${i + 2}: duplicate UPC ${row.upc}`);
        seen.add(row.upc);
        return row;
      });
      await transaction(async session => {
        // Transaction callbacks may retry: never retain counts or plans from an aborted attempt.
        result = empty();
        const plans = [], reservedSlugs = new Set();
        const categories = await Category.find().select('name').session(session).lean();
        const subcategories = await SubCategory.find().select('name parentCategory').session(session).lean();
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index], get = key => row[key] === '' ? undefined : row[key];
          try {
            const existing = await Product.findOne({ sku: row.upc }).session(session).lean();
            const fields = {};
            for (const [column, field] of [['name', 'name'], ['code', 'code'], ['description', 'description'], ['size', 'size']]) {
              if (get(column) !== undefined) fields[field] = get(column);
            }
            for (const [column, field] of [['price', 'price'], ['sale price', 'priceSale'], ['stock', 'available']]) {
              if (get(column) !== undefined) fields[field] = number(get(column), column, column === 'stock');
            }
            if (get('status') !== undefined) {
              if (!STATUSES.has(get('status'))) throw new Error('Invalid product status');
              fields.status = get('status');
            }
            for (const [column, field] of [['best seller', 'isBestSeller'], ['top collection', 'isTopCollection']]) {
              if (get(column) !== undefined) fields[field] = boolean(get(column), column);
            }
            if (get('category') !== undefined) {
              const matches = categories.filter(c => c.name.toLowerCase() === get('category').toLowerCase());
              if (matches.length !== 1) throw new Error(`Category "${get('category')}" not found or ambiguous`);
              fields.category = matches[0]._id;
            }
            const categoryId = fields.category || existing?.category;
            if (get('subcategory') !== undefined) {
              const matches = subcategories.filter(s => s.name.toLowerCase() === get('subcategory').toLowerCase() && String(s.parentCategory) === String(categoryId));
              if (matches.length !== 1) throw new Error(`SubCategory "${get('subcategory')}" does not belong to the selected category or is ambiguous`);
              fields.subCategory = matches[0]._id;
            } else if (existing?.subCategory && fields.category && String(fields.category) !== String(existing.category)) {
              const previous = subcategories.find(s => String(s._id) === String(existing.subCategory));
              if (!previous || String(previous.parentCategory) !== String(fields.category)) fields.subCategory = null;
            }
            const replaceImages = get('replace images') !== undefined && boolean(get('replace images'), 'Replace Images');
            const url = get('image url');
            let suppliedImages;
            if (get('images json') !== undefined) {
              suppliedImages = JSON.parse(get('images json'));
              if (!Array.isArray(suppliedImages)) throw new Error('Images JSON must be an array');
              suppliedImages = await Promise.all(suppliedImages.map(async (image, imageIndex) => {
                if (!image || typeof image !== 'object' || Array.isArray(image)) throw new Error('Invalid image metadata');
                const url = imageUrl(image.url);
                return { url, _id: image._id || `csv_import_${Date.now()}_${index}_${imageIndex}`,
                  blurDataURL: image.blurDataURL || await blurDataUrl(url), fallbackUrl: image.fallbackUrl || null };
              }));
            } else if (url !== undefined) {
              suppliedImages = [{ url: imageUrl(url), _id: `csv_import_${Date.now()}_${index}`, blurDataURL: await blurDataUrl(url) }];
            }
            if (replaceImages && suppliedImages === undefined) throw new Error('Replace Images requires Images JSON or Image URL');
            if (replaceImages) fields.images = suppliedImages;
            else if (suppliedImages) {
              const previous = (existing?.images || []).map(plain), urls = new Set(previous.map(image => image.url));
              const additions = suppliedImages.filter(image => { if (urls.has(image.url)) return false; urls.add(image.url); return true; });
              if (additions.length) fields.images = [...previous, ...additions];
            }
            if (!existing) {
              for (const field of ['name', 'priceSale', 'available', 'category']) if (fields[field] === undefined) throw new Error(`New product requires ${field}`);
              const base = generateSlug(fields.name);
              if (!base) throw new Error('Name must produce a non-empty slug');
              let slug = base, suffix = 1;
              while (reservedSlugs.has(slug) || await Product.findOne({ slug }).session(session)) slug = `${base}-${suffix++}`;
              reservedSlugs.add(slug);
              Object.assign(fields, { sku: row.upc, slug, price: fields.price ?? fields.priceSale, status: fields.status || 'enabled', likes: 0, sold: 0 });
            }
            const candidate = new Product({ ...(existing ? plain(existing) : {}), ...fields });
            await candidate.validate();
            plans.push({ existing, fields });
          } catch (error) { result.errors.push(`Row ${index + 2}: ${error.message}`); }
        }
        if (result.errors.length) throw Object.assign(new Error('CSV validation failed. No products were changed.'), { validationErrors: result.errors });
        for (const { existing, fields } of plans) {
          if (existing) {
            if (Object.keys(fields).length) {
              const updated = await Product.findByIdAndUpdate(existing._id, { $set: fields }, { session, runValidators: true });
              if (!updated) throw new Error('Product changed or was removed during import');
            }
            result.updated++;
          } else {
            await Product.create([fields], { session });
            result.created++;
          }
        }
      });
      return res.status(200).json({ success: true, message: `Import complete. Created: ${result.created}, Updated: ${result.updated}, Errors: 0`, data: result });
    } catch (error) {
      const unsupported = error.code === 20 || /Transaction numbers are only allowed|replica set|does not support.*transaction/i.test(error.message);
      return res.status(unsupported ? 503 : 400).json({ success: false,
        message: unsupported ? 'Atomic inventory import requires a transaction-capable MongoDB replica set. No products were changed.' : error.message,
        data: { ...empty(), errors: error.validationErrors || [error.message] } });
    }
  };
}
module.exports = { createInventoryImporter };
