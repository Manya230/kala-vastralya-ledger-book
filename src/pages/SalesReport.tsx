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
      // Fetch full sale details including items
      const saleDetail = await getSaleByIdApi(sale.id);
      
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
  
  // Generate print content with same format as NewSale
  const generatePrintContent = (saleDetail: SaleDetail) => {
    const calculateTaxes = (grandTotal: number) => {
      const sgst = grandTotal * 0.023881;
      const cgst = grandTotal * 0.023881;
      return { sgst, cgst };
    };

    const taxes = saleDetail.type === 'bill' ? calculateTaxes(saleDetail.final_amount) : { sgst: 0, cgst: 0 };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${saleDetail.type === 'bill' ? 'Bill' : 'Estimate'} - ${saleDetail.number}</title>
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
              border: 1px solid black; 
            }
            .header { 
              border-bottom: 2px solid black; 
              padding: 10px; 
              text-align: center; 
              font-weight: normal; 
              font-size: 18px; 
            }
            .contact-row { 
              display: flex; 
              border-bottom: 1px solid black; 
            }
            .contact-left { 
              flex: 1; 
              padding: 10px; 
              border-right: 1px solid black; 
            }
            .contact-right { 
              flex: 1; 
              padding: 10px; 
            }
            .info-row { 
              display: flex; 
              border-bottom: 1px solid black; 
            }
            .info-left { 
              flex: 1; 
              padding: 10px; 
              border-right: 1px solid black; 
            }
            .info-right { 
              flex: 1; 
              padding: 10px; 
            }
            .customer-section { 
              border-bottom: 1px solid black; 
            }
            .customer-header { 
              border-bottom: 2px solid black; 
              padding: 10px; 
              text-align: center; 
              font-weight: bold; 
            }
            .customer-row { 
              display: flex; 
            }
            .customer-left { 
              flex: 1; 
              padding: 10px; 
              border-right: 1px solid black; 
            }
            .customer-right { 
              flex: 1; 
              padding: 10px; 
            }
            .items-table { 
              width: 100%; 
              border-collapse: collapse; 
            }
            .items-table th, .items-table td { 
              border: 1px solid black; 
              padding: 8px; 
              text-align: left; 
            }
            .items-table th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
            }
            .items-table .text-right { 
              text-align: right; 
            }
            .items-table .text-center { 
              text-align: center; 
            }
            .totals-section { 
              border-top: 2px solid black; 
            }
            .totals-row { 
              display: flex; 
            }
            .totals-left { 
              flex: 1; 
              padding: 10px; 
              border-right: 1px solid black; 
            }
            .totals-right { 
              flex: 1; 
              padding: 10px; 
            }
            .total-line { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
            }
            .total-line.final { 
              font-weight: bold; 
              border-top: 1px solid black; 
              padding-top: 5px; 
            }
            .footer-section { 
              border-top: 1px solid black; 
            }
            .footer-row { 
              display: flex; 
            }
            .footer-left { 
              flex: 1; 
              padding: 10px; 
              border-right: 1px solid black; 
            }
            .footer-right { 
              padding: 10px; 
              text-align: center;
              display: flex;
              align-items: flex-end;
              justify-content: center; 
            }
            @media print { 
              body { margin: 0; } 
              .receipt { border: none; } 
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <!-- Header -->
            <div class="header">
              ${saleDetail.type === 'bill' ? 'BILL' : 'ESTIMATE'}
            </div>
            
            <!-- Contact Information -->
            <div class="contact-row">
              <div class="contact-left">
                <strong>KALA VASTRALYA</strong><br>
                Shop No. 12, Trimurti Apartment,<br>
                Near Axis Bank, Karve Road,<br>
                Kothrud, Pune - 411029<br>
                Mobile: 8007792000<br>
                Email: kalavastralya@gmail.com
              </div>
              <div class="contact-right">
                <div><strong>${saleDetail.type === 'bill' ? 'Bill' : 'Estimate'} No:</strong> ${saleDetail.number}</div>
                <div><strong>Date:</strong> ${format(new Date(saleDetail.date), 'dd/MM/yyyy')}</div>
                ${saleDetail.type === 'bill' ? '<div><strong>GSTIN:</strong> 27ABCDE1234F1Z5</div>' : ''}
              </div>
            </div>
            
            <!-- Customer Details -->
            <div class="customer-section">
              <div class="customer-header">Customer Details</div>
              <div class="customer-row">
                <div class="customer-left">
                  <div><strong>Name:</strong> ${saleDetail.customer_name}</div>
                  ${saleDetail.mobile ? `<div><strong>Mobile:</strong> ${saleDetail.mobile}</div>` : ''}
                  ${saleDetail.customer_address ? `<div><strong>Address:</strong> ${saleDetail.customer_address}</div>` : ''}
                </div>
                <div class="customer-right">
                  ${saleDetail.customer_gstin ? `<div><strong>GSTIN:</strong> ${saleDetail.customer_gstin}</div>` : ''}
                  ${saleDetail.payment_mode ? `<div><strong>Payment Mode:</strong> ${saleDetail.payment_mode}</div>` : ''}
                </div>
              </div>
            </div>
            
            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th>Sr.No.</th>
                  <th>Particulars</th>
                  <th class="text-center">Qty</th>
                  <th class="text-right">Rate</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${saleDetail.items.map((item, index) => `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${item.category_name}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">₹${item.sale_price.toFixed(2)}</td>
                    <td class="text-right">₹${item.item_final_price.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-row">
                <div class="totals-left">
                  ${saleDetail.remarks ? `<div><strong>Remarks:</strong> ${saleDetail.remarks}</div>` : ''}
                </div>
                <div class="totals-right">
                  <div class="total-line">
                    <span>Total:</span>
                    <span>₹${saleDetail.total_amount.toFixed(2)}</span>
                  </div>
                  ${saleDetail.total_discount > 0 ? `
                    <div class="total-line">
                      <span>Discount:</span>
                      <span>₹${saleDetail.total_discount.toFixed(2)}</span>
                    </div>
                  ` : ''}
                  ${saleDetail.type === 'bill' ? `
                    <div class="total-line">
                      <span>SGST:</span>
                      <span>₹${taxes.sgst.toFixed(2)}</span>
                    </div>
                    <div class="total-line">
                      <span>CGST:</span>
                      <span>₹${taxes.cgst.toFixed(2)}</span>
                    </div>
                  ` : ''}
                  <div class="total-line final">
                    <span>Grand Total:</span>
                    <span>₹${saleDetail.final_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="footer-section">
              <div class="footer-row">
                <div class="footer-left">
                  <strong>Terms & Conditions:</strong><br>
                  1. Goods once sold will not be taken back.<br>
                  2. All disputes subject to Pune jurisdiction only.
                </div>
                <div class="footer-right">
                  <div>
                    <div>For KALA VASTRALYA</div>
                    <br><br><br>
                    <div>Auth. Signatory</div>
                  </div>
                </div>
              </div>
            </div>
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
            {/* <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setIsDetailsOpen(false)}
            >
              <X size={16} />
            </Button> */}
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
