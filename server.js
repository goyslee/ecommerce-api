const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const pool = require('./config/dbConfig');
const swaggerUi = require('swagger-ui-express');
const YAML = require('js-yaml'); 
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authController = require('./controllers/authController');

const app = express();
const port = process.env.PORT || 3000;
const swaggerDocument = YAML.load(fs.readFileSync('./swagger.yaml', 'utf8'));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log("Incoming Request Body:", req.body);
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
authController.initializePassport(passport);

app.use(authRoutes);
app.use(userRoutes);
app.use(productRoutes);
app.use(cartRoutes);
app.use(checkoutRoutes);
app.use(orderRoutes);

app.get('/', (req, res) => {
  res.send('Hello, this is the E-commerce API!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
