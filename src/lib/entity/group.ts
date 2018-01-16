import {Entity} from "typeorm/decorator/entity/Entity";
import {Column, JoinTable, JoinTableOptions, ManyToMany, OneToMany, PrimaryColumn} from "typeorm";
import {User} from "./user";

@Entity("groups")
export class Group {
    @PrimaryColumn({name: "groupid"})
    groupId: number;

    @Column()
    title: string;

    @Column()
    type: string;

    @Column({name: "allmembersadmin"})
    allMembersAreAdmin: boolean;

    @ManyToMany(type => User, user => user.groups)
    @JoinTable({
        joinColumns: [{name: "groupid", referencedColumnName: "groupId"}],
        inverseJoinColumns: [{name: "userid", referencedColumnName: "id"}]
    })
    users: User[];


    constructor(groupId: number, title: string, type: string, allMembersAreAdmin: boolean, users?: User[]) {
        this.groupId = groupId;
        this.title = title;
        this.type = type;
        this.allMembersAreAdmin = allMembersAreAdmin;
        this.users = users;
    }
}

