import {Entity} from "typeorm/decorator/entity/Entity";
import {Column, ManyToMany, PrimaryColumn} from "typeorm";
import {Group} from "./group";

@Entity("users")
export class User {
    @PrimaryColumn()
    id: number;

    @Column()
    username: string;

    @Column({name: "firstname"})
    firstName: string;

    @Column({name: "lastname"})
    lastName: string;

    @Column()
    language: string;

    @ManyToMany(type => Group, group => group.users)
    groups: Group[];

    constructor(id: number, username: string,  firstName?: string, lastName?: string, language?: string) {
        this.id = id;
        this.username = username;
        this.firstName = firstName;
        this.lastName = lastName;
        this.language = language;
    }
}