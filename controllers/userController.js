const Joi = require('joi');
const bcrypt = require('bcrypt');
const pool = require('../config/dbConfig'); // Adjusted path

const userSchema = Joi.object({
  name: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(5).required(),
  address: Joi.string().required(),
  phonenumber: Joi.string().pattern(new RegExp('^[0-9+\\-\\s]+$')).required()
});

const register = async (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  try {
    const { name, email, password, address, phonenumber } = value;
    const existingUser = await pool.query("SELECT * FROM Users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).send("User already exists.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO Users (name, email, password, address, phonenumber) VALUES ($1, $2, $3, $4, $5) RETURNING *", 
      [name, email, hashedPassword, address, phonenumber]
    );

    const userId = newUser.rows[0].userid;

    await pool.query(
      "INSERT INTO Carts (UserID, TotalPrice) VALUES ($1, 0)",
      [userId]
    );

    res.status(201).send("User registered successfully and cart created");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

const getUserById = async (req, res) => {
  const { userid } = req.params;
  try {
    if (parseInt(req.user.userid) !== parseInt(userid)) {
      return res.status(403).send("Not authorized to view other users' accounts");
    }
    const result = await pool.query('SELECT * FROM Users WHERE userid = $1', [userid]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const updateUser = async (req, res) => {
  const { userid } = req.params;
  const { name, email, password, address, phonenumber } = req.body;
   
  try {
    if (parseInt(req.user.userid) !== parseInt(userid)) {
      return res.status(403).send("Not authorized to change other users' accounts");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'UPDATE Users SET name = $1, email = $2, password = $3, address = $4, phonenumber = $5 WHERE userid = $6 RETURNING *',
      [name, email, hashedPassword, address, phonenumber, parseInt(userid)]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const deleteUser = async (req, res) => {
  const { userid } = req.params;
  try {
    if (!req.user || parseInt(req.user.userid) !== parseInt(userid)) {
      return res.status(403).send("Not authorized to delete other users' accounts");
    }
    await pool.query('DELETE FROM Users WHERE userid = $1', [userid]);
    res.status(204).send();
  } catch (err) {
    res.status(500).send(err.message);
  }
};

module.exports = {
  register,
  getUserById,
  updateUser,
  deleteUser
};
