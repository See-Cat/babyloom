import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Media } from '../../entities/media.entity';

describe('MediaController', () => {
  let controller: MediaController;

  const mockMediaRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        MediaService,
        {
          provide: getRepositoryToken(Media),
          useValue: mockMediaRepository,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return media list', async () => {
      const mockMedia = [
        {
          id: '1',
          type: 'photo',
          url: '/uploads/test.jpg',
          babyId: 'baby-1',
        },
      ];

      mockMediaRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMedia),
      });

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
    });
  });
});
