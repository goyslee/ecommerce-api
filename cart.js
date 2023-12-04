module.exports = (app, pool) => {
    // Add an item to the cart
  app.post('/cart', async (req, res) => {
        const userId = req.user.userid;
        const { productid, quantity } = req.body;

        // Convert quantity to an integer
        const parsedQuantity = parseInt(quantity, 10);

        if (isNaN(parsedQuantity) || parsedQuantity < 1) {
            return res.status(400).send('Invalid quantity');
        }

        try {
            // Check stock availability first
            const product = await pool.query('SELECT stockquantity, price FROM Products WHERE productid = $1', [productid]);
            if (product.rows.length === 0 || product.rows[0].stockquantity < parsedQuantity) {
                return res.status(400).send('Insufficient stock');
            }

            // Check if a cart exists for the user, if not create one
            let cartRes = await pool.query('SELECT * FROM carts WHERE userid = $1', [userId]);
            let cartId;
            if (cartRes.rows.length === 0) {
                const newCart = await pool.query('INSERT INTO carts (userid, totalprice) VALUES ($1, 0) RETURNING cartid', [userId]);
                cartId = newCart.rows[0].cartid;
            } else {
                cartId = cartRes.rows[0].cartid;
            }

            // Decrease stock quantity
            await pool.query('UPDATE Products SET stockquantity = stockquantity - $1 WHERE productid = $2', [parsedQuantity, productid]);

            // Calculate the total price for this item
            const itemPrice = product.rows[0].price;
            const itemTotalPrice = itemPrice * parsedQuantity;

            // Add item to cartitems table
            await pool.query('INSERT INTO cartitems (cartid, productid, quantity) VALUES ($1, $2, $3)', [cartId, productid, parsedQuantity]);

            // Calculate and update the total price in the user's cart
            const cartItems = await pool.query('SELECT productid, quantity FROM cartitems WHERE cartid = $1', [cartId]);
            let cartTotalPrice = 0;

            for (const item of cartItems.rows) {
                const product = await pool.query('SELECT price FROM Products WHERE productid = $1', [item.productid]);

                if (product.rows.length > 0) {
                    const itemPrice = parseFloat(product.rows[0].price); // Use parseFloat for price
                    const itemQuantity = parseInt(item.quantity, 10) || 0; // Use parseInt and handle empty or non-numeric quantity

                    // Calculate item total price and add it to cartTotalPrice
                    const itemTotalPrice = itemPrice * itemQuantity;
                    cartTotalPrice += itemTotalPrice;
                }
            }

            // Update the total price in the user's cart
            await pool.query('UPDATE carts SET totalprice = $1 WHERE cartid = $2', [cartTotalPrice, cartId]);

            res.status(201).send('Item added to cart');
        } catch (err) {
            res.status(500).send(err.message);
        }
    });


// Update an item in the cart
app.put('/cart', async (req, res) => {
    const userId = req.user.userid; // Get the logged-in user's ID
    const { productid, quantity } = req.body; // Get productid and quantity from the request body

    console.log('userId:', userId);
    console.log('productid:', productid);

    // Convert quantity to an integer
    const updatedQuantity = parseInt(quantity, 10);
    if (isNaN(updatedQuantity) || updatedQuantity < 1) {
        return res.status(400).send('Invalid quantity');
    }

    try {
        // Check if the user has a cart
        console.log('Checking user cart...');
        const userCart = await pool.query('SELECT cartid FROM carts WHERE userid = $1', [userId]);
        if (userCart.rows.length === 0) {
            console.log('User cart not found');
            return res.status(404).send('User cart not found');
        }

        const { cartid: userCartId } = userCart.rows[0]; // Store the user's cart ID

        // Query the database to get the current cart item
        console.log('Checking current cart item...');
        const current = await pool.query('SELECT productid, quantity FROM cartitems WHERE productid = $1 AND cartid = $2', [productid, userCartId]);
        if (current.rows.length === 0) {
            console.log('Item not found in cart');
            return res.status(404).send('Item not found in cart');
        }

        const { quantity: currentQuantity } = current.rows[0];

        // Check stock if quantity is increasing
        if (updatedQuantity > currentQuantity) {
            const product = await pool.query('SELECT stockquantity, price FROM Products WHERE productid = $1', [productid]);
            if (product.rows.length === 0 || product.rows[0].stockquantity < (updatedQuantity - currentQuantity)) {
                return res.status(400).send('Insufficient stock');
            }

            const { stockquantity, price } = product.rows[0];

            // Calculate the total price for this item
            const itemTotalPrice = price * updatedQuantity;

            // Update stock quantity
            await pool.query('UPDATE Products SET stockquantity = stockquantity - $1 WHERE productid = $2', [updatedQuantity - currentQuantity, productid]);

            // Update the cart item quantity
            console.log('Updating the cart item quantity...');
            await pool.query('UPDATE cartitems SET quantity = $1 WHERE productid = $2 AND cartid = $3', [updatedQuantity, productid, userCartId]);
        } else if (updatedQuantity < currentQuantity) {
            // Decreasing quantity
            const product = await pool.query('SELECT price FROM Products WHERE productid = $1', [productid]);
            if (product.rows.length === 0) {
                return res.status(400).send('Invalid product');
            }

            const { price } = product.rows[0];

            // Calculate the total price for this item
            const itemTotalPrice = price * updatedQuantity;

            // Update stock quantity
            await pool.query('UPDATE Products SET stockquantity = stockquantity + $1 WHERE productid = $2', [currentQuantity - updatedQuantity, productid]);

            // Update the cart item quantity
            console.log('Updating the cart item quantity...');
            await pool.query('UPDATE cartitems SET quantity = $1 WHERE productid = $2 AND cartid = $3', [updatedQuantity, productid, userCartId]);
        }

        // Calculate and update the total price in the user's cart
        const cartItems = await pool.query('SELECT productid, quantity FROM cartitems WHERE cartid = $1', [userCartId]);
        let cartTotalPrice = 0;

        for (const item of cartItems.rows) {
            const product = await pool.query('SELECT price FROM Products WHERE productid = $1', [item.productid]);

            if (product.rows.length > 0) {
                const itemPrice = parseInt(product.rows[0].price, 10);
                const itemQuantity = parseInt(item.quantity, 10) || 0; // Use parseInt and handle empty or non-numeric quantity

                // Calculate item total price and add it to cartTotalPrice
                const itemTotalPrice = itemPrice * itemQuantity;
                cartTotalPrice += itemTotalPrice;
            }
        }

        // Update the total price in the user's cart
        await pool.query('UPDATE carts SET totalprice = $1 WHERE cartid = $2', [cartTotalPrice, userCartId]);

        console.log('Item updated successfully');
        res.json({ message: 'Item updated successfully', cartTotalPrice });
    } catch (err) {
        console.error("Error in PUT /cart:", err);
        res.status(500).send(err.message);
    }
});


   // Delete an item from the cart
    app.delete('/cart/:itemId', async (req, res) => {
        const userId = req.user.userid;
        const { itemId } = req.params;

        try {
            // First, ensure the item belongs to the user's cart
            const cartRes = await pool.query('SELECT * FROM carts WHERE userid = $1', [userId]);
            if (cartRes.rows.length === 0) {
                return res.status(404).send('Cart not found');
            }
            const cartId = cartRes.rows[0].cartid;

            // Fetch the cart item to be deleted
            const item = await pool.query('SELECT quantity, productid FROM cartitems WHERE cartitemid = $1', [itemId]);
            if (item.rows.length === 0) {
                return res.status(404).send('Item not found in cart');
            }

            const parsedQuantity = parseInt(item.rows[0].quantity, 10);

            // Increase stock quantity
            await pool.query('UPDATE Products SET stockquantity = stockquantity + $1 WHERE productid = $2', [parsedQuantity, item.rows[0].productid]);

            // Delete the cart item
            await pool.query('DELETE FROM cartitems WHERE cartitemid = $1', [itemId]);

            // Calculate and update the total price in the user's cart
            const cartItems = await pool.query('SELECT productid, quantity FROM cartitems WHERE cartid = $1', [cartId]);
            let cartTotalPrice = 0;

            for (const item of cartItems.rows) {
                const product = await pool.query('SELECT price FROM Products WHERE productid = $1', [item.productid]);

                if (product.rows.length > 0) {
                    const itemPrice = parseFloat(product.rows[0].price); // Use parseFloat for price
                    const itemQuantity = parseInt(item.quantity, 10) || 0; // Use parseInt and handle empty or non-numeric quantity

                    // Calculate item total price and add it to cartTotalPrice
                    const itemTotalPrice = itemPrice * itemQuantity;
                    cartTotalPrice += itemTotalPrice;
                }
            }

            // Update the total price in the user's cart
            await pool.query('UPDATE carts SET totalprice = $1 WHERE cartid = $2', [cartTotalPrice, cartId]);

            res.status(204).send();
        } catch (err) {
            res.status(500).send(err.message);
        }
    });
};
