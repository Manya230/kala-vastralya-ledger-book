import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSalesApi, getSaleByIdApi, exportSalesApi, updateSaleApi, updateProductQuantityApi, deleteSaleApi } from '@/lib/api';
import { Search, Calendar, FileDown, X, Plus, Minus, Trash2, Printer } from 'lucide-react';

interface Sale {
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
  customer_address?: string | null;
  customer_gstin?: string | null;
}

interface SaleItem {
  id: number;
  product_id: number;
  barcode: string;
  category_name: string;
  sale_price: number;
  quantity: number;
  item_final_price: number;
}

interface SaleDetail extends Sale {
  remarks: string | null;
  items: SaleItem[];
}

const SalesReport = () => {
  const queryClient = useQueryClient();

  // Filter states
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'daily' | 'range'>('daily');
  
  // Details dialog state
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [editedItems, setEditedItems] = useState<SaleItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  
  // Fetch sales
  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['sales', viewMode, dateFilter, startDate, endDate, activeTab, searchQuery],
    queryFn: () => {
      const params: Record<string, string> = {};
      
      if (viewMode === 'daily') {
        params.date = dateFilter;
      } else if (viewMode === 'range' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      
      if (activeTab !== 'all') {
        params.type = activeTab;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      return getSalesApi(params);
    }
  });
  
  // Fetch sale details
  const { data: saleDetail, isLoading: isLoadingDetails } = useQuery<SaleDetail | null>({
    queryKey: ['sale', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      const data = await getSaleByIdApi(selectedSaleId);
      console.log("Data received in queryFn:", data);
      return data as SaleDetail;
    },
    enabled: !!selectedSaleId,
    staleTime: 0,
    gcTime: 0
  });

  // Effect to set edited items when sale detail changes
  useEffect(() => {
    if (saleDetail && saleDetail.items) {
      console.log('Setting edited items from data:', saleDetail.items);
      setEditedItems(saleDetail.items);
    } else {
      console.log('No items found in sale detail');
      setEditedItems([]);
    }
  }, [saleDetail]);
  
  // Update sale mutation
  const updateSaleMutation = useMutation({
    mutationFn: async ({ id, updatedSale }: { id: number, updatedSale: any }) => {
      return updateSaleApi(id, updatedSale);
    },
    onSuccess: () => {
      toast.success('Sale updated successfully');
      queryClient.invalidateQueries({ queryKey: ['sale', selectedSaleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error('Error updating sale:', error);
      toast.error('Failed to update sale');
    }
  });
  
  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: number, quantity: number }) => {
      return updateProductQuantityApi(id, quantity);
    }
  });
  
  // Delete sale mutation
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: number) => {
      // Server will handle inventory restoration automatically
      return deleteSaleApi(saleId);
    },
    onSuccess: () => {
      toast.success('Sale deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setIsDeleteDialogOpen(false);
      setSaleToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    }
  });
  
  // Handle view sale details
  const handleViewDetails = (id: number) => {
    console.log('Viewing sale details for ID:', id);
    setSelectedSaleId(id);
    setIsDetailsOpen(true);
    setIsEditing(false);
  };
  
  // Handle print sale
  const handlePrintSale = async (sale: Sale) => {
    try {
      // Fetch full sale details including items and remarks
      const saleDetail = await getSaleByIdApi(sale.id) as SaleDetail;
      
      // Generate print content
      const printContent = generatePrintContent(saleDetail);
      
      // Open in new tab
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Error printing sale:', error);
      toast.error('Failed to print sale');
    }
  };
  
  // Generate print content - exact copy matching the bill format
  const generatePrintContent = (sale: SaleDetail) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print ${sale.type === 'bill' ? 'Bill' : 'Estimate'}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              font-size: 12px; 
            }
            .receipt { 
              max-width: 800px; 
              margin: 0 auto; 
              border: 2px solid black; 
              border-collapse: collapse;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            td, th {
              border: 1px solid black;
              padding: 8px;
              text-align: left;
              vertical-align: top;
            }
            .header-cell {
              text-align: center;
              font-weight: bold;
              font-size: 16px;
              padding: 10px;
            }
            .contact-info {
              text-align: center;
              padding: 8px;
              font-size: 11px;
            }
            .company-name {
              text-align: center;
              font-weight: bold;
              font-size: 18px;
              padding: 10px;
            }
            .customer-header {
              text-align: center;
              font-weight: bold;
              background-color: #f0f0f0;
            }
            .right-align {
              text-align: right;
            }
            .center-align {
              text-align: center;
            }
            .items-header {
              background-color: #f0f0f0;
              text-align: center;
              font-weight: bold;
            }
            .footer-text {
              font-size: 10px;
              padding: 5px;
            }
            .signatory {
              text-align: center;
              padding: 20px;
            }
            @media print { 
              body { margin: 0; padding: 10px; } 
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <table>
              <!-- Header -->
              <tr>
                <td class="header-cell" colspan="6">${sale.type === 'bill' ? 'BILL' : 'ESTIMATE'}</td>
              </tr>
              
              <!-- Contact and GSTIN Row -->
              <tr>
                <td colspan="3">Mob. 8007792000, 9416930965</td>
                <td colspan="3" class="right-align">GSTIN: 06AEBPY4971P1ZN</td>
              </tr>
              
              <!-- Company Name -->
              <tr>
                <td class="company-name" colspan="6">KALAN VASTRALYA</td>
              </tr>
              
              <!-- Address -->
              <tr>
                <td class="contact-info" colspan="6">254B, Opp RJS Plaza, Pataudi Road, Haily Mandi</td>
              </tr>
              
              <!-- Customer Details Header -->
              <tr>
                <td class="customer-header" colspan="6">Customer Details</td>
              </tr>
              
              <!-- Customer Info Row 1 -->
              <tr>
                <td><strong>Name</strong></td>
                <td colspan="2">${sale.customer_name}</td>
                <td><strong>${sale.type === 'bill' ? 'Bill' : 'Estimate'} No.:</strong></td>
                <td colspan="2">${sale.number}</td>
              </tr>
              
              <!-- Customer Info Row 2 -->
              <tr>
                <td><strong>Mobile No.</strong></td>
                <td colspan="2">${sale.mobile || ''}</td>
                <td><strong>Date:</strong></td>
                <td colspan="2">${format(new Date(sale.date), 'dd/MM/yyyy, h:mm:ss a')}</td>
              </tr>
              
              <!-- Customer Info Row 3 -->
              <tr>
                <td><strong>Address</strong></td>
                <td colspan="2">${sale.customer_address || ''}</td>
                <td colspan="3"></td>
              </tr>
              
              <!-- Customer Info Row 4 -->
              <tr>
                <td><strong>GSTIN Number</strong></td>
                <td colspan="2">${sale.customer_gstin || ''}</td>
                <td colspan="3"></td>
              </tr>
              
              <!-- Items Header -->
              <tr>
                <td class="items-header"><strong>Sr. No.</strong></td>
                <td class="items-header"><strong>Item</strong></td>
                <td class="items-header"><strong>Qty</strong></td>
                <td class="items-header"><strong>Rate</strong></td>
                <td class="items-header"><strong>Amount</strong></td>
                <td rowspan="${sale.items.length + (sale.type === 'bill' ? 6 : 4)}"></td>
              </tr>
              
              <!-- Items -->
              ${sale.items.map((item, index) => `
                <tr>
                  <td class="center-align">${index + 1}</td>
                  <td>${item.category_name}</td>
                  <td class="center-align">${item.quantity}</td>
                  <td class="right-align">₹ ${item.sale_price}</td>
                  <td class="right-align">₹ ${item.item_final_price}</td>
                </tr>
              `).join('')}
              
              ${sale.type === 'bill' ? `
                <!-- Tax Rows -->
                <tr>
                  <td colspan="2"><strong>SGST @ 2.5%</strong></td>
                  <td colspan="2" class="right-align">₹ ${(sale.final_amount * 0.023881).toFixed(2)}</td>
                  <td><strong>Total</strong></td>
                </tr>
                
                <tr>
                  <td colspan="2"><strong>CGST @ 2.5%</strong></td>
                  <td colspan="2" class="right-align">₹ ${(sale.final_amount * 0.023881).toFixed(2)}</td>
                  <td class="right-align">₹ ${sale.total_amount}</td>
                </tr>
              ` : ''}
              
              <!-- Total Discount -->
              <tr>
                <td colspan="4"></td>
                <td><strong>Total Discount</strong></td>
              </tr>
              
              <tr>
                <td colspan="4"></td>
                <td class="right-align">₹ ${sale.total_discount || 0}</td>
              </tr>
              
              <!-- Grand Total -->
              <tr>
                <td colspan="4"></td>
                <td><strong>Grand Total (incl taxes)</strong></td>
              </tr>
              
              <tr>
                <td colspan="4"></td>
                <td class="right-align">₹ ${sale.final_amount}</td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td class="footer-text" colspan="3">
                  Thank you for shopping.<br>
                  (Goods once sold will not be taken back.)
                </td>
                <td class="signatory" colspan="3">
                  Auth. Signatory
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  };
  
  // Handle export
  const handleExport = () => {
    const params: Record<string, string> = {};
    
    if (viewMode === 'daily') {
      params.date = dateFilter;
    } else if (viewMode === 'range' && startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    
    if (activeTab !== 'all') {
      params.type = activeTab;
    }
    
    if (searchQuery) {
      params.search = searchQuery;
    }
    
    exportSalesApi(params);
    toast.success('Exporting sales report');
  };
  
  // Handle delete sale
  const handleDeleteSale = (sale: Sale) => {
    setSaleToDelete(sale);
    setIsDeleteDialogOpen(true);
  };
  
  // Confirm delete
  const confirmDelete = () => {
    if (saleToDelete) {
      deleteSaleMutation.mutate(saleToDelete.id);
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy hh:mm a');
  };

  // Calculate totals
  const getTotalAmount = () => {
    return sales
      .reduce((sum: number, sale: Sale) => sum + sale.final_amount, 0)
      .toFixed(2);
  };

  // Handle update item quantity
  const handleUpdateItemQuantity = (index: number, newQuantity: number) => {
    if (!isEditing || newQuantity < 0) return;

    const updatedItems = [...editedItems];
    const item = updatedItems[index];
    const currentQuantity = item.quantity;
    
    // Update the item quantity
    updatedItems[index] = {
      ...item,
      quantity: newQuantity,
      item_final_price: item.sale_price * newQuantity
    };
    
    setEditedItems(updatedItems);
  };

  // Handle remove item
  const handleRemoveItem = (index: number) => {
    if (!isEditing) return;
    
    const updatedItems = [...editedItems];
    updatedItems.splice(index, 1);
    setEditedItems(updatedItems);
  };

  // Calculate totals for edited items
  const calculateEditedTotals = () => {
    const total = editedItems.reduce((sum, item) => sum + item.item_final_price, 0);
    const discount = saleDetail ? saleDetail.total_discount : 0;
    const final = total - discount;
    
    return { total, discount, final };
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!saleDetail || !selectedSaleId) return;
    
    const { total, discount, final } = calculateEditedTotals();
    
    // Prepare inventory updates by comparing original vs edited items
    const originalItems = saleDetail.items;
    const inventoryUpdates: { productId: number, quantityChange: number }[] = [];
    
    // Calculate quantity changes for existing items
    editedItems.forEach(editedItem => {
      const originalItem = originalItems.find(oi => oi.product_id === editedItem.product_id);
      if (originalItem) {
        // Positive change means we need to add back to inventory, negative means remove from inventory
        const quantityChange = originalItem.quantity - editedItem.quantity;
        if (quantityChange !== 0) {
          inventoryUpdates.push({ productId: editedItem.product_id, quantityChange });
        }
      }
    });
    
    // Handle completely removed items - add their full quantity back to inventory
    originalItems.forEach(originalItem => {
      const stillExists = editedItems.some(ei => ei.product_id === originalItem.product_id);
      if (!stillExists) {
        inventoryUpdates.push({ productId: originalItem.product_id, quantityChange: originalItem.quantity });
      }
    });
    
    // Update the sale first
    await updateSaleMutation.mutateAsync({
      id: selectedSaleId,
      updatedSale: {
        total_amount: total,
        total_discount: discount,
        final_amount: final,
        items: editedItems
      }
    });
    
    // Update inventory quantities
    // for (const update of inventoryUpdates) {
    //   try {
    //     // Get current quantity first
    //     const currentProduct = await fetch(`http://localhost:3001/api/products/${update.productId}`);
    //     if (currentProduct.ok) {
    //       const productData = await currentProduct.json();
    //       const newQuantity = productData.quantity + update.quantityChange;
          
    //       await updateQuantityMutation.mutateAsync({
    //         id: update.productId,
    //         quantity: newQuantity
    //       });
    //     }
    //   } catch (error) {
    //     console.error(`Failed to update inventory for product ${update.productId}:`, error);
    //     toast.error(`Failed to update inventory for one of the products`);
    //   }
    // }
  };
  
  // Calculate SGST and CGST
  const calculateTaxes = (grandTotal: number) => {
    const sgst = grandTotal * 0.023881;
    const cgst = grandTotal * 0.023881;
    return { sgst, cgst };
  };

  return (
    <Layout>
      <Card title="Sales Report">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'daily' | 'range')} className="flex-grow">
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="range">Date Range</TabsTrigger>
            </TabsList>
            
            <div className="mt-2">
              {viewMode === 'daily' ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-auto"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-auto"
                    placeholder="Start Date"
                  />
                  <span>to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-auto"
                    placeholder="End Date"
                  />
                </div>
              )}
            </div>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by name or mobile..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button onClick={handleExport} className="flex items-center gap-1">
              <FileDown size={16} />
              Export Excel
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="bill">Bills</TabsTrigger>
              <TabsTrigger value="estimate">Estimates</TabsTrigger>
            </TabsList>
            
            <div className="text-sm">
              <span className="mr-4">
                {sales.length} transaction{sales.length !== 1 ? 's' : ''}
              </span>
              <span className="font-medium">
                Total: ₹{getTotalAmount()}
              </span>
            </div>
          </div>
          
          <TabsContent value={activeTab} className="pt-4">
            <div className="border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Number</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-center">Payment</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center">Loading...</td>
                    </tr>
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center">No sales found</td>
                    </tr>
                  ) : (
                    sales.map((sale: Sale) => (
                      <tr
                        key={sale.id}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <div>{formatDate(sale.date).split(' ')[0]}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(sale.date).split(' ').slice(1).join(' ')}
                          </div>
                        </td>
                        <td className="px-4 py-3">{sale.number}</td>
                        <td className="px-4 py-3">
                          {sale.type === 'bill' ? (
                            <span className="kala-tag-bill">Bill</span>
                          ) : (
                            <span className="kala-tag-estimate">Estimate</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>{sale.customer_name}</div>
                          {sale.mobile && (
                            <div className="text-xs text-gray-500">{sale.mobile}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">₹{sale.final_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {sale.payment_mode ? (
                            <span className="capitalize">{sale.payment_mode}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              onClick={() => handleViewDetails(sale.id)}
                              variant="outline"
                              size="sm"
                            >
                              View
                            </Button>
                            <Button
                              onClick={() => handlePrintSale(sale)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Printer size={14} />
                            </Button>
                            <Button
                              onClick={() => handleDeleteSale(sale)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
      
      {/* Sale Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="relative">
            <DialogTitle>
              {saleDetail ? (
                <>
                  {saleDetail.type === 'bill' ? 'Bill' : 'Estimate'} Details
                </>
              ) : (
                'Sale Details'
              )}
            </DialogTitle>
            <DialogDescription>
              Sale ID: {selectedSaleId}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails || !saleDetail ? (
            <div className="py-8 text-center">Loading...</div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {saleDetail.type === 'bill' ? 'Bill' : 'Estimate'} Number
                  </p>
                  <p className="font-medium">{saleDetail.number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(saleDetail.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{saleDetail.customer_name}</p>
                </div>
                {saleDetail.mobile && (
                  <div>
                    <p className="text-sm text-gray-500">Mobile</p>
                    <p className="font-medium">{saleDetail.mobile}</p>
                  </div>
                )}
                {saleDetail.customer_address && (
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">{saleDetail.customer_address}</p>
                  </div>
                )}
                {saleDetail.customer_gstin && (
                  <div>
                    <p className="text-sm text-gray-500">GSTIN Number</p>
                    <p className="font-medium">{saleDetail.customer_gstin}</p>
                  </div>
                )}
                {saleDetail.payment_mode && (
                  <div>
                    <p className="text-sm text-gray-500">Payment Mode</p>
                    <p className="font-medium capitalize">{saleDetail.payment_mode}</p>
                  </div>
                )}
              </div>
              
              {saleDetail.remarks && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Remarks</p>
                  <p className="bg-gray-50 p-2 rounded">{saleDetail.remarks}</p>
                </div>
              )}
              
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium">Items:</p>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    Edit Items
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveChanges} size="sm">
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="border rounded overflow-hidden mb-4">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      {isEditing && <th className="px-4 py-2 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {saleDetail.items && saleDetail.items.length > 0 ? (
                      (isEditing ? editedItems : saleDetail.items).map((item, index) => (
                        <tr key={item.id || index} className="border-t">
                          <td className="px-4 py-2">
                            <div className="font-medium">{item.category_name}</div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  className="w-6 h-6 flex items-center justify-center rounded bg-gray-200"
                                  onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-center w-6">{item.quantity}</span>
                                <button
                                  type="button"
                                  className="w-6 h-6 flex items-center justify-center rounded bg-gray-200"
                                  onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              item.quantity
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">₹{item.sale_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">₹{item.item_final_price.toFixed(2)}</td>
                          {isEditing && (
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                className="p-1 text-gray-500 hover:text-red-500"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <X size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isEditing ? 5 : 4} className="px-4 py-4 text-center">
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-gray-50 p-4 rounded">
                {isEditing ? (
                  <>
                    <div className="flex justify-between mb-1">
                      <span>Total:</span>
                      <span>₹{calculateEditedTotals().total.toFixed(2)}</span>
                    </div>
                    
                    {saleDetail.total_discount > 0 && (
                      <div className="flex justify-between mb-1">
                        <span>Total Discount:</span>
                        <span>₹{saleDetail.total_discount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {saleDetail.type === 'bill' && (
                      <>
                        <div className="flex justify-between mb-1">
                          <span>SGST:</span>
                          <span>₹{calculateTaxes(calculateEditedTotals().final).sgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span>CGST:</span>
                          <span>₹{calculateTaxes(calculateEditedTotals().final).cgst.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between font-medium">
                      <span>Grand Total(incl taxes):</span>
                      <span>₹{calculateEditedTotals().final.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between mb-1">
                      <span>Total:</span>
                      <span>₹{saleDetail.total_amount.toFixed(2)}</span>
                    </div>
                    
                    {saleDetail.total_discount > 0 && (
                      <div className="flex justify-between mb-1">
                        <span>Total Discount:</span>
                        <span>₹{saleDetail.total_discount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {saleDetail.type === 'bill' && (
                      <>
                        <div className="flex justify-between mb-1">
                          <span>SGST:</span>
                          <span>₹{calculateTaxes(saleDetail.final_amount).sgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span>CGST:</span>
                          <span>₹{calculateTaxes(saleDetail.final_amount).cgst.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between font-medium">
                      <span>Grand Total(incl taxes):</span>
                      <span>₹{saleDetail.final_amount.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {saleToDelete?.type === 'bill' ? 'Bill' : 'Estimate'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {saleToDelete?.type === 'bill' ? 'bill' : 'estimate'} {saleToDelete?.number}? 
              This action cannot be undone. The inventory quantities will be restored automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteSaleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteSaleMutation.isPending}
            >
              {deleteSaleMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SalesReport;
