//server.js
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const pool = require('./db'); 
const middleware = require('./middleware');
const swaggerUi = require('swagger-ui-express');
const YAML = require('js-yaml'); 
const fs = require('fs');

const port = process.env.PORT || 3000;

const app = express();
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

require('./authentication')(app, passport, pool);
require('./user')(app, pool);
require('./products')(app, pool);
require('./cart')(app, pool);
require('./checkout')(app, pool);
require('./orders')(app, pool, middleware);

app.get('/', (req, res) => {
  res.send('Hello, this is the E-commerce API!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
