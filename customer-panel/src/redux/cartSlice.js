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

            // Normalize price: If item has no base price but has a sale price, use sale price as base price
            // This fixes issues where admin sets price to null but provides a sale price
            if ((!item.price || item.price === 0) && item.priceSale) {
                item.price = item.priceSale;
            }

            // Check if product already exists in cart
            const existing = state.cartItems.find(i => i.id === item.id);

            if (existing) {
                // Update existing item properties to ensure latest price/info is used
                existing.quantity += item.quantity;
                existing.price = item.price; // Will now hold the normalized valid price
                existing.priceSale = item.priceSale;
                existing.salePrice = item.salePrice;
                existing.image = item.image;
                existing.name = item.name;
            } else {
                state.cartItems.push(item);
            }

            // Sync to localStorage
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
        updateQuantity: (state, action) => {
            const { id, quantity } = action.payload;
            const item = state.cartItems.find((i) => i.id === id);
            if (item) item.quantity = quantity;
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },
    },
});

export const { addToCart, removeFromCart, clearCart, updateQuantity } = cartSlice.actions;
export default cartSlice.reducer;
