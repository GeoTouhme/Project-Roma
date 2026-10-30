'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Model doubles only: execute the real controller and reporting/date code, with no DB connection.
async function report({ now, timezone = 'America/Los_Angeles', orders = [], users = [] }) {
  const instant = new Date(now).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return instant; }
  }
  const filename = path.resolve(__dirname, '../src/controllers/dashboard.js');
  const realRequire = createRequire(filename);
  const reads = [];
  const matches = (item, filter) => Object.entries(filter.createdAt || {}).every(([op, value]) => {
    const time = new Date(item.createdAt).getTime();
    return op === '$gte' ? time >= +value : op === '$gt' ? time > +value : op === '$lte' ? time <= +value : time < +value;
  });
  const models = {
    '../models/Order': { find(filter) { reads.push(filter); return { select: async () => orders.filter(o => matches(o, filter)) }; } },
    '../models/User': { find: () => ({ select: async () => users }) },
    '../models/Product': { countDocuments: async () => 9, find: () => ({ sort: () => ({ limit: async () => [{ name: 'Best seller' }] }) }) },
    '../models/Notification': {},
    // No create/save/upsert API is available, so accidental report writes fail the test.
    '../models/settings': { findOne: async filter => {
      assert.deepEqual(JSON.parse(JSON.stringify(filter)), { key: 'storeConfig' });
      return timezone === null ? null : { timezone };
    } },
  };
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(process.env.ROMA_DASHBOARD_SOURCE || filename, 'utf8'), {
    module: mod, exports: mod.exports, Date: Clock,
    require: name => Object.hasOwn(models, name) ? models[name] : realRequire(name),
  }, { filename });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const snapshot = JSON.stringify({ orders, users });
  await mod.exports.getDashboardAnalytics({}, res);
  assert.equal(res.code, 201, JSON.stringify(res.body));
  assert.equal(JSON.stringify({ orders, users }), snapshot, 'reporting must not mutate records');
  return { data: JSON.parse(JSON.stringify(res.body.data)), reads };
}
const order = (createdAt, total, status = 'delivered') => ({ createdAt, total, status });

test('current calendar year excludes prior-year months while week/yesterday retain December', async () => {
  const { data } = await report({ now: '2025-01-02T20:00:00Z', orders: [
    order('2024-01-02T12:00:00Z', 100), order('2024-12-31T20:00:00Z', 7),
    order('2025-01-01T08:00:00Z', 11), order('2025-01-02T08:00:00Z', 13),
  ] });
  assert.deepEqual(data.salesReport, [2, ...Array(11).fill(0)]);
  assert.deepEqual(data.incomeReport.year, [24, ...Array(11).fill(0)]);
  assert.deepEqual(data.incomeReport.month, [11, 13, ...Array(29).fill(0)]);
  assert.deepEqual(data.incomeReport.week, [0, 0, 0, 0, 7, 11, 13]);
  assert.deepEqual(data.ordersReport, [0, 0, 0, 2, 0, 0, 0]);
  assert.equal(data.dailyEarning, 13);
  assert.equal(data.yesterdayEarning, 11);
});

test('same month in a previous year never contributes to current month or year', async () => {
  const { data } = await report({ now: '2025-10-28T20:00:00Z', orders: [
    order('2024-10-30T20:00:00Z', 999), order('2025-10-27T20:00:00Z', 5),
  ] });
  assert.equal(data.incomeReport.month[29], 0);
  assert.equal(data.incomeReport.year[9], 5);
  assert.equal(data.salesReport[9], 1);
});

test('rolling seven local dates cross a leap-day/month boundary oldest to newest', async () => {
  const { data, reads } = await report({ now: '2024-03-01T20:00:00Z', orders: [
    order('2024-02-24T07:59:59.999Z', 999), // February 23, outside week
    order('2024-02-24T08:00:00Z', 2),
    order('2024-02-29T08:00:00Z', 3),
    order('2024-03-01T08:00:00Z', 5),
  ] });
  assert.deepEqual(data.incomeReport.week, [2, 0, 0, 0, 0, 3, 5]);
  assert.equal(data.incomeReport.month.length, 31);
  assert.equal(data.incomeReport.month[0], 5);
  assert.equal(data.yesterdayEarning, 3);
  assert.equal(reads[0].createdAt.$gte.toISOString(), '2024-01-01T08:00:00.000Z');
});

for (const [now, length, stamp] of [
  ['2024-02-29T20:00:00Z', 29, '2024-02-29T08:00:00Z'],
  ['2025-02-28T20:00:00Z', 28, '2025-02-28T08:00:00Z'],
]) test(`February daily buckets have ${length} days`, async () => {
  const { data } = await report({ now, orders: [order(stamp, 7)] });
  assert.equal(data.incomeReport.month.length, length);
  assert.equal(data.incomeReport.month[length - 1], 7);
});

