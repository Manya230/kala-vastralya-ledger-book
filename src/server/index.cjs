const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
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

// Set up SQLite database using sqlite3 instead of better-sqlite3
const dbPath = path.join(dataDir, 'kala-vastralya.db');
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
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS manufacturers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )
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
      )
    `);

    // Ensure sales table includes customer_address and customer_gstin
    // If this is the first run, these columns might be missing if not added here.
    // For existing databases, an ALTER TABLE might be needed separately if they don't exist.
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
        final_amount REAL,
        customer_address TEXT,
        customer_gstin TEXT 
      )
    `);
    // Attempt to add columns if they don't exist (safe for SQLite)
    db.run("ALTER TABLE sales ADD COLUMN customer_address TEXT", () => {});
    db.run("ALTER TABLE sales ADD COLUMN customer_gstin TEXT", () => {});


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
      )
    `);

    // REMOVED SAMPLE DATA INSERTION FOR CATEGORIES
    // REMOVED SAMPLE DATA INSERTION FOR MANUFACTURERS
    // REMOVED SAMPLE DATA INSERTION FOR PRODUCTS
  });
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
    db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
      if (err) {
        console.error('Error fetching categories:', err);
        return res.status(500).json({ error: 'Failed to fetch categories' });
      }
      res.json(rows);
    });
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
    db.run('INSERT INTO categories (name) VALUES (?)', [name], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Category already exists' });
        }
        console.error('Error creating category:', err);
        return res.status(500).json({ error: 'Failed to create category' });
      }
      
      res.status(201).json({ id: this.lastID, name });
    });
  } catch (error) {
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
    db.all('SELECT * FROM manufacturers ORDER BY name', (err, rows) => {
      if (err) {
        console.error('Error fetching manufacturers:', err);
        return res.status(500).json({ error: 'Failed to fetch manufacturers' });
      }
      res.json(rows);
    });
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
    db.run('INSERT INTO manufacturers (name) VALUES (?)', [name], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Manufacturer already exists' });
        }
        console.error('Error creating manufacturer:', err);
        return res.status(500).json({ error: 'Failed to create manufacturer' });
      }
      
      res.status(201).json({ id: this.lastID, name });
    });
  } catch (error) {
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
    `, (err, rows) => {
      if (err) {
        console.error('Error fetching products:', err);
        return res.status(500).json({ error: 'Failed to fetch products' });
      }
      
      res.json(rows);
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by barcode
app.get('/api/products/barcode/:barcode', (req, res) => {
  const { barcode } = req.params;
  
  try {
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
    `, [barcode], (err, row) => {
      if (err) {
        console.error('Error fetching product:', err);
        return res.status(500).json({ error: 'Failed to fetch product' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.json(row);
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  try {
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
      WHERE p.id = ?
    `, [id], (err, row) => {
      if (err) {
        console.error('Error fetching product:', err);
        return res.status(500).json({ error: 'Failed to fetch product' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.json(row);
    });
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
    db.run(`
      INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [barcode, category_id, manufacturer_id, quantity, cost_price, sale_price], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
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
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product quantity
app.patch('/api/products/:id/quantity', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  try {
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error finding product:', err);
        return res.status(500).json({ error: 'Failed to update product quantity' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      db.run('UPDATE products SET quantity = ? WHERE id = ?', [quantity, id], (err) => {
        if (err) {
          console.error('Error updating product quantity:', err);
          return res.status(500).json({ error: 'Failed to update product quantity' });
        }
        
        res.json({ id, quantity });
      });
    });
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({ error: 'Failed to update product quantity' });
  }
});

// Update product details
app.patch('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { category_id, manufacturer_id, quantity, cost_price, sale_price } = req.body;

  if (!category_id || !manufacturer_id || quantity == null || cost_price == null || sale_price == null) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.run(
    `UPDATE products SET category_id = ?, manufacturer_id = ?, quantity = ?, cost_price = ?, sale_price = ? WHERE id = ?`,
    [category_id, manufacturer_id, quantity, cost_price, sale_price, id],
    function (err) {
      if (err) {
        console.error('Error updating product:', err);
        return res.status(500).json({ error: 'Failed to update product' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ id: parseInt(id), category_id, manufacturer_id, quantity, cost_price, sale_price });
    }
  );
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
    items,
    customer_address,
    customer_gstin
  } = req.body;
  
  if (!type || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Type and items are required' });
  }
  
  const date = getCurrentDateIST();

  // This will be a more complex operation with sqlite3
  // We need to implement transactions manually
  try {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Generate the next number
      const prefix = type === 'bill' ? 'BILL' : 'EST';
      db.get(`
        SELECT number FROM sales WHERE type = ? ORDER BY id DESC LIMIT 1
      `, [type], (err, lastSale) => {
        if (err) {
          console.error('Error generating sale number:', err);
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
            date, total_amount, total_discount, final_amount,
            customer_address, customer_gstin
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          final_amount,
          customer_address || null,
          customer_gstin || null
        ], function(err) {
          if (err) {
            console.error('Error creating sale:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to create sale' });
          }
          
          const saleId = this.lastID;
          let completed = 0;
          let errors = false;
          
          console.log('Inserting sale items:', items, 'for saleId:', saleId);
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
            ], function(err) {
              if (err) {
                console.error('Error inserting sale item:', err);
                errors = true;
              }
              
              // Update product quantity
              db.run(`
                UPDATE products 
                SET quantity = quantity - ? 
                WHERE id = ?
              `, [item.quantity, item.product_id], function(err) {
                if (err) {
                  console.error('Error updating product quantity:', err);
                  errors = true;
                }
                
                completed++;
                
                // If all items are processed
                if (completed === items.length) {
                  if (errors) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to create sale' });
                  } else {
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err);
                        return res.status(500).json({ error: 'Failed to create sale' });
                      }
                      // Fetch the full sale record
                      db.get(`
                        SELECT 
                          s.id, s.type, s.number, s.customer_name, s.mobile, 
                          s.payment_mode, s.remarks, s.date, s.total_amount, s.total_discount, s.final_amount,
                          s.customer_address, s.customer_gstin
                        FROM sales s
                        WHERE s.id = ?
                      `, [saleId], (err, sale) => {
                        if (err || !sale) {
                          return res.status(201).json({ id: saleId, number: formattedNumber, date: date });
                        }
                        // Fetch sale items
                        db.all(`
                          SELECT 
                            si.id, si.product_id, si.category_name, si.sale_price, 
                            si.quantity, si.item_final_price,
                            p.barcode
                          FROM sale_items si
                          LEFT JOIN products p ON si.product_id = p.id
                          WHERE si.sale_id = ?
                        `, [saleId], (err, items) => {
                          sale.items = items || [];
                          res.status(201).json(sale);
                        });
                      });
                    });
                  }
                }
              });
            });
          });
          
          // If there are no items
          if (items.length === 0) {
            db.run('COMMIT');
            return res.status(201).json({
              id: saleId,
              number: formattedNumber,
              date: date
            });
          }
        });
      });
    });
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
        s.payment_mode, s.date, s.total_amount, s.total_discount, s.final_amount,
        s.customer_address, s.customer_gstin
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
    
    db.all(query, queryParams, (err, rows) => {
      if (err) {
        console.error('Error fetching sales:', err);
        return res.status(500).json({ error: 'Failed to fetch sales' });
      }
      
      res.json(rows);
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get a single sale with its items
app.get('/api/sales/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    db.get(`
      SELECT 
        s.id, s.type, s.number, s.customer_name, s.mobile, 
        s.payment_mode, s.remarks, s.date, s.total_amount, s.total_discount, s.final_amount,
        s.customer_address, s.customer_gstin
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
          return res.status(500).json({ error: 'Failed to fetch sale details' });
        }
        
        sale.items = items;
        
        res.json(sale);
      });
    });
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
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Get the original sale
      db.get('SELECT * FROM sales WHERE id = ?', [id], (err, originalSale) => {
        if (err) {
          console.error('Error fetching original sale:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to update sale' });
        }
        
        if (!originalSale) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Sale not found' });
        }
        
        // Get original sale items to restore inventory
        db.all('SELECT * FROM sale_items WHERE sale_id = ?', [id], (err, originalItems) => {
          if (err) {
            console.error('Error fetching original sale items:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to update sale' });
          }

          // Calculate inventory changes for each product
          const inventoryUpdates = [];
          // For each original item, find the new quantity (if any)
          originalItems.forEach(origItem => {
            const editedItem = items.find(i => i.product_id === origItem.product_id);
            if (editedItem) {
              // If quantity changed, update by the difference
              const diff = origItem.quantity - editedItem.quantity;
              if (diff !== 0) {
                inventoryUpdates.push({ product_id: origItem.product_id, quantityChange: diff });
              }
            } else {
              // Item was removed, add back full quantity
              inventoryUpdates.push({ product_id: origItem.product_id, quantityChange: origItem.quantity });
            }
          });
          // New items added in edit
          items.forEach(editedItem => {
            const origItem = originalItems.find(i => i.product_id === editedItem.product_id);
            if (!origItem) {
              // New item, subtract its quantity
              inventoryUpdates.push({ product_id: editedItem.product_id, quantityChange: -editedItem.quantity });
            }
          });

          // Now update inventory for all changes
          let updatedCount = 0;
          let errors = false;
          if (inventoryUpdates.length === 0) {
            updateSale();
            return;
          }
          inventoryUpdates.forEach(update => {
            db.run(`
              UPDATE products
              SET quantity = quantity + ?
              WHERE id = ?
            `, [update.quantityChange, update.product_id], function(err) {
              if (err) {
                console.error('Error updating inventory:', err);
                errors = true;
              }
              updatedCount++;
              if (updatedCount === inventoryUpdates.length) {
                if (errors) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to update inventory' });
                }
                updateSale();
              }
            });
          });

          function updateSale() {
            // Update the sale
            db.run(`
              UPDATE sales
              SET total_amount = ?, total_discount = ?, final_amount = ?
              WHERE id = ?
            `, [total_amount, total_discount || 0, final_amount, id], function(err) {
              if (err) {
                console.error('Error updating sale:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to update sale' });
              }
              
              // Delete all existing sale items
              db.run('DELETE FROM sale_items WHERE sale_id = ?', [id], function(err) {
                if (err) {
                  console.error('Error deleting sale items:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to update sale' });
                }
                
                // Insert updated sale items
                if (items.length === 0) {
                  db.run('COMMIT');
                  return res.json({
                    id: parseInt(id),
                    message: 'Sale updated successfully'
                  });
                }
                
                let completedItems = 0;
                let errors = false;
                
                items.forEach((item, index) => {
                  // Insert sale item
                  db.run(`
                    INSERT INTO sale_items (
                      sale_id, product_id, category_name, sale_price, quantity, item_final_price
                    ) VALUES (?, ?, ?, ?, ?, ?)
                  `, [
                    id,
                    item.product_id,
                    item.category_name,
                    item.sale_price,
                    item.quantity,
                    item.item_final_price
                  ], function(err) {
                    if (err) {
                      console.error('Error inserting sale item:', err);
                      errors = true;
                    }
                    completedItems++;
                    if (completedItems === items.length) {
                      if (errors) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to update sale' });
                      } else {
                        db.run('COMMIT');
                        return res.json({
                          id: parseInt(id),
                          message: 'Sale updated successfully'
                        });
                      }
                    }
                  });
                });
              });
            });
          }
        });
      });
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({ error: 'Failed to update sale' });
  }
});

