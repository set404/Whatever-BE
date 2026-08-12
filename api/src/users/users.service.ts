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
    const profiles = await this.prisma.profile.findMany({
      include: { authUser: true },
      orderBy: { createdAt: 'asc' },
    });

    return profiles.map((profile) => ({
      id: profile.id,
      email: profile.authUser.email,
      displayName: profile.displayName,
      globalRole: profile.globalRole as GlobalRole,
      createdAt: profile.createdAt,
    }));
  }

  async updateGlobalRole(
    userId: string,
    role: GlobalRole,
  ): Promise<AdminUserListItem> {
    const existing = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new NotFoundException('No user with that id');
    }

    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: { globalRole: role },
      include: { authUser: true },
    });

    return {
      id: updated.id,
      email: updated.authUser.email,
      displayName: updated.displayName,
      globalRole: updated.globalRole as GlobalRole,
      createdAt: updated.createdAt,
    };
  }
}
