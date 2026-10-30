export const PRIVACY_EVENT = 'balport:privacy-preferences';
export const OPEN_PRIVACY_EVENT = 'balport:open-privacy-preferences';
export const CONSENT_VERSION = 'analytics-2026-10-29-v1';
export const GOOGLE_ANALYTICS_ID = 'G-LN2CR3WR1H';

export function globalPrivacyControl() { return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true; }
export function getPreferences() {
  try {
    const record = JSON.parse(localStorage.getItem('cookieConsentRecord') || 'null');
    const valid = record?.version === CONSENT_VERSION && typeof record.analytics === 'boolean' && typeof record.updatedAt === 'string';
    return { decided: valid, analytics: valid && record.analytics === true && !globalPrivacyControl(), gpc: globalPrivacyControl() };
  } catch { return { decided: false, analytics: false, gpc: globalPrivacyControl() }; }
}
export const analyticsEnabled = () => getPreferences().analytics;
function clearAnalyticsStorage() {
  try { localStorage.removeItem('visitor_session_id'); } catch {}
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = ['', host, parts.length > 1 ? `.${parts.slice(-2).join('.')}` : ''];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name)) continue;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
  }
}
export function applyOptOut() {
  if (typeof window !== 'undefined') {
    window[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = true;
    document.getElementById('balport-google-analytics')?.remove();
  }
  clearAnalyticsStorage();
}
export function setAnalyticsPreference(analytics) {
  const granted = analytics === true && !globalPrivacyControl();
  try {
    localStorage.setItem('cookieConsent', granted ? 'accepted' : 'essential_only');
    localStorage.setItem('cookieConsentRecord', JSON.stringify({ version: CONSENT_VERSION, analytics: granted, updatedAt: new Date().toISOString() }));
  } catch { applyOptOut(); }
  if (!granted) applyOptOut();
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}
export function enforcePrivacySignal() {
  if (globalPrivacyControl()) setAnalyticsPreference(false);
  else if (!analyticsEnabled()) applyOptOut();
}
export function openPrivacyPreferences() { window.dispatchEvent(new Event(OPEN_PRIVACY_EVENT)); }
