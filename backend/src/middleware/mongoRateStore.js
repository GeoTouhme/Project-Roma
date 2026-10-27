'use strict';
const crypto = require('crypto');
const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, totalHits: Number, resetTime: Date });
schema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });
const Buckets = mongoose.models.RateBucket || mongoose.model('RateBucket', schema);
class MongoRateStore {
  constructor(prefix) { this.prefix = prefix; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  identity(key) {
    const bucket = Math.floor(Date.now() / this.windowMs);
    return { id: crypto.createHash('sha256').update(`${this.prefix}:${bucket}:${key}`).digest('hex'), resetTime: new Date((bucket + 1) * this.windowMs) };
  }
  async increment(key) {
    const { id, resetTime } = this.identity(key);
    const change = { $inc: { totalHits: 1 }, $setOnInsert: { resetTime } };
    let value;
    try { value = await Buckets.findOneAndUpdate({ _id: id }, change, { upsert: true, new: true }); }
    catch (error) { if (error.code !== 11000) throw error; value = await Buckets.findOneAndUpdate({ _id: id }, { $inc: { totalHits: 1 } }, { new: true }); }
    return { totalHits: value.totalHits, resetTime: value.resetTime };
  }
  async decrement(key) { await Buckets.updateOne({ _id: this.identity(key).id, totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } }); }
  async resetKey(key) { await Buckets.deleteOne({ _id: this.identity(key).id }); }
}
module.exports = { MongoRateStore };
