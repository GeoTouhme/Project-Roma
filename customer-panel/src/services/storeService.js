import axios from "axios";
import { API_BASE_URL } from "../config/AppConfig";

const storeService = {
  getStoreStatus: async () => {
    const response = await axios.get(`${API_BASE_URL}store/status`);
    return response.data;
  },
};

export default storeService;
