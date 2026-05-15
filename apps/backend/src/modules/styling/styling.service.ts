import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateStylingDto } from './dto/update-styling.dto';

@Injectable()
export class StylingService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive() {
    const profile = await this.prisma.stylingProfile.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!profile) {
      // Return sensible defaults if nothing configured
      return {
        id: null,
        isActive: true,
        logoKey: null,
        altLogoKey: null,
        faviconKey: null,
        tokens: {},
        darkTokens: {},
        updatedAt: null,
      };
    }

    return {
      id: profile.id,
      isActive: profile.isActive,
      logoKey: profile.logoKey,
      altLogoKey: profile.altLogoKey,
      faviconKey: profile.faviconKey,
      tokens: profile.tokens,
      darkTokens: profile.darkTokens,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async update(dto: UpdateStylingDto, actorId: string) {
    // Get or create the active profile
    let profile = await this.prisma.stylingProfile.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!profile) {
      profile = await this.prisma.stylingProfile.create({
        data: {
          isActive: true,
          tokens: {},
          darkTokens: {},
          updatedById: actorId,
        },
      });
    }

    const updated = await this.prisma.stylingProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.logoKey !== undefined && { logoKey: dto.logoKey }),
        ...(dto.altLogoKey !== undefined && { altLogoKey: dto.altLogoKey }),
        ...(dto.faviconKey !== undefined && { faviconKey: dto.faviconKey }),
        ...(dto.tokens !== undefined && { tokens: dto.tokens }),
        ...(dto.darkTokens !== undefined && { darkTokens: dto.darkTokens }),
        updatedById: actorId,
      },
    });

    return {
      id: updated.id,
      isActive: updated.isActive,
      logoKey: updated.logoKey,
      altLogoKey: updated.altLogoKey,
      faviconKey: updated.faviconKey,
      tokens: updated.tokens,
      darkTokens: updated.darkTokens,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
