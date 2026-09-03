/**
 * 🛡️ emailGuard.js — Disposable/throwaway email defense
 *
 * Blocks registration and email-change flows from using disposable/temporary
 * inbox providers (Mailinator, Guerrilla Mail, 10MinuteMail, Temp-Mail, YOPmail,
 * Sharklasers, etc.). This platform is an age-restricted alcohol delivery
 * service: throwaway inboxes are the primary vehicle for fake accounts,
 * OTP-flow abuse, per-user coupon fraud, and ban evasion.
 *
 * Also validates basic email format and rejects "+tag" local parts on
 * self-service flows (gmail aliases allow one real inbox to spawn unlimited
 * "unique" accounts).
 */

const dns = require('dns').promises;

// Known disposable / temporary email domains (suffix-matched, so subdomains
// like anything.mailinator.com are caught too).
const DISPOSABLE_DOMAINS = [
  // Mailinator & family
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'sogetthis.com',
  'spamhereplease.com', 'binkmail.com', 'bobmail.info', 'chammy.info',
  'devnullmail.com', 'letthemeailthat.com', 'mailinater.com', 'mailinator100.com',
  'mailnesia.com', 'reallymymail.com', 'safetymail.info', 'sendspamhere.com',
  'toomail.biz', 'trash2009.com', 'wegwerfmail.de', 'wegwerfmail.net',
  // Guerrilla Mail & family
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'guerrillamail.info',
  'pokemail.net', 'spam4.me', 'sharklasers.net',
  // Temp-mail / 10-minute family
  'temp-mail.org', 'temp-mail.io', 'temp-mail.world', 'tempmail.net', 'tempmail.plus',
  'tempmail.dev', 'tempmailo.com', 'tempmail.space', '10minutemail.com',
  '10minutemail.net', '10minutemail.org', '10minutemail.info', '10minuteemail.com',
  '10minutesmail.com', '20minutemail.com', '1minutemail.com', 'tempinbox.com',
  'tempail.com', 'tempr.email', 'tempemail.co', 'tempemail.net', 'tempmail.email',
  'throwawaymail.com', 'throwawaymail.net', 'throwawaymail.org', 'maildrop.cc',
  'discard.email', 'dispostable.com', 'mailtemp.info', 'faketempmail.com',
  // YOPmail & family
  'yopmail.com', 'yopmail.net', 'yopmail.fr', 'yopmail.org', 'cool.fr.nf',
  'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr',
  'courriel.fr.nf', 'moncourriel.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
  // Nada / Mail7 / Mail.tm family
  'getnada.com', 'nada.email', 'nada.ltd', 'mail7.io', 'inboxbear.com',
  'mail.tm', 'mail.gw', 'tmail.ws', 'tmails.net',
  // Other popular throwaway providers
  'mailnesia.com', 'mytemp.email', 'mohmal.com', 'mohmal.im', 'emailondeck.com',
  'email-fake.com', 'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com',
  'trashmail.com', 'trashmail.de', 'trashmail.net', 'trashmail.org', 'trash-mail.com',
  'byom.de', 'wegwerfmailaddress.com', 'wegwerfmail.info', 'mailed.ro',
  'luxusmail.org', 'burnmail.io', 'instantemailaddress.com', 'instant-mail.de',
  'one-time.email', 'onetimeemail.com', '1secmail.com', '1secmail.org', '1secmail.net',
  'esiix.com', 'wwjmp.com', 'xojxe.com', 'yoggm.com', 'inboxkitten.com',
  'mailcatch.com', 'mintemail.com', 'mail-temp.com', 'moakt.com', 'moakt.ws',
  'tmpmail.net', 'tmpmail.org', 'mytrashmail.com', 'spamgourmet.com', 'spamhole.com',
  'spambog.com', 'spamex.com', 'spaml.de', 'mailexpire.com', 'jetable.org',
  'anonbox.net', 'deadaddress.com', 'despam.it', 'discard.cf', 'dropmail.me',
  'dropmail.net', 'duskmail.com', 'e4ward.com', 'emailigo.de', 'emailsensei.com',
  'emailtemporanea.net', 'emltmp.com', 'fake-mail.net', 'fleckens.hu',
  'goemailgo.com', 'humaility.com', 'incognitomail.com', 'incognitomail.org',
  'kasmail.com', 'killmail.net', 'kurzepost.de', 'mailde.de', 'mailde.info',
  'maildrop2.com', 'maileimer.de', 'mailhazard.com', 'mailimate.com',
  'mailsac.com', 'mailtemporar.com', 'mailtothis.com', 'mbx.cc', 'meltmail.com',
  'messageboxx.org', 'mt2015.com', 'mvrht.net', 'my10minutemail.com',
  'mytrashmail.com', 'no-spam.ws', 'nomail.xl.cx', 'nospam.ze.tc',
  'objectmail.com', 'proxymail.eu', 'rcpt.at', 'rhyta.com', 'safetypost.net',
  'scratchmail.com', 'shieldedmail.com', 'sneakemail.com', 'sofort-mail.de',
  'sofortmail.de', 'spamavert.com', 'spambob.com', 'spambob.net', 'spambob.org',
  'spambox.us', 'spamcannon.com', 'spamcereal.com', 'spamfree.eu.org',
  'spamfree24.org', 'spamgourmet.net', 'spamgourmet.org', 'spamhole.org',
  'spaminator.de', 'spaml.de', 'spammotel.com', 'spambox.ir', 'tempeml.com',
  'tempmailaddress.com', 'tempmailadress.com', 'thankyou2010.com', 'tmails.net',
  'tormail.org', 'trash-mail.net', 'trashmail.at', 'trashmail.me', 'trbvm.com',
  'trbvn.com', 'vomoto.com', 'vpn.st', 'weg-werfmail.de', 'wetrainingscheibe.de',
  'wh4f.org', 'whyspam.me', 'willselfdestruct.com', 'yandex.com.tr',
  'zoemail.net', 'zomail.info', 'zippymail.info', 'zetmail.com',
  'linshiyouxiang.net', 'bccto.me', 'chacuo.net', '027168.com', 'qq.cafe',
  'edu.aiot.zeemail.org', 'smash.re', 'one-time.email', 'tempmail.best',
  'inbox.si', 'inbox.lt', 'inbox.ee', 'mailinus.com', 'mailismagic.com',
  'mailinator.101reviews.com', 'mailpond.com', 'mailspeed.ru', 'mailtea.com',
  'mailt.net', 'mailtemp.uk', 'mainer.ru', 'mailtemp.net', 'mailinator.pro',
];

