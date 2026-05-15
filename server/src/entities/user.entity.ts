import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Entry } from './entry.entity';
import { BabyUser } from './baby-user.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  nickname: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'enum', enum: ['admin', 'member'], default: 'member' })
  role: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Entry, (entry) => entry.creator)
  entries: Entry[];

  @OneToMany(() => BabyUser, (babyUser) => babyUser.user)
  babyUsers: BabyUser[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
