import Optional from "typescript-optional";

interface IBot {
    start(): void;
}

interface IDatabaseService {
    applyAllMigrations(): void;
}

interface IUserRepository {
    /**
     * Find all the users in database
     * @returns {User[]} a list of all the entries
     */
    findAll(): Promise<User[]>;

    /**
     * Find one user by his Id or username
     * @param {number | string} id the id of the user
     * @returns {Promise<Optional<User>>} an Optional containing the matching user, or an empty Optional if no entries can be found
     */
    findOne(id: number | string): Promise<Optional<User>>;

    /**
     * Save a new user in the database or update if already existent
     * @param {User} user the user to save
     * @returns {User} the saved user (for immutability, the returned user is a new instance of {User}
     */
    save(user: User): Promise<User>;

    /**
     * Delete a user from the database
     * @param {User | number} user the user to delete, or his id
     * @returns {boolean} true if the operation was successful, false otherwise
     */
    deleteEntry(user: User | number): Promise<boolean>;
}

interface IModelMapper {

    mapUser(row: any): Promise<User>;
    mapUsers(rows: any[]): Promise<User[]>;
}

interface IConnectionParameters {
    host: string;
    user: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
}

export {IBot, IDatabaseService, IUserRepository, IConnectionParameters, IModelMapper};
