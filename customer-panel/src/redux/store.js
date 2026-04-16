import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import cartReducer from "./cartSlice";
import storeStatusReducer from "./storeStatusSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    storeStatus: storeStatusReducer,
  },
});

export default store;
