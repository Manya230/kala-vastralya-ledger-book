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
import { Search, Calendar, FileDown, X, Plus, Minus, Trash2, Edit, Check } from 'lucide-react';

interface Sale {
  id: number;
  type: 'bill' | 'estimate';
  number: string;
  customer_name: string;
  mobile: string | null;
  final_amount: number;
  payment_mode: string | null;
}

interface SaleItem {
  id: number;
  product_id: number;
  category_name: string;
  sale_price: number;
  quantity: number;
  item_final_price: number;
  barcode?: string;
}

interface SaleDetail extends Sale {
  payment_mode: string | null;
  remarks: string | null;
  date: string;
  total_amount: number;
  total_discount: number;
  final_amount: number;
  customer_address: string | null;
  customer_gstin: string | null;
  customer_gst_number?: string | null;
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
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [editedDiscount, setEditedDiscount] = useState<number>(0);
  const [editingRateIndex, setEditingRateIndex] = useState<number | null>(null);
  const [editedRate, setEditedRate] = useState<number>(0);
  
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

  // Effect to set edited items and discount when sale detail changes
  useEffect(() => {
    if (saleDetail && saleDetail.items) {
      console.log('Setting edited items from data:', saleDetail.items);
      setEditedItems(saleDetail.items);
      setEditedDiscount(saleDetail.total_discount || 0);
    } else {
      console.log('No items found in sale detail');
      setEditedItems([]);
      setEditedDiscount(0);
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
      setIsEditingDiscount(false);
      setEditingRateIndex(null);
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
    setIsEditingDiscount(false);
    setEditingRateIndex(null);
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
      .reduce((sum: number, sale: any) => sum + (sale.final_amount ?? 0), 0)
      .toFixed(2);
  };

  // Handle update item quantity
  const handleUpdateItemQuantity = (index: number, newQuantity: number) => {
    if (!isEditing || newQuantity < 0) return;

    const updatedItems = [...editedItems];
    const item = updatedItems[index];
    
    // Update the item quantity and recalculate final price
    updatedItems[index] = {
      ...item,
      quantity: newQuantity,
      item_final_price: item.sale_price * newQuantity
    };
    
    setEditedItems(updatedItems);
  };

  // Handle update item rate
  const handleUpdateItemRate = (index: number, newRate: number) => {
    if (newRate < 0) return;

    const updatedItems = [...editedItems];
    const item = updatedItems[index];
    
    // Update the item rate and recalculate final price
    updatedItems[index] = {
      ...item,
      sale_price: newRate,
      item_final_price: newRate * item.quantity
    };
    
    setEditedItems(updatedItems);
  };

  // Handle start editing rate
  const handleStartEditingRate = (index: number, currentRate: number) => {
    setEditingRateIndex(index);
    setEditedRate(currentRate);
  };

  // Handle save rate changes
  const handleSaveRateChanges = async (index: number) => {
    handleUpdateItemRate(index, editedRate);
    
    // Calculate new totals
    const updatedItems = [...editedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      sale_price: editedRate,
      item_final_price: editedRate * updatedItems[index].quantity
    };
    
    const total = updatedItems.reduce((sum, item) => sum + item.item_final_price, 0);
    const discount = saleDetail ? saleDetail.total_discount : 0;
    const final = total - discount;
    
    // Save to database
    if (selectedSaleId) {
      await updateSaleMutation.mutateAsync({
        id: selectedSaleId,
        updatedSale: {
          total_amount: total,
          total_discount: discount,
          final_amount: final,
          items: updatedItems
        }
      });
    }
    
    setEditingRateIndex(null);
  };

  // Handle cancel rate editing
  const handleCancelRateEditing = () => {
    setEditingRateIndex(null);
    setEditedRate(0);
  };

  // Handle remove item
  const handleRemoveItem = (index: number) => {
    if (!isEditing) return;
    
    const updatedItems = [...editedItems];
    updatedItems.splice(index, 1);
    setEditedItems(updatedItems);
  };

  // Calculate totals for edited items with current discount
  const calculateEditedTotals = () => {
    const total = editedItems.reduce((sum, item) => sum + item.item_final_price, 0);
    const discount = isEditingDiscount ? editedDiscount : (saleDetail ? saleDetail.total_discount : 0);
    const final = total - discount;
    
    return { total, discount, final };
  };

  // Handle save discount changes
  const handleSaveDiscountChanges = async () => {
    if (!saleDetail || !selectedSaleId) return;
    
    const { total } = calculateEditedTotals();
    const final = total - editedDiscount;
    
    await updateSaleMutation.mutateAsync({
      id: selectedSaleId,
      updatedSale: {
        total_amount: total,
        total_discount: editedDiscount,
        final_amount: final,
        items: editedItems
      }
    });
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!saleDetail || !selectedSaleId) return;
    
    const { total, discount, final } = calculateEditedTotals();
    
    // Update the sale
    await updateSaleMutation.mutateAsync({
      id: selectedSaleId,
      updatedSale: {
        total_amount: total,
        total_discount: discount,
        final_amount: final,
        items: editedItems
      }
    });
  };
  
  // Calculate SGST and CGST
  const calculateTaxes = (grandTotal: number) => {
    const sgst = grandTotal * 0.023881;
    const cgst = grandTotal * 0.023881;
    return { sgst, cgst };
  };

  const generatePrintHTML = (receiptData: any, type: 'bill' | 'estimate') => {
    const isEstimate = type === 'estimate';
    
    const items = Array.isArray(receiptData.items) ? receiptData.items : [];

    const estimateHTML = `
      <div style="max-width: 800px; margin: 0 auto; padding: 20px; background: white; font-family: Arial, sans-serif; border: 2px solid black;">
        <h1 style="text-align: center; margin-bottom: 20px; font-size: 24px;">Estimate/Challan</h1>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 14px;">
          <div>
            <p style="margin: 5px 0;"><strong>Estimate Number:</strong> ${receiptData.number}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${receiptData.customer_name || ''}</p>
            ${receiptData.mobile ? `<p style="margin: 5px 0;"><strong>Mobile:</strong> ${receiptData.mobile}</p>` : ''}
            ${receiptData.customer_address ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${receiptData.customer_address}</p>` : ''}
            ${receiptData.customer_gst_number ? `<p style="margin: 5px 0;"><strong>GSTIN:</strong> ${receiptData.customer_gst_number}</p>` : ''}
          </div>
          <div style="text-align: right;">
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(receiptData.date).toLocaleDateString('en-GB')}, ${new Date(receiptData.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            ${receiptData.payment_mode ? `<p style="margin: 5px 0;"><strong>Payment Mode:</strong> ${receiptData.payment_mode}</p>` : ''}
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid black; padding: 10px; text-align: left;">Item</th>
              <th style="border: 1px solid black; padding: 10px; text-align: center;">Qty</th>
              <th style="border: 1px solid black; padding: 10px; text-align: right;">Rate</th>
              <th style="border: 1px solid black; padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: SaleItem) => `
              <tr>
                <td style="border: 1px solid black; padding: 10px;">
                  <div style="font-weight: bold;">${item.category_name}</div>
                  ${item.barcode ? `<div style="font-size: 12px; color: #666;">${item.barcode}</div>` : ''}
                </td>
                <td style="border: 1px solid black; padding: 10px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid black; padding: 10px; text-align: right;">₹${(item.sale_price ?? 0).toFixed(2)}</td>
                <td style="border: 1px solid black; padding: 10px; text-align: right;">₹${(item.item_final_price ?? 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Total:</span>
            <span>₹${(receiptData.total_amount ?? 0).toFixed(2)}</span>
          </div>
          ${(receiptData.total_discount ?? 0) > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Total Discount:</span>
              <span>₹${(receiptData.total_discount ?? 0).toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Final Amount:</span>
            <span>₹${(receiptData.final_amount ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;

    const billHTML = `
      <div class="receipt">
        <div class="header">BILL</div>
        <div class="contact-row">
          <div class="contact-left">Mob. 9053555965, 9416930965</div>
          <div class="contact-right">GSTIN: 06AEBPY4971P1ZN</div>
        </div>
        <div class="company-name">KALAN VASTRALYA</div>
        <div class="address">254B, Opp RJS Plaza, Pataudi Road, Haily Mandi</div>
        <div class="details-row">
          <div class="customer-details">
            <div class="customer-header">Customer Details</div>
            <div class="customer-row">
              <div class="customer-label">Name</div>
              <div class="customer-value">${receiptData.customer_name || ''}</div>
            </div>
            ${receiptData.mobile ? `
              <div class="customer-row">
                <div class="customer-label">Mobile No.</div>
                <div class="customer-value">${receiptData.mobile}</div>
              </div>
            ` : ''}
            ${receiptData.customer_address ? `
              <div class="customer-row">
                <div class="customer-label">Address</div>
                <div class="customer-value">${receiptData.customer_address}</div>
              </div>
            ` : ''}
            ${receiptData.customer_gst_number ? `
              <div class="customer-row">
                <div class="customer-label">GSTIN Number</div>
                <div class="customer-value">${receiptData.customer_gst_number}</div>
              </div>
            ` : ''}
          </div>
          <div class="bill-info">
            <div class="bill-info-item">
              <strong>Bill No.:&nbsp;</strong>${receiptData.number}
            </div>
            <div class="bill-info-item">
              <strong>Date:&nbsp;</strong>${new Date(receiptData.date).toLocaleDateString('en-GB')}, ${new Date(receiptData.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: SaleItem, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.category_name}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">₹ ${(item.sale_price ?? 0).toFixed(0)}</td>
                <td class="text-right">₹ ${(item.item_final_price ?? 0).toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals-section">
          <div class="taxes">
            <div style="flex-grow: 1;"></div>
            <div class="tax-row">
              <div class="tax-label">SGST @ 2.5%</div>
              <div class="tax-value">₹ ${( (receiptData.final_amount ?? 0) * 0.02388095238).toFixed(2)}</div>
            </div>
            <div class="tax-row" style="border-top: none;">
              <div class="tax-label">CGST @ 2.5%</div>
              <div class="tax-value">₹ ${( (receiptData.final_amount ?? 0) * 0.02388095238).toFixed(2)}</div>
            </div>
          </div>
          <div>
            <div class="total-row">
              <div class="total-label">Total</div>
              <div class="total-value">₹ ${(receiptData.total_amount ?? 0).toFixed(0)}</div>
            </div>
            ${(receiptData.total_discount ?? 0) > 0 ? `
              <div class="total-row">
                <div class="total-label">Total Discount</div>
                <div class="total-value">₹ ${(receiptData.total_discount ?? 0).toFixed(0)}</div>
              </div>
            ` : ''}
            <div class="total-row" style="border-bottom: none;">
              <div class="total-label">Grand Total (incl taxes)</div>
              <div class="total-value">₹ ${(receiptData.final_amount ?? 0).toFixed(0)}</div>
            </div>
          </div>
        </div>
        <div class="footer">
          <div class="footer-left">
            <div>Thank you for shopping.</div>
            <div style="font-size: 14px;">(Goods once sold will not be taken back.)</div>
          </div>
          <div class="footer-right">
            <div>Auth. Signatory</div>
          </div>
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isEstimate ? 'Estimate' : 'Bill'} - ${receiptData.number}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: white; 
            }
            /* Styles for Bill format */
            .receipt { 
              border: 1px solid black; 
              max-width: 800px; 
              margin: 0 auto; 
            }
            .header { border-bottom: 1px solid black; padding: 10px; text-align: center; font-weight: normal; font-size: 18px; }
            .contact-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid black; }
            .contact-left { border-right: 1px solid black; padding: 10px; font-size: 14px; }
            .contact-right { padding: 10px; text-align: right; font-size: 14px; }
            .company-name { text-align: center; border-bottom: 1px solid black; padding: 10px; font-weight: bold; font-size: 24px; }
            .address { text-align: center; border-bottom: 1px solid black; padding: 10px; font-size: 14px; }
            .details-row { display: grid; grid-template-columns: 3fr 1fr; border-bottom: 1px solid black; }
            .customer-details { border-right: 1px solid black; }
            .customer-header { border-bottom: 1px solid black; padding: 10px; text-align: center; font-weight: bold; }
            .customer-row { display: grid; grid-template-columns: 1fr 2fr; border-bottom: 1px solid black; }
            .customer-row:last-child { border-bottom: none; }
            .customer-label { border-right: 1px solid black; padding: 10px; font-weight: bold; }
            .customer-value { padding: 10px; }
            .bill-info { display: flex; flex-direction: column; height: 100%; }
            .bill-info-item { flex: 1; padding: 10px; display: flex; align-items: center; }
            .bill-info-item:first-child { border-bottom: 1px solid black; } /* This was already 1px, remains 1px */
            table { width: 100%; border-collapse: collapse; } 
            th, td { border: 1px solid black; padding: 10px; text-align: left; } /* This was already 1px, remains 1px */
            th { background-color: #f5f5f5; font-weight: bold; } 
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section { display: grid; grid-template-columns: 1fr 1fr; }
            .taxes { border-right: 1px solid black; display: flex; flex-direction: column; } /* This was already 1px, remains 1px */
            .tax-row { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid black; border-bottom: 1px solid black; } /* This was already 1px, remains 1px */
            .tax-label { border-right: 1px solid black; padding: 10px; text-align: center; font-weight: bold; } /* This was already 1px, remains 1px */
            .tax-value { padding: 10px; text-align: center; }
            .total-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid black; } /* This was already 1px, remains 1px */
            .total-label { border-right: 1px solid black; padding: 10px; text-align: right; font-weight: bold; } /* This was already 1px, remains 1px */
            .total-value { padding: 10px; text-align: right; }
            .footer { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid black; } /* This was already 1px, remains 1px */
            .footer-left { border-right: 1px solid black; padding: 10px; text-align: center; } /* This was already 1px, remains 1px */
            .footer-right { padding: 10px; text-align: center; display: flex; align-items: flex-end; justify-content: center; }
            @media print { 
              body { 
                margin: 0; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              } 
              .no-print { display: none; } 
              .receipt { /* For Bill */
                margin: 0 auto; 
                border: 1px solid black !important; 
                box-shadow: none !important;
              }
              /* For Estimate */
              div[style*="max-width: 800px"][style*="border: 2px solid black"] { /* Estimate border remains 2px unless specified otherwise */
                margin: 0 auto !important; 
                /* border: 2px solid black !important; */ /* This line is commented out to not override estimate's specific border if it should be different */
                box-shadow: none !important; 
              }
            }
          </style>
        </head>
        <body>
          ${isEstimate ? estimateHTML : billHTML}
        </body>
      </html>
    `;
  };

  const handlePrintSale = async (saleId: number) => {
    const saleDetail = await getSaleByIdApi(saleId) as SaleDetail;
    if (!saleDetail) {
      toast.error('Failed to fetch sale details for printing');
      return;
    }

    const receiptDataForPrint = {
      ...saleDetail,
      customer_gst_number: saleDetail.customer_gstin || saleDetail.customer_gst_number || '',
      items: saleDetail.items || [],
    };

    const printHTML = generatePrintHTML(
      receiptDataForPrint,
      saleDetail.type
    );
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    }
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
                    sales.map((sale) => (
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
                              onClick={() =>
                                handleDeleteSale({
                                  ...sale,
                                  type: sale.type === 'bill' ? 'bill' : 'estimate'
                                })
                              }
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={14} />
                            </Button>
                            <Button
                              onClick={() => handlePrintSale(sale.id)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Print
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
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="bg-gray-100 hover:bg-gray-200">
                    Edit Items
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="bg-gray-100 hover:bg-gray-200">
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
                          <td className="px-4 py-2 text-right">
                            {editingRateIndex === index ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  value={editedRate}
                                  onChange={(e) => setEditedRate(parseFloat(e.target.value) || 0)}
                                  className="w-20 h-8 text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                  style={{ MozAppearance: 'textfield' }}
                                  step="0.01"
                                  min="0"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveRateChanges(index)}
                                  className="h-8 px-2"
                                >
                                  <Check size={14} />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelRateEditing}
                                  className="h-8 px-2 bg-gray-100 hover:bg-gray-200"
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <span>₹{item.sale_price.toFixed(2)}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartEditingRate(index, item.sale_price)}
                                  className="h-8 px-2 bg-gray-100 hover:bg-gray-200"
                                >
                                  <Edit size={14} />
                                </Button>
                              </div>
                            )}
                          </td>
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
                {isEditing || isEditingDiscount ? (
                  <>
                    <div className="flex justify-between mb-1">
                      <span>Total:</span>
                      <span>₹{calculateEditedTotals().total.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center mb-1">
                      <span>Total Discount:</span>
                      <div className="flex items-center gap-2">
                        {isEditingDiscount ? (
                          <>
                            <Input
                              type="number"
                              value={editedDiscount}
                              onChange={(e) => setEditedDiscount(parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                              style={{ MozAppearance: 'textfield' }}
                              step="0.01"
                              min="0"
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveDiscountChanges}
                              className="h-8 px-2"
                            >
                              <Check size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsEditingDiscount(false);
                                setEditedDiscount(saleDetail.total_discount || 0);
                              }}
                              className="h-8 px-2 bg-gray-100 hover:bg-gray-200"
                            >
                              <X size={14} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span>₹{(saleDetail.total_discount || 0).toFixed(2)}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingDiscount(true)}
                              className="h-8 px-2 bg-gray-100 hover:bg-gray-200"
                            >
                              <Edit size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
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
                    
                    <div className="flex justify-between items-center mb-1">
                      <span>Total Discount:</span>
                      <div className="flex items-center gap-2">
                        <span>₹{(saleDetail.total_discount || 0).toFixed(2)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingDiscount(true)}
                          className="h-8 px-2 bg-gray-100 hover:bg-gray-200"
                        >
                          <Edit size={14} />
                        </Button>
                      </div>
                    </div>
                    
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
                      <span>Grand Total:</span>
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
