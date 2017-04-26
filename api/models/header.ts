import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from "./user";
import { Record } from "./record";

@Entity()
export class Header {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    key: string;

    @Column()
    value: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'int' })
    sort: number;

    @ManyToOne(type => User, user => user.id)
    record: Record;
}