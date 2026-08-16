const Products = require('../models/Product');
const Deal = require('../models/Deal');

const applyBundleDeals = async (items) => {
  const now = new Date();
  const deals = await Deal.find({
    status: 'active',
    startAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
  }).lean();

  let bundleDiscount = 0;

  for (const deal of deals) {
    const dealProductIds = deal.productIds.map((id) => id.toString());
    const matchingItems = items.filter((item) => dealProductIds.includes(item.pid.toString()));
    const totalQty = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQty < deal.quantity) continue;

    const bundleCount = Math.floor(totalQty / deal.quantity);
    const leftoverQty = totalQty % deal.quantity;
    const unitPrice = matchingItems[0]?.price || 0;
    const regularTotal = totalQty * unitPrice;
    const discountedTotal = bundleCount * deal.bundlePrice + leftoverQty * unitPrice;
    const discount = regularTotal - discountedTotal;
    if (discount > 0) bundleDiscount += discount;
  }

  return bundleDiscount;
};

const getCart = async (request, response) => {
  try {
    const req = await request.body;
    const cartItems = [];

    // Prevent crash if products array is missing or invalid
    if (!req.products || !Array.isArray(req.products)) {
      return response.status(400).json({ success: false, message: 'Invalid products array provided.' });
    }

    for (const item of req.products) {
      const product = await Products.findById(item.pid).select([
        'cover',
        'name',
        'brand',
        'slug',
        'available',
        'price',
        'priceSale',
        'status',
      ]);

      if (!product || product.status === 'disabled' || product.status === 'inactive' || product.available <= 0) {
        return response
          .status(400)
          .json({ success: false, message: 'Product is unavailable or out of stock.' });
      }
      const { quantity, color, size, sku } = item;
      if (product.available < quantity) {
        return response
          .status(400)
          .json({ success: false, message: 'No Products in Stock' });
      }

      const unitPrice = product.priceSale || product.price;
      const subtotal = unitPrice * quantity;
      const { ...others } = product.toObject();
      cartItems.push({
        ...others,
        pid: item.pid,
        quantity,
        size,
        image: item.image,
        color,
        subtotal: subtotal.toFixed(2),
        sku: sku,
      });
    }

    const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const bundleDiscount = await applyBundleDeals(cartItems);
    const finalSubtotal = Math.max(0, subtotal - bundleDiscount);

    return response.status(200).json({
      success: true,
      data: cartItems,
      subtotal: finalSubtotal.toFixed(2),
      bundleDiscount: bundleDiscount.toFixed(2),
    });
  } catch (error) {
    return response
      .status(400)
      .json({ success: false, message: error.message });
  }
};
module.exports = { getCart };
