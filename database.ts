import { world, ScoreboardObjective, ScoreboardIdentity } from '@minecraft/server';

export class Database<T extends any> {
  /**
   * Data saved in memory
   */
  private MEMORY: { [key: string]: T } | null = null;

  /**
   * List of queued tasks on this table
   */
  private QUEUE: Array<() => void> = [];

  /**
   * Callbacks to run once the database data has been fetched
   */
  private onLoadCallback: ((data: { [key: string]: T } | null) => void) | undefined;

  /**
   * The scoreboard objective used to store data
   */
  private objective: ScoreboardObjective;

  /**
   * Encryption key (shift value for Caesar Cipher)
   */
  private readonly ENCRYPTION_KEY: number = 5; // Shift by 5 positions

  /**
   * Cache for decrypted data to avoid repeated decryption
   */
  private decryptedDataCache: string | null = null;

  /**
   * Creates a new instance of the Database
   * @param tableName - The name of the table (used as the scoreboard objective name)
   */
  constructor(public tableName: string) {
    this.tableName = tableName;
    this.objective = world.scoreboard.getObjective(this.tableName) || world.scoreboard.addObjective(this.tableName, this.tableName);

    // Fetch data from the scoreboard
    const LOADED_DATA = this.fetch();
    this.MEMORY = LOADED_DATA;

    // Run onLoad callback and queued tasks
    this.onLoadCallback?.(LOADED_DATA);
    this.QUEUE.forEach((v) => v());
    this.QUEUE = []; // Clear the queue after execution
  }

