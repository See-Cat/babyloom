import { Test, TestingModule } from '@nestjs/testing';
import { EntryController } from './entry.controller';
import { EntryService } from './entry.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Entry } from '../../entities/entry.entity';
import { Repository } from 'typeorm';

describe('EntryController', () => {
  let controller: EntryController;
  let service: EntryService;

  const mockEntryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntryController],
      providers: [
        EntryService,
        {
          provide: getRepositoryToken(Entry),
          useValue: mockEntryRepository,
        },
      ],
    }).compile();

    controller = module.get<EntryController>(EntryController);
    service = module.get<EntryService>(EntryService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated entries', async () => {
      const mockEntries = [
        {
          id: '1',
          content: 'Test entry',
          babyId: 'baby-1',
          createdBy: 'user-1',
          createdAt: new Date(),
        },
      ];

      mockEntryRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockEntries, 1]),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const result = await controller.findAll();

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new entry', async () => {
      const mockEntry = {
        id: '1',
        content: 'New entry',
        babyId: 'baby-1',
        createdBy: 'user-1',
        createdAt: new Date(),
      };

      mockEntryRepository.create.mockReturnValue(mockEntry);
      mockEntryRepository.save.mockResolvedValue(mockEntry);

      const result = await controller.create(
        { content: 'New entry', babyId: 'baby-1' },
        { user: { userId: 'user-1' } },
      );

      expect(result).toHaveProperty('id');
      expect(result.content).toBe('New entry');
    });
  });

  describe('remove', () => {
    it('should soft delete an entry', async () => {
      mockEntryRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockEntryRepository.update.mockResolvedValue({ affected: 1 });

      await controller.remove('1', { user: { userId: 'user-1' } });

      expect(mockEntryRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });
});
