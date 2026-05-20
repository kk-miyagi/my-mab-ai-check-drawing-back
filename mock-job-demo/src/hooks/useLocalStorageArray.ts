export function useLocalStorageArray<T>(key: string) {
  const getItems = (): T[] => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T[]) : [];
    } catch {
      return [];
    }
  };

  const setItems = (items: T[]) => {
    localStorage.setItem(key, JSON.stringify(items));
  };

  // 追加
  const addItem = (item: T) => {
    const items = getItems();
    setItems([...items, item]);
  };

  // 削除
  const removeItem = (predicate: (item: T) => boolean) => {
    const items = getItems();
    const filtered = items.filter(item => !predicate(item));
    setItems(filtered);
  };

  // 更新
  const updateItem = (
    predicate: (item: T) => boolean,
    newItem: T
  ) => {
    const items = getItems();
    const updated = items.map(item =>
      predicate(item) ? newItem : item
    );
    setItems(updated);
  };

  // クリア
  const clear = () => {
    localStorage.removeItem(key);
  };

  return {
    getItems,
    addItem,
    removeItem,
    updateItem,
    clear,
  };
}
