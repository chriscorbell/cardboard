import { NavLink, Navigate, Route, Routes } from "react-router";
import { cx } from "../../components/ui";
import { UsersTab } from "./UsersTab";
import { BoardsTab } from "./BoardsTab";
import { AgentTab } from "./AgentTab";
import { SessionsTab } from "./SessionsTab";

const TABS = [
  { to: "users", label: "Users" },
  { to: "boards", label: "Boards" },
  { to: "agent", label: "Agent" },
  { to: "sessions", label: "Sessions" },
];

export function AdminPage() {
  return (
    <div className="flex h-full min-h-0">
      <nav className="w-52 shrink-0 border-r border-line p-3">
        <p className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Admin</p>
        <ul className="flex flex-col gap-0.5">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} className={({ isActive }) => cx("block rounded-control px-2.5 py-1.5 text-[13.5px] transition-colors", isActive ? "bg-raised font-medium text-ink" : "text-ink-muted hover:bg-raised/60 hover:text-ink")}>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-7">
          <Routes>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<UsersTab />} />
            <Route path="boards" element={<BoardsTab />} />
            <Route path="agent" element={<AgentTab />} />
            <Route path="sessions" element={<SessionsTab />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export function TabHeader({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}
