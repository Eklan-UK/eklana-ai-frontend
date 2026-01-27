import User from '@/models/user';
import { Types } from 'mongoose';
import { NotFoundError } from './response';

/**
 * User service for common user operations
 * Centralizes user lookup logic to follow DRY principles
 */
export const userService = {
  /**
   * Find user by ID
   * @throws NotFoundError if user not found
   */
  findById: async (userId: string, select?: string) => {
    const user = await User.findById(userId)
      .select(select || 'email firstName lastName')
      .lean()
      .exec();
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    return user;
  },
  
  /**
   * Find user by email
   * @throws NotFoundError if user not found
   */
  findByEmail: async (email: string, select?: string) => {
    const user = await User.findOne({ email })
      .select(select || 'email firstName lastName')
      .lean()
      .exec();
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    return user;
  },
  
  /**
   * Find multiple users by IDs
   */
  findMultiple: async (userIds: string[], select?: string) => {
    return User.find({ 
      _id: { $in: userIds.map(id => new Types.ObjectId(id)) } 
    })
      .select(select || 'email firstName lastName')
      .lean()
      .exec();
  },
  
  /**
   * Find users by role
   */
  findByRole: async (role: 'user' | 'admin' | 'tutor', select?: string) => {
    return User.find({ role })
      .select(select || 'email firstName lastName')
      .lean()
      .exec();
  },
  
  /**
   * Find users with role validation
   * @throws NotFoundError if any user not found or doesn't have required role
   */
  findMultipleWithRole: async (
    userIds: string[], 
    role: 'user' | 'admin' | 'tutor',
    select?: string
  ) => {
    const users = await User.find({
      _id: { $in: userIds.map(id => new Types.ObjectId(id)) },
      role,
    })
      .select(select || 'email firstName lastName')
      .lean()
      .exec();
    
    if (users.length !== userIds.length) {
      const foundIds = users.map(u => u._id.toString());
      const missingIds = userIds.filter(id => !foundIds.includes(id));
      throw new NotFoundError(`Users with IDs: ${missingIds.join(', ')}`);
    }
    
    return users;
  },
  
  /**
   * Get user's display name
   */
  getDisplayName: (user: any): string => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (user.name) {
      return user.name;
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  },
};

