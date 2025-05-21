
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { formatInTimeZone } = require('date-fns-tz');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Set up SQLite database
const dbPath = path.join(dataDir, 'kala-vastralya.db');
const db = new Database(dbPath);

// Set up multer for file uploads
const upload = multer({ dest: path.join(dataDir, 'uploads/') });

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize database tables
function initDb() {
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS manufacturers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      category_id INTEGER,
      manufacturer_id INTEGER,
      quantity INTEGER,
      cost_price REAL,
      sale_price REAL,
      FOREIGN KEY (category_id) REFERENCES categories (id),
      FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      number TEXT UNIQUE,
      customer_name TEXT,
      mobile TEXT,
      payment_mode TEXT,
      remarks TEXT,
      date TEXT,
      total_amount REAL,
      total_discount REAL,
      final_amount REAL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      category_name TEXT,
      sale_price REAL,
      quantity INTEGER,
      item_final_price REAL,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  // Add some initial data if tables are empty
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (categoryCount === 0) {
    const categories = ['Sarees', 'Shirts', 'Pants', 'Coord Set'];
    categories.forEach(category => {
      db.prepare('INSERT INTO categories (name) VALUES (?)').run(category);
    });
  }

  const manufacturerCount = db.prepare('SELECT COUNT(*) as count FROM manufacturers').get().count;
  if (manufacturerCount === 0) {
    const manufacturers = ['XYZ Clothing', 'ABC Manufacturer', 'JKL Textiles', 'Geeta tailers'];
    manufacturers.forEach(manufacturer => {
      db.prepare('INSERT INTO manufacturers (name) VALUES (?)').run(manufacturer);
    });
  }
  
  // Add some sample products if needed
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    const sampleProducts = [
      {
        barcode: '12345678',
        category: 'Sarees',
        manufacturer: 'XYZ Clothing',
        quantity: 31,
        costPrice: 1000,
        salePrice: 2000
      },
      {
        barcode: '87654321',
        category: 'Coord Set',
        manufacturer: 'ABC Manufacturer',
        quantity: 20,
        costPrice: 3500,
        salePrice: 5000
      },
      {
        barcode: '10101010',
        category: 'Shirts',
        manufacturer: 'JKL Textiles',
        quantity: 24,
        costPrice: 150,
        salePrice: 300
      },
      {
        barcode: '10000000',
        category: 'Pants',
        manufacturer: 'Geeta tailers',
        quantity: 32,
        costPrice: 500,
        salePrice: 860
      }
    ];

    sampleProducts.forEach(product => {
      const categoryId = db.prepare('SELECT id FROM categories WHERE name = ?').get(product.category).id;
      const manufacturerId = db.prepare('SELECT id FROM manufacturers WHERE name = ?').get(product.manufacturer).id;

      db.prepare(`
        INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        product.barcode,
        categoryId,
        manufacturerId,
        product.quantity,
        product.costPrice,
        product.salePrice
      );
    });
  }
}

// Initialize database
initDb();

// Helper function to get current date in IST
function getCurrentDateIST() {
  return formatInTimeZone(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
}

// --------------------------------
// Category Routes
// --------------------------------

// Get all categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Add a new category
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// --------------------------------
// Manufacturer Routes
// --------------------------------

// Get all manufacturers
app.get('/api/manufacturers', (req, res) => {
  try {
    const manufacturers = db.prepare('SELECT * FROM manufacturers ORDER BY name').all();
    res.json(manufacturers);
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
});

// Add a new manufacturer
app.post('/api/manufacturers', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Manufacturer name is required' });
  }

  try {
    const result = db.prepare('INSERT INTO manufacturers (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Manufacturer already exists' });
    }
    console.error('Error creating manufacturer:', error);
    res.status(500).json({ error: 'Failed to create manufacturer' });
  }
});

// --------------------------------
// Product Routes
// --------------------------------

// Get all products with category and manufacturer names
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT 
        p.id,
        p.barcode,
        p.quantity,
        p.cost_price,
        p.sale_price,
        c.name AS category,
        m.name AS manufacturer,
        c.id AS category_id,
        m.id AS manufacturer_id
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
    `).all();
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by barcode
app.get('/api/products/:barcode', (req, res) => {
  const { barcode } = req.params;
  
  try {
    const product = db.prepare(`
      SELECT 
        p.id,
        p.barcode,
        p.quantity,
        p.cost_price,
        p.sale_price,
        c.name AS category,
        m.name AS manufacturer
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE p.barcode = ?
    `).get(barcode);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Add a new product
app.post('/api/products', (req, res) => {
  const { barcode, category_id, manufacturer_id, quantity, cost_price, sale_price } = req.body;
  
  if (!barcode || !category_id || !manufacturer_id || !quantity || !cost_price || !sale_price) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(barcode, category_id, manufacturer_id, quantity, cost_price, sale_price);
    
    res.status(201).json({ 
      id: result.lastInsertRowid,
      barcode,
      category_id,
      manufacturer_id,
      quantity,
      cost_price,
      sale_price
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Barcode already exists' });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product quantity
app.patch('/api/products/:id/quantity', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(quantity, id);
    
    res.json({ id, quantity });
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({ error: 'Failed to update product quantity' });
  }
});

// --------------------------------
// Sales Routes
// --------------------------------

// Create a new sale
app.post('/api/sales', (req, res) => {
  const { 
    type, 
    customer_name, 
    mobile, 
    payment_mode, 
    remarks, 
    total_amount, 
    total_discount,
    final_amount,
    items 
  } = req.body;
  
  if (!type || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Type and items are required' });
  }
  
  const date = getCurrentDateIST();
  
  try {
    // Start a transaction
    const transaction = db.transaction(() => {
      // Generate the next number
      const prefix = type === 'bill' ? 'BILL' : 'EST';
      const lastSale = db.prepare(`
        SELECT number FROM sales WHERE type = ? ORDER BY id DESC LIMIT 1
      `).get(type);
      
      let nextNumber = 1;
      if (lastSale) {
        const lastNumberStr = lastSale.number.split('-')[1];
        nextNumber = parseInt(lastNumberStr, 10) + 1;
      }
      
      const formattedNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
      const finalCustomerName = customer_name || 'Walk In Customer';
      
      // Insert the sale
      const saleResult = db.prepare(`
        INSERT INTO sales (
          type, number, customer_name, mobile, payment_mode, remarks, 
          date, total_amount, total_discount, final_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        type, 
        formattedNumber, 
        finalCustomerName, 
        mobile || null, 
        payment_mode || null, 
        remarks || null,
        date,
        total_amount,
        total_discount || 0,
        final_amount
      );
      
      const saleId = saleResult.lastInsertRowid;
      
      // Insert sale items and update inventory
      items.forEach(item => {
        // Insert sale item
        db.prepare(`
          INSERT INTO sale_items (
            sale_id, product_id, category_name, sale_price, quantity, item_final_price
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          saleId,
          item.product_id,
          item.category_name,
          item.sale_price,
          item.quantity,
          item.item_final_price
        );
        
        // Update product quantity
        db.prepare(`
          UPDATE products 
          SET quantity = quantity - ? 
          WHERE id = ?
        `).run(item.quantity, item.product_id);
      });
      
      return {
        id: saleId,
        number: formattedNumber,
        date: date
      };
    });
    
    // Execute the transaction
    const result = transaction();
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// Get all sales with filtering options
app.get('/api/sales', (req, res) => {
  const { date, startDate, endDate, type, search } = req.query;
  
  try {
    let query = `
      SELECT 
        s.id, s.type, s.number, s.customer_name, s.mobile, 
        s.payment_mode, s.date, s.total_amount, s.total_discount, s.final_amount
      FROM sales s
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Apply date filter
    if (date) {
      query += ` AND date(s.date) = date(?)`;
      queryParams.push(date);
    } else if (startDate && endDate) {
      query += ` AND date(s.date) BETWEEN date(?) AND date(?)`;
      queryParams.push(startDate, endDate);
    }
    
    // Apply type filter
    if (type && (type === 'bill' || type === 'estimate')) {
      query += ` AND s.type = ?`;
      queryParams.push(type);
    }
    
    // Apply search filter
    if (search) {
      query += ` AND (s.customer_name LIKE ? OR s.mobile LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    // Order by date descending
    query += ` ORDER BY s.date DESC`;
    
    const sales = db.prepare(query).all(...queryParams);
    
    res.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get a single sale with its items
app.get('/api/sales/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const sale = db.prepare(`
      SELECT 
        s.id, s.type, s.number, s.customer_name, s.mobile, 
        s.payment_mode, s.remarks, s.date, s.total_amount, s.total_discount, s.final_amount
      FROM sales s
      WHERE s.id = ?
    `).get(id);
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const items = db.prepare(`
      SELECT 
        si.id, si.product_id, si.category_name, si.sale_price, 
        si.quantity, si.item_final_price,
        p.barcode
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(id);
    
    sale.items = items;
    
    res.json(sale);
  } catch (error) {
    console.error('Error fetching sale details:', error);
    res.status(500).json({ error: 'Failed to fetch sale details' });
  }
});

// Update a sale
app.put('/api/sales/:id', (req, res) => {
  const { id } = req.params;
  const { 
    total_amount,
    total_discount, 
    final_amount,
    items 
  } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items are required' });
  }
  
  try {
    // Start a transaction
    const transaction = db.transaction(() => {
      // Get the original sale
      const originalSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
      
      if (!originalSale) {
        throw new Error('Sale not found');
      }
      
      // Get original sale items to restore inventory
      const originalItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
      
      // Restore inventory quantities for original items
      originalItems.forEach(item => {
        db.prepare(`
          UPDATE products
          SET quantity = quantity + ?
          WHERE id = ?
        `).run(item.quantity, item.product_id);
      });
      
      // Update the sale
      db.prepare(`
        UPDATE sales
        SET total_amount = ?, total_discount = ?, final_amount = ?
        WHERE id = ?
      `).run(total_amount, total_discount || 0, final_amount, id);
      
      // Delete all existing sale items
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      
      // Insert updated sale items
      items.forEach(item => {
        // Insert sale item
        db.prepare(`
          INSERT INTO sale_items (
            sale_id, product_id, category_name, sale_price, quantity, item_final_price
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id,
          item.product_id,
          item.category_name,
          item.sale_price,
          item.quantity,
          item.item_final_price
        );
        
        // Update product quantity
        db.prepare(`
          UPDATE products 
          SET quantity = quantity - ? 
          WHERE id = ?
        `).run(item.quantity, item.product_id);
      });
      
      return originalSale;
    });
    
    // Execute the transaction
    const result = transaction();
    
    res.json({
      id: parseInt(id),
      message: 'Sale updated successfully'
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    if (error.message === 'Sale not found') {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.status(500).json({ error: 'Failed to update sale' });
  }
});

// --------------------------------
// Excel Import/Export Routes
// --------------------------------

// Import products from Excel
app.post('/api/import/products', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }
    
    // Validate required columns
    const requiredColumns = ['barcode', 'category', 'manufacturer', 'quantity', 'cost_price', 'sale_price'];
    const missingColumns = requiredColumns.filter(col => !Object.keys(data[0]).includes(col));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}` 
      });
    }
    
    // Start a transaction
    const transaction = db.transaction(() => {
      let imported = 0;
      let errors = [];
      
      data.forEach((row, index) => {
        try {
          // Get or create category
          let categoryId;
          const existingCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category);
          
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(row.category);
            categoryId = result.lastInsertRowid;
          }
          
          // Get or create manufacturer
          let manufacturerId;
          const existingManufacturer = db.prepare('SELECT id FROM manufacturers WHERE name = ?').get(row.manufacturer);
          
          if (existingManufacturer) {
            manufacturerId = existingManufacturer.id;
          } else {
            const result = db.prepare('INSERT INTO manufacturers (name) VALUES (?)').run(row.manufacturer);
            manufacturerId = result.lastInsertRowid;
          }
          
          // Check if product exists
          const existingProduct = db.prepare('SELECT * FROM products WHERE barcode = ?').get(row.barcode);
          
          if (existingProduct) {
            // Update existing product
            db.prepare(`
              UPDATE products
              SET category_id = ?, manufacturer_id = ?, quantity = ?, cost_price = ?, sale_price = ?
              WHERE id = ?
            `).run(
              categoryId,
              manufacturerId,
              row.quantity,
              row.cost_price,
              row.sale_price,
              existingProduct.id
            );
          } else {
            // Insert new product
            db.prepare(`
              INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              row.barcode,
              categoryId,
              manufacturerId,
              row.quantity,
              row.cost_price,
              row.sale_price
            );
          }
          
          imported++;
        } catch (err) {
          errors.push({ row: index + 1, error: err.message });
        }
      });
      
      return { imported, errors };
    });
    
    // Execute the transaction
    const result = transaction();
    
    // Clean up the temporary file
    fs.unlinkSync(filePath);
    
    res.json({
      message: `Successfully imported ${result.imported} products`,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error importing products:', error);
    
    // Clean up the temporary file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to import products' });
  }
});

// Export products to Excel
app.get('/api/export/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT 
        p.barcode,
        c.name AS category,
        m.name AS manufacturer,
        p.quantity,
        p.cost_price,
        p.sale_price
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
    `).all();
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found to export' });
    }
    
    // Create a new workbook
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(products);
    
    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Products');
    
    // Create a buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send the buffer
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ error: 'Failed to export products' });
  }
});

// Export sales to Excel
app.get('/api/export/sales', (req, res) => {
  const { date, startDate, endDate, type, search } = req.query;
  
  try {
    let query = `
      SELECT 
        s.id, s.type, s.number, s.customer_name, s.mobile, 
        s.payment_mode, s.date, s.total_amount, s.total_discount, s.final_amount
      FROM sales s
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Apply date filter
    if (date) {
      query += ` AND date(s.date) = date(?)`;
      queryParams.push(date);
    } else if (startDate && endDate) {
      query += ` AND date(s.date) BETWEEN date(?) AND date(?)`;
      queryParams.push(startDate, endDate);
    }
    
    // Apply type filter
    if (type && (type === 'bill' || type === 'estimate')) {
      query += ` AND s.type = ?`;
      queryParams.push(type);
    }
    
    // Apply search filter
    if (search) {
      query += ` AND (s.customer_name LIKE ? OR s.mobile LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    // Order by date descending
    query += ` ORDER BY s.date DESC`;
    
    const sales = db.prepare(query).all(...queryParams);
    
    if (sales.length === 0) {
      return res.status(404).json({ error: 'No sales found to export' });
    }
    
    // Get items for each sale
    const salesWithItems = sales.map(sale => {
      const items = db.prepare(`
        SELECT 
          si.product_id, si.category_name, si.sale_price, 
          si.quantity, si.item_final_price
        FROM sale_items si
        WHERE si.sale_id = ?
      `).all(sale.id);
      
      sale.items = items.length;
      return sale;
    });
    
    // Create a new workbook
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(salesWithItems);
    
    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sales');
    
    // Create a buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=sales.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send the buffer
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting sales:', error);
    res.status(500).json({ error: 'Failed to export sales' });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
