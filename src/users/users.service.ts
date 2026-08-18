import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalRole } from '../roles/global-role.enum';

export interface AdminUserListItem {
  id: string;
  email: string | null;
  displayName: string | null;
  globalRole: GlobalRole;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<AdminUserListItem[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      globalRole: user.globalRole as GlobalRole,
      createdAt: user.createdAt,
    }));
  }

  async updateGlobalRole(
    userId: string,
    role: GlobalRole,
  ): Promise<AdminUserListItem> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new NotFoundException('No user with that id');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { globalRole: role },
    });

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      globalRole: updated.globalRole as GlobalRole,
      createdAt: updated.createdAt,
    };
  }
}
