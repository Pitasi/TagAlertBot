import {Entity} from "typeorm/decorator/entity/Entity";
import {Column, PrimaryColumn} from "typeorm";

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

    constructor(id: number, username: string,  firstName?: string, lastName?: string, language?: string) {
        this.id = id;
        this.username = username;
        this.firstName = firstName;
        this.lastName = lastName;
        this.language = language;
    }
}