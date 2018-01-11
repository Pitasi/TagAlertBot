import {Entity} from "typeorm/decorator/entity/Entity";
import {Column, PrimaryColumn} from "typeorm";

@Entity()
export class User {
    @PrimaryColumn()
    id: number;

    @Column()
    username: string;
}