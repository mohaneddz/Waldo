import { getStoreValue, setStoreValue } from '@/utils/store';
import { onMount, createSignal } from 'solid-js';

export default function useSettings() {

	const [autoStart, setAutoStart] = createSignal(false);
    const [timeout, setTimeout] = createSignal(30);
    const [saveLocation, setSaveLocation] = createSignal('Downloads');

	onMount(async () => {
		const autoStart = await getStoreValue('autostart');
		typeof autoStart === 'boolean' && setAutoStart(autoStart);

        const timeoutValue = await getStoreValue<number>('timeout');
        typeof timeoutValue === 'number' && setTimeout(timeoutValue);

        const location = await getStoreValue<string>('saveLocation');
        typeof location === 'string' && setSaveLocation(location);
	});

	function handleGoBack() {
		window.history.back();
	}

	async function saveSettings() {

        await setStoreValue('autostart', autoStart());
        await setStoreValue('timeout', timeout());
        await setStoreValue('saveLocation', saveLocation());

		console.log('Settings saved');
	}

	return { handleGoBack, saveSettings , autoStart, setAutoStart, timeout, setTimeout, saveLocation, setSaveLocation };
}
