// controllers/newsController.js
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notifications = require('../models/Notification');

const calculateExpirationDate = (days) => {
  const now = new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
};
const getDashboardAnalytics = async (req, res) => {
  try {
    const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();
    const getLastWeeksDate = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    };

    const getOrdersReport = (ordersByYears) =>
      [...new Array(12)].map(
        (_, i) =>
          ordersByYears?.filter(
            (v) => new Date(v.createdAt).getMonth() + 1 === i + 1
          ).length
      );

    const getIncomeReport = (prop, ordersByYears) => {
      const newData = ordersByYears.filter((item) =>
        prop === 'year'
          ? true
          : prop === 'week'
          ? new Date(item.createdAt).getMonth() === new Date().getMonth() &&
            new Date(item.createdAt).getTime() > getLastWeeksDate().getTime()
          : new Date(item.createdAt).getMonth() === new Date().getMonth()
      );

      return [
        ...new Array(
          prop === 'week'
            ? 7
            : prop === 'year'
            ? 12
            : getDaysInMonth(
                new Date().getMonth() + 1,
                new Date().getFullYear()
              )
        ),
      ].map((_, i) =>
        prop === 'week'
          ? newData
              ?.filter(
                (v) =>
                  new Date(v.createdAt).getDate() ===
                    getLastWeeksDate().getDate() + 1 + i &&
                  v.status !== 'cancelled' &&
                  v.status !== 'returned' &&
                  v.status !== 'denied'
              )
              .reduce((partialSum, a) => partialSum + Number(a.total), 0)
          : prop === 'year'
          ? newData
              ?.filter(
                (v) =>
                  new Date(v.createdAt).getMonth() === i &&
                  v.status !== 'cancelled' &&
                  v.status !== 'returned' &&
                  v.status !== 'denied'
              )
              .reduce((partialSum, a) => partialSum + Number(a.total), 0)
          : newData
              ?.filter(
                (v) =>
                  new Date(v.createdAt).getDate() === i + 1 &&
                  v.status !== 'cancelled' &&
                  v.status !== 'returned' &&
                  v.status !== 'denied'
              )
              .reduce((partialSum, a) => partialSum + Number(a.total), 0)
      );
    };

    const users = await User.find({}).select('createdAt');
    const totalProducts = await Product.countDocuments({});
    const lastYearDate = calculateExpirationDate(-365).getTime();
    const todayDate = new Date().getTime();
    
    // Get timestamps for yesterday and today
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday - 24 * 60 * 60 * 1000).getTime();
    
    const ordersByYears = await Order.find({
      createdAt: { $gt: lastYearDate, $lt: todayDate },
    }).select(['createdAt', 'status', 'total']);

    const todaysOrders = ordersByYears.filter(
      (v) => new Date(v.createdAt).getTime() >= startOfToday
    );

    const yesterdaysOrders = ordersByYears.filter(
      (v) => {
        const time = new Date(v.createdAt).getTime();
        return time >= startOfYesterday && time < startOfToday;
      }
    );

    const dailyEarning = todaysOrders
      .filter((order) => order.status !== 'cancelled' && order.status !== 'returned' && order.status !== 'denied')
      .reduce((partialSum, order) => partialSum + Number(order.total), 0);

    const yesterdayEarning = yesterdaysOrders
      .filter((order) => order.status !== 'cancelled' && order.status !== 'returned' && order.status !== 'denied')
      .reduce((partialSum, order) => partialSum + Number(order.total), 0);

    const newUsersToday = users.filter(u => new Date(u.createdAt).getTime() >= startOfToday).length;
    const newUsersYesterday = users.filter(u => {
      const time = new Date(u.createdAt).getTime();
      return time >= startOfYesterday && time < startOfToday;
    }).length;

    // Fetching best-selling products
    const bestSellingProducts = await Product.find()
      .sort({ sold: -1 })
      .limit(5);

    const data = {
      salesReport: getOrdersReport(ordersByYears),
      bestSellingProducts: bestSellingProducts,
      ordersReport: [
        'pending',
        'processing',
        'ontheway',
        'delivered',
        'returned',
        'cancelled',
        'denied',
      ].map(
        (status) => ordersByYears.filter((v) => v.status === status).length
      ),
      incomeReport: {
        week: getIncomeReport('week', ordersByYears),
        month: getIncomeReport('month', ordersByYears),
        year: getIncomeReport('year', ordersByYears),
      },
      users: users.length,
      newUsersToday,
      newUsersYesterday,
      totalProducts,
      dailyOrders: todaysOrders.length,
      yesterdayOrders: yesterdaysOrders.length,
      dailyEarning,
      yesterdayEarning,
    };
    res.status(201).json({ success: true, data: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getNofications = async (req, res) => {
  try {
    // Extract query parameters for pagination

    const { page: pageQuery, limit: limitQuery } = req.query;

    // Set default limit and page number
    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;
    const skip = limit * (page - 1); // Calculate skip value

    // Count total notifications
    const totalNotifications = await Notifications.countDocuments();

    // Count total unread notifications
    const totalUnreadNotifications = await Notifications.countDocuments({
      opened: false,
    });

    // Fetch notifications
    const notifications = await Notifications.find({}, null, {
      limit: limit,
      skip: skip,
    }).sort({ createdAt: -1 });

    res.status(201).json({
      success: true,
      data: notifications,
      totalNotifications: totalNotifications,
      totalUnread: totalUnreadNotifications,
      count: Math.ceil(totalUnreadNotifications / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardAnalytics,
  getNofications,
};
