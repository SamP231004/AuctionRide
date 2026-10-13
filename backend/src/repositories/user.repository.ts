import type { Prisma, PrismaClient, Role, User } from '@prisma/client';
import type { DbClient } from './types.js';

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: string, tx: DbClient = this.db): Promise<User | null> {
    return tx.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  create(data: { name: string; email: string; passwordHash: string; role?: Role }): Promise<User> {
    return this.db.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  touchLastLogin(id: string, at: Date): Promise<User> {
    return this.db.user.update({ where: { id }, data: { lastLoginAt: at } });
  }

  countByRole(role: Role): Promise<number> {
    return this.db.user.count({ where: { role } });
  }

  findManyByIds(ids: string[]): Promise<Pick<User, 'id' | 'name'>[]> {
    return this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  }
}
