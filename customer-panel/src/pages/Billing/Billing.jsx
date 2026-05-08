import React, { useState, useEffect, useRef } from "react";
import Product from "../../assets/images/product.png";
import { useDispatch, useSelector } from "react-redux";
import PaymentService from "../../services/paymentService";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import OrderService from "../../services/orderService";
import { clearCart } from "../../redux/cartSlice";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const Billing = () => {
  let userInfo = null;
  try {
    const storedUser = localStorage.getItem("user");
    userInfo = storedUser ? JSON.parse(storedUser) : null;
  } catch (e) {
    localStorage.removeItem("user");
  }
  
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const { isOpen: storeIsOpen } = useSelector((state) => state.storeStatus);
  const subtotal = cartItems?.reduce((total, item) => total + (item.priceSale || item.salePrice || item.price || 0) * item.quantity, 0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userInfo?.email || "");
  const [zip, setZip] = useState("");
  const [isZipSupported, setIsZipSupported] = useState(true);
  const country = "US";
  const state = "CA";
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const [checkingQuote, setCheckingQuote] = useState(false);
  const [quoteVerified, setQuoteVerified] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [tip, setTip] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);

  // List of supported Zip Codes
  const supportedZipCodes = ["92663", "92646", "92612", "92647", "92661", "92707", "92648"];

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    if (window.google && addressInputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: "us" },
        fields: ["address_components", "geometry", "formatted_address"],
        types: ["address"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.address_components) return;

        let streetNumber = "";
        let route = "";
        let extractedCity = "";
        let extractedZip = "";

        for (const component of place.address_components) {
          const componentType = component.types[0];

          switch (componentType) {
            case "street_number":
              streetNumber = component.long_name;
              break;
            case "route":
              route = component.long_name;
              break;
            case "locality":
              extractedCity = component.long_name;
              break;
            case "postal_code":
              extractedZip = component.long_name;
              break;
            default:
              break;
          }
        }

        setAddress(`${streetNumber} ${route}`.trim());
        setCity(extractedCity);
        if (extractedZip) {
          handleZipChange(extractedZip);
        }
      });
    }
  }, []);

  const handleZipChange = (val) => {
    setZip(val);
    setErrors((prev) => ({ ...prev, zip: "" }));
    setQuoteVerified(false);
    setDeliveryFee(0); 
    
    if (val.length === 5) {
      if (!supportedZipCodes.includes(val)) {
        setIsZipSupported(false);
        // We only show this specific zip error because it's local validation
        setCheckoutError("Sorry, we don't deliver to this Zip Code yet.");
      } else {
        setIsZipSupported(true);
        setCheckoutError(null);
        // Only trigger background check if we have enough data, but don't show error yet if it fails
        if (address && phone && firstName) {
          checkDeliveryQuote(val, true); // true means 'silent' mode
        }
      }
    } else {
      setIsZipSupported(true);
      if (checkoutError?.includes("Zip Code")) {
         setCheckoutError(null);
      }
    }
  };

  const checkDeliveryQuote = async (zipCode = zip, silent = false) => {
    if (!address || !city || !zipCode || !phone || !firstName) {
      if (!silent) setCheckoutError("Please fill in all details to verify delivery.");
      return;
    }
    
    setCheckingQuote(true);
    if (!silent) setCheckoutError(null);
    setQuoteVerified(false);

    try {
      const response = await OrderService.getDeliveryQuote({
        user: { 
          firstName, 
          lastName, 
          phone, 
          address, 
          city, 
          state, 
          zip: zipCode, 
          country 
        },
        items: cartItems.map(item => ({ pid: item.id, quantity: item.quantity }))
      });

      if (response.success) {
        const fee = response.deliveryFee || 0;
        setDeliveryFee(fee);
        setQuoteVerified(true);
        setCheckoutError(null);
      } else {
        if (!silent) setCheckoutError(response.message || "Delivery not available for this address.");
      }
    } catch (err) {
      if (!silent) setCheckoutError(err?.response?.data?.message || "Delivery not available for this address.");
    } finally {
      setCheckingQuote(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!address.trim()) newErrors.address = "Address is required";
    if (!country.trim()) newErrors.country = "Country is required";
    if (!city.trim()) newErrors.city = "City is required";
    if (!state.trim()) newErrors.state = "State is required";

    if (!phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[0-9+\s()-]{7,15}$/.test(phone)) newErrors.phone = "Enter a valid phone number";

    const cleanZip = zip.trim();
    if (!cleanZip) {
      newErrors.zip = "Zip code is required";
    } else if (!/^\d{5}$/.test(cleanZip)) {
      newErrors.zip = "Enter a valid 5-digit Zip Code";
    } else if (!supportedZipCodes.includes(cleanZip)) {
      newErrors.zip = "We don't deliver to this area";
      setCheckoutError("Delivery not available for this area");
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0 || !isZipSupported || (cleanZip && !supportedZipCodes.includes(cleanZip))) return;

    if (!quoteVerified) {
      setCheckoutError("Please verify your delivery address first.");
      checkDeliveryQuote();
      return;
    }

    const user = {
      firstName,
      lastName,
      phone,
      email,
      address,
      city,
      state, // Optional
      country,
      zip,
    };

    const items = cartItems.map((item) => {
      const effectivePrice = item.priceSale || item.salePrice || item.price || 0;
      return {
        _id: item.id,
        name: item.name,
        brand: item.brand,
        slug: item.slug,
        price: item.price,
        priceSale: item.priceSale ?? null,
        available: null,
        pid: item.id,
        quantity: item.quantity,
        size: null,
        image: item.image,
        color: null,
        subtotal: (effectivePrice * item.quantity).toFixed(2),
        sku: item?.sku,
      };
    });

    const orderPayload = {
      paymentMethod: "Stripe",
      items,
      user,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      couponCode: null,
      shipping: deliveryFee.toString(),
      tip,
    };

    setProcessing(true);
    setCheckoutError(null);

    const cardElement = elements.getElement(CardElement);

    if (!stripe || !elements || !cardElement) {
      setCheckoutError("Stripe has not loaded yet.");
      setProcessing(false);
      return;
    }

    try {
      const clientSecret = await PaymentService.paymentIntentCreate({ amount: subtotal + deliveryFee + tip }).then(res => res.client_secret);

      const billingDetails = {
        name: `${firstName} ${lastName}`,
        email,
        phone,
        address: {
          city,
          country,
          line1: address,
          postal_code: zip,
        },
      };

      const paymentMethodReq = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: billingDetails,
      });

      if (paymentMethodReq.error) {
        setCheckoutError(paymentMethodReq.error.message);
        setProcessing(false);
        return;
      }

      const confirmRes = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethodReq.paymentMethod.id,
      });

      if (confirmRes.error) {
        setCheckoutError(confirmRes.error.message);
        setProcessing(false);
        return;
      }

      const orderResponse = await OrderService.creteOrder({
        ...orderPayload,
        paymentId: confirmRes.paymentIntent.id,
      });

      console.log("orderResponse= ", orderResponse?.orderId);
      toast.success("Order placed!")
      setProcessing(false);
      dispatch(clearCart());
      setTimeout(() => {
        if (orderResponse?.orderId)
          navigate(`/order/${orderResponse?.orderId}`)
      }, 1500);
    } catch (err) {
      console.log("err= ", err);
      toast.error(err?.response?.data?.message || 'Something went wrong');
      setCheckoutError(err?.response?.data?.message || 'Payment failed');
      setProcessing(false);
    }
  };

  const iframeStyles = {
    base: {
      color: '#111111', // black from your theme
      fontSize: '16px',
      fontFamily: 'Jost, sans-serif',
      iconColor: '#B5223B', // primary color
      '::placeholder': {
        color: '#777777' // grey_text from your theme
      }
    },
    invalid: {
      color: '#dc2626', // red-600 from Tailwind (for error)
      iconColor: '#dc2626'
    },
    complete: {
      color: '#111111', // black
      iconColor: '#16a34a' // green-600 from Tailwind
    }
  };

  const cardElementOpts = {
    iconStyle: 'solid',
    style: iframeStyles,
    hidePostalCode: true
  };

  return (
    <div className="container md:pb-[100px] pb-[40px]">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Section - Billing Details */}
        <div className="md:w-2/3 p-6 rounded-lg">
          <h2 className="text-3xl font-semibold mb-4">Billing Details</h2>


          <form action="">

            <div className="grid grid-cols-1 gap-4">
              {/* First Name and Last Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setErrors((prev) => ({ ...prev, firstName: "" }));
                    }}
                    className={`border rounded-lg h-11 p-3 w-full ${errors.firstName ? "border-red-500" : ""}`}
                    placeholder="Enter your first name"
                  />
                  {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block font-semibold">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setErrors((prev) => ({ ...prev, lastName: "" }));
                    }}
                    className={`border rounded-lg h-11 p-3 w-full ${errors.lastName ? "border-red-500" : ""}`}
                    placeholder="Enter your last name"
                  />
                  {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block font-semibold">Address</label>
                <input
                  type="text"
                  ref={addressInputRef}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setErrors((prev) => ({ ...prev, address: "" }));
                    setQuoteVerified(false);
                    setDeliveryFee(0);
                  }}
                  className={`border rounded-lg h-11 p-3 w-full ${errors.address ? "border-red-500" : ""}`}
                  placeholder="Start typing your address..."
                />
                {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
              </div>

              {/* Country and City */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setErrors((prev) => ({ ...prev, city: "" }));
                      setQuoteVerified(false);
                      setDeliveryFee(0);
                    }}
                    className={`border rounded-lg h-11 p-3 w-full ${errors.city ? "border-red-500" : ""}`}
                    placeholder="Enter city"
                  />
                  {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                </div>
                {/* State */}
                <div>
                  <label className="block font-semibold">State</label>
                  <select
                    value={state}
                    disabled
                    className="bg-gray-100 cursor-not-allowed border rounded-lg h-11 p-2 w-full"
                  >
                    <option value="CA">California</option>
                  </select>
                </div>

                {/* Zip Code */}
                <div>
                  <label className="block font-semibold">Zip Code</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => handleZipChange(e.target.value)}
                    className={`border rounded-lg h-11 p-3 w-full ${errors.zip || !isZipSupported ? "border-red-500 bg-red-50" : ""}`}
                    placeholder="Enter zip code"
                  />
                  {(errors.zip || !isZipSupported) && (
                    <p className="text-red-500 text-sm mt-1">{errors.zip || "Delivery not available for this area"}</p>
                  )}
                </div>
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setErrors((prev) => ({ ...prev, phone: "" }));
                      setQuoteVerified(false);
                      setDeliveryFee(0);
                    }}
                    className={`border rounded-lg h-11 p-3 w-full ${errors.phone ? "border-red-500" : ""}`}
                    placeholder="Enter your phone number"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block font-semibold">Email</label>
                  <input
                    disabled
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    className={`cursor-not-allowed bg-white border rounded-lg h-11 p-3 w-full ${errors.email ? "border-red-500" : ""}`}
                    placeholder="Enter your email"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block font-semibold">Country</label>
                <select
                  value={country}
                  disabled
                  className="bg-gray-100 cursor-not-allowed border rounded-lg h-11 p-2 w-full"
                >
                  <option value="US">United States</option>
                </select>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Payment Method</h3>
              <div className="border rounded p-4 bg-gray-50">
                {/* Stripe Only */}
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment"
                    value="Stripe"
                    checked={true}
                    readOnly
                    className="h-5 w-5 accent-[#B5223B]"
                  />
                  <span className="font-semibold text-[#B5223B]">
                    Secure Card Payment (Stripe)
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2 ml-7">
                  We only accept card payments to ensure secure delivery and prevent fraud.
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Right Section - Order Summary */}
        <div className="md:w-1/3 p-6 rounded-lg">
          <div className="border border-[#CECECE] rounded-lg p-4">
            {/* Product */}
            {cartItems.map((item, index) => (
              <div key={index} className="flex justify-between items-start mb-4">
                {/* Left: Image and Name */}
                <div className="flex items-start gap-4">
                  <img src={item.image || Product} alt={item.name} className="w-12 h-12 object-cover rounded" />
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <div className="text-sm text-gray-500 flex items-center gap-4">
                      <p>
                        <span className="font-medium text-gray-600">Qty:</span> {item.quantity}
                      </p>
                      <p>
                        <span className="font-medium text-gray-600">Price:</span> ${item.priceSale || item.salePrice || item.price || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Total */}
                <p className="font-semibold text-right">${((item.priceSale || item.salePrice || item.price || 0) * item.quantity).toFixed(2)}</p>
              </div>
            ))}

            <hr />

            {/* Order Summary Details */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <p>Subtotal:</p>
                <p className="font-semibold">${subtotal.toFixed(2)}</p>
              </div>
              <div className="flex justify-between">
                <p>Delivery Fee:</p>
                <p className="font-semibold">
                  {deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : "Free"}
                </p>
              </div>
              {!quoteVerified && (
                <p className="text-xs text-gray-400 italic">
                  Delivery fee calculated after address verification
                </p>
              )}
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <p>Total:</p>
                <p>${(subtotal + deliveryFee + tip).toFixed(2)}</p>
              </div>
            </div>

            {/* Driver Tip */}
            <div className="mt-2">
              <p className="font-semibold mb-1">Driver Tip</p>
              <div className="flex gap-2">
                {[0, 2, 3, 5].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTip(amount)}
                    className={`px-3 py-1 rounded-lg border text-sm font-semibold transition-colors ${
                      tip === amount
                        ? "bg-[#B5223B] text-white border-[#B5223B]"
                        : "bg-white text-gray-700 border-gray-300 hover:border-[#B5223B]"
                    }`}
                  >
                    {amount === 0 ? "No tip" : `$${amount}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Stripe card input */}
            <div className="mt-4 border rounded p-4">
              <label className="block font-semibold mb-2">Card Details</label>
              <CardElement options={cardElementOpts} onChange={() => setCheckoutError(null)} />
            </div>
            {checkoutError && <p className="text-red-500 font-semibold mb-2">{checkoutError}</p>}
            {quoteVerified && !checkoutError && <p className="text-green-600 font-semibold mb-2 flex items-center gap-1">✅ Delivery address verified</p>}
            {checkingQuote && <p className="text-blue-600 font-semibold mb-2 animate-pulse">Checking delivery availability...</p>}
            
            {/* Place Order Button */}
            {cartItems.length > 0 && <div className="w-full flex flex-col items-end">
              <div className="text-xs text-gray-500 mb-2 text-right max-w-[300px]">
                By placing this order, you agree to our terms and that your personal data may be processed by our delivery partner for the purpose of identity verification as required by law.
              </div>
              <button
                disabled={processing || checkingQuote || !isZipSupported || !storeIsOpen}
                onClick={handleSubmit}
                className={`mt-2 ${processing || checkingQuote || !isZipSupported || !storeIsOpen ? "bg-[#B5223B]/50 cursor-not-allowed" : "bg-[#B5223B]"} text-white px-6 py-3 rounded-lg w-full md:w-auto font-bold uppercase tracking-wider`}
              >
                {processing ? "Placing Order.." : checkingQuote ? "Verifying..." : !quoteVerified ? "Verify Delivery" : "Place Order"}
              </button>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Billing;
