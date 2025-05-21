
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { formatISO } = require('date-fns');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, './data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Set up SQLite database
const dbPath = path.join(dataDir, 'kala.db');
const db = new sqlite3.Database(dbPath);

// Set up multer for file uploads
const upload = multer({ dest: path.join(dataDir, 'uploads/') });

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize database tables
function initDb() {
  // Create tables if they don't exist
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS manufacturers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      );
    `);

    db.run(`
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
    `);

    db.run(`
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
    `);

    db.run(`
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
    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
      if (err) {
        console.error('Error checking categories:', err);
        return;
      }
      
      if (row.count === 0) {
        const categories = ['Sarees', 'Shirts', 'Pants', 'Coord Set'];
        categories.forEach(category => {
          db.run('INSERT INTO categories (name) VALUES (?)', [category], (err) => {
            if (err) console.error('Error adding category:', err);
          });
        });
      }
    });

    db.get('SELECT COUNT(*) as count FROM manufacturers', (err, row) => {
      if (err) {
        console.error('Error checking manufacturers:', err);
        return;
      }
      
      if (row.count === 0) {
        const manufacturers = ['XYZ Clothing', 'ABC Manufacturer', 'JKL Textiles', 'Geeta tailers'];
        manufacturers.forEach(manufacturer => {
          db.run('INSERT INTO manufacturers (name) VALUES (?)', [manufacturer], (err) => {
            if (err) console.error('Error adding manufacturer:', err);
          });
        });
      }
    });
    
    // Add some sample products if needed
    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
      if (err) {
        console.error('Error checking products:', err);
        return;
      }
      
      if (row.count === 0) {
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
          db.get('SELECT id FROM categories WHERE name = ?', [product.category], (err, categoryRow) => {
            if (err || !categoryRow) {
              console.error('Error finding category:', err);
              return;
            }
            
            db.get('SELECT id FROM manufacturers WHERE name = ?', [product.manufacturer], (err, manufacturerRow) => {
              if (err || !manufacturerRow) {
                console.error('Error finding manufacturer:', err);
                return;
              }
              
              db.run(`
                INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                product.barcode,
                categoryRow.id,
                manufacturerRow.id,
                product.quantity,
                product.costPrice,
                product.salePrice
              ], (err) => {
                if (err) console.error('Error adding product:', err);
              });
            });
          });
        });
      }
    });
  });
}

// Initialize database
initDb();

// Helper function to get current date in ISO format
function getCurrentDate() {
  return formatISO(new Date());
}

// --------------------------------
// Category Routes
// --------------------------------

// Get all categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(categories);
  });
});

// Add a new category
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  db.run('INSERT INTO categories (name) VALUES (?)', [name], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Category already exists' });
      }
      console.error('Error creating category:', err);
      return res.status(500).json({ error: 'Failed to create category' });
    }
    
    res.status(201).json({ 
      id: this.lastID, 
      name 
    });
  });
});

// --------------------------------
// Manufacturer Routes
// --------------------------------

// Get all manufacturers
app.get('/api/manufacturers', (req, res) => {
  db.all('SELECT * FROM manufacturers ORDER BY name', (err, manufacturers) => {
    if (err) {
      console.error('Error fetching manufacturers:', err);
      return res.status(500).json({ error: 'Failed to fetch manufacturers' });
    }
    res.json(manufacturers);
  });
});

// Add a new manufacturer
app.post('/api/manufacturers', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Manufacturer name is required' });
  }

  db.run('INSERT INTO manufacturers (name) VALUES (?)', [name], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Manufacturer already exists' });
      }
      console.error('Error creating manufacturer:', err);
      return res.status(500).json({ error: 'Failed to create manufacturer' });
    }
    
    res.status(201).json({ 
      id: this.lastID, 
      name 
    });
  });
});

// --------------------------------
// Product Routes
// --------------------------------

// Get all products with category and manufacturer names
app.get('/api/products', (req, res) => {
  db.all(`
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
  `, (err, products) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
    
    res.json(products);
  });
});

// Get product by barcode
app.get('/api/products/:barcode', (req, res) => {
  const { barcode } = req.params;
  
  db.get(`
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
  `, [barcode], (err, product) => {
    if (err) {
      console.error('Error fetching product:', err);
      return res.status(500).json({ error: 'Failed to fetch product' });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  });
});

// Add a new product
app.post('/api/products', (req, res) => {
  const { barcode, category_id, manufacturer_id, quantity, cost_price, sale_price } = req.body;
  
  if (!barcode || !category_id || !manufacturer_id || !quantity || !cost_price || !sale_price) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  db.run(`
    INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [barcode, category_id, manufacturer_id, quantity, cost_price, sale_price], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Barcode already exists' });
      }
      console.error('Error creating product:', err);
      return res.status(500).json({ error: 'Failed to create product' });
    }
    
    res.status(201).json({ 
      id: this.lastID,
      barcode,
      category_id,
      manufacturer_id,
      quantity,
      cost_price,
      sale_price
    });
  });
});

