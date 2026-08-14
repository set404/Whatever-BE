import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RestaurantListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  websiteUrl: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface CreateRestaurantInput {
  name: string;
  imageUrl?: string;
  websiteUrl?: string;
}

export interface UpdateRestaurantInput {
  name?: string;
  // undefined = leave unchanged, null = clear it, string = set it.
  imageUrl?: string | null;
  websiteUrl?: string | null;
}

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this group');
    }
    return membership;
  }

  async listForGroup(groupId: string, userId: string): Promise<RestaurantListItem[]> {
    await this.requireMembership(groupId, userId);

    const restaurants = await this.prisma.restaurant.findMany({
      where: { groupId, active: true },
      orderBy: { createdAt: 'asc' },
    });

    return restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      websiteUrl: r.websiteUrl,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  }

  async create(
    groupId: string,
    userId: string,
    input: CreateRestaurantInput,
  ): Promise<RestaurantListItem> {
    await this.requireMembership(groupId, userId);

    const restaurant = await this.prisma.restaurant.create({
      data: {
        groupId,
        name: input.name,
        imageUrl: input.imageUrl,
        websiteUrl: input.websiteUrl,
        createdBy: userId,
      },
    });

    return {
      id: restaurant.id,
      name: restaurant.name,
      imageUrl: restaurant.imageUrl,
      websiteUrl: restaurant.websiteUrl,
      createdBy: restaurant.createdBy,
      createdAt: restaurant.createdAt,
    };
  }

  // Shared by update/remove: loads the restaurant and checks that the caller is
  // either the one who added it, or a group owner/admin.
  private async requireEditableRestaurant(groupId: string, userId: string, restaurantId: string) {
    const membership = await this.requireMembership(groupId, userId);

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant || restaurant.groupId !== groupId || !restaurant.active) {
      throw new NotFoundException('No restaurant with that id in this group');
    }

    const canManageGroup = membership.role === 'owner' || membership.role === 'admin';
    if (restaurant.createdBy !== userId && !canManageGroup) {
      throw new ForbiddenException(
        'Only the person who added this, or a group owner/admin, can change it',
      );
    }

    return restaurant;
  }

  async update(
    groupId: string,
    userId: string,
    restaurantId: string,
    input: UpdateRestaurantInput,
  ): Promise<RestaurantListItem> {
    await this.requireEditableRestaurant(groupId, userId, restaurantId);

    const restaurant = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name: input.name,
        imageUrl: input.imageUrl,
        websiteUrl: input.websiteUrl,
      },
    });

    return {
      id: restaurant.id,
      name: restaurant.name,
      imageUrl: restaurant.imageUrl,
      websiteUrl: restaurant.websiteUrl,
      createdBy: restaurant.createdBy,
      createdAt: restaurant.createdAt,
    };
  }

  // Soft-delete only — restaurants.active is designed to never be hard-deleted
  // (see BE/README.md), since past decisions reference them by id.
  async remove(groupId: string, userId: string, restaurantId: string): Promise<void> {
    await this.requireEditableRestaurant(groupId, userId, restaurantId);

    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { active: false },
    });
  }
}
