export interface NpsFormSettings {
  name: string;
  url: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface UpdateNpsFormSettingsBody {
  name: string;
  url: string;
  isActive?: boolean;
}