test('configured Tokyo timezone defines the calendar year, day, and user counts', async () => {
  const { data, reads } = await report({ now: '2025-01-01T02:00:00Z', timezone: 'Asia/Tokyo', orders: [
    order('2024-12-31T14:59:59.999Z', 2), order('2024-12-31T15:00:00Z', 3),
  ], users: [
    { createdAt: '2024-12-31T14:59:59.999Z' }, { createdAt: '2024-12-31T15:00:00Z' },
    { createdAt: '2025-01-01T02:01:00Z' },
  ] });
  assert.equal(data.salesReport[0], 1);
  assert.equal(data.incomeReport.year[0], 3);
  assert.deepEqual(data.incomeReport.week, [0, 0, 0, 0, 0, 2, 3]);
  assert.equal(data.dailyOrders, 1);
  assert.equal(data.yesterdayOrders, 1);
  assert.equal(data.newUsersToday, 1);
  assert.equal(data.newUsersYesterday, 1);
  assert.equal(data.users, 3);
  assert.equal(reads[0].createdAt.$gte.toISOString(), '2024-12-25T15:00:00.000Z');
});

for (const [label, now, before, start, last, today] of [
  ['spring 23-hour day', '2024-03-11T19:00:00Z', '2024-03-10T07:59:59.999Z', '2024-03-10T08:00:00Z', '2024-03-11T06:59:59.999Z', '2024-03-11T07:00:00Z'],
  ['fall 25-hour day', '2024-11-04T20:00:00Z', '2024-11-03T06:59:59.999Z', '2024-11-03T07:00:00Z', '2024-11-04T07:59:59.999Z', '2024-11-04T08:00:00Z'],
]) test(`yesterday uses local midnight boundaries across ${label}`, async () => {
  const { data } = await report({ now, orders: [order(before, 2), order(start, 3), order(last, 5), order(today, 7)],
    users: [before, start, last, today].map(createdAt => ({ createdAt })) });
  assert.equal(data.yesterdayOrders, 2);
  assert.equal(data.yesterdayEarning, 8);
  assert.equal(data.dailyOrders, 1);
  assert.equal(data.dailyEarning, 7);
  assert.equal(data.newUsersYesterday, 2);
  assert.equal(data.newUsersToday, 1);
  assert.deepEqual(data.incomeReport.week, [0, 0, 0, 0, 2, 8, 7]);
});

test('repeated fall-back hours both count once in the same local date', async () => {
  const { data } = await report({ now: '2024-11-03T20:00:00Z', orders: [
    order('2024-11-03T08:30:00Z', 3), order('2024-11-03T09:30:00Z', 5),
  ] });
  assert.equal(data.dailyOrders, 2);
  assert.equal(data.dailyEarning, 8);
  assert.equal(data.incomeReport.week[6], 8);
});

test('status revenue policy, response keys, and request upper bound are preserved', async () => {
  const now = '2025-06-15T20:00:00Z';
  const statuses = ['pending', 'processing', 'ontheway', 'delivered', 'returned', 'cancelled', 'denied', 'accepted'];
  const { data, reads } = await report({ now, orders: [
    ...statuses.map(status => order('2025-06-15T07:00:00Z', '2', status)),
    order(now, 100), order('2025-06-16T07:00:00Z', 100),
  ] });
  assert.deepEqual(Object.keys(data).sort(), ['salesReport', 'ordersReport', 'incomeReport', 'users', 'newUsersToday', 'newUsersYesterday', 'dailyOrders', 'yesterdayOrders', 'dailyEarning', 'yesterdayEarning', 'bestSellingProducts', 'totalProducts'].sort());
  assert.equal(data.dailyOrders, 8);
  assert.equal(data.dailyEarning, 10);
  assert.equal(data.incomeReport.year[5], 10);
  assert.deepEqual(data.ordersReport, [1, 1, 1, 1, 1, 1, 1]);
  assert.equal(data.salesReport[5], 8);
  assert.equal(data.totalProducts, 9);
  assert.deepEqual(data.bestSellingProducts, [{ name: 'Best seller' }]);
  assert.equal(new Date(reads[0].createdAt.$lt).toISOString(), '2025-06-15T20:00:00.000Z');
});

for (const timezone of [null, 'Not/A_Zone']) test(`missing/invalid timezone ${timezone} falls back without settings writes`, async () => {
  const { data } = await report({ now: '2025-01-01T02:00:00Z', timezone, orders: [order('2024-12-31T20:00:00Z', 3)] });
  assert.equal(data.dailyEarning, 3);
  assert.equal(data.incomeReport.year[11], 3);
});
