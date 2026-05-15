import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../../entities/user.entity';

interface AppConfig {
  admin?: {
    username?: string;
    password?: string;
    nickname?: string;
  };
  app?: {
    name?: string;
    description?: string;
    maxUploadSize?: number;
    allowRegistration?: boolean;
    defaultLanguage?: string;
  };
  storage?: {
    uploadPath?: string;
    backupEnabled?: boolean;
    backupInterval?: string;
  };
  features?: {
    enableTrash?: boolean;
    trashRetentionDays?: number;
    enableNotifications?: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly configPath = path.join(process.cwd(), 'config', 'app.json');

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  private readConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to read config file:', error.message);
    }
    return {};
  }

  getAppConfig(): AppConfig {
    return this.readConfig();
  }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { username },
      withDeleted: false,
    });
    if (user && user.isActive && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nickname: user.nickname,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  async initAdmin() {
    const config = this.readConfig();
    const adminConfig = config.admin || {};
    
    const adminExists = await this.userRepository.findOne({
      where: { role: 'admin' },
      withDeleted: true,
    });

    if (!adminExists) {
      const username = adminConfig.username || 'admin';
      const password = adminConfig.password || 'admin123';
      const nickname = adminConfig.nickname || '管理员';
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = this.userRepository.create({
        username,
        nickname,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      });
      await this.userRepository.save(admin);
      console.log(`Admin user created: ${username} / ${password}`);
    }
  }

  async syncAdminFromConfig() {
    const config = this.readConfig();
    const adminConfig = config.admin || {};
    
    if (!adminConfig.username || !adminConfig.password) {
      return;
    }

    const admin = await this.userRepository.findOne({
      where: { role: 'admin' },
      withDeleted: true,
    });

    if (admin) {
      const updates: Partial<User> = {};
      
      if (adminConfig.username && adminConfig.username !== admin.username) {
        updates.username = adminConfig.username;
      }
      if (adminConfig.nickname && adminConfig.nickname !== admin.nickname) {
        updates.nickname = adminConfig.nickname;
      }
      if (adminConfig.password) {
        const isSamePassword = await bcrypt.compare(adminConfig.password, admin.password);
        if (!isSamePassword) {
          updates.password = await bcrypt.hash(adminConfig.password, 10);
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.userRepository.update(admin.id, updates);
        console.log('Admin user updated from config file');
      }
    }
  }
}
