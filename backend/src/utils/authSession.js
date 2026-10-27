 'use strict';
const Users = require('../models/User');
async function authenticateSession(claims) {
  if (typeof claims.sid !== 'string' || !/^[a-f0-9]{64}$/.test(claims.sid)) throw new Error('Session expired');
  const user = await Users.findById(claims._id).select('+authSessionId');
  if (!user || !user.isVerified || user.authSessionId !== claims.sid || ['disabled', 'inactive', 'blocked'].includes(user.status)) throw new Error('Session expired');
  return { ...claims, role: user.role, email: user.email };
}
module.exports = { authenticateSession };