  /**
   * Encrypts a string using Caesar Cipher
   * @param str - The string to encrypt
   * @returns The encrypted string
   */
  private encrypt(str: string): string {
    return str
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(code + this.ENCRYPTION_KEY);
      })
      .join('');
  }

  /**
   * Decrypts a string using Caesar Cipher
   * @param str - The string to decrypt
   * @returns The decrypted string
   */
  private decrypt(str: string): string {
    return str
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(code - this.ENCRYPTION_KEY);
      })
      .join('');
  }

  /**
   * Fetches data from the scoreboard
   * @returns The parsed data from the scoreboard
   */
  private fetch(): { [key: string]: T } {
    const participants = this.objective.getParticipants();
    if (participants.length === 0) return {};

    let collectedData = '';
    participants.forEach((participant) => {
      const score = this.objective.getScore(participant);
      if (score !== undefined) {
        collectedData += participant.displayName;
      }
    });

    try {
      // Decrypt the collected data before parsing
      if (this.decryptedDataCache !== collectedData) {
        this.decryptedDataCache = this.decrypt(collectedData);
      }
      return JSON.parse(this.decryptedDataCache);
    } catch (error) {
      console.warn(`[DATABASE]: Failed to parse data from scoreboard: ${error}`);
      return {};
    }
  }

  /**
   * Saves data to the scoreboard
   */
  private async saveData(): Promise<void> {
    if (!this.MEMORY) return;

    // Clear existing data
    const participants = this.objective.getParticipants();
    participants.forEach((participant) => {
      this.objective.removeParticipant(participant);
    });

    // Convert data to JSON, encrypt it, and split into chunks
    const stringData = JSON.stringify(this.MEMORY);
    const encryptedData = this.encrypt(stringData); // Encrypt the data
    const chunks = this.chunkString(encryptedData, 32767); // Max scoreboard character limit

    // Save each chunk as a scoreboard entry
    chunks.forEach((chunk, index) => {
      this.objective.setScore(chunk, index);
    });
  }

  /**
   * Splits a string into chunks of a specified size
   * @param str - The string to split
   * @param size - The size of each chunk
   * @returns An array of chunks
   */
  private chunkString(str: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Adds a queue task to be awaited
   * @returns A promise that resolves when the task is executed
   */
  private async addQueueTask(): Promise<void> {
    return new Promise((resolve) => {
      this.QUEUE.push(resolve);
    });
  }

  /**
   * Sends a callback once this database has initiated data
   * @param callback - The callback to run
   */
  async onLoad(callback: (data: { [key: string]: T } | null) => void) {
    if (this.MEMORY) return callback(this.MEMORY);
    this.onLoadCallback = callback;
  }

  /**
   * Sets the specified `key` to the given `value` in the database table.
   * @param key - Key to store the value in.
   * @param value - The value to store for the specified key.
   * @returns A promise that resolves once the value has been saved in the database table.
   */
  async set(key: string, value: T): Promise<void> {
    if (!this.MEMORY) throw new Error("Data tried to be set before load!");
    this.MEMORY[key] = value;
    return this.saveData();
  }

  /**
   * Gets a value from this table
   * @param key - The key to retrieve the value for.
   * @returns The value associated with the given key in the database table.
   */
  get(key: string): T | null {
    if (!this.MEMORY) throw new Error("Data not loaded! Consider using `getSync` instead!");
    return this.MEMORY[key] || null;
  }

  /**
   * Gets a value asynchronously from the database table.
   * @param key - The key to retrieve the value for.
   * @returns A Promise that resolves to the value associated with the given key in the database table.
   */
  async getSync(key: string): Promise<T | null> {
    if (this.MEMORY) return this.get(key);
    await this.addQueueTask();
    if (!this.MEMORY) return null;
    return this.MEMORY[key];
  }

  /**
   * Get all the keys in the table
   * @returns The keys on this table
   */
  keys(): string[] {
    if (!this.MEMORY) throw new Error("Data not loaded! Consider using `keysSync` instead!");
    return Object.keys(this.MEMORY);
  }

  /**
   * Get all the keys in the table async
   * @returns The keys on this table
   */
  async keysSync(): Promise<string[]> {
    if (this.MEMORY) return this.keys();
    await this.addQueueTask();
    if (!this.MEMORY) return [];
    return Object.keys(this.MEMORY);
  }

  /**
   * Get all the values in the table
   * @returns The values in this table
   */
  values(): T[] {
    if (!this.MEMORY) throw new Error("Data not loaded! Consider using `valuesSync` instead!");
    return Object.values(this.MEMORY);
  }

  /**
   * Get all the values in the table async
   * @returns The values on this table
   */
  async valuesSync(): Promise<T[]> {
    if (this.MEMORY) return this.values();
    await this.addQueueTask();
    if (!this.MEMORY) return [];
    return Object.values(this.MEMORY);
  }

  /**
   * Check if the key exists in the table
   * @param key - The key to test
   * @returns If this key exists on this table
   */
  has(key: string): boolean {
    if (!this.MEMORY) throw new Error("Data not loaded! Consider using `hasSync` instead!");
    return Boolean(this.MEMORY[key]);
  }

  /**
   * Check if the key exists in the table async
   * @param key - The key to test
   * @returns If this table contains this key
   */
  async hasSync(key: string): Promise<boolean> {
    if (this.MEMORY) return this.has(key);
    await this.addQueueTask();
    if (!this.MEMORY) return false;
    return Boolean(this.MEMORY[key]);
  }

  /**
   * Gets all the keys and values
   * @returns The collection data
   */
  collection(): { [key: string]: T } {
    if (!this.MEMORY) throw new Error("Data not loaded! Consider using `collectionSync` instead!");
    return this.MEMORY;
  }

  /**
   * Gets all the keys and values async
   * @returns The collection data
   */
  async collectionSync(): Promise<{ [key: string]: T }> {
    if (this.MEMORY) return this.collection();
    await this.addQueueTask();
    if (!this.MEMORY) return {};
    return this.MEMORY;
  }

  /**
   * Delete a key from this table
   * @param key - The key to delete
   * @returns If the deletion was successful
   */
  async delete(key: string): Promise<boolean> {
    if (!this.MEMORY) return false;
    const status = delete this.MEMORY[key];
    await this.saveData();
    return status;
  }

  /**
   * Clear everything in the table
   * @returns Once this table has been cleared
   */
  async clear(): Promise<void> {
    this.MEMORY = {};
    return await this.saveData();
  }

  /**
   * Gets a key by value
   * @param value - The value to search for
   * @returns The key associated with the value, or null if not found
   */
  getKeyByValue(value: T): string | null {
    if (!this.MEMORY) throw new Error("Data not loaded!");
    for (const key in this.MEMORY) {
      if (this.MEMORY[key] === value) {
        return key;
      }
    }
    return null; // value not found in object
  }
}

export const TABLES = {
  test: new Database<any>("test"),
  example: new Database<any>("example"),
};
