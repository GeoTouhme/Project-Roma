import { loadStripe } from "@stripe/stripe-js";
import { STRIPE_PUBLIC_KEY } from "./AppConfig";

export const stripePromise = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null;
