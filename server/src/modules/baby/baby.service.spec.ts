import { Test, TestingModule } from '@nestjs/testing';
import { BabyService } from './baby.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Baby } from '../../entities/baby.entity';
import { Repository } from 'typeorm';

describe('BabyService', () => {
  let service: BabyService;
  let repository: Repository<Baby>;

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
        BabyService,
        {
          provide: getRepositoryToken(Baby),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BabyService>(BabyService);
    repository = module.get<Repository<Baby>>(getRepositoryToken(Baby));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all babies with relations', async () => {
      const mockBabies = [
        {
          id: '1',
          name: '宝宝1',
          entries: [],
          babyUsers: [],
        },
      ];

      mockRepository.find.mockResolvedValue(mockBabies);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['entries', 'babyUsers', 'babyUsers.user'],
      });
    });
  });

  describe('findOne', () => {
    it('should return baby by id', async () => {
      const mockBaby = {
        id: '1',
        name: '宝宝1',
        entries: [],
        babyUsers: [],
      };

      mockRepository.findOne.mockResolvedValue(mockBaby);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.name).toBe('宝宝1');
    });

    it('should throw NotFoundException when baby not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow('Baby not found');
    });
  });

  describe('create', () => {
    it('should create a new baby', async () => {
      const mockBaby = {
        id: '1',
        name: '宝宝2',
        birthDate: new Date('2024-01-01'),
      };

      mockRepository.create.mockReturnValue(mockBaby);
      mockRepository.save.mockResolvedValue(mockBaby);

      const result = await service.create({
        name: '宝宝2',
        birthDate: new Date('2024-01-01'),
      });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('宝宝2');
    });
  });
});
