import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GroupListItem {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  createdAt: Date;
}

export interface InvitationResult {
  code: string;
  expiresAt: Date;
}

// Excludes visually ambiguous characters (0/O, 1/I/L) since codes are meant to be
// read off one screen and typed into another.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string): Promise<GroupListItem> {
    // `on_group_created` (see BE/supabase/migrations) adds the creator as 'owner'
    // in group_members as soon as this INSERT commits — no separate write needed.
    const group = await this.prisma.group.create({
      data: { name, createdBy: userId },
    });

    return {
      id: group.id,
      name: group.name,
      role: 'owner',
      memberCount: 1,
      createdAt: group.createdAt,
    };
  }

  async listForUser(userId: string): Promise<GroupListItem[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: { group: { include: { _count: { select: { members: true } } } } },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      role: membership.role,
      memberCount: membership.group._count.members,
      createdAt: membership.group.createdAt,
    }));
  }

  async getOne(userId: string, groupId: string): Promise<GroupListItem> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: { include: { _count: { select: { members: true } } } } },
    });
    if (!membership) {
      throw new NotFoundException('No group with that id');
    }

    return {
      id: membership.group.id,
      name: membership.group.name,
      role: membership.role,
      memberCount: membership.group._count.members,
      createdAt: membership.group.createdAt,
    };
  }

  async createInvitation(
    userId: string,
    groupId: string,
  ): Promise<InvitationResult> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenException('Only a group owner or admin can invite members');
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    // Collisions are astronomically unlikely at this alphabet/length, so a single
    // insert (rather than a generate-and-check-uniqueness loop) is fine here.
    const invitation = await this.prisma.invitation.create({
      data: {
        groupId,
        code: generateInviteCode(),
        createdBy: userId,
        expiresAt,
      },
    });

    return { code: invitation.code, expiresAt: invitation.expiresAt! };
  }

  async joinByCode(userId: string, code: string): Promise<GroupListItem> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { code: code.toUpperCase() },
      include: { group: { include: { _count: { select: { members: true } } } } },
    });

    if (!invitation || (invitation.expiresAt && invitation.expiresAt < new Date())) {
      throw new NotFoundException('Invalid or expired invite code');
    }

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: invitation.groupId, userId } },
    });
    if (existing) {
      throw new BadRequestException("You're already a member of this group");
    }

    await this.prisma.groupMember.create({
      data: { groupId: invitation.groupId, userId, role: 'member' },
    });

    return {
      id: invitation.group.id,
      name: invitation.group.name,
      role: 'member',
      memberCount: invitation.group._count.members + 1,
      createdAt: invitation.group.createdAt,
    };
  }
}
