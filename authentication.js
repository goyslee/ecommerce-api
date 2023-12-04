const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const pool = require('./db');

module.exports = (app, passport) => {
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
      async (email, password, done) => {
        console.log('LocalStrategy called.'); 
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

  passport.serializeUser((user, done) => {
    done(null, user.userid);
  });

  passport.deserializeUser((userid, done) => {
    pool.query('SELECT * FROM Users WHERE userid = $1', [userid], (err, results) => {
      if (err) {
        return done(err);
      }
      done(null, results.rows[0]);
    });
  });
  
 
  
    
 app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      // Authentication failed, return an appropriate response
      return res.status(401).send('Authentication failed');
    }
    // If authentication succeeded, log in the user and initialize the session
      req.login(user, (loginErr) => {
         console.log(req.user.id)
      if (loginErr) {
        return next(loginErr);
      }
        // Redirect to a success page or send a success response
        console.log(req.user.id)
      return res.status(200).send('Authentication successful');
    });
  })(req, res, next);
});

};
