// Run once against the isolated, pre-auth database using a root-only mounted file.
// Existing production volumes are preserved; initdb environment variables alone do not retrofit auth.
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('/run/roma-mongo-bootstrap.json', 'utf8'));
const admin = db.getSiblingDB('admin');
const app = db.getSiblingDB('liquor_shop');
admin.createUser({ user: config.adminUser, pwd: config.adminPassword, roles: [{ role:'root', db:'admin' }] });
admin.auth(config.adminUser, config.adminPassword);
app.createUser({ user: config.appUser, pwd: config.appPassword, roles: [{ role:'readWrite', db:'liquor_shop' }] });
if (config.backupUser) app.createUser({ user: config.backupUser, pwd: config.backupPassword, roles: [{ role:'read', db:'liquor_shop' }] });
print('Database identities created; credentials omitted');
