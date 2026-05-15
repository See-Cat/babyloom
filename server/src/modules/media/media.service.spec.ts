import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Media } from '../../entities/media.entity';
import { Repository } from 'typeorm';

describe('MediaService', () => {
  let service: MediaService;
  let repository: Repository<Media>;

  const mockRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: getRepositoryToken(Media),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    repository = module.get<Repository<Media>>(getRepositoryToken(Media));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return media with filters', async () => {
      const mockMedia = [
        {
          id: '1',
          type: 'photo',
          url: '/uploads/test.jpg',
          babyId: 'baby-1',
        },
      ];

      mockRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMedia),
      });

      const result = await service.findAll({ babyId: 'baby-1' });

      expect(result).toHaveLength(1);
    });

    it('should exclude deleted media by default', async () => {
      mockRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.findAll({});

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create media entry', async () => {
      const mockMedia = {
        id: '1',
        type: 'photo',
        url: '/uploads/test.jpg',
        babyId: 'baby-1',
      };

      mockRepository.create.mockReturnValue(mockMedia);
      mockRepository.save.mockResolvedValue(mockMedia);

      const result = await service.create({
        type: 'photo',
        url: '/uploads/test.jpg',
        babyId: 'baby-1',
      });

      expect(result).toHaveProperty('id');
      expect(result.type).toBe('photo');
    });
  });

  describe('remove', () => {
    it('should soft delete media', async () => {
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('1');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });

  describe('restore', () => {
    it('should restore soft deleted media', async () => {
      const mockMedia = { id: '1', type: 'photo' };

      mockRepository.restore.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(mockMedia);

      const result = await service.restore('1');

      expect(result).toBeDefined();
      expect(mockRepository.restore).toHaveBeenCalledWith('1');
    });
  });
});
