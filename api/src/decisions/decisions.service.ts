import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DecisionResult {
  id: string;
  decisionDate: Date;
  createdAt: Date;
  restaurant: {
    id: string;
    name: string;
    imageUrl: string | null;
    websiteUrl: string | null;
  };
}

// Prisma's `Decision` column is a plain SQL `date` — truncate to a UTC midnight
// Date so the (groupId, decisionDate) unique constraint keys off calendar day,
// not a timestamp.
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// No restaurant should be picked more than once within any 4 consecutive days —
// i.e. a repeat needs at least this many days' gap from its last pick.
const NO_REPEAT_WINDOW_DAYS = 4;

function toResult(decision: {
  id: string;
  decisionDate: Date;
  createdAt: Date;
  restaurant: {
    id: string;
    name: string;
    imageUrl: string | null;
    websiteUrl: string | null;
  };
}): DecisionResult {
  return {
    id: decision.id,
    decisionDate: decision.decisionDate,
    createdAt: decision.createdAt,
    restaurant: decision.restaurant,
  };
}

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(
    groupId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this group');
    }
  }

  /**
   * Picks a restaurant for `decisionDate`, excluding anything picked within the
   * last NO_REPEAT_WINDOW_DAYS days. If the group's pool is too small for that
   * (every active restaurant was picked recently), a repeat is unavoidable —
   * falls back to whichever one was picked longest ago, to spread repeats out
   * as much as possible rather than failing or ignoring the rule entirely.
   */
  private async choose<T extends { id: string }>(
    groupId: string,
    decisionDate: Date,
    restaurants: T[],
  ): Promise<T> {
    const cutoff = new Date(decisionDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - (NO_REPEAT_WINDOW_DAYS - 1));

    const recentDecisions = await this.prisma.decision.findMany({
      where: { groupId, decisionDate: { gte: cutoff, lt: decisionDate } },
      select: { restaurantId: true, decisionDate: true },
      orderBy: { decisionDate: 'desc' },
    });

    const recentlyPickedIds = new Set(
      recentDecisions.map((d) => d.restaurantId),
    );
    const eligible = restaurants.filter((r) => !recentlyPickedIds.has(r.id));
    if (eligible.length > 0) {
      return eligible[Math.floor(Math.random() * eligible.length)];
    }

    // recentDecisions is newest-first, so the first occurrence per restaurant is
    // its most recent pick.
    const lastPickedAt = new Map<string, Date>();
    for (const d of recentDecisions) {
      if (!lastPickedAt.has(d.restaurantId)) {
        lastPickedAt.set(d.restaurantId, d.decisionDate);
      }
    }
    return [...restaurants].sort((a, b) => {
      const aTime = lastPickedAt.get(a.id)?.getTime() ?? 0;
      const bTime = lastPickedAt.get(b.id)?.getTime() ?? 0;
      return aTime - bTime;
    })[0];
  }

  async getOrPickToday(
    groupId: string,
    userId: string,
  ): Promise<DecisionResult> {
    await this.requireMembership(groupId, userId);

    const decisionDate = todayDateOnly();

    const existing = await this.prisma.decision.findUnique({
      where: { groupId_decisionDate: { groupId, decisionDate } },
      include: { restaurant: true },
    });
    if (existing) {
      return toResult(existing);
    }

    const restaurants = await this.prisma.restaurant.findMany({
      where: { groupId, active: true },
    });
    if (restaurants.length === 0) {
      throw new BadRequestException(
        'Add a restaurant before getting a decision',
      );
    }

    const pick = await this.choose(groupId, decisionDate, restaurants);

    try {
      const decision = await this.prisma.decision.create({
        data: { groupId, restaurantId: pick.id, decisionDate },
        include: { restaurant: true },
      });
      return toResult(decision);
    } catch (err) {
      // Two members hitting "today's decision" at the same moment can both pass
      // the findUnique check above and race on the create; the loser just reads
      // back the winner's row rather than erroring.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.decision.findUniqueOrThrow({
          where: { groupId_decisionDate: { groupId, decisionDate } },
          include: { restaurant: true },
        });
        return toResult(winner);
      }
      throw err;
    }
  }

  async history(groupId: string, userId: string): Promise<DecisionResult[]> {
    await this.requireMembership(groupId, userId);

    const decisions = await this.prisma.decision.findMany({
      where: { groupId },
      include: { restaurant: true },
      orderBy: { decisionDate: 'desc' },
    });

    return decisions.map(toResult);
  }
}
