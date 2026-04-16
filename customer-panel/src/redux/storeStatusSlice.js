import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import storeService from "../services/storeService";

export const fetchStoreStatus = createAsyncThunk(
  "storeStatus/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await storeService.getStoreStatus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Failed to fetch store status" });
    }
  }
);

const storeStatusSlice = createSlice({
  name: "storeStatus",
  initialState: {
    isOpen: true,
    message: "",
    schedule: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearStoreError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStoreStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStoreStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.isOpen = action.payload.isOpen;
        state.message = action.payload.message || "";
        state.schedule = action.payload.schedule || [];
      })
      .addCase(fetchStoreStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch store status";
        // Fail open if we can't get store status
        state.isOpen = true;
      });
  },
});

export const { clearStoreError } = storeStatusSlice.actions;
export default storeStatusSlice.reducer;
