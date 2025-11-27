export interface Repository<T, ID = string> {

    findById(id: ID): Promise<T | null>;

    create(entity: T): Promise<T>;

    createMany(entities: T[]): Promise<number>;

    update(id: ID, updates: Partial<T>): Promise<T>;

    delete(id: ID): Promise<void>;

    exists(id: ID): Promise<boolean>;
}