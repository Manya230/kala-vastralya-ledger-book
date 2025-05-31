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
import api from '@/lib/api';
import { CartItem } from '@/contexts/AppContext';

interface CartItemWithDiscount extends CartItem {
  discount_percent: number;
  discount_amount: number;
}

const NewSale = () => {
  const navigate = useNavigate();
  
  // Form states
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstNumber, setCustomerGstNumber] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState<string | undefined>(undefined);
  const [remarks, setRemarks] = useState('');
  
  // Cart states
  const [cartItems, setCartItems] = useState<CartItemWithDiscount[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  
  // Fetch all products to check inventory
  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await api.get('/products');
      return response.data;
    }
  });
  
  // Fetch all sales to generate proper bill/estimate numbers
  const { data: allSales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await api.get('/sales');
      return response.data;
    }
  });
  
  // Effect to recalculate totals when cart changes
  useEffect(() => {
    const total = cartItems.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);
    const totalDiscountAmount = cartItems.reduce((sum, item) => sum + item.discount_amount, 0);
    
    setTotalAmount(total);
    setDiscount(totalDiscountAmount);
    setFinalAmount(total - totalDiscountAmount);
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
            item_final_price: updatedPrice,
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
    meta: {
      onSuccess: handleProductSuccess,
      onError: () => {
        toast.error('Product not found');
      }
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
      toast.success(`${data.type === 'bill' ? 'Bill' : 'Estimate'} ${data.number} saved successfully`);
      navigate('/sales-report');
    },
    onError: (error) => {
      console.error('Error creating sale:', error);
      toast.error('Failed to save sale');
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
  
  // Handle update item quantity with inventory validation
  const updateItemQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      return;
    }
    
    // Find the product in inventory to check available quantity
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
      toast.error('Product not found in inventory');
      return;
    }
    
    // Calculate how much quantity is already used by other cart items of the same product
    const currentCartItem = cartItems.find(item => item.product_id === productId);
    const otherCartQuantity = cartItems
      .filter(item => item.product_id === productId && item !== currentCartItem)
      .reduce((sum, item) => sum + item.quantity, 0);
    
    const availableQuantity = product.quantity - otherCartQuantity;
    
    if (newQuantity > availableQuantity) {
      toast.error(`Only ${availableQuantity} items available in stock`);
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
          item_final_price: updatedPrice
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
          item_final_price: totalPrice // Keep the original amount, don't subtract discount
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
  
  // Generate receipt data
  const generateReceiptData = (type: 'bill' | 'estimate') => {
    // Generate proper bill/estimate numbers
    const salesOfType = allSales.filter(sale => sale.type === type);
    const lastNumber = salesOfType.length > 0 
      ? Math.max(...salesOfType.map(sale => {
          const match = sale.number.match(/\d+$/);
          return match ? parseInt(match[0]) : 0;
        }))
      : 0;
    const nextNumber = lastNumber + 1;
    const properNumber = type === 'bill' 
      ? `BILL-${String(nextNumber).padStart(4, '0')}`
      : `EST-${String(nextNumber).padStart(4, '0')}`;
    
    return {
      id: 0, // temporary id
      type,
      number: properNumber,
      customer_name: customerName || 'Walk In Customer',
      mobile: mobileNumber,
      customer_address: customerAddress,
      customer_gst_number: customerGstNumber,
      payment_mode: paymentMode,
      date: new Date().toISOString(),
      total_amount: totalAmount,
      total_discount: discount,
      final_amount: finalAmount,
      remarks,
      items: cartItems.map(item => ({
        ...item,
        barcode: item.barcode
      }))
    };
  };
  
  // Generate print HTML
  const generatePrintHTML = (receiptData: any, type: 'bill' | 'estimate') => {
    const isEstimate = type === 'estimate';
    
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
            .header { 
              border-bottom: 1px solid black; 
              padding: 10px; 
              text-align: center; 
              font-weight: normal; 
              font-size: 18px; 
            }
            .contact-row { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              border-bottom: 1px solid black; 
            }
            .contact-left { 
              border-right: 1px solid black; 
              padding: 10px; 
              font-size: 14px; 
            }
            .contact-right { 
              padding: 10px; 
              text-align: right; 
              font-size: 14px; 
            }
            .company-name { 
              text-align: center; 
              border-bottom: 1px solid black; 
              padding: 10px; 
              font-weight: bold; 
              font-size: 24px; 
            }
            .address { 
              text-align: center; 
              border-bottom: 1px solid black; 
              padding: 10px; 
              font-size: 14px; 
            }
            .details-row { 
              display: grid; 
              grid-template-columns: 3fr 1fr; 
              border-bottom: 1px solid black; 
            }
            .customer-details { 
              border-right: 1px solid black; 
            }
            .customer-header { 
              border-bottom: 1px solid black; 
              padding: 10px; 
              text-align: center; 
              font-weight: bold; 
            }
            .customer-row { 
              display: grid; 
              grid-template-columns: 1fr 2fr; 
              border-bottom: 1px solid black; 
            }
            .customer-row:last-child { 
              border-bottom: none; 
            }
            .customer-label { 
              border-right: 1px solid black; 
              padding: 10px; 
              font-weight: bold; 
            }
            .customer-value { 
              padding: 10px; 
            }
            .bill-info { 
              display: flex; 
              flex-direction: column; 
              height: 100%; 
            }
            .bill-info-item { 
              flex: 1; 
              padding: 10px; 
              display: flex; 
              align-items: center; 
              border-bottom: 1px solid black; 
            }
            .bill-info-item:last-child { 
              border-bottom: none; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
            }
            th, td { 
              border: 1px solid black; 
              padding: 10px; 
              text-align: left; 
            }
            th { 
              background-color: #f5f5f5; 
              font-weight: bold; 
            }
            .text-center { 
              text-align: center; 
            }
            .text-right { 
              text-align: right; 
            }
            .totals-section { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
            }
            .taxes { 
              border-right: 1px solid black; 
              display: flex; /* For flex-grow to work */
              flex-direction: column; /* Stack items vertically */
            }
            .tax-row { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              border-top: 1px solid black; 
              border-bottom: 1px solid black; 
            }
            .tax-label { 
              border-right: 1px solid black; 
              padding: 10px; 
              text-align: center; 
              font-weight: bold; 
            }
            .tax-value { 
              padding: 10px; 
              text-align: center; 
            }
            .total-row { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              border-bottom: 1px solid black; 
            }
            .total-label { 
              border-right: 1px solid black; 
              padding: 10px; 
              text-align: right; 
              font-weight: bold; 
            }
            .total-value { 
              padding: 10px; 
              text-align: right; 
            }
            .footer { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              border-top: 1px solid black; 
            }
            .footer-left { 
              border-right: 1px solid black; 
              padding: 10px; 
              text-align: center; 
            }
            .footer-right { 
              padding: 10px; 
              text-align: center;
              display: flex;
              align-items: flex-end;
              justify-content: center; 
            }
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
              div[style*="max-width: 800px"][style*="border: 2px solid black"] { /* Estimate border remains 2px */
                margin: 0 auto !important; 
                /* border: 2px solid black !important; */ /* This line is commented out to not override estimate's specific border if it should be different */
                box-shadow: none !important; 
              }
            }
          </style>
        </head>
        <body>
          ${isEstimate ? `
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
                  ${(receiptData.items || []).map((item: CartItem, index: number) => `
                    <tr>
                      <td style="border: 1px solid black; padding: 10px;">
                        <div style="font-weight: bold;">${item.category_name}</div>
                        ${item.barcode ? `<div style="font-size: 12px; color: #666;">${item.barcode}</div>` : ''}
                      </td>
                      <td style="border: 1px solid black; padding: 10px; text-align: center;">${item.quantity}</td>
                      <td style="border: 1px solid black; padding: 10px; text-align: right;">₹${(item.sale_price ?? 0).toFixed(2)}</td>
                      <td style="border: 1px solid black; padding: 10px; text-align: right;">₹${(item.sale_price * item.quantity).toFixed(2)}</td>
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
          ` : `
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
                  ${(receiptData.items || []).map((item: CartItem, index: number) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${item.category_name}</td>
                      <td class="text-center">${item.quantity}</td>
                      <td class="text-right">₹ ${(item.sale_price ?? 0).toFixed(0)}</td>
                      <td class="text-right">₹ ${(item.sale_price * item.quantity).toFixed(0)}</td>
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
          `}
        </body>
      </html>
    `;
  };
  
  // Handle print estimate/bill
  const handlePrint = (type: 'bill' | 'estimate') => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one item to the cart');
      return;
    }
    
    const receiptData = generateReceiptData(type);
    const printHTML = generatePrintHTML(receiptData, type);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    }
  };
  
  // Handle save bill or estimate
  const handleSaveSale = (type: 'bill' | 'estimate') => {
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
      customer_address: customerAddress,
      customer_gstin: customerGstNumber,
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
              
              <div>
                <label htmlFor="customerAddress" className="block text-sm font-medium mb-1">
                  Address
                </label>
                <Textarea
                  id="customerAddress"
                  placeholder="Enter customer address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  rows={2}
                />
              </div>
              
              <div>
                <label htmlFor="customerGstNumber" className="block text-sm font-medium mb-1">
                  GSTIN Number
                </label>
                <Input
                  id="customerGstNumber"
                  placeholder="Enter GSTIN number"
                  value={customerGstNumber}
                  onChange={(e) => setCustomerGstNumber(e.target.value)}
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
                      <th className="px-4 py-2 text-right">Amount</th>
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
                    <span>Total:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Total Discount:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={discount}
                        onChange={handleDiscountChange}
                        className="h-7 text-right"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Grand Total (incl taxes):</span>
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
            
            <div className="mt-6 space-y-4">
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePrint('estimate')}
                  disabled={cartItems.length === 0}
                  className="flex items-center gap-1"
                >
                  <Printer size={16} />
                  Print Estimate
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePrint('bill')}
                  disabled={cartItems.length === 0}
                  className="flex items-center gap-1"
                >
                  <Printer size={16} />
                  Print Bill
                </Button>
              </div>
              
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveSale('estimate')}
                  disabled={createSaleMutation.isPending || cartItems.length === 0}
                >
                  Save Estimate
                </Button>
                
                <Button
                  type="button"
                  onClick={() => handleSaveSale('bill')}
                  disabled={createSaleMutation.isPending || cartItems.length === 0}
                >
                  Save Bill
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Layout>
  );
};

export default NewSale;
