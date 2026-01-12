import { VSCodeAzureSubscriptionProvider, AzureSubscription } from '@microsoft/vscode-azext-azureauth';

/**
 * Service for handling Azure authentication via VS Code's built-in Microsoft auth.
 */
export class AuthService {
  private provider: VSCodeAzureSubscriptionProvider;

  constructor() {
    this.provider = new VSCodeAzureSubscriptionProvider();
  }

  /**
   * Ensure the user is signed in to Azure.
   * Prompts for sign-in if not already signed in.
   *
   * @returns true if signed in, false if sign-in was cancelled
   */
  async ensureSignedIn(): Promise<boolean> {
    const isSignedIn = await this.provider.isSignedIn();
    if (isSignedIn) {
      return true;
    }
    return this.provider.signIn();
  }

  /**
   * Get list of Azure subscriptions the user has access to.
   */
  async getSubscriptions(): Promise<AzureSubscription[]> {
    return this.provider.getSubscriptions(false);
  }

  /**
   * Get the underlying subscription provider for disposal.
   */
  getProvider(): VSCodeAzureSubscriptionProvider {
    return this.provider;
  }
}
