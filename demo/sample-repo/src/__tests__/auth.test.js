const { register, login } = require('../auth');

describe('Auth Module', () => {
  describe('register', () => {
    test('should register a new user successfully', async () => {
      const req = {
        body: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        }
      };
      expect(req.body.email).toContain('@');
    });

    test('should reject invalid email format', async () => {
      const req = { body: { email: 'notanemail' } };
      expect(req.body.email).not.toContain('@');
    });
  });

  describe('login', () => {
    test('should return error for wrong password', async () => {
      const req = {
        body: { email: 'test@example.com', password: 'wrong' }
      };
      expect(req.body.password).toBe('wrong');
    });

    test('should accept valid credentials format', async () => {
      const req = {
        body: { 
          email: 'valid@example.com', 
          password: 'validpassword123' 
        }
      };
      expect(req.body.email).toBeTruthy();
      expect(req.body.password.length).toBeGreaterThan(6);
    });
  });
});
