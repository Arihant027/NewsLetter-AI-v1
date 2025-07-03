import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No authentication token, access denied.' });

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) return res.status(401).json({ message: 'Token verification failed, access denied.' });

    req.user = verified.id;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Token is not valid.' });
  }
};

export default auth;