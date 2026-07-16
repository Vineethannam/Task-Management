"""SEMS Phase-2 backend tests: pagination, my-work, activity, analytics, roles, RBAC"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://eng-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@sems.io", "password": "Admin@123"}
DEV = {"email": "kabir@sems.io", "password": "Password@123"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s, data


@pytest.fixture(scope="module")
def admin_session():
    s, _ = _login(ADMIN)
    return s


@pytest.fixture(scope="module")
def dev_session():
    s, _ = _login(DEV)
    return s


# ---------- Auth ----------
class TestAuth:
    def test_admin_login_and_me(self):
        s, data = _login(ADMIN)
        assert "user" in data or "email" in data
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "admin@sems.io"
        assert "permissions" in u or u.get("role") == "SUPER_ADMIN"

    def test_dev_login(self):
        s, _ = _login(DEV)
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "DEVELOPER"


# ---------- Pagination ----------
PAGINATED_ENDPOINTS = [
    "/users", "/projects", "/teams", "/tasks", "/bugs",
    "/timelogs", "/notifications", "/me/tasks", "/me/projects", "/me/bugs",
]

class TestPagination:
    @pytest.mark.parametrize("path", PAGINATED_ENDPOINTS)
    def test_paginated_shape(self, admin_session, path):
        r = admin_session.get(f"{API}{path}?page=1&page_size=5")
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        for k in ("items", "total", "page", "page_size", "total_pages"):
            assert k in data, f"missing {k} in {path} response: {list(data.keys())}"
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["items"]) <= 5
        assert isinstance(data["items"], list)

    def test_users_filter(self, admin_session):
        r = admin_session.get(f"{API}/users?page=1&page_size=50&role=DEVELOPER")
        assert r.status_code == 200
        data = r.json()
        for u in data["items"]:
            assert u["role"] == "DEVELOPER"

    def test_users_search_q(self, admin_session):
        r = admin_session.get(f"{API}/users?page=1&page_size=10&q=kabir")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("kabir" in (u.get("email","")+u.get("name","")).lower() for u in items)


# ---------- All / list dropdown endpoints ----------
class TestAllEndpoints:
    @pytest.mark.parametrize("path", ["/users/all", "/teams/all", "/projects/all"])
    def test_all(self, admin_session, path):
        r = admin_session.get(f"{API}{path}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- My Work ----------
class TestMyWork:
    def test_me_tasks(self, dev_session):
        me = dev_session.get(f"{API}/auth/me").json()
        r = dev_session.get(f"{API}/me/tasks?page=1&page_size=50")
        assert r.status_code == 200
        for t in r.json()["items"]:
            assert t.get("assignee_id") == me["id"]

    def test_me_projects(self, dev_session):
        r = dev_session.get(f"{API}/me/projects?page=1&page_size=50")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_me_bugs(self, dev_session):
        me = dev_session.get(f"{API}/auth/me").json()
        r = dev_session.get(f"{API}/me/bugs?page=1&page_size=50")
        assert r.status_code == 200
        for b in r.json()["items"]:
            assert b.get("assignee_id") == me["id"]


# ---------- Task Activity ----------
@pytest.fixture(scope="module")
def task_ctx(admin_session):
    projects = admin_session.get(f"{API}/projects/all").json()
    assert projects, "no projects"
    pid = projects[0]["id"]
    users = admin_session.get(f"{API}/users/all").json()
    dev = next((u for u in users if u["role"] == "DEVELOPER"), users[0])
    payload = {
        "title": "TEST_ActivityTask",
        "project_id": pid,
        "assignee_id": dev["id"],
        "estimated_hours": 8,
        "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "status": "BACKLOG",
        "priority": "MEDIUM",
    }
    r = admin_session.post(f"{API}/tasks", json=payload)
    assert r.status_code in (200, 201), f"create task {r.status_code} {r.text}"
    tid = r.json()["id"]
    yield {"id": tid, "project_id": pid, "assignee_id": dev["id"]}
    admin_session.delete(f"{API}/tasks/{tid}")


class TestTaskActivity:
    def test_estimated_hours_stored(self, admin_session, task_ctx):
        r = admin_session.get(f"{API}/tasks/{task_ctx['id']}")
        assert r.status_code == 200
        assert r.json().get("estimated_hours") == 8

    def test_deadline_changes_and_status(self, admin_session, task_ctx):
        tid = task_ctx["id"]
        for delta in (7, 10):
            r = admin_session.put(f"{API}/tasks/{tid}", json={
                "due_date": (datetime.now(timezone.utc) + timedelta(days=delta)).isoformat()
            })
            assert r.status_code == 200, r.text
        r = admin_session.put(f"{API}/tasks/{tid}", json={"status": "IN_PROGRESS"})
        assert r.status_code == 200

        task = admin_session.get(f"{API}/tasks/{tid}").json()
        assert task.get("deadline_changes", 0) == 2, f"expected 2, got {task.get('deadline_changes')}"

        act = admin_session.get(f"{API}/tasks/{tid}/activity")
        assert act.status_code == 200
        events = act.json()
        # Might be list or paginated
        if isinstance(events, dict):
            events = events.get("items", [])
        types = [e.get("type") or e.get("event") for e in events]
        assert types.count("DEADLINE_CHANGED") >= 2, f"types={types}"
        assert "STATUS_CHANGED" in types

    def test_estimate_changed_activity(self, admin_session, task_ctx):
        tid = task_ctx["id"]
        r = admin_session.put(f"{API}/tasks/{tid}", json={"estimated_hours": 12})
        assert r.status_code == 200
        act = admin_session.get(f"{API}/tasks/{tid}/activity").json()
        if isinstance(act, dict):
            act = act.get("items", [])
        types = [e.get("type") or e.get("event") for e in act]
        assert "ESTIMATE_CHANGED" in types, f"types={types}"


# ---------- Bug Activity ----------
@pytest.fixture(scope="module")
def bug_ctx(admin_session):
    projects = admin_session.get(f"{API}/projects/all").json()
    pid = projects[0]["id"]
    users = admin_session.get(f"{API}/users/all").json()
    dev = next((u for u in users if u["role"] == "DEVELOPER"), users[0])
    dev2 = next((u for u in users if u["role"] == "DEVELOPER" and u["id"] != dev["id"]), dev)
    payload = {
        "title": "TEST_ActivityBug",
        "project_id": pid,
        "assignee_id": dev["id"],
        "severity": "HIGH",
        "priority": "HIGH",
        "status": "OPEN",
        "estimated_hours": 4,
    }
    r = admin_session.post(f"{API}/bugs", json=payload)
    assert r.status_code in (200, 201), r.text
    bid = r.json()["id"]
    yield {"id": bid, "assignee_id": dev["id"], "dev2": dev2["id"]}
    admin_session.delete(f"{API}/bugs/{bid}")


class TestBugActivity:
    def test_resolve_reopen_reassign(self, admin_session, bug_ctx):
        bid = bug_ctx["id"]
        r = admin_session.put(f"{API}/bugs/{bid}", json={"status": "RESOLVED"})
        assert r.status_code == 200
        r = admin_session.put(f"{API}/bugs/{bid}", json={"status": "REOPENED"})
        assert r.status_code == 200
        r = admin_session.put(f"{API}/bugs/{bid}", json={"assignee_id": bug_ctx["dev2"]})
        assert r.status_code == 200

        bug = admin_session.get(f"{API}/bugs/{bid}").json()
        assert bug.get("reopen_count", 0) == 1, f"reopen_count={bug.get('reopen_count')}"
        assert bug.get("resolved_at"), "resolved_at not set"

        act = admin_session.get(f"{API}/bugs/{bid}/activity").json()
        if isinstance(act, dict):
            act = act.get("items", [])
        types = [e.get("type") or e.get("event") for e in act]
        for t in ("CREATED", "RESOLVED", "REOPENED", "ASSIGNED"):
            assert t in types, f"missing {t} in {types}"

        if bug_ctx["dev2"] != bug_ctx["assignee_id"]:
            assert bug.get("reassign_count", 0) >= 1


# ---------- Roles / Permissions Matrix ----------
class TestRoles:
    def test_meta_modules(self, admin_session):
        r = admin_session.get(f"{API}/meta/modules")
        assert r.status_code == 200
        mods = r.json()
        if isinstance(mods, dict):
            mods = mods.get("modules", mods.get("items", []))
        assert isinstance(mods, list) and len(mods) >= 5
        for m in mods:
            assert "key" in m and "actions" in m

    def test_roles_list(self, admin_session):
        r = admin_session.get(f"{API}/roles")
        assert r.status_code == 200
        roles = r.json()
        if isinstance(roles, dict):
            roles = roles.get("items", roles)
        assert len(roles) >= 7

    def test_update_viewer_role(self, admin_session):
        # Test on VIEWER to be safe
        original = admin_session.get(f"{API}/roles/VIEWER").json()
        orig_perms = original.get("permissions", [])
        try:
            new_perms = ["task.read", "task.update", "bug.read"]
            r = admin_session.put(f"{API}/roles/VIEWER", json={"permissions": new_perms})
            assert r.status_code == 200, r.text
            got = admin_session.get(f"{API}/roles/VIEWER").json()
            assert set(got["permissions"]) == set(new_perms)

            # Verify auth/me for VIEWER user reflects changes
            s, _ = _login({"email": "riya@sems.io", "password": "Password@123"})
            me = s.get(f"{API}/auth/me").json()
            assert set(me.get("permissions", [])) == set(new_perms)
        finally:
            # restore
            admin_session.put(f"{API}/roles/VIEWER", json={"permissions": orig_perms})


# ---------- Analytics ----------
class TestAnalytics:
    def test_bugs_summary(self, admin_session):
        r = admin_session.get(f"{API}/analytics/bugs/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "open", "resolved", "reopened_now", "critical", "total_reopens"):
            assert k in d, f"missing {k}"

    def test_bugs_timeline(self, admin_session):
        r = admin_session.get(f"{API}/analytics/bugs/timeline?days=30")
        assert r.status_code == 200
        d = r.json()
        assert d.get("days") == 30
        assert isinstance(d.get("series"), list) and len(d["series"]) == 30
        for pt in d["series"]:
            for k in ("date", "created", "resolved"):
                assert k in pt

    @pytest.mark.parametrize("dim", ["user", "team", "project"])
    def test_bugs_top(self, admin_session, dim):
        r = admin_session.get(f"{API}/analytics/bugs/top?dimension={dim}")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            for k in ("id", "name", "count", "open", "critical"):
                assert k in arr[0], f"missing {k} in {arr[0]}"

    def test_delays(self, admin_session):
        r = admin_session.get(f"{API}/analytics/delays")
        assert r.status_code == 200
        d = r.json()
        assert "users" in d and "teams" in d
        if d["users"]:
            u = d["users"][0]
            for k in ("name", "deadline_changes", "reassigns", "tasks"):
                assert k in u, f"missing {k} in delays.users"


# ---------- RBAC negative ----------
class TestRBACNegative:
    def test_dev_cannot_create_user(self, dev_session):
        r = dev_session.post(f"{API}/users", json={
            "email": "TEST_reject@sems.io", "name": "x", "password": "Password@123", "role": "DEVELOPER"
        })
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_dev_cannot_edit_admin_role(self, dev_session):
        r = dev_session.put(f"{API}/roles/ADMIN", json={"permissions": []})
        assert r.status_code == 403
