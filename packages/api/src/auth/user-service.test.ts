import { UserService } from './user-service';
import { User } from '@gastown-tester/shared';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData: User = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      };

      const createdUser = await userService.create(userData);

      expect(createdUser).toEqual(userData);
      expect(await userService.findById('test-123')).toEqual(userData);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent user', async () => {
      const user = await userService.findById('non-existent');
      expect(user).toBeNull();
    });

    it('should return user when found', async () => {
      const userData: User = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      };

      await userService.create(userData);
      const foundUser = await userService.findById('test-123');
      expect(foundUser).toEqual(userData);
    });
  });

  describe('findByEmail', () => {
    it('should return null for non-existent email', async () => {
      const user = await userService.findByEmail('non-existent@example.com');
      expect(user).toBeNull();
    });

    it('should return user when found by email', async () => {
      const userData: User = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      };

      await userService.create(userData);
      const foundUser = await userService.findByEmail('test@example.com');
      expect(foundUser).toEqual(userData);
    });
  });

  describe('update', () => {
    it('should update existing user', async () => {
      const userData: User = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      };

      await userService.create(userData);

      const updatedUser = await userService.update('test-123', {
        name: 'Updated Name',
        email: 'updated@example.com'
      });

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.id).toBe('test-123');

      // Should be findable by new email
      const foundUser = await userService.findByEmail('updated@example.com');
      expect(foundUser?.id).toBe('test-123');

      // Should not be findable by old email
      const oldEmailUser = await userService.findByEmail('test@example.com');
      expect(oldEmailUser).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      await expect(userService.update('non-existent', { name: 'New Name' }))
        .rejects.toThrow('User with id non-existent not found');
    });
  });

  describe('delete', () => {
    it('should return false for non-existent user', async () => {
      const result = await userService.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should delete existing user', async () => {
      const userData: User = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      };

      await userService.create(userData);

      const result = await userService.delete('test-123');
      expect(result).toBe(true);

      // User should no longer be found
      expect(await userService.findById('test-123')).toBeNull();
      expect(await userService.findByEmail('test@example.com')).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('should return empty array when no users', async () => {
      const users = await userService.getAllUsers();
      expect(users).toEqual([]);
    });

    it('should return all users', async () => {
      const user1: User = {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        createdAt: new Date()
      };

      const user2: User = {
        id: 'user-2',
        email: 'user2@example.com',
        name: 'User 2',
        createdAt: new Date()
      };

      await userService.create(user1);
      await userService.create(user2);

      const users = await userService.getAllUsers();
      expect(users).toHaveLength(2);
      expect(users).toContainEqual(user1);
      expect(users).toContainEqual(user2);
    });
  });
});