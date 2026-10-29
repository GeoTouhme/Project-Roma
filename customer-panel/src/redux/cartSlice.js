import { createSlice } from "@reduxjs/toolkit";

// Read cart from localStorage if exists
const getInitialCart = () => {
  try {
    const data = localStorage.getItem("cartItems");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    localStorage.removeItem("cartItems");
    return [];
  }
};

const cartFromLocalStorage = getInitialCart();

const cartSlice = createSlice({
    name: "cart",
    initialState: {
        cartItems: cartFromLocalStorage,
    },
    reducers: {
        addToCart: (state, action) => {
            const item = action.payload;

            // Keep raw price fields untouched — pricing semantics (null base price
            // with sale-only price, active flash sales) are resolved by
            // sellingPrice() at render/total time and recalculated from the DB
            // server-side at checkout. Never mutate price here.

            // Check if product already exists in cart
            const existing = state.cartItems.find(i => i.id === item.id);

            if (existing) {
                // Update existing item properties to ensure latest price/info is used
                existing.quantity += item.quantity;
                existing.price = item.price; // Will now hold the normalized valid price
                existing.priceSale = item.priceSale;
                existing.salePrice = item.salePrice;
                existing.saleEndsAt = item.saleEndsAt;
                existing.image = item.image;
                existing.name = item.name;
            } else {
                state.cartItems.push(item);
            }

            // Sync to localStorage
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },
        addBundleToCart: (state, action) => {
            const bundle = action.payload;
            const existing = state.cartItems.find(i => i.id === bundle.id && i.type === 'bundle');
            if (existing) {
                existing.quantity += bundle.quantity || 1;
            } else {
                state.cartItems.push(bundle);
            }
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },
        removeFromCart: (state, action) => {
            state.cartItems = state.cartItems.filter(i => i.id !== action.payload);
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },
        clearCart: (state) => {
            state.cartItems = [];
            localStorage.removeItem("cartItems");
        },
        applyPriceRefresh: (state, action) => {
            const allowedFields = ['price', 'priceSale', 'salePrice', 'saleEndsAt', 'name', 'slug', 'image', 'available', 'pricingStatus'];
            action.payload.forEach(update => {
                state.cartItems.filter(item => item.id === update.id).forEach(item => {
                    allowedFields.forEach(field => {
                        if (Object.prototype.hasOwnProperty.call(update, field)) item[field] = update[field];
                    });
                });
            });
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },
        updateQuantity: (state, action) => {
            const { id, quantity } = action.payload;
            const item = state.cartItems.find((i) => i.id === id);
            if (item) item.quantity = quantity;
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },
    },
});

export const { addToCart, addBundleToCart, removeFromCart, clearCart, updateQuantity, applyPriceRefresh } = cartSlice.actions;
export default cartSlice.reducer;
