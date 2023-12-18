// controllers\checkoutController.js
const pool = require('../config/dbConfig');
const { simulatePayment } = require('../services/paymentService');

async function getProductPrice(productid) {
    const productQuery = await pool.query('SELECT price FROM products WHERE productid = $1', [productid]);
    if (productQuery.rows.length > 0) {
        return productQuery.rows[0].price;
    } else {
        throw new Error('Product not found');
    }
}

const checkout = async (req, res) => {
    const cartId = req.params.cartId;
    const userId = req.user.userid;

    try {
        const cartUserQuery = await pool.query('SELECT userid FROM carts WHERE cartid = $1', [cartId]);
        if (cartUserQuery.rows.length === 0 || parseInt(cartUserQuery.rows[0].userid) !== parseInt(userId)) {
            return res.status(403).send("Not authorized to view other users' carts");
        }

        const cartQuery = await pool.query('SELECT * FROM carts WHERE cartid = $1', [cartId]);
        if (cartQuery.rows.length === 0) {
            return res.status(400).send('Invalid cart');
        }

        const totalQuery = await pool.query('SELECT totalprice FROM carts WHERE cartid = $1', [cartId]);
        const totalPrice = totalQuery.rows[0].totalprice;

        const paymentResult = await simulatePayment(userId, cartId, totalPrice);

        if (paymentResult.success) {
            const userQuery = await pool.query('SELECT address FROM users WHERE userid = $1', [userId]);
            const shippingAddress = userQuery.rows[0].address;

            const orderQuery = await pool.query('INSERT INTO orders (userid, orderdate, totalprice, shippingaddress) VALUES ($1, NOW(), $2, $3) RETURNING *', [userId, totalPrice, shippingAddress]);
            const orderId = orderQuery.rows[0].orderid;

            const cartItemsQuery = await pool.query('SELECT productid, quantity FROM cartitems WHERE cartid = $1', [cartId]);
            for (const item of cartItemsQuery.rows) {
                const itemTotalPrice = item.quantity * (await getProductPrice(item.productid));
                await pool.query('INSERT INTO orderdetails (orderid, productid, quantity, price) VALUES ($1, $2, $3, $4)', [orderId, item.productid, item.quantity, itemTotalPrice]);
            }

            await pool.query('DELETE FROM cartitems WHERE cartid = $1', [cartId]);
            await pool.query('UPDATE carts SET totalprice = 0 WHERE cartid = $1', [cartId]);

            res.status(201).send('Checkout successful');
        } else {
            return res.status(400).send('Payment failed');
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
};

module.exports = {
    checkout
};
