const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const pool = require('./db');
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

app.use(session({
  secret: process.env.SECRET, // Replace with a real secret key
  resave: false,
  saveUninitialized: false
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    console.log("Incoming Request Body:", req.body);
    next();
});

// Configure Passport Local Strategy for login
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const res = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
      if (res.rows.length === 0) {
        return done(null, false, { message: 'Incorrect email.' });
      }

      const user = res.rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect password.' });
      }
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.userid);
});


// Deserialize user
passport.deserializeUser((userid, done) => {
  pool.query('SELECT * FROM Users WHERE userid = $1', [userid], (err, results) => {
    if (err) {
      return done(err);
    }
    done(null, results.rows[0]);
  });
});


// Login endpoint
app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));


const userSchema = Joi.object({
    name: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(5).required(),
    address: Joi.string().required(), // Basic string validation for address
    phonenumber: Joi.string().pattern(new RegExp('^[0-9+\\-\\s]+$')).required() // Validates for numbers, +, -, and spaces
});

app.post('/register', async (req, res) => {
    console.log(req.body); 

    // Validate user input
    const { error, value } = userSchema.validate(req.body);
    
    if (error) {
        console.error("Validation error:", error);
        return res.status(400).send(error.details[0].message);
    }

    try {
        const { name, email, password, address, phonenumber } = value;

        // Check if user already exists
        const existingUser = await pool.query("SELECT * FROM Users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).send("User already exists.");
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Store the user in the database and get the new user's ID
        const newUser = await pool.query(
            "INSERT INTO Users (name, email, password, address, phonenumber) VALUES ($1, $2, $3, $4, $5) RETURNING *", 
            [name, email, hashedPassword, address, phonenumber]
        );

        const userId = newUser.rows[0].userid;

        // Create a cart for the new user
        await pool.query(
            "INSERT INTO Carts (UserID, TotalPrice) VALUES ($1, 0)",
            [userId]
        );

        res.status(201).send("User registered successfully and cart created");
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});





app.get('/', (req, res) => {
  res.send('Hello, this is the E-commerce API!');
});


//PRODUCTS ROUTES START************************************************************************
// CREATE - Add a new product
app.post('/products', async (req, res) => {
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

// READ - Get all products or by category
app.get('/products', async (req, res) => {
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

// READ - Get a single product by ID
app.get('/products/:productid', async (req, res) => {
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

// UPDATE - Update a product
app.put('/products/:productid', async (req, res) => {
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

// DELETE - Delete a product
app.delete('/products/:productid', async (req, res) => {
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

//PRODUCTS ROUTES END************************************************************************


//CART ROUTES START ************************************************************************
// POST /cart/{cartId} - Add a product to a cart
app.post('/cart', async (req, res) => {
  const { productId, quantity } = req.body;
  
  // Assuming you get the logged-in user's ID from their session or JWT token
  const loggedInUserId = req.user.id; // Replace with your actual logic to get the logged-in user's ID
    console.log(req.user.id);
  try {
    // Get the cart associated with the logged-in user
    const userCart = await pool.query('SELECT CartID FROM Carts WHERE UserID = $1', [loggedInUserId]);

    if (userCart.rowCount === 0) {
      return res.status(404).send('Cart not found for the current user');
    }

    const cartId = userCart.rows[0].cartid;

    // Then, check if the product exists and get the price to calculate total
    const product = await pool.query('SELECT Price FROM Products WHERE ProductID = $1', [productId]);
    
    if (product.rowCount === 0) {
      return res.status(404).send('Product not found');
    }

    const price = product.rows[0].price;
    const totalPrice = price * quantity;

    // Add product to CartItems
    await pool.query(
      'INSERT INTO CartItems (CartID, ProductID, Quantity) VALUES ($1, $2, $3)',
      [cartId, productId, quantity]
    );

    // Update the TotalPrice in the Carts table
    await pool.query(
      'UPDATE Carts SET TotalPrice = TotalPrice + $1 WHERE CartID = $2',
      [totalPrice, cartId]
    );

    res.status(201).send('Product added to cart');
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// PUT /cart/items/:cartItemId - Update the quantity of a product in the cart
app.put('/cart/items/:cartItemId', async (req, res) => {
  const { cartItemId } = req.params;
  const { quantity } = req.body; // The new quantity
  // Assuming you get the logged-in user's ID from their session or JWT token
  const loggedInUserId = req.user.id; // Replace with your actual logic to get the logged-in user's ID

  try {
    // First, get the current item
    const currentItem = await pool.query('SELECT * FROM CartItems WHERE CartItemID = $1', [cartItemId]);
    
    if (currentItem.rowCount === 0) {
      return res.status(404).send('Cart item not found');
    }

    const cartId = currentItem.rows[0].cartid;
    const productId = currentItem.rows[0].productid;
    const oldQuantity = currentItem.rows[0].quantity;

    // Ensure the cart belongs to the logged-in user
    const cart = await pool.query('SELECT * FROM Carts WHERE CartID = $1 AND UserID = $2', [cartId, loggedInUserId]);

    if (cart.rowCount === 0) {
      return res.status(403).send('Unauthorized to access this cart');
    }

    // Get the product's price
    const product = await pool.query('SELECT Price FROM Products WHERE ProductID = $1', [productId]);
    const price = product.rows[0].price;

    // Update the CartItems table with the new quantity
    await pool.query('UPDATE CartItems SET Quantity = $1 WHERE CartItemID = $2', [quantity, cartItemId]);

    // Recalculate the total price for the cart
    const totalDifference = price * (quantity - oldQuantity);
    await pool.query('UPDATE Carts SET TotalPrice = TotalPrice + $1 WHERE CartID = $2', [totalDifference, cartId]);

    res.status(200).send('Cart item quantity updated');
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// DELETE /cart/items/:cartItemId - Remove a product from the cart
app.delete('/cart/items/:cartItemId', async (req, res) => {
  const { cartItemId } = req.params;
  // Assuming you get the logged-in user's ID from their session or JWT token
  const loggedInUserId = req.user.id; // Replace with your actual logic to get the logged-in user's ID

  try {
    // First, get the current item and price to recalculate total
    const currentItem = await pool.query('SELECT * FROM CartItems WHERE CartItemID = $1', [cartItemId]);
    
    if (currentItem.rowCount === 0) {
      return res.status(404).send('Cart item not found');
    }

    const cartId = currentItem.rows[0].cartid;

    // Ensure the cart belongs to the logged-in user
    const cart = await pool.query('SELECT * FROM Carts WHERE CartID = $1 AND UserID = $2', [cartId, loggedInUserId]);

    if (cart.rowCount === 0) {
      return res.status(403).send('Unauthorized to access this cart');
    }

    const productId = currentItem.rows[0].productid;
    const quantity = currentItem.rows[0].quantity;
    const product = await pool.query('SELECT Price FROM Products WHERE ProductID = $1', [productId]);
    const price = product.rows[0].price;

    // Remove the product from CartItems
    await pool.query('DELETE FROM CartItems WHERE CartItemID = $1', [cartItemId]);

    // Update the TotalPrice in the Carts table
    const totalDifference = price * quantity;
    await pool.query('UPDATE Carts SET TotalPrice = TotalPrice - $1 WHERE CartID = $2', [totalDifference, cartId]);

    res.status(200).send('Cart item removed');
  } catch (err) {
    res.status(500).send(err.message);
  }
});



// GET /cart/{cartId} - Retrieve a cart by ID
app.get('/cart/:cartId', async (req, res) => {
  const { cartId } = req.params;

  try {
    const cartItems = await pool.query(
      'SELECT * FROM CartItems WHERE CartID = $1',
      [cartId]
    );

    if (cartItems.rowCount === 0) {
      return res.status(404).send('Cart not found or empty');
    }

    res.json(cartItems.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
//CART ROUTES ENDS *************************************************************************

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
