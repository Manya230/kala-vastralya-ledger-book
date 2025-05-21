
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Create the data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = sqlite3(path.join(dataDir, 'kala.db'));

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  
  CREATE TABLE IF NOT EXISTS manufacturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    manufacturer_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL,
    sale_price REAL NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories (id),
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id)
  );
  
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    customer_name TEXT,
    mobile TEXT,
    payment_mode TEXT,
    remarks TEXT,
    total_amount REAL NOT NULL,
    total_discount REAL,
    final_amount REAL NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    category_name TEXT NOT NULL,
    sale_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    item_final_price REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  );
`);

// Set up Express app
const app = express();
const port = 3001;

// Configure middleware
app.use(cors());
app.use(express.json());

// Set up file uploads
const upload = multer({ dest: path.join(dataDir, 'uploads') });

// Define API routes

// Category API
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const result = stmt.run(name);
    
    res.status(201).json({
      id: result.lastInsertRowid,
      name
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manufacturer API
app.get('/api/manufacturers', (req, res) => {
  try {
    const manufacturers = db.prepare('SELECT * FROM manufacturers').all();
    res.json(manufacturers);
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/manufacturers', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Manufacturer name is required' });
    }
    
    const stmt = db.prepare('INSERT INTO manufacturers (name) VALUES (?)');
    const result = stmt.run(name);
    
    res.status(201).json({
      id: result.lastInsertRowid,
      name
    });
  } catch (error) {
    console.error('Error creating manufacturer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Product API
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.id, p.barcode, p.quantity, p.cost_price, p.sale_price, 
             c.name as category, m.name as manufacturer,
             p.category_id, p.manufacturer_id
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
    `).all();
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:barcode', (req, res) => {
  try {
    const { barcode } = req.params;
    
    const product = db.prepare(`
      SELECT p.id, p.barcode, p.quantity, p.cost_price, p.sale_price, 
             c.name as category, m.name as manufacturer,
             p.category_id, p.manufacturer_id
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { barcode, category_id, manufacturer_id, quantity, cost_price, sale_price } = req.body;
    
    if (!barcode || !category_id || !manufacturer_id || quantity === undefined || cost_price === undefined || sale_price === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(barcode, category_id, manufacturer_id, quantity, cost_price, sale_price);
    
    // Fetch the created product with category and manufacturer details
    const product = db.prepare(`
      SELECT p.id, p.barcode, p.quantity, p.cost_price, p.sale_price, 
             c.name as category, m.name as manufacturer,
             p.category_id, p.manufacturer_id
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/products/:id/quantity', (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ error: 'Quantity is required' });
    }
    
    const stmt = db.prepare('UPDATE products SET quantity = ? WHERE id = ?');
    stmt.run(quantity, id);
    
    // Fetch the updated product
    const product = db.prepare(`
      SELECT p.id, p.barcode, p.quantity, p.cost_price, p.sale_price, 
             c.name as category, m.name as manufacturer,
             p.category_id, p.manufacturer_id
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE p.id = ?
    `).get(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sales API
app.post('/api/sales', (req, res) => {
  try {
    const { 
      type, customer_name, mobile, payment_mode, remarks,
      total_amount, total_discount, final_amount, items 
    } = req.body;
    
    if (!type || final_amount === undefined || !items || !items.length) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Generate a unique sale number (format: BILL/EST-YYYYMMDD-XXXX)
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const formattedDate = dateStr.replace(/-/g, '');
    
    // Count sales for today to generate the number
    const salesCountToday = db.prepare(
      'SELECT COUNT(*) as count FROM sales WHERE date LIKE ?'
    ).get(`${dateStr}%`).count;
    
    const prefix = type === 'bill' ? 'BILL' : 'EST';
    const saleNumber = `${prefix}-${formattedDate}-${(salesCountToday + 1).toString().padStart(4, '0')}`;
    
    db.transaction(() => {
      // Insert sale
      const saleStmt = db.prepare(`
        INSERT INTO sales (
          date, number, type, customer_name, mobile, payment_mode, 
          remarks, total_amount, total_discount, final_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const saleResult = saleStmt.run(
        dateStr,
        saleNumber,
        type,
        customer_name || null,
        mobile || null,
        payment_mode || null,
        remarks || null,
        total_amount,
        total_discount || 0,
        final_amount
      );
      
      const saleId = saleResult.lastInsertRowid;
      
      // Insert sale items
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, category_name, 
          sale_price, quantity, item_final_price
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      // Update product quantities
      const updateQuantityStmt = db.prepare(`
        UPDATE products SET quantity = quantity - ? WHERE id = ?
      `);
      
      for (const item of items) {
        itemStmt.run(
          saleId,
          item.product_id,
          item.category_name,
          item.sale_price,
          item.quantity,
          item.item_final_price
        );
        
        updateQuantityStmt.run(item.quantity, item.product_id);
      }
      
      // Return the created sale
      const sale = db.prepare(`
        SELECT s.*, 
               json_group_array(
                 json_object(
                   'id', si.id,
                   'product_id', si.product_id,
                   'category_name', si.category_name,
                   'sale_price', si.sale_price,
                   'quantity', si.quantity,
                   'item_final_price', si.item_final_price
                 )
               ) as items
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.id = ?
        GROUP BY s.id
      `).get(saleId);
      
      // Parse items JSON
      sale.items = JSON.parse(sale.items);
      
      res.status(201).json(sale);
    })();
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales', (req, res) => {
  try {
    const { date, startDate, endDate, type, search } = req.query;
    
    let query = `
      SELECT s.*, 
             json_group_array(
               json_object(
                 'id', si.id,
                 'product_id', si.product_id,
                 'category_name', si.category_name,
                 'sale_price', si.sale_price,
                 'quantity', si.quantity,
                 'item_final_price', si.item_final_price
               )
             ) as items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
    `;
    
    const conditions = [];
    const params = [];
    
    if (date) {
      conditions.push('s.date = ?');
      params.push(date);
    }
    
    if (startDate && endDate) {
      conditions.push('s.date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    
    if (type) {
      conditions.push('s.type = ?');
      params.push(type);
    }
    
    if (search) {
      conditions.push('(s.number LIKE ? OR s.customer_name LIKE ? OR s.mobile LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY s.id ORDER BY s.date DESC';
    
    const sales = db.prepare(query).all(...params);
    
    // Parse items JSON
    sales.forEach(sale => {
      sale.items = JSON.parse(sale.items);
    });
    
    res.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = db.prepare(`
      SELECT s.*, 
             json_group_array(
               json_object(
                 'id', si.id,
                 'product_id', si.product_id,
                 'category_name', si.category_name,
                 'sale_price', si.sale_price,
                 'quantity', si.quantity,
                 'item_final_price', si.item_final_price
               )
             ) as items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(id);
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    // Parse items JSON
    sale.items = JSON.parse(sale.items);
    
    res.json(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sales/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { total_amount, total_discount, final_amount, items } = req.body;
    
    if (final_amount === undefined || !items || !items.length) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Check if sale exists
    const existingSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!existingSale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    db.transaction(() => {
      // Update sale
      db.prepare(`
        UPDATE sales 
        SET total_amount = ?, total_discount = ?, final_amount = ?
        WHERE id = ?
      `).run(total_amount, total_discount || 0, final_amount, id);
      
      // Get existing items
      const existingItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
      
      // Restore quantities for existing items
      for (const item of existingItems) {
        db.prepare(`
          UPDATE products 
          SET quantity = quantity + ? 
          WHERE id = ?
        `).run(item.quantity, item.product_id);
      }
      
      // Delete existing items
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      
      // Insert new items
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, category_name, 
          sale_price, quantity, item_final_price
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      // Update product quantities
      const updateQuantityStmt = db.prepare(`
        UPDATE products SET quantity = quantity - ? WHERE id = ?
      `);
      
      for (const item of items) {
        itemStmt.run(
          id,
          item.product_id,
          item.category_name,
          item.sale_price,
          item.quantity,
          item.item_final_price
        );
        
        updateQuantityStmt.run(item.quantity, item.product_id);
      }
    })();
    
    // Return the updated sale
    const sale = db.prepare(`
      SELECT s.*, 
             json_group_array(
               json_object(
                 'id', si.id,
                 'product_id', si.product_id,
                 'category_name', si.category_name,
                 'sale_price', si.sale_price,
                 'quantity', si.quantity,
                 'item_final_price', si.item_final_price
               )
             ) as items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(id);
    
    // Parse items JSON
    sale.items = JSON.parse(sale.items);
    
    res.json(sale);
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import/Export API
app.post('/api/import/products', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (!data.length) {
      return res.status(400).json({ error: 'Empty file' });
    }
    
    const requiredColumns = ['barcode', 'category', 'manufacturer', 'quantity', 'cost_price', 'sale_price'];
    const firstRow = data[0];
    
    for (const col of requiredColumns) {
      if (!(col in firstRow)) {
        return res.status(400).json({ error: `Missing column: ${col}` });
      }
    }
    
    const errors = [];
    let imported = 0;
    
    db.transaction(() => {
      for (const row of data) {
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
          const existingProduct = db.prepare('SELECT id FROM products WHERE barcode = ?').get(row.barcode);
          
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
        } catch (error) {
          errors.push(`Error importing row ${imported + 1}: ${error.message}`);
        }
      }
    })();
    
    // Remove the temporary file
    fs.unlinkSync(filePath);
    
    res.status(201).json({
      message: `Successfully imported ${imported} products`,
      total: data.length,
      imported,
      errors: errors.length ? errors : undefined
    });
  } catch (error) {
    console.error('Error importing products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.barcode, c.name as category, m.name as manufacturer, 
             p.quantity, p.cost_price, p.sale_price
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN manufacturers m ON p.manufacturer_id = m.id
    `).all();
    
    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/sales', (req, res) => {
  try {
    const { date, startDate, endDate, type, search } = req.query;
    
    let query = `
      SELECT s.id, s.date, s.number, s.type, s.customer_name, s.mobile, 
             s.payment_mode, s.remarks, s.total_amount, s.total_discount, s.final_amount
      FROM sales s
    `;
    
    const conditions = [];
    const params = [];
    
    if (date) {
      conditions.push('s.date = ?');
      params.push(date);
    }
    
    if (startDate && endDate) {
      conditions.push('s.date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    
    if (type) {
      conditions.push('s.type = ?');
      params.push(type);
    }
    
    if (search) {
      conditions.push('(s.number LIKE ? OR s.customer_name LIKE ? OR s.mobile LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.date DESC';
    
    const sales = db.prepare(query).all(...params);
    
    const salesWithItems = sales.map(sale => {
      const items = db.prepare(`
        SELECT si.product_id, si.category_name, si.sale_price, si.quantity, si.item_final_price
        FROM sale_items si
        WHERE si.sale_id = ?
      `).all(sale.id);
      
      return {
        ...sale,
        items: JSON.stringify(items)
      };
    });
    
    const worksheet = XLSX.utils.json_to_sheet(salesWithItems);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=sales.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting sales:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
