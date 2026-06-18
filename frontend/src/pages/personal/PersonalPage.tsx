import { AppAccordion } from "@/components/shared/AppAccordion";
import { useAuthStore } from "@/store/auth";

export function PersonalPage() {
  const user = useAuthStore((s) => s.user);

  if (!user?.personal_workspace_id) {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-void-text text-xl font-semibold tracking-tight">
            Personal Workspace
          </h1>
        </div>
        <div className="py-16 text-center">
          <p className="text-void-muted text-sm">
            Session needs to be refreshed.
          </p>
          <p className="text-void-dim text-xs mt-1">
            Please{" "}
            <a href="/login" className="text-void-accent hover:underline">
              log out and log in again
            </a>{" "}
            to load your personal workspace.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          Personal Workspace
        </h1>
        <p className="text-void-muted text-sm mt-1">
          Apps and environments for your personal projects.
        </p>
      </div>

      <AppAccordion
        workspaceId={user.personal_workspace_id}
        workspaceType="personal"
        canManage={true}
      />
    </>
  );
}
