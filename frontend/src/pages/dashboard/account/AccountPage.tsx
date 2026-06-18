import { AlertTriangle, Code2, Shield, User } from "lucide-react";
import { useState } from "react";
import DangerZoneTab from "./DangerZoneTab";
import DeveloperTab from "./DeveloperTab";
import ProfileTab from "./ProfileTab";
import SecurityTab from "./SecurityTab";

const tabs = [
  { id: "profile",   label: "Profile",     icon: User },
  { id: "security",  label: "Security",    icon: Shield },
  { id: "developer", label: "Developer",   icon: Code2 },
  { id: "danger",    label: "Danger Zone", icon: AlertTriangle },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-void-text">Account</h1>
          <p className="text-void-muted mt-1">Manage your profile, security and developer settings</p>
        </div>
      </div>

      {/* Tab bar */}
      <div role="tablist" className="flex gap-1 border-b border-void-border mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-void-accent text-void-accent"
                : "border-transparent text-void-muted hover:text-void-text"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-2xl">
        <div role="tabpanel" id="tabpanel-profile"   aria-labelledby="tab-profile"   hidden={activeTab !== "profile"}>   <ProfileTab /></div>
        <div role="tabpanel" id="tabpanel-security"  aria-labelledby="tab-security"  hidden={activeTab !== "security"}>  <SecurityTab /></div>
        <div role="tabpanel" id="tabpanel-developer" aria-labelledby="tab-developer" hidden={activeTab !== "developer"}> <DeveloperTab /></div>
        <div role="tabpanel" id="tabpanel-danger"    aria-labelledby="tab-danger"    hidden={activeTab !== "danger"}>    <DangerZoneTab /></div>
      </div>
    </div>
  );
}
