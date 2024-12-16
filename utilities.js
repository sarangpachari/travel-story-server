const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  //NO TOKEN, UNAUTHORIZED
  if (!token) return res.sendStatus(401).send({ message: "Unauthorized" });
  //TOKEN IS INVALID

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(401);
    //TOKEN IS VALID
    req.user = user;
    next();
  });
}


module.exports = {
    authenticateToken
}
