
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Barcode, Plus, Minus, X } from 'lucide-react';
import { getProductByBarcodeApi, createSaleApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { CartItem } from '@/contexts/AppContext';

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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  
  // Effect to recalculate totals when cart changes
  useEffect(() => {
    const total = cartItems.reduce((sum, item) => sum + item.item_final_price, 0);
    setTotalAmount(total);
    setFinalAmount(total - discount);
  }, [cartItems, discount]);
  
  // Effect to update discount when final amount changes
  useEffect(() => {
    const calculatedDiscount = totalAmount - finalAmount;
    if (calculatedDiscount !== discount) {
      setDiscount(calculatedDiscount);
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
          return {
            ...item,
            quantity: newQuantity,
            item_final_price: data.sale_price * newQuantity
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
    meta: {
      onSuccess: handleProductSuccess
    },
    onError: (error: any) => {
      console.error('Error searching product:', error);
      toast.error('Failed to search product');
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
      // Navigate to the sales report
      navigate('/sales-report');
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
      
      // Manually call the success handler because Tanstack Query's meta.onSuccess isn't working as expected
      if (result.data) {
        handleProductSuccess(result.data);
      }
    } catch (error) {
      console.error("Error searching for product:", error);
    }
  };
  
  // Handle update item quantity
  const updateItemQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      return;
    }
    
    const newCart = cartItems.map(item => {
      if (item.product_id === productId) {
        return {
          ...item,
          quantity: newQuantity,
          item_final_price: item.sale_price * newQuantity
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
      items: cartItems
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
                        <td className="px-4 py-2 text-right">₹{item.sale_price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₹{item.item_final_price.toFixed(2)}</td>
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
                    <span>Discount:</span>
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
    </Layout>
  );
};

export default NewSale;
