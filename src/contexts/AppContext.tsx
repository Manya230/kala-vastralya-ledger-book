
import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getCategoriesApi, getManufacturersApi } from '@/lib/api';

// Define types
export interface Category {
  id: number;
  name: string;
}

export interface Manufacturer {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  barcode: string;
  quantity: number;
  cost_price: number;
  sale_price: number;
  category: string;
  manufacturer: string;
  category_id: number;
  manufacturer_id: number;
}

export interface CartItem {
  product_id: number;
  barcode: string;
  category_name: string;
  sale_price: number;
  quantity: number;
  item_final_price: number;
}

interface AppContextType {
  categories: Category[];
  manufacturers: Manufacturer[];
  refreshCategories: () => Promise<void>;
  refreshManufacturers: () => Promise<void>;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Create provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);

  const refreshCategories = async () => {
    try {
      const data = await getCategoriesApi();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const refreshManufacturers = async () => {
    try {
      const data = await getManufacturersApi();
      setManufacturers(data);
    } catch (error) {
      console.error('Failed to fetch manufacturers:', error);
      toast.error('Failed to load manufacturers');
    }
  };

  // Load initial data
  useEffect(() => {
    refreshCategories();
    refreshManufacturers();
  }, []);

  return (
    <AppContext.Provider
      value={{
        categories,
        manufacturers,
        refreshCategories,
        refreshManufacturers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Create custom hook
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
