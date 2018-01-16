import {Entity} from "typeorm/decorator/entity/Entity";
import {Column, PrimaryColumn} from "typeorm";

@Entity("groups")
export class Group {
    @PrimaryColumn({name: "groupid"})
    groupId: number;
    @Column({name: "userid"})
    userId: number;
}