// Update product quantity
app.patch('/api/products/:id/quantity', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error('Error finding product:', err);
      return res.status(500).json({ error: 'Failed to update product quantity' });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    db.run('UPDATE products SET quantity = ? WHERE id = ?', [quantity, id], (err) => {
      if (err) {
        console.error('Error updating product quantity:', err);
        return res.status(500).json({ error: 'Failed to update product quantity' });
      }
      
      res.json({ id: parseInt(id), quantity });
    });
  });
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
  
  const date = getCurrentDate();
  
  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Generate the next number
    const prefix = type === 'bill' ? 'BILL' : 'EST';
    db.get(`
      SELECT number FROM sales WHERE type = ? ORDER BY id DESC LIMIT 1
    `, [type], (err, lastSale) => {
      if (err) {
        console.error('Error getting last sale:', err);
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Failed to create sale' });
      }
      
      let nextNumber = 1;
      if (lastSale) {
        const lastNumberStr = lastSale.number.split('-')[1];
        nextNumber = parseInt(lastNumberStr, 10) + 1;
      }
      
      const formattedNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
      const finalCustomerName = customer_name || 'Walk In Customer';
      
      // Insert the sale
      db.run(`
        INSERT INTO sales (
          type, number, customer_name, mobile, payment_mode, remarks, 
          date, total_amount, total_discount, final_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
      ], function(err) {
        if (err) {
          console.error('Error creating sale:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to create sale' });
        }
        
        const saleId = this.lastID;
        let itemsProcessed = 0;
        
        // Insert sale items and update inventory
        items.forEach((item, index) => {
          // Insert sale item
          db.run(`
            INSERT INTO sale_items (
              sale_id, product_id, category_name, sale_price, quantity, item_final_price
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            saleId,
            item.product_id,
            item.category_name,
            item.sale_price,
            item.quantity,
            item.item_final_price
          ], (err) => {
            if (err) {
              console.error('Error creating sale item:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to create sale item' });
            }
            
            // Update product quantity
            db.run(`
              UPDATE products 
              SET quantity = quantity - ? 
              WHERE id = ?
            `, [item.quantity, item.product_id], (err) => {
              if (err) {
                console.error('Error updating product quantity:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to update product quantity' });
              }
              
              itemsProcessed++;
              
              // If all items processed, commit transaction and respond
              if (itemsProcessed === items.length) {
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Error committing transaction:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to create sale' });
                  }
                  
                  res.status(201).json({
                    id: saleId,
                    number: formattedNumber,
                    date: date
                  });
                });
              }
            });
          });
        });
      });
    });
  });
});

// Get all sales with filtering options
app.get('/api/sales', (req, res) => {
  const { date, startDate, endDate, type, search } = req.query;
  
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
  
  db.all(query, queryParams, (err, sales) => {
    if (err) {
      console.error('Error fetching sales:', err);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }
    
    res.json(sales);
  });
});

// Get a single sale with its items
app.get('/api/sales/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT 
      s.id, s.type, s.number, s.customer_name, s.mobile, 
      s.payment_mode, s.remarks, s.date, s.total_amount, s.total_discount, s.final_amount
    FROM sales s
    WHERE s.id = ?
  `, [id], (err, sale) => {
    if (err) {
      console.error('Error fetching sale:', err);
      return res.status(500).json({ error: 'Failed to fetch sale details' });
    }
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    db.all(`
      SELECT 
        si.id, si.product_id, si.category_name, si.sale_price, 
        si.quantity, si.item_final_price,
        p.barcode
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [id], (err, items) => {
      if (err) {
        console.error('Error fetching sale items:', err);
        return res.status(500).json({ error: 'Failed to fetch sale items' });
      }
      
      sale.items = items;
      
      res.json(sale);
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
