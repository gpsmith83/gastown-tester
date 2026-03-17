import { User } from '@gastown-tester/shared';

export class UserService {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> user id

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email);
    if (!userId) return null;
    return this.findById(userId);
  }

  async create(userData: User): Promise<User> {
    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      createdAt: userData.createdAt
    };

    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);

    return user;
  }

  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser: User = {
      ...existingUser,
      ...updates
    };

    // Update email index if email changed
    if (updates.email && updates.email !== existingUser.email) {
      this.emailIndex.delete(existingUser.email);
      this.emailIndex.set(updates.email, id);
    }

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async delete(id: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user) return false;

    this.users.delete(id);
    this.emailIndex.delete(user.email);
    return true;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
}