
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, X, Plus, Minus, CheckCircle } from 'lucide-react';
import { getProductsApi, getProductByBarcodeApi, createSaleApi, updateProductQuantityApi } from '@/lib/api';

interface Product {
  id: number;
  barcode: string;
  category_name: string;
  manufacturer_name: string;
  quantity: number;
  cost_price: number;
  sale_price: number;
}

interface CartItem {
  id: number;
  barcode: string;
  category_name: string;
  sale_price: number;
  quantity: number;
}

const NewSale = () => {
  const queryClient = useQueryClient();

  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [saleType, setSaleType] = useState<'bill' | 'estimate'>('bill');
  const [paymentMode, setPaymentMode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [billNumber, setBillNumber] = useState('12345');
  const [estimateNumber, setEstimateNumber] = useState('E-12345');

  // Fetch products
  const { data: productsData, refetch: fetchProducts } = useQuery({
    queryKey: ['products'],
    queryFn: getProductsApi,
  });

  // Update products state when data changes
  useEffect(() => {
    if (productsData) {
      setProducts(productsData);
    }
  }, [productsData]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch product by barcode
  const { data: scannedProduct, refetch: fetchProductByBarcode } = useQuery({
    queryKey: ['productByBarcode', barcode],
    queryFn: () => getProductByBarcodeApi(barcode),
    enabled: false,
    retry: false,
  });

  useEffect(() => {
    if (barcode) {
      fetchProductByBarcode();
    }
  }, [barcode, fetchProductByBarcode]);

  useEffect(() => {
    if (scannedProduct) {
      addProductToCart(scannedProduct);
      setBarcode('');
    }
  }, [scannedProduct]);

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      const items = cartItems.map(item => ({
        product_id: item.id,
        category_name: item.category_name,
        sale_price: item.sale_price,
        quantity: item.quantity,
        item_final_price: item.sale_price * item.quantity,
      }));

      const saleData = {
        type: saleType,
        customer_name: customerName,
        mobile: customerMobile,
        payment_mode: paymentMode,
        remarks: remarks,
        total_amount: cartTotal,
        total_discount: totalDiscount,
        final_amount: finalTotal,
        items: items,
      };

      return createSaleApi(saleData);
    },
    onSuccess: () => {
      toast.success('Sale created successfully');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      resetForm();
    },
    onError: (error: any) => {
      console.error('Error creating sale:', error);
      toast.error(error?.message || 'Failed to create sale');
    },
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: number, quantity: number }) => {
      return updateProductQuantityApi(id, quantity);
    }
  });

  // Calculate totals
  const cartTotal = cartItems.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
  const finalTotal = cartTotal - totalDiscount;

  // Add product to cart
  const addProductToCart = (product: Product) => {
    if (!product) {
      toast.error('Product not found');
      return;
    }

    if (product.quantity <= 0) {
      toast.error(`Only ${product.quantity} items available in stock`);
      return;
    }

    const existingItemIndex = cartItems.findIndex(item => item.id === product.id);

    if (existingItemIndex !== -1) {
      const existingItem = cartItems[existingItemIndex];
      if (existingItem.quantity >= product.quantity) {
        toast.error(`Only ${product.quantity} items available in stock`);
        return;
      }
      const updatedItems = [...cartItems];
      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + 1,
      };
      setCartItems(updatedItems);
    } else {
      const newItem: CartItem = {
        id: product.id,
        barcode: product.barcode,
        category_name: product.category_name,
        sale_price: product.sale_price,
        quantity: 1,
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  // Remove from cart
  const removeFromCart = (index: number) => {
    const updatedItems = [...cartItems];
    updatedItems.splice(index, 1);
    setCartItems(updatedItems);
  };

  // Reset form
  const resetForm = () => {
    setCartItems([]);
    setCustomerName('');
    setCustomerMobile('');
    setCustomerAddress('');
    setCustomerGstin('');
    setPaymentMode('');
    setRemarks('');
    setTotalDiscount(0);
  };

  // Calculate taxes
  const calculateTaxes = (grandTotal: number) => {
    const sgst = grandTotal * 0.023881;
    const cgst = grandTotal * 0.023881;
    return { sgst, cgst };
  };

  const generateReceipt = () => {
    if (cartItems.length === 0) {
      toast.error('Please add items to cart');
      return;
    }

    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) return;

    const { sgst, cgst } = calculateTaxes(finalTotal);

    let receiptHTML = '';
    
    if (saleType === 'bill') {
      receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bill</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .bill-container { max-width: 800px; margin: 0 auto; border: 2px solid black; }
            .header { text-align: center; border-bottom: 2px solid black; padding: 10px; }
            .company-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .contact-info { border-bottom: 1px solid black; padding: 5px 0; }
            .bill-title { font-size: 20px; font-weight: bold; text-align: center; padding: 10px 0; border-bottom: 1px solid black; }
            .customer-section { padding: 10px; border-bottom: 1px solid black; }
            .customer-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th, .items-table td { border: 1px solid black; padding: 8px; text-align: left; }
            .items-table th { background-color: #f0f0f0; text-align: center; }
            .items-table .qty-col, .items-table .rate-col, .items-table .amount-col { text-align: center; }
            .totals-section { padding: 10px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total-row.grand-total { font-weight: bold; border-top: 1px solid black; padding-top: 5px; }
            .taxes-section { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-end; }
          </style>
        </head>
        <body>
          <div class="bill-container">
            <div class="header">
              <div class="company-name">Kalan Vastralya</div>
              <div class="contact-info">
                <div>Mob. 9053555965, 9416930965</div>
                <div>GSTIN: 06AABFK2971P1ZV</div>
              </div>
            </div>
            
            <div class="bill-title">BILL</div>
            
            <div class="customer-section">
              <div class="customer-row">
                <span><strong>Bill No:</strong> ${billNumber}</span>
                <span><strong>Date:</strong> ${format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
              <div class="customer-row">
                <span><strong>Name:</strong> ${customerName || 'N/A'}</span>
                ${customerMobile ? `<span><strong>Mobile:</strong> ${customerMobile}</span>` : '<span></span>'}
              </div>
              ${customerAddress ? `
                <div class="customer-row">
                  <span><strong>Address:</strong> ${customerAddress}</span>
                  <span></span>
                </div>
              ` : ''}
              ${customerGstin ? `
                <div class="customer-row">
                  <span><strong>GSTIN:</strong> ${customerGstin}</span>
                  <span></span>
                </div>
              ` : ''}
            </div>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Particulars</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${cartItems.map((item, index) => `
                  <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${item.category_name}</td>
                    <td class="qty-col">${item.quantity}</td>
                    <td class="rate-col">₹${item.sale_price.toFixed(2)}</td>
                    <td class="amount-col">₹${(item.sale_price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals-section">
              <div class="total-row">
                <span><strong>Total:</strong></span>
                <span>₹${cartTotal.toFixed(2)}</span>
              </div>
              ${totalDiscount > 0 ? `
                <div class="total-row">
                  <span><strong>Total Discount:</strong></span>
                  <span>₹${totalDiscount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="taxes-section">
                <div class="total-row">
                  <span><strong>SGST:</strong></span>
                  <span>₹${sgst.toFixed(2)}</span>
                </div>
                <div class="total-row grand-total">
                  <span><strong>CGST:</strong></span>
                  <span>₹${cgst.toFixed(2)}</span>
                </div>
              </div>
              <div class="total-row grand-total" style="margin-top: 10px;">
                <span><strong>Grand Total (incl taxes):</strong></span>
                <span>₹${finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Estimate/Challan</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .receipt { max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
            .items { margin: 10px 0; }
            .item { margin: 5px 0; }
            .totals { margin-top: 15px; }
            .final-total { font-weight: bold; font-size: 1.1em; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h2>Kalan Vastralya</h2>
              <h3>Estimate/Challan</h3>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span>Estimate No:</span>
              <span>${estimateNumber}</span>
            </div>
            <div class="row">
              <span>Date:</span>
              <span>${format(new Date(), 'dd/MM/yyyy hh:mm a')}</span>
            </div>
            ${customerName ? `
              <div class="row">
                <span>Customer:</span>
                <span>${customerName}</span>
              </div>
            ` : ''}
            ${customerMobile ? `
              <div class="row">
                <span>Mobile:</span>
                <span>${customerMobile}</span>
              </div>
            ` : ''}
            ${customerAddress ? `
              <div class="row">
                <span>Address:</span>
                <span>${customerAddress}</span>
              </div>
            ` : ''}
            ${customerGstin ? `
              <div class="row">
                <span>GSTIN:</span>
                <span>${customerGstin}</span>
              </div>
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="items">
              <strong>Items:</strong>
              ${cartItems.map(item => `
                <div class="item">
                  <div class="row">
                    <span>${item.category_name}</span>
                    <span>₹${item.sale_price}</span>
                  </div>
                  <div class="row">
                    <span>Qty: ${item.quantity}</span>
                    <span>₹${(item.sale_price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div class="divider"></div>
            
            <div class="totals">
              <div class="row">
                <span>Amount:</span>
                <span>₹${cartTotal.toFixed(2)}</span>
              </div>
              ${totalDiscount > 0 ? `
                <div class="row">
                  <span>Total Discount:</span>
                  <span>₹${totalDiscount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="row final-total">
                <span>Grand Total (incl taxes):</span>
                <span>₹${finalTotal.toFixed(2)}</span>
              </div>
            </div>
            
            ${remarks ? `
              <div class="divider"></div>
              <div>
                <strong>Remarks:</strong>
                <p>${remarks}</p>
              </div>
            ` : ''}
          </div>
        </body>
        </html>
      `;
    }

    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
    receiptWindow.print();
  };

  // Add validation function for cart quantity updates
  const updateCartItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const item = cartItems[index];
    const product = products.find(p => p.id === item.id);
    
    if (!product) {
      toast.error('Product not found');
      return;
    }

    // Check if new quantity exceeds available stock
    if (newQuantity > product.quantity) {
      toast.error(`Only ${product.quantity} items available in stock`);
      return;
    }

    const updatedItems = [...cartItems];
    updatedItems[index] = {
      ...item,
      quantity: newQuantity
    };
    setCartItems(updatedItems);
  };

  const handleCreateSale = async () => {
    try {
      // Optimistically update the inventory
      const optimisticCartItems = cartItems.map(item => ({
        id: item.id,
        quantity: item.quantity
      }));

      // Create the sale
      await createSaleMutation.mutateAsync();

      // Update inventory quantities
      for (const item of optimisticCartItems) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          await updateQuantityMutation.mutateAsync({
            id: item.id,
            quantity: -item.quantity
          });
        }
      }
    } catch (error: any) {
      console.error('Error creating sale:', error);
      toast.error(error?.message || 'Failed to create sale');
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-2 gap-4">
        <Card title="New Sale">
          <div className="space-y-4">
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  id="barcode"
                  placeholder="Scan or enter barcode"
                  className="pl-8"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>
              {scannedProduct && (
                <div className="flex items-center space-x-2 mt-2">
                  <CheckCircle className="text-green-500 h-5 w-5" />
                  <span>Product found: {scannedProduct.category_name}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  type="text"
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customerMobile">Customer Mobile</Label>
                <Input
                  type="tel"
                  id="customerMobile"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customerAddress">Customer Address</Label>
              <Input
                type="text"
                id="customerAddress"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="customerGstin">Customer GSTIN</Label>
              <Input
                type="text"
                id="customerGstin"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="saleType">Sale Type</Label>
                <Select value={saleType} onValueChange={(value) => setSaleType(value as 'bill' | 'estimate')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sale type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bill">Bill</SelectItem>
                    <SelectItem value="estimate">Estimate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="paymentMode">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Enter remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card title="Cart">
          {cartItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No items in cart</p>
          ) : (
            <div className="space-y-2">
              {cartItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{item.category_name}</div>
                    <div className="text-sm text-gray-500">₹{item.sale_price} each</div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded bg-gray-200"
                        onClick={() => updateCartItemQuantity(index, item.quantity - 1)}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-center w-8">{item.quantity}</span>
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded bg-gray-200"
                        onClick={() => updateCartItemQuantity(index, item.quantity + 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <div className="text-right min-w-[80px]">
                      <div className="font-medium">
                        ₹{(item.sale_price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      className="p-1 text-gray-500 hover:text-red-500"
                      onClick={() => removeFromCart(index)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="flex items-center justify-between">
                <Label htmlFor="discount">Total Discount</Label>
                <Input
                  type="number"
                  id="discount"
                  className="w-24 text-right"
                  value={totalDiscount}
                  onChange={(e) => setTotalDiscount(parseFloat(e.target.value))}
                />
              </div>

              <div className="py-2 font-medium text-right text-sm">
                <div>Total: ₹{cartTotal.toFixed(2)}</div>
                <div>Discount: ₹{totalDiscount.toFixed(2)}</div>
                <div className="text-base">Final Total: ₹{finalTotal.toFixed(2)}</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 flex justify-end space-x-2">
        <Button variant="secondary" onClick={resetForm}>
          Reset
        </Button>
        <Button onClick={generateReceipt}>
          Generate Receipt
        </Button>
        <Button onClick={handleCreateSale} disabled={createSaleMutation.isPending}>
          {createSaleMutation.isPending ? 'Creating...' : 'Create Sale'}
        </Button>
      </div>
    </Layout>
  );
};

export default NewSale;
