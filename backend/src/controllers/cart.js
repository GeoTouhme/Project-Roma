const Products = require('../models/Product');

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

      const subtotal = (product.priceSale || product.price) * quantity;
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

    return response.status(200).json({
      success: true,
      data: cartItems,
    });
  } catch (error) {
    return response
      .status(400)
      .json({ success: false, message: error.message });
  }
};
module.exports = { getCart };
