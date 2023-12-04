const Joi = require('joi');
const bcrypt = require('bcrypt');
const pool = require('./db');

const userSchema = Joi.object({
  name: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(5).required(),
  address: Joi.string().required(),
  phonenumber: Joi.string().pattern(new RegExp('^[0-9+\\-\\s]+$')).required()
});

module.exports = (app) => {
  app.post('/register', async (req, res) => {
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
  });
};
