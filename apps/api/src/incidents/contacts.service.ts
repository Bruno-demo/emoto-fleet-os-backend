import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmergencyContact, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FleetEmergencyContact } from './incidents.types';

@Injectable()
export class ContactsService {
  constructor(private readonly prismaService: PrismaService) {}

  // Returns emergency contacts for the caller fleet with optional role filtering.
  async listContactsForUser(
    user: AuthenticatedUser,
    query: ListContactsDto,
  ): Promise<PaginatedResponse<FleetEmergencyContact>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.EmergencyContactWhereInput = {
      fleetId: user.fleetId,
    };

    if (query.role) {
      where.role = query.role;
    }

    const [contacts, total] = await Promise.all([
      this.prismaService.emergencyContact.findMany({
        where,
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.emergencyContact.count({ where }),
    ]);

    return createPaginatedResponse(
      contacts.map((contact) => this.toFleetEmergencyContact(contact)),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Creates a new emergency contact under the caller fleet scope.
  async createContactForUser(
    user: AuthenticatedUser,
    dto: CreateContactDto,
  ): Promise<FleetEmergencyContact> {
    const createdContact = await this.prismaService.emergencyContact.create({
      data: {
        fleetId: user.fleetId,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        active: dto.active ?? true,
      },
    });

    return this.toFleetEmergencyContact(createdContact);
  }

  // Fetches one contact record while enforcing fleet-level access isolation.
  async getContactForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<FleetEmergencyContact> {
    const contact = await this.loadContactOrThrow(id);
    this.assertFleetAccess(contact.fleetId, user);
    return this.toFleetEmergencyContact(contact);
  }

  // Updates a fleet-scoped emergency contact record.
  async updateContactForUser(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateContactDto,
  ): Promise<FleetEmergencyContact> {
    const contact = await this.loadContactOrThrow(id);
    this.assertFleetAccess(contact.fleetId, user);

    const updatedContact = await this.prismaService.emergencyContact.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        active: dto.active,
      },
    });

    return this.toFleetEmergencyContact(updatedContact);
  }

  // Deletes a fleet contact and returns a confirmation payload.
  async deleteContactForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    const contact = await this.loadContactOrThrow(id);
    this.assertFleetAccess(contact.fleetId, user);
    await this.prismaService.emergencyContact.delete({ where: { id } });
    return { deleted: true, id };
  }

  // Loads one contact by id or raises a 404 error.
  private async loadContactOrThrow(id: string): Promise<EmergencyContact> {
    const contact = await this.prismaService.emergencyContact.findUnique({
      where: { id },
    });
    if (!contact) {
      throw new NotFoundException('Emergency contact not found');
    }

    return contact;
  }

  // Enforces caller fleet ownership for contact operations.
  private assertFleetAccess(fleetId: string, user: AuthenticatedUser): void {
    if (fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Maps persistence entity into API-safe emergency contact payload.
  private toFleetEmergencyContact(
    contact: EmergencyContact,
  ): FleetEmergencyContact {
    return {
      id: contact.id,
      fleetId: contact.fleetId,
      name: contact.name,
      phone: contact.phone,
      role: contact.role,
      active: contact.active,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}
