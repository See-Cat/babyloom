import { Test, TestingModule } from '@nestjs/testing';
import { BabyUserService } from './baby-user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BabyUser } from '../../entities/baby-user.entity';
import { Repository } from 'typeorm';

describe('BabyUserService', () => {
  let service: BabyUserService;
  let repository: Repository<BabyUser>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BabyUserService,
        {
          provide: getRepositoryToken(BabyUser),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BabyUserService>(BabyUserService);
    repository = module.get<Repository<BabyUser>>(getRepositoryToken(BabyUser));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return filtered relations', async () => {
      const mockRelations = [
        {
          id: '1',
          babyId: 'baby-1',
          userId: 'user-1',
          relation: 'mom',
        },
      ];

      mockRepository.find.mockResolvedValue(mockRelations);

      const result = await service.findAll({ babyId: 'baby-1' });

      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { babyId: 'baby-1' },
        relations: ['baby', 'user'],
      });
    });

    it('should return all relations when no filter', async () => {
      const mockRelations = [
        { id: '1', babyId: 'baby-1', userId: 'user-1' },
        { id: '2', babyId: 'baby-2', userId: 'user-2' },
      ];

      mockRepository.find.mockResolvedValue(mockRelations);

      const result = await service.findAll({});

      expect(result).toHaveLength(2);
    });
  });

  describe('findByBabyAndUser', () => {
    it('should return relation by baby and user', async () => {
      const mockRelation = {
        id: '1',
        babyId: 'baby-1',
        userId: 'user-1',
        canCreate: true,
        canDelete: false,
      };

      mockRepository.findOne.mockResolvedValue(mockRelation);

      const result = await service.findByBabyAndUser('baby-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.canCreate).toBe(true);
    });
  });

  describe('create', () => {
    it('should create baby-user relation', async () => {
      const mockRelation = {
        id: '1',
        babyId: 'baby-1',
        userId: 'user-1',
        relation: 'dad',
        canCreate: true,
        canDelete: true,
        canEdit: true,
      };

      mockRepository.create.mockReturnValue(mockRelation);
      mockRepository.save.mockResolvedValue(mockRelation);

      const result = await service.create({
        babyId: 'baby-1',
        userId: 'user-1',
        relation: 'dad',
        canCreate: true,
        canDelete: true,
        canEdit: true,
      });

      expect(result).toHaveProperty('id');
      expect(result.relation).toBe('dad');
    });
  });
});
