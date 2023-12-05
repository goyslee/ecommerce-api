// middleware.js (Create a separate middleware file)

function checkAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    // If the user is authenticated, continue with the request
    return next();
  }

  // If the user is not authenticated, send an unauthorized response
  res.status(401).send('Unauthorized');
}

module.exports = { checkAuthentication };
