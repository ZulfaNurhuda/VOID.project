import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/shared/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { SecretsIndexPage } from "@/pages/secrets/SecretsIndexPage";
import { SecretsPage } from "@/pages/secrets/SecretsPage";
import { PersonalPage } from "@/pages/personal/PersonalPage";
import { TeamsPage } from "@/pages/teams/TeamsPage";
import { TeamDetailPage } from "@/pages/teams/TeamDetailPage";
import { AuditPage } from "@/pages/audit/AuditPage";
import AccountPage from "@/pages/dashboard/account/AccountPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import Verify2FAPage from "@/pages/auth/Verify2FAPage";
import AnalyticsPage from "./pages/dashboard/admin/AnalyticsPage";
import UsersPage     from "./pages/dashboard/admin/UsersPage";
import InvitesPage   from "./pages/dashboard/admin/InvitesPage";
import InstancePage  from "./pages/dashboard/admin/instance/InstancePage";
import { useAuthStore } from "@/store/auth";
import { SetupPage } from "@/pages/SetupPage";

// ── Auth check ────────────────────────────────────────────
const isAuthenticated = () => !!useAuthStore.getState().user;

// ── Root ──────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: Outlet });

// ── Setup route (only accessible when no users exist) ─────
const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: "/dashboard/secrets" });
  },
  component: SetupPage,
});

// ── Auth routes (no sidebar) ─────────────────────────────
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: "/dashboard/secrets" });
  },
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: "/dashboard/secrets" });
  },
  component: RegisterPage,
});

// ── Index: redirect to /dashboard/secrets or /login ──────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: "/dashboard/secrets" });
    throw redirect({ to: "/login" });
  },
});

// ── Dashboard parent (auth guard + layout) ────────────────
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

// /dashboard → redirect to /dashboard/secrets
const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/secrets" });
  },
});

const secretsIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/secrets",
  component: SecretsIndexPage,
});

const secretsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/apps/$appId/envs/$envId/secrets",
  component: function SecretsRoute() {
    const { appId, envId } = secretsRoute.useParams();
    return <SecretsPage appId={appId} envId={envId} />;
  },
});

const personalRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/personal",
  component: PersonalPage,
});

const teamsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/teams",
  component: TeamsPage,
});

const teamDetailRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/teams/$teamId",
  component: function TeamDetailRoute() {
    const { teamId } = teamDetailRoute.useParams();
    return <TeamDetailPage teamId={teamId} />;
  },
});

const auditRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/audit",
  component: AuditPage,
});

const accountRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/account",
  component: AccountPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/analytics",
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (user?.role !== "admin") throw redirect({ to: "/dashboard/secrets" });
  },
  component: AnalyticsPage,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/users",
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (user?.role !== "admin") throw redirect({ to: "/dashboard/secrets" });
  },
  component: UsersPage,
});

const invitesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/invites",
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (user?.role !== "admin") throw redirect({ to: "/dashboard/secrets" });
  },
  component: InvitesPage,
});

const instanceRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/instance",
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (user?.role !== "admin") throw redirect({ to: "/dashboard/secrets" });
  },
  component: InstancePage,
});

// ── Public auth pages ─────────────────────────────────────
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
});

const verify2FARoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-2fa",
  component: Verify2FAPage,
});

// ── Router ────────────────────────────────────────────────
export const routeTree = rootRoute.addChildren([
  indexRoute,
  setupRoute,
  loginRoute,
  registerRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  verify2FARoute,
  dashboardRoute.addChildren([
    dashboardIndexRoute,
    secretsIndexRoute,
    secretsRoute,
    personalRoute,
    teamsRoute,
    teamDetailRoute,
    auditRoute,
    accountRoute,
    analyticsRoute,
    adminUsersRoute,
    invitesRoute,
    instanceRoute,
  ]),
]);

export const router = createRouter({ routeTree, basepath: (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '/' });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