const DISPOSABLE_SET = new Set(DISPOSABLE_DOMAINS.map((d) => d.toLowerCase()));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function isDisposableEmail(email) {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (DISPOSABLE_SET.has(domain)) return true;
  // Suffix match: subdomains of disposable providers
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.');
    if (DISPOSABLE_SET.has(candidate)) return true;
  }
  return false;
}

function isValidEmailFormat(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

/**
 * Gmail-style "+tag" aliases let one real inbox register unlimited "unique"
 * accounts (per-user coupon limits, review abuse). Rejected on self-service
 * flows where the user types the address manually.
 */
function hasPlusAlias(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  return email.slice(0, at).includes('+');
}

/**
 * Confirm the email's domain actually has MX records so the verification
 * email is deliverable. Definitive "no MX" → reject. DNS resolution errors
 * (timeouts, resolver hiccups) are treated leniently to avoid blocking all
 * signups during a transient DNS outage — the domain blocklist above is the
 * hard gate, this is a quality check.
 */
async function domainCanReceiveMail(email) {
  const domain = emailDomain(email);
  if (!domain) return { ok: false, reason: 'invalid' };
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { ok: false, reason: 'no-mx' };
    }
    return { ok: true };
  } catch (err) {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'ENODATA')) {
      return { ok: false, reason: 'no-mx' };
    }
    // Timeout / resolver error — don't block signup on infra flakiness.
    return { ok: true };
  }
}

/**
 * Full self-service acceptance check. Throws Error with a user-safe message
 * when the email is unacceptable.
 */
async function assertAcceptableEmail(email, { allowPlusAlias = false } = {}) {
  if (!isValidEmailFormat(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (isDisposableEmail(email)) {
    throw new Error('Disposable email addresses are not allowed. Please use a permanent email address.');
  }
  if (!allowPlusAlias && hasPlusAlias(email)) {
    throw new Error('Email aliases with "+" are not allowed. Please use your primary email address.');
  }
  const mx = await domainCanReceiveMail(email);
  if (!mx.ok) {
    throw new Error('This email domain cannot receive mail. Please check the address or use a different email.');
  }
}

module.exports = {
  isDisposableEmail,
  isValidEmailFormat,
  hasPlusAlias,
  assertAcceptableEmail,
  DISPOSABLE_DOMAINS,
};