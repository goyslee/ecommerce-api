module.exports = (app, pool) => {
  app.post('/products', async (req, res) => {
    // Add a new product
    const { name, description, price, stockquantity, category } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO Products (name, description, price, stockquantity, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, description, price, stockquantity, category]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.get('/products', async (req, res) => {
    // Get all products or by category
    const { category } = req.query;
    try {
      let result;
      if (category) {
        result = await pool.query('SELECT * FROM Products WHERE category = $1', [category]);
      } else {
        result = await pool.query('SELECT * FROM Products');
      }
      res.json(result.rows);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.get('/products/:productid', async (req, res) => {
    // Get a single product by ID
    const { productid } = req.params;
    try {
      const result = await pool.query('SELECT * FROM Products WHERE productid = $1', [productid]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).send('Product not found');
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.put('/products/:productid', async (req, res) => {
    // Update a product
    const { productid } = req.params;
    const { name, description, price, stockquantity, category } = req.body;
    try {
      const result = await pool.query(
        'UPDATE Products SET name = $1, description = $2, price = $3, stockquantity = $4, category = $5 WHERE productid = $6 RETURNING *',
        [name, description, price, stockquantity, category, productid]
      );
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).send('Product not found');
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.delete('/products/:productid', async (req, res) => {
    // Delete a product
    const { productid } = req.params;
    try {
      // Check if product is part of any order details
      const orderDetailResult = await pool.query('SELECT * FROM OrderDetails WHERE productid = $1', [productid]);

      if (orderDetailResult.rowCount > 0) {
        // If product is in any order, send a message that it cannot be deleted
        res.status(400).send('Cannot delete product because it is associated with one or more orders and will inflate order history.');
      } else {
        // If product is not in any order, proceed with deletion
        await pool.query('DELETE FROM Products WHERE productid = $1', [productid]);
        res.status(204).send();
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
};
