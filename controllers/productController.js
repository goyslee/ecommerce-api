// controllers\productController.js 
const pool = require('../config/dbConfig');

const addProduct = async (req, res) => {
  const { name, description, price, stockquantity, category } = req.body;
  try {
    const newProduct = await pool.query(
      'INSERT INTO Products (name, description, price, stockquantity, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, price, stockquantity, category]
    );
    res.status(201).json(newProduct.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Products');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getProductById = async (req, res) => {
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
};

const updateProduct = async (req, res) => {
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
};

const deleteProduct = async (req, res) => {
  const { productid } = req.params;
  try {
    const result = await pool.query('DELETE FROM Products WHERE productid = $1 RETURNING *', [productid]);
    if (result.rows.length > 0) {
      res.send('Product deleted successfully');
    } else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct
};
