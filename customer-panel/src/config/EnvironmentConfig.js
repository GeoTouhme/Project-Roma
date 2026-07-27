const dev = {
  BASE_URL: "https://balportliquors.com/",
  // API_ENDPOINT_URL: "http://localhost:5001",
  API_ENDPOINT_URL: process.env.REACT_APP_API_URL || "",
};
const prod = {
  BASE_URL: "https://balportliquors.com/",
  // API_ENDPOINT_URL: "http://localhost:5001",
  API_ENDPOINT_URL: process.env.REACT_APP_API_URL || "",
};

const test = {
  BASE_URL: "https://balportliquors.com/",
  // API_ENDPOINT_URL: "http://localhost:5001",
  API_ENDPOINT_URL: process.env.REACT_APP_API_URL || "",
};

const getEnv = () => {
  switch (process.env.NODE_ENV) {
    case "development":
      return { ...dev, API_ENDPOINT_URL: process.env.REACT_APP_API_URL || dev.API_ENDPOINT_URL };
    case "production":
      return { ...prod, API_ENDPOINT_URL: process.env.REACT_APP_API_URL || prod.API_ENDPOINT_URL };
    case "test":
      return { ...test, API_ENDPOINT_URL: process.env.REACT_APP_API_URL || test.API_ENDPOINT_URL };
    default:
      break;
  }
};

export const env = getEnv();
