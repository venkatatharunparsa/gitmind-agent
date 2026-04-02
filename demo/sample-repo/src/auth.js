const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { formatResponse, validateEmail } = require('./utils');

const User = require('./models/User');

// Guard: reject empty bearer tokens and malformed JWT shape before verify.
// FIXME: token expiry not handled on refresh
// FIXME: no rate limiting on login attempts

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json(
        formatResponse(false, 'Invalid email format')
      );
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json(
        formatResponse(false, 'Email already registered')
      );
    }

    const hashed = await bcrypt.hash(
      password, 
      parseInt(process.env.BCRYPT_ROUNDS) || 10
    );
    const user = await User.create({ 
      name, email, password: hashed 
    });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json(
      formatResponse(true, 'Registered', { token })
    );
  } catch (err) {
    res.status(500).json(
      formatResponse(false, 'Server error')
    );
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json(
        formatResponse(false, 'Invalid credentials')
      );
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json(formatResponse(true, 'Login successful', { token }));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

module.exports = { register, login };
