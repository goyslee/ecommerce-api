const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const pool = require('../config/dbConfig'); // Adjust the path as needed

const initializePassport = (passport) => {
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
};

const login = (passport) => (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(401).send('Authentication failed');
        }
        req.login(user, (loginErr) => {
            if (loginErr) {
                return next(loginErr);
            }
            return res.status(200).send('Authentication successful');
        });
    })(req, res, next);
};

const logout = (req, res) => {
    req.logout();
    res.send('Logged out successfully');
};

module.exports = {
    initializePassport,
    login,
    logout
};
