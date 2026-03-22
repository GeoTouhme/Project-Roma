import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isAuthenticated: localStorage.getItem("isAuthenticated") === "true",
  access_token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => {
      state.isAuthenticated = true;
      state.access_token = action.payload;
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("auth_token", action.payload);
    },
    logout: (state, action) => {
      state.isAuthenticated = false;
      state.access_token = null;
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      localStorage.setItem("isAuthenticated", "false");
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
