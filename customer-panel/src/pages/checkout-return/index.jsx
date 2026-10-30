import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import OrderService from '../../services/orderService';
import { clearCart } from '../../redux/cartSlice';

export default function CheckoutReturn() {
  const authenticated = useSelector(state => state.auth.isAuthenticated);
  const navigate = useNavigate(), dispatch = useDispatch();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ state: 'checking', message: 'Checking your payment. Please do not pay again.' });
  const [reference] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const paymentId = query.get('payment_intent');
    if (paymentId && /^pi_[a-zA-Z0-9]+$/.test(paymentId)) sessionStorage.setItem('pending_payment_id', paymentId);
    // Remove Stripe's return-query client secret from subsequent navigation/referrers.
    if (window.location.search) window.history.replaceState({}, '', '/checkout/return');
    return { checkoutId: sessionStorage.getItem('pending_checkout_id'), paymentId: sessionStorage.getItem('pending_payment_id') };
  });
  useEffect(() => {
    if (!authenticated || (!reference.checkoutId && !reference.paymentId)) return;
    let stopped = false, timer, polls = 0;
    const check = async () => {
      try {
        const response = await OrderService.recoverCheckout(reference);
        if (stopped) return;
        setResult(response);
        if (response.state === 'completed') {
          sessionStorage.removeItem('pending_checkout_id'); sessionStorage.removeItem('pending_payment_id');
          dispatch(clearCart()); navigate(`/order/${response.orderId}`, { replace: true });
        } else if (['refunded', 'cancelled'].includes(response.state)) {
          sessionStorage.removeItem('pending_checkout_id'); sessionStorage.removeItem('pending_payment_id');
        } else if (response.state === 'payment_pending' && ++polls < 20) timer = setTimeout(check, 3000);
      } catch (error) {
        if (!stopped) setResult({ state: 'error', message: error.message || 'Payment recovery is temporarily unavailable. Do not pay again; retry or contact the store.' });
      }
    };
    check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [authenticated, reference, attempt, navigate, dispatch]);
  const cancelUnpaid = async () => {
    try {
      const response = await OrderService.cancelUnpaidCheckout(reference.checkoutId);
      if (response.state === 'cancelled') {
        sessionStorage.removeItem('pending_checkout_id'); sessionStorage.removeItem('pending_payment_id');
        navigate('/billing');
      } else setAttempt(value => value + 1);
    } catch (error) { setResult({ state: 'error', message: error.message || 'Unable to cancel this attempt. Please retry recovery.' }); }
  };
  return <section className="container py-12 max-w-2xl">
    <h1 className="text-3xl font-semibold mb-5">Payment and order status</h1>
    {!authenticated ? <p>Sign in to recover your checkout. <Link to="/login" className="underline">Sign in</Link></p>
      : !reference.checkoutId && !reference.paymentId ? <p>No pending checkout was found. <Link to="/orders" className="underline">View orders</Link></p>
      : <>
        <p role="status" className="mb-5">{result.message || 'Checking your payment. Do not pay again.'}</p>
        {['refunded', 'cancelled'].includes(result.state) && <Link to="/billing" className="mr-4 underline">Return to checkout</Link>}
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-[44px] rounded bg-primary px-5 text-white">Check again</button>
        {result.state === 'payment_incomplete' && reference.checkoutId && <button type="button" onClick={cancelUnpaid} className="ml-3 min-h-[44px] underline">Cancel unpaid attempt and return to checkout</button>}
        <p className="mt-6 text-sm">If the store needs to review your payment, keep this checkout reference: {reference.checkoutId || reference.paymentId}. Do not submit another payment.</p>
      </>}
  </section>;
}
