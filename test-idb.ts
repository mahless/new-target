export function createStore(dbName: string, storeName: string) {
  const request = indexedDB.open(dbName);
  // ...
}
