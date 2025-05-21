
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSalesApi, getSaleByIdApi, exportSalesApi } from '@/lib/api';
import { Search, Calendar, FileDown, X } from 'lucide-react';

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
}

interface SaleDetail extends Sale {
  remarks: string | null;
  items: Array<{
    id: number;
    product_id: number;
    barcode: string;
    category_name: string;
    sale_price: number;
    quantity: number;
    item_final_price: number;
  }>;
}

const SalesReport = () => {
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
  const { data: saleDetail, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['sale', selectedSaleId],
    queryFn: () => getSaleByIdApi(selectedSaleId!),
    enabled: !!selectedSaleId
  });
  
  // Handle view sale details
  const handleViewDetails = (id: number) => {
    setSelectedSaleId(id);
    setIsDetailsOpen(true);
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
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy hh:mm a');
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
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="bill">Bills</TabsTrigger>
            <TabsTrigger value="estimate">Estimates</TabsTrigger>
          </TabsList>
          
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
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center">Loading...</td>
                    </tr>
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center">No sales found</td>
                    </tr>
                  ) : (
                    sales.map((sale: Sale) => (
                      <tr
                        key={sale.id}
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleViewDetails(sale.id)}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              
              <div className="bg-gray-50 px-4 py-3 border-t">
                <div className="flex justify-between items-center">
                  <span>
                    {sales.length} transaction{sales.length !== 1 ? 's' : ''}
                  </span>
                  <span>
                    Total: ₹
                    {sales
                      .reduce((sum: number, sale: Sale) => sum + sale.final_amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
      
      {/* Sale Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setIsDetailsOpen(false)}
            >
              <X size={16} />
            </Button>
            <DialogTitle>
              {saleDetail ? (
                <>
                  {saleDetail.type === 'bill' ? 'Bill' : 'Estimate'} Details
                </>
              ) : (
                'Sale Details'
              )}
            </DialogTitle>
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
              
              <p className="font-medium mb-2">Items:</p>
              <div className="border rounded overflow-hidden mb-4">
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
                    {saleDetail.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-2">
                          <div className="font-medium">{item.category_name}</div>
                          <div className="text-xs text-gray-500">{item.barcode}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">₹{item.sale_price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₹{item.item_final_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex justify-between mb-1">
                  <span>Total:</span>
                  <span>₹{saleDetail.total_amount.toFixed(2)}</span>
                </div>
                
                {saleDetail.total_discount > 0 && (
                  <div className="flex justify-between mb-1">
                    <span>Discount:</span>
                    <span>₹{saleDetail.total_discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-medium">
                  <span>Final Amount:</span>
                  <span>₹{saleDetail.final_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SalesReport;
