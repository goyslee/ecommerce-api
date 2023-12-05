// checkout.js
module.exports = (app, pool) => {
    // Simulate payment processing (for demonstration purposes)
async function simulatePayment(userId, cartId, totalPrice) {
    try {
        // Implement logic to charge the user's payment method
        // and handle the payment gateway's response.

        // For simulation purposes, I am just logging a successful payment.
        console.log(`Payment processed successfully for User ID: ${userId}, Cart ID: ${cartId}, Total Price: ${totalPrice}`);

        // Return a payment status or transaction ID in a real implementation.
        return {
            success: true,
            transactionId: '123456789', // Replace with a real transaction ID
        };
    } catch (error) {
        // Handle payment failure
        console.error('Payment processing error:', error);

        // Return a payment failure status or error message in a real implementation.
        return {
            success: false,
            error: 'Payment processing error',
        };
    }
    }   
    // Function to get the price of a product based on productid
async function getProductPrice(productid) {
    try {
        const productQuery = await pool.query('SELECT price FROM products WHERE productid = $1', [productid]);

        if (productQuery.rows.length > 0) {
            return productQuery.rows[0].price;
        } else {
            // Handle the case where the product is not found
            throw new Error('Product not found');
        }
    } catch (error) {
        // Handle any database errors or product not found errors here
        throw error;
    }
}

// Checkout endpoint
app.post('/cart/:cartId/checkout', async (req, res) => {
    const cartId = req.params.cartId;
    const userId = req.user.userid; // Assuming you have user authentication middleware

    try {
        // Check if logged-in user's userid matches the cart's userid
        const cartUserQuery = await pool.query('SELECT userid FROM carts WHERE cartid = $1', [cartId]);

        if (cartUserQuery.rows.length === 0 || parseInt(cartUserQuery.rows[0].userid) !== parseInt(userId)) {
            return res.status(403).send("Not authorized to view other users' carts");
        }

        // Step 1: Validate the cart
        const cartQuery = await pool.query('SELECT * FROM carts WHERE cartid = $1', [cartId]);

        if (cartQuery.rows.length === 0) {
            return res.status(400).send('Invalid cart');
        }

        // Step 2: Retrieve the total price from the cart
        const totalQuery = await pool.query('SELECT totalprice FROM carts WHERE cartid = $1', [cartId]);
        const totalPrice = totalQuery.rows[0].totalprice;

        // Step 3: Process payment (simulated for now)
        const paymentResult = await simulatePayment(userId, cartId, totalPrice);

        // Check the payment result
        if (paymentResult.success) {
            // Payment succeeded, continue with order creation and other steps

            // Step 4: Get the user's shipping address
            const userQuery = await pool.query('SELECT address FROM users WHERE userid = $1', [userId]);
            const shippingAddress = userQuery.rows[0].address;

            // Step 5: Create an order
            const orderQuery = await pool.query('INSERT INTO orders (userid, orderdate, totalprice, shippingaddress) VALUES ($1, NOW(), $2, $3) RETURNING *', [userId, totalPrice, shippingAddress]);

            const orderId = orderQuery.rows[0].orderid;

            // Step 6: Create order details from cart items
            const cartItemsQuery = await pool.query('SELECT productid, quantity FROM cartitems WHERE cartid = $1', [cartId]);

            for (const item of cartItemsQuery.rows) {
                // Calculate item total price (product price * quantity)
                const itemTotalPrice = item.quantity * (await getProductPrice(item.productid));
                
                await pool.query('INSERT INTO orderdetails (orderid, productid, quantity, price) VALUES ($1, $2, $3, $4)', [orderId, item.productid, item.quantity, itemTotalPrice]);
            }

            // Step 7: Clear the cart
            await pool.query('DELETE FROM cartitems WHERE cartid = $1', [cartId]);
            await pool.query('UPDATE carts SET totalprice = 0 WHERE cartid = $1', [cartId]);

            res.status(201).send('Checkout successful');
        } else {
            // Payment failed, handle the error and respond accordingly
            return res.status(400).send('Payment failed');
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

};
