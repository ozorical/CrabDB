# **CrabDB: Minecraft Scoreboard Database**

A simple and efficient way to store and manage data in Minecraft using **scoreboards**. Perfect for saving player stats, game states, or configs.

## **Features**
- **Persistent Storage**: Data saves even after server restarts.
- **Encryption**: Data is encrypted (Caesar Cipher) before storage.
- **Easy API**: Methods like `set`, `get`, `delete`, and `clear`.
- **Memory Caching**: Fast access with automatic saving.

## **How It Works**
1. Data is stored in a scoreboard as encrypted JSON chunks.
2. On startup, data is loaded into memory for quick access.
3. Changes are automatically saved back to the scoreboard.

## **Example Use Cases**
- **Player Stats**: Save levels, coins, etc.
  ```typescript
  await TABLES.playerStats.set("player1", { level: 5, coins: 100 });
  ```
- **Game State**: Track minigame progress.
- **Configs**: Store server settings.

## **Quick API**
- **`set(key, value)`**: Save data.
- **`get(key)`**: Retrieve data.
- **`delete(key)`**: Remove data.
- **`clear()`**: Wipe all data.
- **`has(key)`**: Check if key exists.
- **`keys()` / `values()`**: Get all keys or values.

## **Example**
```typescript
const db = TABLES.playerData;
await db.set("player1", { level: 5, coins: 100 });
const data = await db.get("player1"); // { level: 5, coins: 100 }
await db.delete("player1");
```

## **Why Use This?**
- **Simple**: Easy-to-use API.
- **Secure**: Data is encrypted.

**Limitations**:
- Scoreboards have character limits.
- Encryption is basic (Caesar Cipher).