// Delete a sale
app.delete('/api/sales/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Get the sale to be deleted
      db.get('SELECT * FROM sales WHERE id = ?', [id], (err, sale) => {
        if (err) {
          console.error('Error fetching sale for deletion:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to delete sale' });
        }
        
        if (!sale) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Sale not found' });
        }
        
        // Get all sale items to restore inventory
        db.all('SELECT * FROM sale_items WHERE sale_id = ?', [id], (err, saleItems) => {
          if (err) {
            console.error('Error fetching sale items for deletion:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to delete sale' });
          }
          
          let restoredCount = 0;
          let errors = false;
          
          // If no items to restore, just delete the sale
          if (saleItems.length === 0) {
            deleteSaleRecord();
            return;
          }
          
          // Restore inventory quantities for all items
          saleItems.forEach((item) => {
            db.run(`
              UPDATE products
              SET quantity = quantity + ?
              WHERE id = ?
            `, [item.quantity, item.product_id], function(err) {
              if (err) {
                console.error('Error restoring inventory:', err);
                errors = true;
              }
              
              restoredCount++;
              if (restoredCount === saleItems.length) {
                if (errors) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to restore inventory' });
                } else {
                  deleteSaleRecord();
                }
              }
            });
          });
          
          function deleteSaleRecord() {
            // Delete sale items first
            db.run('DELETE FROM sale_items WHERE sale_id = ?', [id], function(err) {
              if (err) {
                console.error('Error deleting sale items:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to delete sale' });
              }
              
              // Delete the sale
              db.run('DELETE FROM sales WHERE id = ?', [id], function(err) {
                if (err) {
                  console.error('Error deleting sale:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to delete sale' });
                }
                
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Error committing deletion transaction:', err);
                    return res.status(500).json({ error: 'Failed to delete sale' });
                  }
                  res.json({ message: 'Sale deleted successfully' });
                });
              });
            });
          }
        });
      });
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ error: 'Failed to delete sale' });
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
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let imported = 0;
      let errors = [];
      let completed = 0;
      
      data.forEach((row, index) => {
        try {
          // Get or create category
          db.get('SELECT id FROM categories WHERE name = ?', [row.category], (err, existingCategory) => {
            if (err) {
              errors.push({ row: index + 1, error: err.message });
              processComplete();
              return;
            }
            
            let categoryId;
            
            const processManufacturer = () => {
              // Get or create manufacturer
              db.get('SELECT id FROM manufacturers WHERE name = ?', [row.manufacturer], (err, existingManufacturer) => {
                if (err) {
                  errors.push({ row: index + 1, error: err.message });
                  processComplete();
                  return;
                }
                
                let manufacturerId;
                
                const processProduct = () => {
                  // Check if product exists
                  db.get('SELECT * FROM products WHERE barcode = ?', [row.barcode], (err, existingProduct) => {
                    if (err) {
                      errors.push({ row: index + 1, error: err.message });
                      processComplete();
                      return;
                    }
                    
                    if (existingProduct) {
                      // Update existing product
                      db.run(`
                        UPDATE products
                        SET category_id = ?, manufacturer_id = ?, quantity = ?, cost_price = ?, sale_price = ?
                        WHERE id = ?
                      `, [
                        categoryId,
                        manufacturerId,
                        row.quantity,
                        row.cost_price,
                        row.sale_price,
                        existingProduct.id
                      ], (err) => {
                        if (err) {
                          errors.push({ row: index + 1, error: err.message });
                        } else {
                          imported++;
                        }
                        processComplete();
                      });
                    } else {
                      // Insert new product
                      db.run(`
                        INSERT INTO products (barcode, category_id, manufacturer_id, quantity, cost_price, sale_price)
                        VALUES (?, ?, ?, ?, ?, ?)
                      `, [
                        row.barcode,
                        categoryId,
                        manufacturerId,
                        row.quantity,
                        row.cost_price,
                        row.sale_price
                      ], (err) => {
                        if (err) {
                          errors.push({ row: index + 1, error: err.message });
                        } else {
                          imported++;
                        }
                        processComplete();
                      });
                    }
                  });
                };
                
                if (existingManufacturer) {
                  manufacturerId = existingManufacturer.id;
                  processProduct();
                } else {
                  db.run('INSERT INTO manufacturers (name) VALUES (?)', [row.manufacturer], function(err) {
                    if (err) {
                      errors.push({ row: index + 1, error: err.message });
                      processComplete();
                      return;
                    }
                    manufacturerId = this.lastID;
                    processProduct();
                  });
                }
              });
            };
            
            if (existingCategory) {
              categoryId = existingCategory.id;
              processManufacturer();
            } else {
              db.run('INSERT INTO categories (name) VALUES (?)', [row.category], function(err) {
                if (err) {
                  errors.push({ row: index + 1, error: err.message });
                  processComplete();
                  return;
                }
                categoryId = this.lastID;
                processManufacturer();
              });
            }
          });
        } catch (err) {
          errors.push({ row: index + 1, error: err.message });
          processComplete();
        }
      });
      
      function processComplete() {
        completed++;
        
        if (completed === data.length) {
          if (errors.length > 0 && imported === 0) {
            db.run('ROLLBACK');
            // Clean up the temporary file
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            return res.status(500).json({ 
              error: 'Failed to import products', 
              details: errors 
            });
          } else {
            db.run('COMMIT');
            // Clean up the temporary file
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            return res.json({
              message: `Successfully imported ${imported} products`,
              errors: errors.length > 0 ? errors : []
            });
          }
        }
      }
      
      // If no data to process
      if (data.length === 0) {
        db.run('COMMIT');
        // Clean up the temporary file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.json({
          message: 'No products to import',
          errors: []
        });
      }
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
    db.all(`
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
    `, (err, products) => {
      if (err) {
        console.error('Error exporting products:', err);
        return res.status(500).json({ error: 'Failed to export products' });
      }
      
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
    });
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
        s.id, 
        s.date, 
        s.number, 
        s.type, 
        s.customer_name, 
        s.mobile, 
        s.customer_address, 
        s.customer_gstin,
        s.payment_mode, 
        s.total_amount, 
        s.total_discount, 
        s.final_amount
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
        console.error('Error exporting sales:', err); // Log the actual SQL error
        return res.status(500).json({ error: 'Failed to export sales' });
      }
      
      if (sales.length === 0) {
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet([], {
          header: [
            "date", "number", "type", "customer_name", "mobile",
            "customer_address", "customer gstin", "items",
            "total_amount", "total_discount", "final_amount", "payment_mode"
          ]
        });
        if (worksheet['A1']) worksheet['A1'].v = "No sales found to export"; 
        else xlsx.utils.sheet_add_aoa(worksheet, [["No sales found to export"]], {origin: "A1"});

        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sales');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=sales.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        return;
      }
      
      let processed = 0;
      const salesWithItemCount = [...sales];

      if (salesWithItemCount.length === 0) {
        finishExport([]);
        return;
      }

      salesWithItemCount.forEach((sale, index) => {
        db.all(`
          SELECT COUNT(*) as itemCount
          FROM sale_items
          WHERE sale_id = ?
        `, [sale.id], (itemErr, result) => {
          if (!itemErr && result && result[0]) {
            salesWithItemCount[index].itemCount = result[0].itemCount;
          } else {
            salesWithItemCount[index].itemCount = 0; // Default to 0 if error or no result
          }
          
          processed++;
          if (processed === salesWithItemCount.length) {
            finishExport(salesWithItemCount);
          }
        });
      });
      
      function finishExport(finalSalesData) {
        const dataForSheet = finalSalesData.map(sale => ({
          'date': sale.date,
          'number': sale.number,
          'type': sale.type,
          'customer_name': sale.customer_name,
          'mobile': sale.mobile,
          'customer_address': sale.customer_address,
          'customer gstin': sale.customer_gstin,
          'items': sale.itemCount, 
          'total_amount': sale.total_amount,
          'total_discount': sale.total_discount,
          'final_amount': sale.final_amount,
          'payment_mode': sale.payment_mode
        }));

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(dataForSheet, {
          header: [ 
            "date", "number", "type", "customer_name", "mobile", 
            "customer_address", "customer gstin", "items", 
            "total_amount", "total_discount", "final_amount", "payment_mode"
          ]
        });
        
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sales');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename=sales.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
      }
    });
  } catch (error) {
    console.error('Error exporting sales:', error);
    res.status(500).json({ error: 'Failed to export sales' });
  }
});

// Start the server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Database path: ${dbPath}`);
});

module.exports = app;
