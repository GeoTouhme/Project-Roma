'use strict';
// Dry-run by default. The old key remains available until every enrollment migrates.
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const { decryptWithSecret, encryptMfaSecret } = require('../../src/utils/mfaCipher');
(async () => {
  if (!process.env.MFA_SECRET_KEY || !process.env.MFA_PREVIOUS_SECRET_KEY || process.env.MFA_SECRET_KEY === process.env.MFA_PREVIOUS_SECRET_KEY) throw new Error('Distinct current/previous MFA keys are required');
  await mongoose.connect(process.env.MONGODB_URI);
  let checked = 0, changed = 0, concurrent = 0;
  const apply = process.argv.includes('--apply');
  for await (const user of User.find({ $or:[{ mfaSecret:{ $type:'string' } },{ mfaTempSecret:{ $type:'string' } }] }).select('_id +mfaSecret +mfaTempSecret').cursor()) {
    const filter = { _id:user._id }, update = {};
    for (const field of ['mfaSecret','mfaTempSecret']) {
      if (!user[field]) continue;
      try { decryptWithSecret(user[field], process.env.MFA_SECRET_KEY); continue; } catch {}
      update[field] = encryptMfaSecret(decryptWithSecret(user[field], process.env.MFA_PREVIOUS_SECRET_KEY));
      filter[field] = user[field]; checked++;
    }
    if (apply && Object.keys(update).length) {
      const result = await User.updateOne(filter, { $set:update });
      if (result.modifiedCount) changed++; else concurrent++;
    }
  }
  console.log(JSON.stringify({ dryRun:!apply, checked, changed, concurrent }));
})().catch(() => { console.error('MFA migration failed; retain the previous key and inspect configuration securely.'); process.exitCode=1; }).finally(() => mongoose.disconnect());
