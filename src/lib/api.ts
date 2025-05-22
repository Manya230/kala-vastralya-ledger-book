import axios from 'axios';

// Change the base URL to point to the local development server
const BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add error handling to the API client
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Category API
export const getCategoriesApi = async () => {
  const response = await api.get('/categories');
  return response.data;
};

export const createCategoryApi = async (name: string) => {
  const response = await api.post('/categories', { name });
  return response.data;
};

// Manufacturer API
export const getManufacturersApi = async () => {
  const response = await api.get('/manufacturers');
  return response.data;
};

export const createManufacturerApi = async (name: string) => {
  const response = await api.post('/manufacturers', { name });
  return response.data;
};

// Product API
export const getProductsApi = async () => {
  const response = await api.get('/products');
  return response.data;
};

export const getProductByBarcodeApi = async (barcode: string) => {
  try {
    const response = await api.get(`/products/${barcode}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching product by barcode:', error);
    return null;
  }
};

export const createProductApi = async (product: {
  barcode: string;
  category_id: number;
  manufacturer_id: number;
  quantity: number;
  cost_price: number;
  sale_price: number;
}) => {
  const response = await api.post('/products', product);
  return response.data;
};

export const updateProductQuantityApi = async (id: number, quantity: number) => {
  const response = await api.patch(`/products/${id}/quantity`, { quantity });
  return response.data;
};

// Sales API
export const createSaleApi = async (sale: {
  type: string;
  customer_name?: string;
  mobile?: string;
  payment_mode?: string;
  remarks?: string;
  total_amount: number;
  total_discount?: number;
  final_amount: number;
  items: Array<{
    product_id: number;
    category_name: string;
    sale_price: number;
    quantity: number;
    item_final_price: number;
  }>;
}) => {
  const response = await api.post('/sales', sale);
  return response.data;
};

export const getSalesApi = async (params?: {
  date?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  search?: string;
}) => {
  const response = await api.get('/sales', { params });
  return response.data;
};

export const getSaleByIdApi = async (id: number) => {
  const response = await api.get(`/sales/${id}`);
  return response.data;
};

export const updateSaleApi = async (id: number, sale: {
  total_amount: number;
  total_discount?: number;
  final_amount: number;
  items: Array<{
    product_id: number;
    category_name: string;
    sale_price: number;
    quantity: number;
    item_final_price: number;
  }>;
}) => {
  const response = await api.put(`/sales/${id}`, sale);
  return response.data;
};

// Export/Import API
export const importProductsApi = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/import/products', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const exportProductsApi = () => {
  window.open(`${BASE_URL}/export/products`, '_blank');
};

export const exportSalesApi = (params?: {
  date?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  search?: string;
}) => {
  const queryParams = new URLSearchParams();
  
  if (params?.date) queryParams.append('date', params.date);
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.search) queryParams.append('search', params.search);
  
  window.open(`${BASE_URL}/export/sales?${queryParams.toString()}`, '_blank');
};

export default api;
