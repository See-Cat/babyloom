import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Entry } from './entry.entity';
import { BabyUser } from './baby-user.entity';

@Entity('babies')
export class Baby {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'enum', enum: ['boy', 'girl'], nullable: true })
  gender: string;

  @Column({ default: '/uploads' })
  storagePath: string;

  @OneToMany(() => Entry, (entry) => entry.baby)
  entries: Entry[];

  @OneToMany(() => BabyUser, (babyUser) => babyUser.baby)
  babyUsers: BabyUser[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
