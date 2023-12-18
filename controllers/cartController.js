// controllers\cartController.js
const pool = require('../config/dbConfig');

const showCart = async (req, res) => {
    const userId = req.user.userid;

    try {
        // Check if the user has a cart
        const cartRes = await pool.query('SELECT * FROM carts WHERE userid = $1', [userId]);
        if (cartRes.rows.length === 0) {
            return res.status(404).send('Cart not found');
        }
        const cartId = cartRes.rows[0].cartid;

        // Fetch the items in the user's cart
        const cartItemsQuery = await pool.query(`
            SELECT p.name, ci.quantity, p.price, (ci.quantity * p.price) as itemTotalPrice
            FROM cartitems ci
            JOIN Products p ON ci.productid = p.productid
            WHERE ci.cartid = $1
        `, [cartId]);

        const cartItems = cartItemsQuery.rows;
        const cartTotalPrice = cartItems.reduce((total, item) => total + item.itemTotalPrice, 0);

        res.json({ cartItems, cartTotalPrice });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const addItemToCart = async (req, res) => {
    const userId = req.user.userid;
    const { productid, quantity } = req.body;
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
        return res.status(400).send('Invalid quantity');
    }

    try {
        const product = await pool.query('SELECT stockquantity, price FROM Products WHERE productid = $1', [productid]);
        if (product.rows.length === 0 || product.rows[0].stockquantity < parsedQuantity) {
            return res.status(400).send('Insufficient stock');
        }

        let cartRes = await pool.query('SELECT * FROM carts WHERE userid = $1', [userId]);
        let cartId;
        if (cartRes.rows.length === 0) {
            const newCart = await pool.query('INSERT INTO carts (userid, totalprice) VALUES ($1, 0) RETURNING cartid', [userId]);
            cartId = newCart.rows[0].cartid;
        } else {
            cartId = cartRes.rows[0].cartid;
        }

        await pool.query('UPDATE Products SET stockquantity = stockquantity - $1 WHERE productid = $2', [parsedQuantity, productid]);

        const itemPrice = product.rows[0].price;
        const itemTotalPrice = itemPrice * parsedQuantity;

        await pool.query('INSERT INTO cartitems (cartid, productid, quantity) VALUES ($1, $2, $3)', [cartId, productid, parsedQuantity]);

        const cartItems = await pool.query('SELECT productid, quantity FROM cartitems WHERE cartid = $1', [cartId]);
        let cartTotalPrice = 0;

        for (const item of cartItems.rows) {
            const productPrice = await pool.query('SELECT price FROM Products WHERE productid = $1', [item.productid]);
            if (productPrice.rows.length > 0) {
                const itemPrice = parseFloat(productPrice.rows[0].price);
                const itemQuantity = parseInt(item.quantity, 10) || 0;
                const itemTotalPrice = itemPrice * itemQuantity;
                cartTotalPrice += itemTotalPrice;
            }
        }

        await pool.query('UPDATE carts SET totalprice = $1 WHERE cartid = $2', [cartTotalPrice, cartId]);

        res.status(201).send('Item added to cart');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const updateCartItem = async (req, res) => {
    const userId = req.user.userid;
    const { productid, quantity } = req.body;
    const updatedQuantity = parseInt(quantity, 10);

    if (isNaN(updatedQuantity) || updatedQuantity < 1) {
        return res.status(400).send('Invalid quantity');
    }

    try {
        const userCart = await pool.query('SELECT cartid FROM carts WHERE userid = $1', [userId]);
        if (userCart.rows.length === 0) {
            return res.status(404).send('User cart not found');
        }

        const { cartid: userCartId } = userCart.rows[0];
        const current = await pool.query('SELECT quantity FROM cartitems WHERE productid = $1 AND cartid = $2', [productid, userCartId]);

        if (current.rows.length === 0) {
            return res.status(404).send('Item not found in cart');
        }

        const { quantity: currentQuantity } = current.rows[0];

        if (updatedQuantity > currentQuantity) {
            const product = await pool.query('SELECT stockquantity FROM Products WHERE productid = $1', [productid]);
            if (product.rows.length === 0 || product.rows[0].stockquantity < (updatedQuantity - currentQuantity)) {
                return res.status(400).send('Insufficient stock');
            }

            await pool.query('UPDATE Products SET stockquantity = stockquantity - $1 WHERE productid = $2', [updatedQuantity - currentQuantity, productid]);
        } else if (updatedQuantity < currentQuantity) {
            await pool.query('UPDATE Products SET stockquantity = stockquantity + $1 WHERE productid = $2', [currentQuantity - updatedQuantity, productid]);
        }

        await pool.query('UPDATE cartitems SET quantity = $1 WHERE productid = $2 AND cartid = $3', [updatedQuantity, productid, userCartId]);

        res.status(200).send('Cart item updated');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const deleteCartItem = async (req, res) => {
    const userId = req.user.userid;
    const { itemId } = req.params;

    try {
        const cartRes = await pool.query('SELECT cartid FROM carts WHERE userid = $1', [userId]);
        if (cartRes.rows.length === 0) {
            return res.status(404).send('Cart not found');
        }

        const cartId = cartRes.rows[0].cartid;
        const item = await pool.query('SELECT quantity, productid FROM cartitems WHERE cartitemid = $1', [itemId]);

        if (item.rows.length === 0) {
            return res.status(404).send('Item not found in cart');
        }

        const parsedQuantity = parseInt(item.rows[0].quantity, 10);
        await pool.query('UPDATE Products SET stockquantity = stockquantity + $1 WHERE productid = $2', [parsedQuantity, item.rows[0].productid]);
        await pool.query('DELETE FROM cartitems WHERE cartitemid = $1', [itemId]);

        res.status(204).send();
    } catch (err) {
        res.status(500).send(err.message);
    }
};

module.exports = {
    addItemToCart,
    updateCartItem,
    deleteCartItem,
    showCart
};