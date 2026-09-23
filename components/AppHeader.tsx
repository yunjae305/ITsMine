import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { loadNotifications } from "@/lib/groups";
import { HeaderActions } from "./HeaderActions";

export async function AppHeader({ user, chip }: { user: CurrentUser | null; chip?: string }) {
  const notifications = user ? await loadNotifications(user.id) : [];
  return (
    <nav className="top-nav">
      <Link className="brand" href="/">
        <span className="brand-mark">몫</span>몫대로
      </Link>
      <div className="nav-actions">
        {chip ? <span className="nav-chip">{chip}</span> : null}
        {user ? <HeaderActions user={user} notifications={notifications} /> : null}
      </div>
    </nav>
  );
}
