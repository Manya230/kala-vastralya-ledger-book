
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CalendarIcon, Eye, Download, Edit3, Save, X, Plus, Minus } from 'lucide-react';
import { getSalesApi, exportSalesApi, getSaleByIdApi, updateSaleApi, SaleItem } from '@/lib/api';

interface SaleDetail {
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
  remarks?: string | null;
}

const SalesReport = () => {
  const queryClient = useQueryClient();
  
  // Filter states
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail view states
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<SaleItem[]>([]);
  
  // Fetch sales data
  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['sales', selectedDate, dateRange, filterType, searchQuery],
    queryFn: async () => {
      const params: any = {};
      
      if (selectedDate) {
        params.date = format(selectedDate, 'yyyy-MM-dd');
      } else if (dateRange.from) {
        params.startDate = format(dateRange.from, 'yyyy-MM-dd');
        if (dateRange.to) {
          params.endDate = format(dateRange.to, 'yyyy-MM-dd');
        }
      }
      
      if (filterType) {
        params.type = filterType;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      console.log('Fetching sales with params:', params);
      const result = await getSalesApi(params);
      console.log('Sales API result:', result);
      return result;
    },
  });
  
  // Fetch sale details
  const { data: saleDetail, isLoading: isLoadingDetails } = useQuery<SaleDetail | null>({
    queryKey: ['sale', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      console.log('Viewing sale details for ID:', selectedSaleId);
      const result = await getSaleByIdApi(selectedSaleId);
      return result;
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
    mutationFn: ({ id, data }: { id: number; data: any }) => updateSaleApi(id, data),
    onSuccess: () => {
      toast.success('Sale updated successfully');
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', selectedSaleId] });
    },
    onError: (error) => {
      console.error('Error updating sale:', error);
      toast.error('Failed to update sale');
    }
  });
  
  // Handle view details
  const handleViewDetails = (saleId: number) => {
    console.log('Opening details for sale ID:', saleId);
    setSelectedSaleId(saleId);
    setIsSheetOpen(true);
    setIsEditMode(false);
  };
  
  // Handle export
  const handleExport = () => {
    const params: any = {};
    
    if (selectedDate) {
      params.date = format(selectedDate, 'yyyy-MM-dd');
    } else if (dateRange.from) {
      params.startDate = format(dateRange.from, 'yyyy-MM-dd');
      if (dateRange.to) {
        params.endDate = format(dateRange.to, 'yyyy-MM-dd');
      }
    }
    
    if (filterType) {
      params.type = filterType;
    }
    
    if (searchQuery) {
      params.search = searchQuery;
    }
    
    exportSalesApi(params);
    toast.success('Export started. Download will begin shortly.');
  };
  
  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      // Reset to original items if canceling edit
      if (saleDetail && saleDetail.items) {
        setEditedItems(saleDetail.items);
      }
    }
    setIsEditMode(!isEditMode);
  };
  
  // Handle save changes
  const handleSaveChanges = () => {
    if (!selectedSaleId || !editedItems.length) return;
    
    const totalAmount = editedItems.reduce((sum, item) => sum + item.item_final_price, 0);
    const totalDiscount = saleDetail?.total_discount || 0;
    
    updateSaleMutation.mutate({
      id: selectedSaleId,
      data: {
        total_amount: totalAmount,
        total_discount: totalDiscount,
        final_amount: totalAmount - totalDiscount,
        items: editedItems
      }
    });
  };
  
  // Handle item quantity update
  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const updatedItems = editedItems.map((item, i) => {
      if (i === index) {
        const newFinalPrice = item.sale_price * newQuantity;
        return {
          ...item,
          quantity: newQuantity,
          item_final_price: newFinalPrice
        };
      }
      return item;
    });
    
    setEditedItems(updatedItems);
  };
  
  // Calculate totals for display
  const calculateTotals = () => {
    if (!saleDetail) return { totalDiscount: 0, finalAmount: 0 };
    
    const totalDiscount = saleDetail.total_discount || 0;
    const finalAmount = saleDetail.final_amount || 0;
    
    return { totalDiscount, finalAmount };
  };
  
  const { totalDiscount, finalAmount } = calculateTotals();
  
  return (
    <Layout>
      <Card title="Sales Report">
        {/* Filters */}
        <div className="mb-6 grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="bill">Bills</SelectItem>
                <SelectItem value="estimate">Estimates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <Input
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-end">
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Sales Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No sales found
                  </td>
                </tr>
              ) : (
                sales.map((sale: Sale) => (
                  <tr key={sale.id} className="border-t">
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        sale.type === 'bill' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {sale.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium">{sale.number}</td>
                    <td className="px-4 py-2">{sale.customer_name}</td>
                    <td className="px-4 py-2">{format(new Date(sale.date), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-2 text-right">₹{sale.final_amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(sale.id)}
                      >
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Sale Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {saleDetail?.type === 'bill' ? 'Bill' : 'Estimate'} Details
            </SheetTitle>
          </SheetHeader>
          
          {isLoadingDetails ? (
            <div className="py-8 text-center">Loading...</div>
          ) : !saleDetail ? (
            <div className="py-8 text-center text-gray-500">Sale not found</div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Sale Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{saleDetail.type === 'bill' ? 'Bill' : 'Estimate'} Number</p>
                  <p className="font-medium">{saleDetail.number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{format(new Date(saleDetail.date), 'dd/MM/yyyy HH:mm')}</p>
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
                {saleDetail.payment_mode && (
                  <div>
                    <p className="text-sm text-gray-500">Payment Mode</p>
                    <p className="font-medium capitalize">{saleDetail.payment_mode}</p>
                  </div>
                )}
                {saleDetail.remarks && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Remarks</p>
                    <p className="font-medium">{saleDetail.remarks}</p>
                  </div>
                )}
              </div>
              
              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Items</h3>
                  <Button
                    size="sm"
                    variant={isEditMode ? "outline" : "default"}
                    onClick={handleEditToggle}
                    className={isEditMode ? "" : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {isEditMode ? (
                      <>
                        <X size={14} className="mr-1" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit3 size={14} className="mr-1" />
                        Edit Items
                      </>
                    )}
                  </Button>
                </div>
                
                {!saleDetail.items || saleDetail.items.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">No items found</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Item</th>
                          <th className="px-4 py-2 text-center">Qty</th>
                          <th className="px-4 py-2 text-right">Rate</th>
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editedItems.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2">
                              <div className="font-medium">{item.category_name}</div>
                              <div className="text-xs text-gray-500">{item.barcode}</div>
                            </td>
                            <td className="px-4 py-2">
                              {isEditMode ? (
                                <div className="flex items-center justify-center space-x-1">
                                  <button
                                    type="button"
                                    className="w-6 h-6 flex items-center justify-center rounded bg-gray-200"
                                    onClick={() => updateItemQuantity(index, item.quantity - 1)}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="text-center w-8">{item.quantity}</span>
                                  <button
                                    type="button"
                                    className="w-6 h-6 flex items-center justify-center rounded bg-gray-200"
                                    onClick={() => updateItemQuantity(index, item.quantity + 1)}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="text-center">{item.quantity}</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">₹{item.sale_price.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{item.item_final_price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {isEditMode && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      onClick={handleSaveChanges}
                      disabled={updateSaleMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save size={14} className="mr-1" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span>₹{saleDetail.total_amount.toFixed(2)}</span>
                </div>
                
                {totalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span>Total Discount:</span>
                    <span>₹{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-medium text-lg border-t pt-2">
                  <span>Final Amount:</span>
                  <span>₹{finalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
};

export default SalesReport;
