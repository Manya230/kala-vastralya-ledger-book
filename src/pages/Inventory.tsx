
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, FileUp, FileDown, Search, Edit, X, Trash2 } from 'lucide-react';
import { getProductsApi, createProductApi, updateProductApi, deleteProductApi, createCategoryApi, createManufacturerApi, exportProductsApi, importProductsApi } from '@/lib/api';
import { useAppContext, Product } from '@/contexts/AppContext';

const Inventory = () => {
  const queryClient = useQueryClient();
  const { categories, manufacturers, refreshCategories, refreshManufacturers } = useAppContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddManufacturerOpen, setIsAddManufacturerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // Form states
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProductsApi
  });
  
  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: createProductApi,
    onSuccess: () => {
      toast.success('Product added successfully');
      setIsAddProductOpen(false);
      resetProductForm();
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      console.error('Failed to add product:', error);
      if (error.message === 'Product with this barcode already exists') {
        toast.error('Product with this barcode already exists');
      } else {
        toast.error('Failed to add product');
      }
    }
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: (product: { id: number, data: any }) => {
      return updateProductApi(product.id, product.data);
    },
    onSuccess: () => {
      toast.success('Product updated successfully');
      setIsEditProductOpen(false);
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      console.error('Failed to update product:', error);
      toast.error('Failed to update product');
    }
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => {
      return deleteProductApi(id);
    },
    onSuccess: () => {
      toast.success('Product deleted successfully');
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
    }
  });
  
  // Add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: createCategoryApi,
    onSuccess: () => {
      toast.success('Category added successfully');
      setCategoryName('');
      refreshCategories();
      setIsAddCategoryOpen(false);
    },
    onError: (error) => {
      console.error('Failed to add category:', error);
      toast.error('Failed to add category');
    }
  });
  
  // Add manufacturer mutation
  const addManufacturerMutation = useMutation({
    mutationFn: createManufacturerApi,
    onSuccess: () => {
      toast.success('Manufacturer added successfully');
      setManufacturerName('');
      refreshManufacturers();
      setIsAddManufacturerOpen(false);
    },
    onError: (error) => {
      console.error('Failed to add manufacturer:', error);
      toast.error('Failed to add manufacturer');
    }
  });
  
  // Import products mutation
  const importProductsMutation = useMutation({
    mutationFn: importProductsApi,
    onSuccess: (data) => {
      toast.success(`${data.message}`);
      setImportFile(null);
      setIsImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      refreshCategories();
      refreshManufacturers();
      
      if (data.errors && data.errors.length > 0) {
        console.error('Import errors:', data.errors);
      }
    },
    onError: (error) => {
      console.error('Failed to import products:', error);
      toast.error('Failed to import products');
    }
  });
  
  // Handle form submission for adding product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!barcode || !categoryId || !manufacturerId || !quantity || !costPrice || !salePrice) {
      toast.error('All fields are required');
      return;
    }
    
    if (barcode.length !== 8) {
      toast.error('Barcode must be 8 digits');
      return;
    }
    
    addProductMutation.mutate({
      barcode,
      category_id: parseInt(categoryId),
      manufacturer_id: parseInt(manufacturerId),
      quantity: parseInt(quantity),
      cost_price: parseFloat(costPrice),
      sale_price: parseFloat(salePrice)
    });
  };

  // Handle form submission for editing product
  const handleEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct || !categoryId || !manufacturerId || !quantity || !costPrice || !salePrice) {
      toast.error('All fields are required');
      return;
    }
    
    updateProductMutation.mutate({
      id: editingProduct.id,
      data: {
        category_id: parseInt(categoryId),
        manufacturer_id: parseInt(manufacturerId),
        quantity: parseInt(quantity),
        cost_price: parseFloat(costPrice),
        sale_price: parseFloat(salePrice)
      }
    });
  };

  // Handle delete product
  const handleDeleteProduct = () => {
    if (!productToDelete) return;
    
    deleteProductMutation.mutate(productToDelete.id);
  };
  
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryName) {
      toast.error('Category name is required');
      return;
    }
    
    addCategoryMutation.mutate(categoryName);
  };
  
  const handleAddManufacturer = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manufacturerName) {
      toast.error('Manufacturer name is required');
      return;
    }
    
    addManufacturerMutation.mutate(manufacturerName);
  };
  
  const handleImportProducts = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!importFile) {
      toast.error('Please select a file');
      return;
    }
    
    importProductsMutation.mutate(importFile);
  };
  
  const handleExportProducts = () => {
    exportProductsApi();
    toast.success('Exporting products');
  };

  // Setup edit product form
  const setupEditProduct = (product: Product) => {
    setEditingProduct(product);
    setCategoryId(categories.find(c => c.name === product.category)?.id.toString() || '');
    setManufacturerId(manufacturers.find(m => m.name === product.manufacturer)?.id.toString() || '');
    setQuantity(product.quantity.toString());
    setCostPrice(product.cost_price.toString());
    setSalePrice(product.sale_price.toString());
    setIsEditProductOpen(true);
  };

  // Setup delete product confirmation
  const confirmDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };
  
  const resetProductForm = () => {
    setBarcode('');
    setCategoryId('');
    setManufacturerId('');
    setQuantity('');
    setCostPrice('');
    setSalePrice('');
  };
  
  // Handle barcode input validation
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and limit to 8 digits
    if (/^\d*$/.test(value) && value.length <= 8) {
      setBarcode(value);
    }
  };
  
  // Filter products based on search
  const filteredProducts = searchQuery
    ? products.filter((product: Product) => 
        product.barcode.includes(searchQuery) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;
  
  return (
    <Layout>
      <Card title="Inventory">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <div className="flex items-center gap-2 flex-grow">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search by barcode, category or manufacturer..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => setIsImportOpen(true)} className="flex items-center gap-1">
              <FileUp size={16} />
              Import
            </Button>
            <Button onClick={handleExportProducts} className="flex items-center gap-1">
              <FileDown size={16} />
              Export
            </Button>
            <Button onClick={() => setIsAddProductOpen(true)} className="flex items-center gap-1">
              <Plus size={16} />
              Add Product
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-2 text-left">Barcode</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Manufacturer</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-right">Cost Price</th>
                <th className="px-4 py-2 text-right">Sale Price</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-center">Loading...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-center">No products found</td>
                </tr>
              ) : (
                filteredProducts.map((product: Product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{product.barcode}</td>
                    <td className="px-4 py-2">{product.category}</td>
                    <td className="px-4 py-2">{product.manufacturer}</td>
                    <td className="px-4 py-2 text-right">{product.quantity}</td>
                    <td className="px-4 py-2 text-right">₹{product.cost_price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">₹{product.sale_price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => setupEditProduct(product)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => confirmDeleteProduct(product)}
                          className="p-1 text-gray-500 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddProduct}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="barcode" className="block text-sm font-medium mb-1">
                  Barcode (8 digits) *
                </label>
                <Input
                  id="barcode"
                  placeholder="Enter 8-digit barcode"
                  value={barcode}
                  onChange={handleBarcodeChange}
                  maxLength={8}
                />
              </div>
              
              <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <label htmlFor="category" className="block text-sm font-medium mb-1">
                    Category *
                  </label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="button" onClick={() => setIsAddCategoryOpen(true)}>
                  <Plus size={16} />
                </Button>
              </div>
              
              <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <label htmlFor="manufacturer" className="block text-sm font-medium mb-1">
                    Manufacturer *
                  </label>
                  <Select value={manufacturerId} onValueChange={setManufacturerId}>
                    <SelectTrigger id="manufacturer">
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((manufacturer) => (
                        <SelectItem key={manufacturer.id} value={manufacturer.id.toString()}>
                          {manufacturer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="button" onClick={() => setIsAddManufacturerOpen(true)}>
                  <Plus size={16} />
                </Button>
              </div>
              
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                  Quantity *
                </label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                />
              </div>
              
              <div>
                <label htmlFor="costPrice" className="block text-sm font-medium mb-1">
                  Cost Price (₹) *
                </label>
                <Input
                  id="costPrice"
                  type="number"
                  placeholder="Enter cost price"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label htmlFor="salePrice" className="block text-sm font-medium mb-1">
                  Sale Price (₹) *
                </label>
                <Input
                  id="salePrice"
                  type="number"
                  placeholder="Enter sale price"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <Button type="submit" disabled={addProductMutation.isPending}>
                {addProductMutation.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleEditProduct}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="editBarcode" className="block text-sm font-medium mb-1">
                  Barcode
                </label>
                <Input
                  id="editBarcode"
                  value={editingProduct?.barcode || ''}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Barcode cannot be changed</p>
              </div>
              
              <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <label htmlFor="editCategory" className="block text-sm font-medium mb-1">
                    Category *
                  </label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="editCategory">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="button" onClick={() => setIsAddCategoryOpen(true)}>
                  <Plus size={16} />
                </Button>
              </div>
              
              <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <label htmlFor="editManufacturer" className="block text-sm font-medium mb-1">
                    Manufacturer *
                  </label>
                  <Select value={manufacturerId} onValueChange={setManufacturerId}>
                    <SelectTrigger id="editManufacturer">
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((manufacturer) => (
                        <SelectItem key={manufacturer.id} value={manufacturer.id.toString()}>
                          {manufacturer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="button" onClick={() => setIsAddManufacturerOpen(true)}>
                  <Plus size={16} />
                </Button>
              </div>
              
              <div>
                <label htmlFor="editQuantity" className="block text-sm font-medium mb-1">
                  Quantity *
                </label>
                <Input
                  id="editQuantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                />
              </div>
              
              <div>
                <label htmlFor="editCostPrice" className="block text-sm font-medium mb-1">
                  Cost Price (₹) *
                </label>
                <Input
                  id="editCostPrice"
                  type="number"
                  placeholder="Enter cost price"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label htmlFor="editSalePrice" className="block text-sm font-medium mb-1">
                  Sale Price (₹) *
                </label>
                <Input
                  id="editSalePrice"
                  type="number"
                  placeholder="Enter sale price"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <Button type="submit" disabled={updateProductMutation.isPending}>
                {updateProductMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddCategory}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="categoryName" className="block text-sm font-medium mb-1">
                  Category Name *
                </label>
                <Input
                  id="categoryName"
                  placeholder="Enter category name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>
              
              <Button type="submit" disabled={addCategoryMutation.isPending}>
                {addCategoryMutation.isPending ? 'Adding...' : 'Add Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Add Manufacturer Dialog */}
      <Dialog open={isAddManufacturerOpen} onOpenChange={setIsAddManufacturerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Manufacturer</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddManufacturer}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="manufacturerName" className="block text-sm font-medium mb-1">
                  Manufacturer Name *
                </label>
                <Input
                  id="manufacturerName"
                  placeholder="Enter manufacturer name"
                  value={manufacturerName}
                  onChange={(e) => setManufacturerName(e.target.value)}
                />
              </div>
              
              <Button type="submit" disabled={addManufacturerMutation.isPending}>
                {addManufacturerMutation.isPending ? 'Adding...' : 'Add Manufacturer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleImportProducts}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="importFile" className="block text-sm font-medium mb-1">
                  Excel File *
                </label>
                <Input
                  id="importFile"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => e.target.files && setImportFile(e.target.files[0])}
                />
                <p className="text-xs text-gray-500 mt-1">
                  File must contain columns: barcode, category, manufacturer, quantity, cost_price, sale_price
                </p>
              </div>
              
              <Button type="submit" disabled={importProductsMutation.isPending}>
                {importProductsMutation.isPending ? 'Importing...' : 'Import Products'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <p><strong>Barcode:</strong> {productToDelete?.barcode}</p>
                <p><strong>Category:</strong> {productToDelete?.category}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProduct}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Inventory;
