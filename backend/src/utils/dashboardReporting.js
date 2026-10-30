const moment = require('moment-timezone');

const DEFAULT_TIMEZONE = 'America/Los_Angeles';
const ORDER_STATUSES = ['pending', 'processing', 'ontheway', 'delivered', 'returned', 'cancelled', 'denied'];
const EXCLUDED_REVENUE_STATUSES = new Set(['cancelled', 'returned', 'denied']);

function getReportingPeriods(timezone, now = new Date()) {
  const zone = typeof timezone === 'string' && moment.tz.zone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const current = moment(now).tz(zone);
  const today = current.clone().startOf('day');
  const year = current.clone().startOf('year');
  const week = today.clone().subtract(6, 'days');
  return {
    timezone: zone,
    now: current.toDate(),
    yearStart: year.toDate(),
    monthStart: current.clone().startOf('month').toDate(),
    todayStart: today.toDate(),
    yesterdayStart: today.clone().subtract(1, 'day').toDate(),
    weekStart: week.toDate(),
    // A January week can begin in December; do not restrict the fetch to this year.
    queryStart: moment.min(year, week).toDate(),
    monthDays: current.daysInMonth(),
    weekDates: Array.from({ length: 7 }, (_, i) => week.clone().add(i, 'days').format('YYYY-MM-DD')),
  };
}

function buildCalendarReport(orders, users, periods) {
  const { timezone, now, yearStart, monthStart, todayStart, yesterdayStart, weekDates } = periods;
  const data = {
    salesReport: Array(12).fill(0),
    ordersReport: ORDER_STATUSES.map(() => 0),
    incomeReport: { week: Array(7).fill(0), month: Array(periods.monthDays).fill(0), year: Array(12).fill(0) },
    users: users.length,
    newUsersToday: 0,
    newUsersYesterday: 0,
    dailyOrders: 0,
    yesterdayOrders: 0,
    dailyEarning: 0,
    yesterdayEarning: 0,
  };
  // Periods are local calendar periods, bounded above by the single request snapshot.
  const inPeriod = (time, start, end = now) => time >= start && time < end;
  for (const order of orders) {
    const local = moment(order.createdAt).tz(timezone);
    const time = local.toDate();
    if (!(time < now)) continue;
    const eligible = !EXCLUDED_REVENUE_STATUSES.has(order.status);
    const revenue = eligible ? Number(order.total) : 0;
    if (inPeriod(time, yearStart)) {
      data.salesReport[local.month()]++;
      const statusIndex = ORDER_STATUSES.indexOf(order.status);
      if (statusIndex !== -1) data.ordersReport[statusIndex]++;
      data.incomeReport.year[local.month()] += revenue;
    }
    if (inPeriod(time, monthStart)) data.incomeReport.month[local.date() - 1] += revenue;
    const weekIndex = weekDates.indexOf(local.format('YYYY-MM-DD'));
    if (weekIndex !== -1) data.incomeReport.week[weekIndex] += revenue;
    if (inPeriod(time, todayStart)) {
      data.dailyOrders++;
      data.dailyEarning += revenue;
    }
    if (inPeriod(time, yesterdayStart, todayStart)) {
      data.yesterdayOrders++;
      data.yesterdayEarning += revenue;
    }
  }
  for (const user of users) {
    const time = new Date(user.createdAt);
    if (inPeriod(time, todayStart)) data.newUsersToday++;
    if (inPeriod(time, yesterdayStart, todayStart)) data.newUsersYesterday++;
  }
  return data;
}

module.exports = { getReportingPeriods, buildCalendarReport };
