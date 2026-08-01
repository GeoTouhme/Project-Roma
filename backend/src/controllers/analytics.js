const PageView = require('../models/PageView');
const { getClientIp } = require('../utils/getClientIp');

const trackView = async (req, res) => {
  try {
    const { productSlug, productName, sessionId, pageType } = req.body;

    if (!productSlug) {
      return res.status(400).json({
        success: false,
        message: 'productSlug is required',
      });
    }

    const referrer = req.get('Referer') || req.body.referrer || '';
    let source = 'direct';
    if (referrer) {
      if (referrer.includes('google')) source = 'google';
      else if (referrer.includes('facebook') || referrer.includes('fb')) source = 'facebook';
      else if (referrer.includes('instagram')) source = 'instagram';
      else if (referrer.includes('balportliquors')) source = 'internal';
      else source = 'referral';
    }

    await PageView.create({
      productSlug,
      productName: productName || '',
      ip: req.realIp || getClientIp(req),
      userAgent: req.get('User-Agent') || '',
      referrer,
      source,
      sessionId: sessionId || null,
      pageType: pageType || 'product',
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Track view error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOf7DaysAgo = new Date(startOfToday);
    startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 7);
    const startOf30DaysAgo = new Date(startOfToday);
    startOf30DaysAgo.setDate(startOf30DaysAgo.getDate() - 30);

    const [
      todayCount,
      yesterdayCount,
      last7DaysCount,
      last30DaysCount,
      topProductsToday,
      topProducts7Days,
      topProducts30Days,
      topPagesToday,
      topPages7Days,
      sourceBreakdown7Days,
      dailyCounts7Days,
    ] = await Promise.all([
      PageView.countDocuments({ createdAt: { $gte: startOfToday } }),
      PageView.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
      PageView.countDocuments({ createdAt: { $gte: startOf7DaysAgo } }),
      PageView.countDocuments({ createdAt: { $gte: startOf30DaysAgo } }),

      // Top Products (pageType === 'product' or missing for legacy data)
      PageView.aggregate([
        { $match: { createdAt: { $gte: startOfToday }, $or: [{ pageType: 'product' }, { pageType: { $exists: false } }] } },
        { $group: { _id: '$productSlug', name: { $first: '$productName' }, views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: startOf7DaysAgo }, $or: [{ pageType: 'product' }, { pageType: { $exists: false } }] } },
        { $group: { _id: '$productSlug', name: { $first: '$productName' }, views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: startOf30DaysAgo }, $or: [{ pageType: 'product' }, { pageType: { $exists: false } }] } },
        { $group: { _id: '$productSlug', name: { $first: '$productName' }, views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),

      // Top Pages (pageType !== 'product')
      PageView.aggregate([
        { $match: { createdAt: { $gte: startOfToday }, pageType: { $exists: true, $ne: 'product' } } },
        { $group: { _id: '$productSlug', name: { $first: '$productName' }, views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: startOf7DaysAgo }, pageType: { $exists: true, $ne: 'product' } } },
        { $group: { _id: '$productSlug', name: { $first: '$productName' }, views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: startOf7DaysAgo } } },
        { $group: { _id: '$source', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: startOf7DaysAgo } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            views: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
    ]);

    const formatDaily = (data) => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const match = data.find(
          (item) =>
            item._id.year === d.getFullYear() &&
            item._id.month === d.getMonth() + 1 &&
            item._id.day === d.getDate()
        );
        days.push({ date: label, views: match ? match.views : 0 });
      }
      return days;
    };

    return res.status(200).json({
      success: true,
      data: {
        counts: {
          today: todayCount,
          yesterday: yesterdayCount,
          last7Days: last7DaysCount,
          last30Days: last30DaysCount,
        },
        topProducts: {
          today: topProductsToday,
          last7Days: topProducts7Days,
          last30Days: topProducts30Days,
        },
        topPages: {
          today: topPagesToday,
          last7Days: topPages7Days,
        },
        sources: sourceBreakdown7Days,
        dailyViews: formatDaily(dailyCounts7Days),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { trackView, getAnalytics };
