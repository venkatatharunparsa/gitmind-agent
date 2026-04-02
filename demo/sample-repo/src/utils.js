const formatResponse = (success, message, data = null) => {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

const paginate = (array, page, limit) => {
  const start = (page - 1) * limit;
  return array.slice(start, start + limit);
};

module.exports = { 
  formatResponse, 
  validateEmail, 
  generateId,
  paginate
};
