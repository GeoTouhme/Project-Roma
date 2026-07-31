import axios from 'axios';

// Get API URL from environment variable or use default
const envUrl = import.meta.env.VITE_API_URL;
export const API_URL = typeof envUrl === 'string' ? envUrl : 'https://balportliquors.com';

// Create axios instance with default config
// 🛡️ SECURITY: withCredentials sends the HttpOnly JWT cookie automatically.
// Do not read the token from localStorage or inject an Authorization header.
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Handle unauthorized access
            localStorage.removeItem('admin_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// API helper functions
export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/api/auth/login', { email, password }),

    register: (userData: any) =>
        api.post('/api/auth/register', userData),

    logout: () =>
        api.post('/api/auth/logout'),

    setupMfa: () =>
        api.post('/api/auth/setup-mfa'),

    confirmMfa: (code: string) =>
        api.post('/api/auth/confirm-mfa', { code }),

    verifyMfa: (tempToken: string, code: string) =>
        api.post('/api/auth/verify-mfa', { tempToken, code }),

    disableMfa: (code: string) =>
        api.post('/api/auth/disable-mfa', { code }),
};

export const userAPI = {
    getProfile: () =>
        api.get('/api/users/profile'),

    updateProfile: (userData: any) =>
        api.put('/api/users/profile', userData),

    changePassword: (passwordData: any) =>
        api.put('/api/users/change-password', passwordData),
};

export const dashboardAPI = {
    getAnalytics: () =>
        api.get('/api/admin/dashboard-analytics'),

    getNotifications: () =>
        api.get('/api/admin/notifications'),
};

export const ordersAPI = {
    getOrders: (params?: any) =>
        api.get('/api/admin/orders', { params }),

    getOrderById: (id: string) =>
        api.get(`/api/admin/orders/${id}`),

    updateOrder: (id: string, data: any) =>
        api.put(`/api/admin/orders/${id}`, data),

    acceptOrder: (id: string) =>
        api.put(`/api/admin/orders/${id}/accept`),

    denyOrder: (id: string, reason: string) =>
        api.put(`/api/admin/orders/${id}/deny`, { reason }),

    deleteOrder: (id: string) =>
        api.delete(`/api/admin/orders/${id}`),
};

export const productsAPI = {
    getProducts: (params?: any) =>
        api.get('/api/admin/products', { params }),

    getProductById: (id: string) =>
        api.get(`/api/admin/products/${id}`),

    createProduct: (data: any) =>
        api.post('/api/admin/products', data),

    updateProduct: (id: string, data: any) =>
        api.put(`/api/admin/products/${id}`, data),

    deleteProduct: (id: string) =>
        api.delete(`/api/admin/products/${id}`),

    exportCSV: () =>
        api.get('/api/admin/products/export-csv', { responseType: 'blob' }),

    importCSV: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/api/admin/products/import-csv', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

export const customersAPI = {
    getCustomers: (params?: any) =>
        api.get('/api/admin/users', { params }),

    getCustomerById: (id: string) =>
        api.get(`/api/admin/users/${id}`),

    updateCustomerRole: (id: string) =>
        api.put(`/api/admin/users/${id}/role`),

    deleteCustomer: (id: string) =>
        api.delete(`/api/admin/users/${id}`),

    updateCustomer: (id: string, data: any) =>
        api.put(`/api/admin/users/${id}`, data),
};

export const categoriesAPI = {
    getCategories: (params?: any) =>
        api.get('/api/admin/categories', { params }),

    getCategoryBySlug: (slug: string) =>
        api.get(`/api/admin/categories/${slug}`),

    createCategory: (data: any) =>
        api.post('/api/admin/categories', data),

    updateCategory: (slug: string, data: any) =>
        api.put(`/api/admin/categories/${slug}`, data),

    deleteCategory: (slug: string) =>
        api.delete(`/api/admin/categories/${slug}`),
};

export const brandsAPI = {
    getBrands: (params?: any) =>
        api.get('/api/admin/brands', { params }),

    getBrandBySlug: (slug: string) =>
        api.get(`/api/admin/brands/${slug}`),

    createBrand: (data: any) =>
        api.post('/api/admin/brands', data),

    updateBrand: (slug: string, data: any) =>
        api.put(`/api/admin/brands/${slug}`, data),

    deleteBrand: (slug: string) =>
        api.delete(`/api/admin/brands/${slug}`),
};

export const subCategoriesAPI = {
    getSubCategories: (params?: any) =>
        api.get('/api/admin/subcategories', { params }),

    getSubCategoryBySlug: (slug: string) =>
        api.get(`/api/admin/subcategories/${slug}`),

    createSubCategory: (data: any) =>
        api.post('/api/admin/subcategories', data),

    updateSubCategory: (slug: string, data: any) =>
        api.put(`/api/admin/subcategories/${slug}`, data),

    deleteSubCategory: (slug: string) =>
        api.delete(`/api/admin/subcategories/${slug}`),
};

export const uploadAPI = {
    uploadImage: (formData: FormData) =>
        api.post('/api/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }),
    deleteImage: (id: string) =>
        api.delete(`/api/delete-file/${encodeURIComponent(id)}`),
};

export const getSettings = () => api.get('/api/settings');
export const updateSettings = (data: any) => api.put('/api/settings', data);

export const analyticsAPI = {
    getAnalytics: () =>
        api.get('/api/admin/analytics'),
};

export const newsletterAPI = {
    getNewsletters: (params?: any) =>
        api.get('/api/admin/newsletter', { params }),
};

