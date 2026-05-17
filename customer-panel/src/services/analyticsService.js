import service from "../interceptor/fetchInterceptor";

const getSessionId = () => {
  let sid = localStorage.getItem('visitor_session_id');
  if (!sid) {
    sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('visitor_session_id', sid);
  }
  return sid;
};

export const trackPageView = async (pageType, meta = {}) => {
  try {
    await service({
      url: '/track-view',
      method: 'post',
      headers: { 'public-request': 'true' },
      data: {
        productSlug: meta.slug || pageType,
        productName: meta.name || pageType,
        sessionId: getSessionId(),
        pageType,
      },
    });
  } catch (err) {
    // Silently fail — analytics should never break the site
  }
};
