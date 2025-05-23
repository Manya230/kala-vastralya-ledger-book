
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Barcode, Plus, Minus, X, Printer } from 'lucide-react';
import { getProductByBarcodeApi, createSaleApi } from '@/lib/api';
import { CartItem } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CartItemWithDiscount extends CartItem {
  discount_percent: number;
  discount_amount: number;
}

const NewSale = () => {
  const navigate = useNavigate();
  
  // Form states
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState<string | undefined>(undefined);
  const [remarks, setRemarks] = useState('');
  
  // Cart states
  const [cartItems, setCartItems] = useState<CartItemWithDiscount[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  
  // Receipt states
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptType, setReceiptType] = useState<'bill' | 'estimate'>('bill');
  
  // Effect to recalculate totals when cart changes
  useEffect(() => {
    const total = cartItems.reduce((sum, item) => sum + item.item_final_price, 0);
    const totalDiscountAmount = cartItems.reduce((sum, item) => sum + item.discount_amount, 0);
    
    setTotalAmount(total + totalDiscountAmount);
    setDiscount(totalDiscountAmount);
    setFinalAmount(total);
  }, [cartItems]);
  
  // Effect to update discount when final amount changes
  useEffect(() => {
    // Only update the final amount if discount is manually changed (not from item discounts)
    const calculatedDiscount = totalAmount - finalAmount;
    if (calculatedDiscount !== discount) {
      setDiscount(calculatedDiscount >= 0 ? calculatedDiscount : 0);
    }
  }, [finalAmount, totalAmount]);
  
  // Handle product data success
  const handleProductSuccess = useCallback((data: any) => {
    console.log("Product data received:", data);
    
    if (!data) {
      toast.error('Product not found');
      return;
    }
    
    if (data.quantity < quantity) {
      toast.error(`Only ${data.quantity} items available in stock`);
      return;
    }
    
    // Check if the product is already in the cart
    const existingItem = cartItems.find(item => item.product_id === data.id);
    
    if (existingItem) {
      // Update existing item
      const newCart = cartItems.map(item => {
        if (item.product_id === data.id) {
          const newQuantity = item.quantity + quantity;
          if (newQuantity > data.quantity) {
            toast.error(`Only ${data.quantity} items available in stock`);
            return item;
          }
          
          const updatedPrice = data.sale_price * newQuantity;
          const discount_amount = (item.discount_percent / 100) * updatedPrice;
          
          return {
            ...item,
            quantity: newQuantity,
            item_final_price: updatedPrice - discount_amount,
            discount_amount: discount_amount
          };
        }
        return item;
      });
      
      setCartItems(newCart);
    } else {
      // Add new item
      setCartItems([...cartItems, {
        product_id: data.id,
        barcode: data.barcode,
        category_name: data.category,
        sale_price: data.sale_price,
        quantity: quantity,
        discount_percent: 0,
        discount_amount: 0,
        item_final_price: data.sale_price * quantity
      }]);
    }
    
    // Reset barcode and quantity
    setBarcode('');
    setQuantity(1);
  }, [cartItems, quantity]);
  
  // Product search query
  const { refetch: searchProduct } = useQuery({
    queryKey: ['product', barcode],
    queryFn: () => getProductByBarcodeApi(barcode),
    enabled: false,
    onSuccess: handleProductSuccess,
    onError: () => {
      toast.error('Product not found');
    }
  });
  
  // Handle mobile number input
  const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and limit to 10 digits
    if (/^\d*$/.test(value) && value.length <= 10) {
      setMobileNumber(value);
    }
  };
  
  // Handle barcode input
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and limit to 8 digits
    if (/^\d*$/.test(value) && value.length <= 8) {
      setBarcode(value);
    }
  };
  
  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: createSaleApi,
    onSuccess: (data) => {
      toast.success(`${data.type === 'bill' ? 'Bill' : 'Estimate'} ${data.number} created successfully`);
      
      // Show receipt before navigating
      setReceiptData({
        ...data,
        customer_name: customerName,
        mobile: mobileNumber,
        payment_mode: paymentMode,
        items: cartItems.map(item => ({
          ...item,
          barcode: item.barcode
        }))
      });
      setReceiptType(data.type);
      setShowReceipt(true);
    },
    onError: (error) => {
      console.error('Error creating sale:', error);
      toast.error('Failed to create sale');
    }
  });
  
  // Handle add item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!barcode) {
      toast.error('Please enter a barcode');
      return;
    }
    
    if (quantity < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    
    console.log("Searching for product with barcode:", barcode);
    try {
      const result = await searchProduct();
      console.log("Search result:", result.data);
      if (result.data) {
        handleProductSuccess(result.data);
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      console.error("Error searching for product:", error);
      toast.error('Product not found');
    }
  };
  
  // Handle update item quantity
  const updateItemQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      return;
    }
    
    const newCart = cartItems.map(item => {
      if (item.product_id === productId) {
        const updatedPrice = item.sale_price * newQuantity;
        const discountAmount = (item.discount_percent / 100) * updatedPrice;
        
        return {
          ...item,
          quantity: newQuantity,
          discount_amount: discountAmount,
          item_final_price: updatedPrice - discountAmount
        };
      }
      return item;
    });
    
    setCartItems(newCart);
  };
  
  // Handle update item discount
  const updateItemDiscount = (productId: number, discountPercent: number) => {
    // Limit discount between 0 and 100
    const limitedDiscount = Math.max(0, Math.min(100, discountPercent));
    
    const newCart = cartItems.map(item => {
      if (item.product_id === productId) {
        const totalPrice = item.sale_price * item.quantity;
        const discountAmount = (limitedDiscount / 100) * totalPrice;
        
        return {
          ...item,
          discount_percent: limitedDiscount,
          discount_amount: discountAmount,
          item_final_price: totalPrice - discountAmount
        };
      }
      return item;
    });
    
    setCartItems(newCart);
  };
  
  // Handle remove item
  const removeItem = (productId: number) => {
    setCartItems(cartItems.filter(item => item.product_id !== productId));
  };
  
  // Handle create bill or estimate
  const handleCreateSale = (type: 'bill' | 'estimate') => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one item to the cart');
      return;
    }
    
    createSaleMutation.mutate({
      type,
      customer_name: customerName,
      mobile: mobileNumber,
      payment_mode: paymentMode,
      remarks,
      total_amount: totalAmount,
      total_discount: discount,
      final_amount: finalAmount,
      items: cartItems.map(({discount_percent, discount_amount, ...item}) => item)
    });
  };
  
  // Handle discount change
  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setDiscount(value);
    setFinalAmount(totalAmount - value);
  };
  
  // Handle final amount change
  const handleFinalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFinalAmount(value);
    const newDiscount = totalAmount - value;
    setDiscount(newDiscount >= 0 ? newDiscount : 0);
  };
  
  // Handle print receipt
  const handlePrint = () => {
    window.print();
  };
  
  // Handle close receipt
  const handleCloseReceipt = () => {
    setShowReceipt(false);
    navigate('/sales-report');
  };
  
  return (
    <Layout>
      <Card title="New Sale">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Customer Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Customer Details</h3>
            <div className="grid gap-4">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium mb-1">
                  Customer Name
                </label>
                <Input
                  id="customerName"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium mb-1">
                  Mobile Number
                </label>
                <Input
                  id="mobileNumber"
                  placeholder="Enter mobile number (10 digits max)"
                  value={mobileNumber}
                  onChange={handleMobileNumberChange}
                  maxLength={10}
                />
              </div>
            </div>
            
            <h3 className="text-lg font-medium mt-6 mb-4">Scan or Enter Barcode</h3>
            <form onSubmit={handleAddItem} className="grid gap-4">
              <div className="flex items-end gap-2">
                <div className="flex-grow">
                  <label htmlFor="barcode" className="block text-sm font-medium mb-1">
                    Barcode
                  </label>
                  <div className="relative">
                    <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      id="barcode"
                      placeholder="Scan or type barcode (8 digits max)"
                      className="pl-8"
                      value={barcode}
                      onChange={handleBarcodeChange}
                      maxLength={8}
                    />
                  </div>
                </div>
                
                <div className="w-20">
                  <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                    Qty
                  </label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                
                <Button type="submit" className="flex-shrink-0">
                  <Plus size={16} />
                  Add
                </Button>
              </div>
            </form>
            
            <h3 className="text-lg font-medium mt-6 mb-4">Payment Details</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Payment Mode
                </label>
                <RadioGroup value={paymentMode} onValueChange={setPaymentMode}>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash">Cash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="upi" id="upi" />
                      <Label htmlFor="upi">UPI</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <label htmlFor="remarks" className="block text-sm font-medium mb-1">
                  Remarks
                </label>
                <Textarea
                  id="remarks"
                  placeholder="Add any remarks or notes here..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
          
          {/* Cart */}
          <div>
            <h3 className="text-lg font-medium mb-4">Items</h3>
            
            {cartItems.length === 0 ? (
              <div className="bg-gray-50 p-4 text-center border rounded">
                <p className="text-gray-500">No items in cart</p>
              </div>
            ) : (
              <div className="border rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Discount</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{item.category_name}</div>
                          <div className="text-xs text-gray-500">{item.barcode}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center rounded bg-gray-200"
                              onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-center w-6">{item.quantity}</span>
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center rounded bg-gray-200"
                              onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">₹{(item.sale_price ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount_percent}
                            onChange={(e) => updateItemDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-right"
                          />%
                        </td>
                        <td className="px-4 py-2 text-right">₹{(item.item_final_price ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="p-1 text-gray-500 hover:text-red-500"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="bg-gray-50 p-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span>Final Price:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Total Discount:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={handleDiscountChange}
                        className="h-7 text-right"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">To Pay:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={finalAmount}
                        onChange={handleFinalAmountChange}
                        className="h-7 text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCreateSale('estimate')}
                disabled={createSaleMutation.isPending || cartItems.length === 0}
              >
                Create Estimate
              </Button>
              
              <Button
                type="button"
                onClick={() => handleCreateSale('bill')}
                disabled={createSaleMutation.isPending || cartItems.length === 0}
              >
                Create Bill
              </Button>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-3xl print:shadow-none print:border-none print:max-w-full">
          <DialogHeader className="relative print:mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 print:hidden"
              onClick={handleCloseReceipt}
            >
              <X size={16} />
            </Button>
            <DialogTitle className="text-center">
              {receiptType === 'bill' && <div className="text-xl font-bold">KALA VASTRALYA</div>}
              <div>
                {receiptType === 'bill' ? 'Bill' : 'Estimate'} Details
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {!receiptData ? (
            <div className="py-8 text-center">Loading...</div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {receiptType === 'bill' ? 'Bill' : 'Estimate'} Number
                  </p>
                  <p className="font-medium">{receiptData.number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{new Date(receiptData.date || Date.now()).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{receiptData.customer_name}</p>
                </div>
                {receiptData.mobile && (
                  <div>
                    <p className="text-sm text-gray-500">Mobile</p>
                    <p className="font-medium">{receiptData.mobile}</p>
                  </div>
                )}
                {receiptData.payment_mode && (
                  <div>
                    <p className="text-sm text-gray-500">Payment Mode</p>
                    <p className="font-medium capitalize">{receiptData.payment_mode}</p>
                  </div>
                )}
              </div>
              
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
                    {receiptData.items.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2">
                          <div className="font-medium">{item.category_name}</div>
                          <div className="text-xs text-gray-500">{item.barcode}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">₹{(item.sale_price ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₹{(item.item_final_price ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex justify-between mb-1">
                  <span>Total:</span>
                  <span>₹{receiptData.total_amount.toFixed(2)}</span>
                </div>
                
                {receiptData.total_discount > 0 && (
                  <div className="flex justify-between mb-1">
                    <span>Total Discount:</span>
                    <span>₹{receiptData.total_discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-medium">
                  <span>Final Amount:</span>
                  <span>₹{receiptData.final_amount.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-2 print:hidden">
                <Button onClick={handleCloseReceipt} variant="outline">
                  Close
                </Button>
                <Button onClick={handlePrint} className="flex items-center gap-1">
                  <Printer size={16} />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default NewSale;
