import { load, Store } from '@tauri-apps/plugin-store';

let store: Store;
let storePromise: Promise<Store> | null = null;

export const initStore = async (filename = 'store.json') => {
	if (store) {
		return store;
	}

	if (!storePromise) {
		storePromise = load(filename, { autoSave: true }).then((loadedStore) => {
			store = loadedStore;
			return loadedStore;
		});
	}

	return await storePromise;
};

export const setStoreValue = async <T>(key: string, value: T): Promise<void> => {
	await initStore();
	await store.set(key, value);
};

export const getStoreValue = async <T>(key: string): Promise<T | null> => {
	await initStore();
	const value = await store.get<T>(key);
	return value ?? null;
};

export const deleteStoreKey = async (key: string): Promise<void> => {
	await initStore();
	await store.delete(key);
};

export const clearStore = async (): Promise<void> => {
	await initStore();
	await store.clear();
};

export const saveStore = async (): Promise<void> => {
	await initStore();
	await store.save();
};

export const entries = async (): Promise<[string, any][]> => {
	await initStore();
	return await store.entries();
};

export const keys = async (): Promise<string[]> => {
	await initStore();
	return await store.keys();
};

export const values = async (): Promise<any[]> => {
	await initStore();
	return await store.values();
};
