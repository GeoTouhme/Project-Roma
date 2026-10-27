import { render, screen } from '@testing-library/react';
import App from './App';
import { trackPageView } from './services/analyticsService';
jest.mock('./routes/PublicRoutes',()=>()=> <div>Public fallback</div>);
jest.mock('./routes/AuthenticatedRoutes',()=>()=> <div>Account fallback</div>);
jest.mock('./components/age-gate/AgeGate',()=>()=>null);
jest.mock('./components/cookie-consent/CookieConsent',()=>()=>null);
jest.mock('./components/scroll-to-top/ScrollToTop',()=>()=>null);
jest.mock('./services/analyticsService',()=>({trackPageView:jest.fn()}));
jest.mock('./services/authServices',()=>({forgetPassword:jest.fn(),resetPassword:jest.fn()}));
jest.mock('./redux/storeStatusSlice',()=>({__esModule:true,default:(state={isOpen:true})=>state,fetchStoreStatus:()=>()=>{}}));
for (const [route,label] of [['/forgot-password','Email'],['/auth/reset-password#token=fixture','New password']]) {
  test(`recovery route ${route.split('#')[0]} loads through the real router without tracking credentials`,()=>{
    window.history.replaceState({},'',route);
    render(<App/>);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(trackPageView).not.toHaveBeenCalled();
  });
}
