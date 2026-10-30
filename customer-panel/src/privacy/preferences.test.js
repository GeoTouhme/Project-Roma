import { CONSENT_VERSION, getPreferences, setAnalyticsPreference, applyOptOut, GOOGLE_ANALYTICS_ID } from './preferences';
import { trackPageView, getTrackingPage } from '../services/analyticsService';
import service from '../interceptor/fetchInterceptor';
jest.mock('../interceptor/fetchInterceptor', () => jest.fn().mockResolvedValue({ success: true }));
beforeEach(() => { localStorage.clear(); service.mockClear(); document.getElementById('balport-google-analytics')?.remove(); delete window.gtag; delete window.dataLayer; Object.defineProperty(navigator, 'globalPrivacyControl', { value: false, configurable: true }); });
test('no choice, legacy acceptance and essential only produce no analytics requests or identifiers', async () => {
  for (const choice of [null, 'accepted', 'essential_only']) {
    if (choice) localStorage.setItem('cookieConsent', choice);
    await trackPageView('home', { slug: 'home', path: '/' });
    expect(service).not.toHaveBeenCalled(); expect(localStorage.getItem('visitor_session_id')).toBeNull(); expect(document.getElementById('balport-google-analytics')).toBeNull();
  }
});
test('opt in enables store analytics and withdrawing removes its identifiers without removing cart/auth preferences', async () => {
  localStorage.setItem('cartItems', '[1]'); setAnalyticsPreference(true);
  expect(getPreferences().analytics).toBe(true); await trackPageView('home', { slug: 'home', path: '/' });
  expect(service).toHaveBeenCalledTimes(1); expect(document.getElementById('balport-google-analytics')).toBeNull();
  localStorage.setItem('visitor_session_id', 'fixture'); setAnalyticsPreference(false);
  expect(window[`ga-disable-${GOOGLE_ANALYTICS_ID}`]).toBe(true); expect(localStorage.getItem('visitor_session_id')).toBeNull(); expect(localStorage.getItem('cartItems')).toBe('[1]');
  expect(document.getElementById('balport-google-analytics')).toBeNull();
});
test('GPC overrides saved opt in and attempts to accept all', async () => {
  setAnalyticsPreference(true); Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  expect(getPreferences().analytics).toBe(false); setAnalyticsPreference(true); await trackPageView('home'); expect(service).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('cookieConsentRecord'))).toMatchObject({ analytics: false, version: CONSENT_VERSION });
});
test('authentication, checkout and privacy request routes are excluded; order IDs are normalized', () => {
  for (const path of ['/auth/reset-password', '/verify-email', '/billing', '/checkout/return', '/privacy-requests']) expect(getTrackingPage(path)).toBeNull();
  expect(getTrackingPage('/order/private-reference').path).toBe('/orders');
});
