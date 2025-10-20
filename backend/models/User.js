const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

class User {
  static collection() {
    return getDB().collection('users');
  }

  static async create(userData) {
    
    // Validate input
    if (!userData.username || !userData.password) {
      throw new Error('Username and password are required');
    }

    // Validate role
    const validRoles = ['student', 'supervisor', 'admin', 'moduleAdmin'];
    if (!validRoles.includes(userData.role)) {
      throw new Error('Invalid role');
    }

    // Validate email format if provided
    if (userData.email && !this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = {
      username: userData.username.toLowerCase().trim(),
      password: hashedPassword,
      role: userData.role || 'student',
      name: (userData.name || userData.fullName || '').trim(),
      email: userData.email ? userData.email.toLowerCase().trim() : '',
      capacity: userData.role === 'supervisor' ? parseInt(userData.capacity) || 0 : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      loginAttempts: 0,
      lockUntil: null
    };

    const result = await this.collection().insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static async findByUsername(username) {
    return await this.collection().findOne({
      username: username.toLowerCase().trim()
    });
  }

  static async findById(id) {
    if (typeof id === 'string') {
      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return null;
      }
      id = new ObjectId(id);
    }
    return await this.collection().findOne({ _id: id });
  }

  static async updatePassword(userId, newPassword) {
    if (typeof userId === 'string') {
      userId = new ObjectId(userId);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return await this.collection().updateOne(
      { _id: userId },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async getAllByRole(role) {
    return await this.collection().find({ role }).toArray();
  }

  static async getAll() {
    return await this.collection().find().toArray();
  }

  // Security: Don't expose passwords in returned objects
  static toSafeUser(user) {
    if (!user) return null;

    const { password, loginAttempts, lockUntil, ...safeUser } = user;
    return safeUser;
  }
}

module.exports = User;