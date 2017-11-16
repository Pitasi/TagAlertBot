interface IBot {
    start(): void;
}

interface IDatabaseService {
    applyAllMigrations(): void;
}
