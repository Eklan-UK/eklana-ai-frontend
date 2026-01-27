/**
 * Base repository interface
 * Defines common data access operations
 */
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findByIdOrThrow(id: ID): Promise<T>;
  findMany(filter?: any): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
  count(filter?: any): Promise<number>;
}

