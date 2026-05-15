import { Test, TestingModule } from '@nestjs/testing';
import { EntryService } from './entry.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Entry } from '../../entities/entry.entity';
import { Repository } from 'typeorm';

describe('EntryService', () => {
  let service: EntryService;
  let repository: Repository<Entry>;

  const mockRepository = {
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
      providers: [
        EntryService,
        {
          provide: getRepositoryToken(Entry),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<EntryService>(EntryService);
    repository = module.get<Repository<Entry>>(getRepositoryToken(Entry));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated entries with default params', async () => {
      const mockEntries = [
        {
          id: '1',
          content: 'Test',
          babyId: 'baby-1',
          createdBy: 'user-1',
          createdAt: new Date(),
        },
      ];

      mockRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockEntries, 1]),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by babyId', async () => {
      mockRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await service.findAll({ babyId: 'baby-1' });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create entry with milestoneIds', async () => {
      const mockEntry = {
        id: '1',
        content: 'Test entry',
        babyId: 'baby-1',
        milestones: [{ id: 'ms-1' }],
      };

      mockRepository.create.mockReturnValue(mockEntry);
      mockRepository.save.mockResolvedValue(mockEntry);

      const result = await service.create({
        content: 'Test entry',
        babyId: 'baby-1',
        milestoneIds: ['ms-1'],
      });

      expect(result).toHaveProperty('id');
      expect(result.milestones).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should soft delete and set deletedBy', async () => {
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.remove('1', 'user-1');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        deletedBy: 'user-1',
      });
    });
  });

  describe('restore', () => {
    it('should restore soft deleted entry', async () => {
      const mockEntry = {
        id: '1',
        content: 'Test',
        deletedAt: null,
      };

      mockRepository.restore.mockResolvedValue({ affected: 1 });
      mockRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockEntry], 1]),
        getOne: jest.fn().mockResolvedValue(mockEntry),
      });

      const result = await service.restore('1');

      expect(result).toBeDefined();
      expect(mockRepository.restore).toHaveBeenCalledWith('1');
    });
  });
});
