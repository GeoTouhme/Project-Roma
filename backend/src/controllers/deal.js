const Deal = require('../models/Deal');
const Product = require('../models/Product');
const { safeObjectId } = require('../utils/validators');

const getDeals = async (req, res) => {
  try {
    const now = new Date();
    const deals = await Deal.find({
      status: 'active',
      startAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
      displayOnHome: true,
    })
      .populate('productIds', 'name slug images price priceSale')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: deals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllDeals = async (req, res) => {
  try {
    const deals = await Deal.find()
      .populate('productIds', 'name slug images')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: deals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDealById = async (req, res) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid deal ID' });
    }
    const deal = await Deal.findById(id)
      .populate('productIds', 'name slug images price priceSale')
      .lean();
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    res.status(200).json({ success: true, data: deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createDeal = async (req, res) => {
  try {
    const {
      name,
      description,
      productIds,
      quantity,
      bundlePrice,
      expiresAt,
      startAt,
      displayOnHome,
    } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product is required',
      });
    }

    const safeIds = productIds.map(safeObjectId).filter(Boolean);
    if (safeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product IDs',
      });
    }

    const existing = await Product.countDocuments({ _id: { $in: safeIds } });
    if (existing !== safeIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found',
      });
    }

    const deal = await Deal.create({
      name,
      description,
      productIds: safeIds,
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      bundlePrice: parseFloat(bundlePrice) || 0,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      startAt: startAt ? new Date(startAt).toISOString() : new Date(),
      displayOnHome: displayOnHome !== false,
    });

    res.status(201).json({ success: true, data: deal, message: 'Deal created' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateDeal = async (req, res) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid deal ID' });
    }

    const updates = { ...req.body };
    if (updates.productIds) {
      const safeIds = updates.productIds.map(safeObjectId).filter(Boolean);
      if (safeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product IDs',
        });
      }
      updates.productIds = safeIds;
    }

    if (updates.expiresAt !== undefined) {
      updates.expiresAt = updates.expiresAt
        ? new Date(updates.expiresAt).toISOString()
        : null;
    }
    if (updates.startAt !== undefined) {
      updates.startAt = updates.startAt
        ? new Date(updates.startAt).toISOString()
        : new Date();
    }

    const deal = await Deal.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    res.status(200).json({ success: true, data: deal, message: 'Deal updated' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteDeal = async (req, res) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid deal ID' });
    }

    await Deal.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Deal deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDeals,
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
};
