const isAuthorized = (req, res, next) => {
    const { userid } = req.params;
    if (req.user && req.user.userid === userid) {
      // User is authorized to modify their own account
      next();
    } else {
      // User is not authorized to modify other users' accounts
      res.status(403).send("Not authorized to change other users' accounts");
    }
};
  
module.exports = {
  isAuthorized,
};