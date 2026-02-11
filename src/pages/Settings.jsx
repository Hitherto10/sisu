import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-safe px-6 text-center">
      <SettingsIcon className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h1 className="text-xl font-serif font-bold">Settings</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
        Customize your reading experience. Coming soon!
      </p>
    </div>
  );
}
