import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../auth/mail.service';
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

export interface EmailInvitationResult {
  email: string;
  expiresAt: Date;
}

export interface InvitationInfo {
  groupId: string;
  groupName: string;
  email: string | null;
}

export interface GroupMemberItem {
  userId: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: Date;
}

// Owner first, then admin, then everyone else — ties broken by join order.
const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1 };
function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 2;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, name: string): Promise<GroupListItem> {
    // Used to be a DB trigger (Supabase-era); ported here now that Prisma Migrate
    // owns the schema and there's no hand-written SQL trigger layer anymore.
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: { name, createdBy: userId },
      });
      await tx.groupMember.create({
        data: { groupId: created.id, userId, role: 'owner' },
      });
      return created;
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
      include: {
        group: { include: { _count: { select: { members: true } } } },
      },
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
      include: {
        group: { include: { _count: { select: { members: true } } } },
      },
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

  async getMembers(
    userId: string,
    groupId: string,
  ): Promise<GroupMemberItem[]> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('No group with that id');
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    // No Prisma relation between GroupMember and User (see schema.prisma), so
    // this is a second query rather than an `include` — fine at group-roster
    // scale.
    const users = await this.prisma.user.findMany({
      where: { id: { in: members.map((member) => member.userId) } },
      select: { id: true, displayName: true, email: true, avatarUrl: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return members
      .map((member) => {
        const user = usersById.get(member.userId);
        return {
          userId: member.userId,
          displayName: user?.displayName ?? null,
          email: user?.email ?? '',
          avatarUrl: user?.avatarUrl ?? null,
          role: member.role,
          joinedAt: member.joinedAt,
        };
      })
      .sort(
        (a, b) =>
          roleRank(a.role) - roleRank(b.role) ||
          a.joinedAt.getTime() - b.joinedAt.getTime(),
      );
  }

  async createInvitation(
    userId: string,
    groupId: string,
  ): Promise<InvitationResult> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ForbiddenException(
        'Only a group owner or admin can invite members',
      );
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

  async inviteByEmail(
    userId: string,
    groupId: string,
    email: string,
  ): Promise<EmailInvitationResult> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });
    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      throw new ForbiddenException(
        'Only a group owner or admin can invite members',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const invitedUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (invitedUser) {
      const existingMembership = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: invitedUser.id } },
      });
      if (existingMembership) {
        throw new BadRequestException(
          'This person is already a member of the group',
        );
      }
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.prisma.invitation.create({
      data: {
        groupId,
        code: generateInviteCode(),
        email: normalizedEmail,
        createdBy: userId,
        expiresAt,
      },
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const joinLink = `${frontendUrl}/#/invite/${invitation.code}`;
    await this.mail.sendGroupInviteEmail(
      normalizedEmail,
      membership.group.name,
      joinLink,
    );

    return { email: normalizedEmail, expiresAt: invitation.expiresAt! };
  }

  async getInvitationInfo(code: string): Promise<InvitationInfo> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { code: code.toUpperCase() },
      include: { group: true },
    });

    if (
      !invitation ||
      (invitation.expiresAt && invitation.expiresAt < new Date())
    ) {
      throw new NotFoundException('Invalid or expired invite code');
    }

    return {
      groupId: invitation.groupId,
      groupName: invitation.group.name,
      email: invitation.email,
    };
  }

  async joinByCode(
    userId: string,
    code: string,
    userEmail: string | null,
  ): Promise<GroupListItem> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        group: { include: { _count: { select: { members: true } } } },
      },
    });

    if (
      !invitation ||
      (invitation.expiresAt && invitation.expiresAt < new Date())
    ) {
      throw new NotFoundException('Invalid or expired invite code');
    }

    if (invitation.email && invitation.email !== userEmail?.toLowerCase()) {
      throw new ForbiddenException(
        'This invite was sent to a different email address',
      );
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
