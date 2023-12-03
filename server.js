const express = require('express');
const app = express();
const port = 3000 || process.env.PORT;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, this is the E-commerce API!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
