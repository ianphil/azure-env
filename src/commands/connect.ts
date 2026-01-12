import type { QuickPickItem } from 'vscode';
import type { AuthService } from '../services/authService';
import type { AzureEnvSettings } from '../models/settings';

export interface StoreInfo {
  name: string;
  endpoint: string;
}

export interface KeyInfo {
  key: string;
}

export interface ConnectFlowDeps {
  authService: AuthService;
  showQuickPick: <T extends QuickPickItem>(
    items: T[],
    options?: { placeHolder?: string; canPickMany?: boolean }
  ) => Promise<T | T[] | undefined>;
  saveSettings: (settings: Partial<AzureEnvSettings>) => Promise<void>;
  listStores: (subscriptionId: string, credential: unknown) => Promise<StoreInfo[]>;
  listKeys: (endpoint: string, credential: unknown) => Promise<KeyInfo[]>;
}

export type ConnectResult =
  | { success: true; endpoint: string; storeName: string }
  | { success: false; reason: string };

/**
 * Run the connect flow: authenticate, select subscription, store, and keys.
 * Returns success with endpoint or failure with reason.
 */
export async function runConnectFlow(deps: ConnectFlowDeps): Promise<ConnectResult> {
  const { authService, showQuickPick, saveSettings, listStores, listKeys } = deps;

  // Step 1: Ensure signed in
  const isSignedIn = await authService.ensureSignedIn();
  if (!isSignedIn) {
    return { success: false, reason: 'auth_failed' };
  }

  // Step 2: Get and select subscription
  const subscriptions = await authService.getSubscriptions();
  if (subscriptions.length === 0) {
    return { success: false, reason: 'no_subscriptions' };
  }

  const subItems = subscriptions.map((sub) => ({
    label: sub.name,
    description: sub.subscriptionId,
    subscription: sub,
  }));

  const selectedSub = await showQuickPick(subItems, {
    placeHolder: 'Select Azure subscription',
  });

  if (!selectedSub || Array.isArray(selectedSub)) {
    return { success: false, reason: 'cancelled' };
  }

  // Step 3: List and select App Configuration store
  const stores = await listStores(
    selectedSub.subscription.subscriptionId,
    selectedSub.subscription.credential
  );

  if (stores.length === 0) {
    return { success: false, reason: 'no_stores' };
  }

  const storeItems = stores.map((s) => ({
    label: s.name,
    description: s.endpoint,
    endpoint: s.endpoint,
    name: s.name,
  }));

  const selectedStore = await showQuickPick(storeItems, {
    placeHolder: 'Select App Configuration store',
  });

  if (!selectedStore || Array.isArray(selectedStore)) {
    return { success: false, reason: 'cancelled' };
  }

  // Step 4: List and select keys
  const keys = await listKeys(selectedStore.endpoint, selectedSub.subscription.credential);

  if (keys.length === 0) {
    return { success: false, reason: 'no_keys' };
  }

  const keyItems = keys.map((k) => ({
    label: k.key,
    key: k.key,
  }));

  const selectedKeys = await showQuickPick(keyItems, {
    placeHolder: 'Select configuration keys',
    canPickMany: true,
  });

  if (!selectedKeys || !Array.isArray(selectedKeys) || selectedKeys.length === 0) {
    if (selectedKeys === undefined) {
      return { success: false, reason: 'cancelled' };
    }
    return { success: false, reason: 'no_keys_selected' };
  }

  // Step 5: Save settings
  await saveSettings({
    endpoint: selectedStore.endpoint,
    selectedKeys: selectedKeys.map((k) => k.key),
  });

  return {
    success: true,
    endpoint: selectedStore.endpoint,
    storeName: selectedStore.name,
  };
}
