// orders.js

module.exports = (app, pool, middleware) => {
    async function getItemTotalPrice(pool, productId, quantity) {
  try {
    const productQuery = await pool.query('SELECT price FROM Products WHERE productid = $1', [productId]);
    if (productQuery.rows.length > 0) {
      const productPrice = productQuery.rows[0].price;
      return productPrice * quantity;
    }
    return 0; // Return 0 if the product is not found
  } catch (err) {
    throw err;
  }
}

  app.get('/orders', middleware.checkAuthentication, async (req, res) => {
    // GET all orders
    const userId = req.user.userid;

    try {
      const ordersQuery = await pool.query('SELECT * FROM orders WHERE userid = $1', [userId]);
      res.json(ordersQuery.rows);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.get('/orders/:orderId', async (req, res) => {
    // GET a specific order by orderId
    const userId = req.user.userid;
    const orderId = req.params.orderId;

    try {
      const orderQuery = await pool.query('SELECT * FROM orders WHERE orderid = $1 AND userid = $2', [orderId, userId]);

      if (orderQuery.rows.length === 0) {
        return res.status(404).send('Order not found');
      }

      res.json(orderQuery.rows[0]);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.post('/orders', async (req, res) => {
    // Create a new order
    const userId = req.user.userid;
    const { totalprice, shippingaddress, orderdetails } = req.body;

    try {
      const newOrderQuery = await pool.query(
        'INSERT INTO orders (userid, orderdate, totalprice, shippingaddress) VALUES ($1, NOW(), $2, $3) RETURNING *',
        [userId, totalprice, shippingaddress]
      );

      const newOrderId = newOrderQuery.rows[0].orderid;

      // Update item prices in the orderdetails table
      for (const item of orderdetails) {
        const itemTotalPrice = await getItemTotalPrice(pool, item.productid, item.quantity);
        await pool.query(
          'UPDATE orderdetails SET price = $1 WHERE orderid = $2 AND productid = $3',
          [itemTotalPrice, newOrderId, item.productid]
        );
      }

      res.status(201).json(newOrderId);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
    
app.put('/orders/:orderId/orderdetails/:orderDetailId', async (req, res) => {
  const userId = req.user.userid;
  const orderId = req.params.orderId;
  const orderDetailId = req.params.orderDetailId;

  // Parse the quantity from the request body to ensure it's a number
  const quantity = parseFloat(req.body.quantity);

  if (isNaN(quantity)) {
    return res.status(400).send('Invalid quantity');
  }

  try {
    // Get the current quantity, price, and productid from the orderdetails table
    const orderDetailQuery = await pool.query(
      'SELECT quantity, price, productid FROM orderdetails WHERE orderid = $1 AND orderdetailid = $2',
      [orderId, orderDetailId]
    );

    if (orderDetailQuery.rows.length === 0) {
      return res.status(404).send('Order detail not found');
    }

    const { quantity: currentQuantity, price, productid } = orderDetailQuery.rows[0];

    // Calculate the new quantity and new price based on the parsed quantity
    const newQuantity = currentQuantity + quantity; // Increment or decrement the quantity based on the parsed value
    const itemTotalPrice = price * Math.abs(quantity); // Calculate the item's total price based on the absolute value of the quantity change

    // Ensure the new quantity is not negative
    if (newQuantity < 0) {
      return res.status(400).send('Quantity cannot be negative');
    }

    // Calculate the new price based on the new quantity
    const newPrice = (price * newQuantity) / currentQuantity; // Update the price based on the new quantity

    // Update the quantity and price in the orderdetails table
    await pool.query(
      'UPDATE orderdetails SET quantity = $1, price = $2 WHERE orderid = $3 AND orderdetailid = $4',
      [newQuantity, newPrice, orderId, orderDetailId]
    );

    // Update the stockquantity in the products table based on the new quantity
    await pool.query(
      'UPDATE products SET stockquantity = stockquantity - $1 WHERE productid = $2',
      [quantity, productid]
    );

    // Update the order's total price by adding or subtracting the item's total price
    await pool.query(
      'UPDATE orders SET totalprice = totalprice + $1 WHERE orderid = $2 AND userid = $3 RETURNING *',
      [itemTotalPrice, orderId, userId]
    );

    res.status(204).send(); // Success, no content response
  } catch (err) {
    res.status(500).send(err.message);
  }
});

  app.delete('/orders/:orderId', async (req, res) => {
    // Delete an order by orderId
    const userId = req.user.userid;
    const orderId = req.params.orderId;

    try {
      const deleteOrderQuery = await pool.query('DELETE FROM orders WHERE orderid = $1 AND userid = $2 RETURNING *', [orderId, userId]);

      if (deleteOrderQuery.rows.length === 0) {
        return res.status(404).send('Order not found');
      }

      res.status(204).send();
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
    

app.delete('/orders/:orderId/orderdetails/:orderDetailId', async (req, res) => {
  const userId = req.user.userid;
  const orderId = req.params.orderId;
  const orderDetailId = req.params.orderDetailId;
  const { quantityToRemove } = req.body; // Get the quantity to remove from the request body

  try {
    // Get the item's product ID, current quantity, and price from the orderdetails table
    const orderDetailQuery = await pool.query(
      'SELECT productid, quantity, price FROM orderdetails WHERE orderid = $1 AND orderdetailid = $2',
      [orderId, orderDetailId]
    );

    if (orderDetailQuery.rows.length === 0) {
      return res.status(404).send('Order detail not found');
    }

    const { productid, quantity: currentQuantity, price } = orderDetailQuery.rows[0];

    // Ensure the quantity to remove is valid
    if (quantityToRemove <= 0 || quantityToRemove > currentQuantity) {
      return res.status(400).send('Invalid quantity to remove');
    }

    // Calculate the new quantity and new price after deduction
    const newQuantity = currentQuantity - quantityToRemove;
    const newPrice = (price * newQuantity) / currentQuantity; // Update the price based on the new quantity

    // Delete the row if the new quantity is zero
    if (newQuantity === 0) {
      await pool.query('DELETE FROM orderdetails WHERE orderid = $1 AND orderdetailid = $2', [orderId, orderDetailId]);
    } else {
      // Update the quantity and price in the orderdetails table
      await pool.query(
        'UPDATE orderdetails SET quantity = $1, price = $2 WHERE orderid = $3 AND orderdetailid = $4',
        [newQuantity, newPrice, orderId, orderDetailId]
      );
    }

    // Calculate the item's total price based on the updated quantity
    const itemTotalPrice = price * quantityToRemove;

    // Update the order's total price by subtracting the item's total price
    const updateOrderQuery = await pool.query(
      'UPDATE orders SET totalprice = totalprice - $1 WHERE orderid = $2 AND userid = $3 RETURNING *',
      [itemTotalPrice, orderId, userId]
    );

    if (updateOrderQuery.rows.length === 0) {
      return res.status(404).send('Order not found');
    }

    res.status(204).send(); // Success, no content response
  } catch (err) {
    res.status(500).send(err.message);
  }
});

};
