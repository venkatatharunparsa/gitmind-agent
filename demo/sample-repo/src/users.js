const { formatResponse } = require('./utils');
const { login } = require('./auth');
const User = require('./models/User');

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password');
    res.json(formatResponse(true, 'Profile fetched', user));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true }
    ).select('-password');
    res.json(formatResponse(true, 'Profile updated', user));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

const deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json(formatResponse(true, 'Account deleted'));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

module.exports = { getProfile, updateProfile, deleteAccount, login };
