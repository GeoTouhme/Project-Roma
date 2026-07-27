import { env } from "./EnvironmentConfig";

export const APP_NAME = "Liquor";
export const API_BASE_URL = env.API_ENDPOINT_URL + "/api/";
export const BASE_URL = env.BASE_URL;
export const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY || "";