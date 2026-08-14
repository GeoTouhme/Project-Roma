import axios from "axios";
import { API_BASE_URL } from "../config/AppConfig";

const settingsService = {
  getSettings: async () => {
    const response = await axios.get(`${API_BASE_URL}settings`);
    return response.data;
  },
};

export default settingsService;
