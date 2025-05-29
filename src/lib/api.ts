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

export const getManufacturersApi = async () => {
  const response = await api.get('/manufacturers');
  return response.data;
};

export const createManufacturerApi = async (name: string) => {
  const response = await api.post('/manufacturers', { name });
  return response.data;
};

export const getProductsApi = async () => {
  const response = await api.get('/products');
  return response.data;
};

export const getProductByBarcodeApi = async (barcode: string) => {
  if (!barcode) {
    return null;
  }
  
  try {
    const response = await api.get(`/products/barcode/${barcode}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching product by barcode:', error);
    throw error;
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
  try {
    const response = await api.post('/products', product);
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 409) {
      throw new Error('Product with this barcode already exists');
    }
    throw error;
  }
};

export const updateProductApi = async (id: number, product: {
  barcode?: string;
  category_id?: number;
  manufacturer_id?: number;
  quantity?: number;
  cost_price?: number;
  sale_price?: number;
}) => {
  const response = await api.patch(`/products/${id}`, product);
  return response.data;
};

export const deleteProductApi = async (id: number) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

export const updateProductQuantityApi = async (id: number, quantity: number) => {
  const response = await api.patch(`/products/${id}/quantity`, { quantity });
  return response.data;
};

// Define TypeScript interfaces for the API responses
export interface SaleItem {
  id: number;
  product_id: number;
  barcode: string;
  category_name: string;
  sale_price: number;
  quantity: number;
  item_final_price: number;
}

export interface Sale {
  id: number;
  type: string;
  number: string;
  customer_name: string;
  mobile: string | null;
  payment_mode: string | null;
  date: string;
  total_amount: number;
  total_discount: number;
  final_amount: number;
  remarks?: string | null;
  items?: SaleItem[];
}

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
  customer_address?: string; // <-- add this
  customer_gstin?: string;   // <-- and this
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
}): Promise<Sale[]> => {
  const response = await api.get('/sales', { params });
  return response.data;
};

export const getSaleByIdApi = async (id: number): Promise<Sale> => {
  console.log(`Fetching sale with id: ${id}`);
  try {
    const response = await api.get(`/sales/${id}`);
    console.log('Sale details response:', response.data);
    
    if (!response.data.items || !Array.isArray(response.data.items) || response.data.items.length === 0) {
      console.warn(`Sale ${id} has no items or items is not an array`, response.data);
    } else {
      console.log(`Sale ${id} has ${response.data.items.length} items`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching sale ${id}:`, error);
    throw error;
  }
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
}): Promise<Sale> => {
  const response = await api.put(`/sales/${id}`, sale);
  return response.data;
};

export const deleteSaleApi = async (id: number): Promise<void> => {
  const response = await api.delete(`/sales/${id}`);
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
